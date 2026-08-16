'use strict';

/**
 * AI Image Diagnosis Service
 * --------------------------
 * Core business service for AI-powered home service problem diagnosis.
 *
 * Responsibilities:
 *   - Preprocess & sanitize upload image
 *   - Call AIGateway (NEVER calls AI providers directly)
 *   - Validate & normalize structured diagnosis output
 *   - Enforce INR currency & indicative pricing contract
 *   - Apply safety hazard rules & disclaimers
 *   - Support mock mode for deterministic automated testing
 *   - Ensure temporary file cleanup
 *
 * Safety Contract:
 *   - AI diagnosis is strictly assistive and preliminary.
 *   - Final diagnosis and authoritative pricing are determined on-site by the professional.
 */

const fs   = require('fs');
const path = require('path');
const AIGateway = require('../gateway/AIGateway');
const { validateImageFile, imageToBase64, deleteImageNow } = require('../utils/imageSanitizer');
const aiLogger = require('../utils/aiLogger');
const AIUsageTracker = require('../monitoring/AIUsageTracker');

// HiFix Service Category Allowlist
const VALID_CATEGORIES = [
  'plumbing',
  'electrical',
  'carpentry',
  'painting',
  'cleaning',
  'appliance_repair',
  'ac_repair',
  'pest_control',
  'other',
  'unknown',
];

// High-risk keywords for automatic safety classification
const SAFETY_HAZARD_PATTERNS = [
  /spark/i, /wire/i, /shock/i, /short circuit/i, /live current/i,
  /gas/i, /fume/i, /smell/i, /leakage/i, /fire/i, /smoke/i, /burn/i,
  /structural/i, /collapse/i, /crack/i, /load-bearing/i,
];

const PRELIMINARY_DISCLAIMER =
  'AI analysis is preliminary and based only on visual inspection. Final diagnosis and pricing will be determined by the assigned professional worker.';

class AIImageDiagnosisService {
  /**
   * Main entry point: Process an image and generate a structured diagnosis.
   *
   * @param {object} params
   * @param {string}   params.filePath       - Absolute path to uploaded image
   * @param {string}   [params.mimeType]     - MIME type of image
   * @param {number}   [params.userId]       - Authenticated user ID
   * @param {string}   [params.serviceContext]- Optional notes from user
   * @param {string}   [params.locationContext]- Optional location string
   * @param {object}   [params.mockResult]   - Mock response for automated test mode
   * @returns {Promise<object>} Structured diagnosis result
   */
  async diagnose({ filePath, mimeType = 'image/jpeg', userId, serviceContext = '', locationContext = '', mockResult = null }) {
    let imageBase64 = null;

    try {
      // ── 1. Validation ─────────────────────────────────────────────────────
      if (!mockResult) {
        if (!filePath || !fs.existsSync(filePath)) {
          return this._buildErrorResult('INVALID_IMAGE', 'Image file does not exist on server.');
        }

        const fileStats = fs.statSync(filePath);
        const fileObj = {
          originalname: path.basename(filePath),
          mimetype:     mimeType,
          size:         fileStats.size,
          path:         filePath,
        };

        const validation = validateImageFile(fileObj);
        if (!validation.valid) {
          return this._buildErrorResult('INVALID_IMAGE', validation.error);
        }

        // Convert image to base64 for Vision API
        imageBase64 = imageToBase64(filePath);
      }

      // ── 2. Handle Mock Test Mode ──────────────────────────────────────────
      if (mockResult) {
        aiLogger.info({ feature: 'IMAGE_DIAGNOSIS', userId, message: 'Executing mock diagnosis' });
        const mockReqId = `ai_mock_diag_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await AIUsageTracker.record({
          requestId: mockReqId,
          userId:    userId || null,
          feature:   'IMAGE_DIAGNOSIS',
          provider:  'google-gemini',
          model:     'gemini-flash-latest',
          status:    'success',
          latencyMs: 150,
        }).catch(() => {});

        return {
          success: true,
          data: {
            diagnosis: this._normalizeDiagnosis(mockResult, serviceContext),
            requestId: mockReqId,
            mocked:    true,
          },
        };
      }

      // ── 3. Call AI Gateway ────────────────────────────────────────────────
      const gatewayResponse = await AIGateway.request({
        feature:       'IMAGE_DIAGNOSIS',
        userPrompt:    serviceContext,
        imageBase64,
        imageMimeType: mimeType,
        userId,
      });

      if (!gatewayResponse.success) {
        return this._buildErrorResult(
          gatewayResponse.error?.category || 'GATEWAY_ERROR',
          gatewayResponse.error?.message  || 'AI diagnosis failed to complete.',
          gatewayResponse.requestId
        );
      }

      // ── 4. Extract & Normalize Output ────────────────────────────────────
      const rawResult = gatewayResponse.result;
      const normalizedDiagnosis = this._normalizeDiagnosis(rawResult, serviceContext);

      return {
        success: true,
        data: {
          diagnosis: normalizedDiagnosis,
          requestId: gatewayResponse.requestId,
          provider:  gatewayResponse.provider,
          model:      gatewayResponse.model,
          latencyMs: gatewayResponse.latencyMs,
        },
      };

    } catch (err) {
      aiLogger.error({ feature: 'IMAGE_DIAGNOSIS', userId, message: err.message });
      return this._buildErrorResult('SERVICE_ERROR', 'Internal error occurred during image diagnosis.');
    } finally {
      // ── 5. Always Cleanup Temp Image ──────────────────────────────────────
      if (filePath && fs.existsSync(filePath)) {
        deleteImageNow(filePath);
      }
    }
  }

  /**
   * Normalize and validate raw model output to guarantee safe structure.
   * @private
   */
  _normalizeDiagnosis(raw, userContext = '') {
    const data = (raw && typeof raw === 'object') ? raw : {};

    // 1. Problem title
    const problem = (typeof data.problem === 'string' && data.problem.trim().length > 0)
      ? data.problem.trim()
      : (typeof data.raw === 'string' ? data.raw.slice(0, 100) : 'Visual Home Issue');

    // 2. Category mapping
    let category = (typeof data.category === 'string') ? data.category.toLowerCase().trim() : 'unknown';
    if (!VALID_CATEGORIES.includes(category)) {
      category = 'other';
    }

    // 3. Confidence calculation (0.00 to 1.00)
    let confidence = parseFloat(data.confidence);
    if (isNaN(confidence) || confidence < 0) confidence = 0.50;
    if (confidence > 1.0) confidence = 1.00;
    confidence = Math.round(confidence * 100) / 100;

    let confidenceLevel = 'low';
    let lowConfidenceNotice = null;

    if (confidence >= 0.90 && category !== 'unknown') {
      confidenceLevel = 'high';
    } else if (confidence >= 0.70 && category !== 'unknown') {
      confidenceLevel = 'moderate';
    } else {
      confidenceLevel = 'low';
      lowConfidenceNotice = 'Unable to confidently identify the problem. Please upload a clearer photo showing the affected area.';
    }

    // 4. Urgency
    const validUrgencies = ['low', 'medium', 'high', 'critical'];
    const urgency = (typeof data.urgency === 'string' && validUrgencies.includes(data.urgency.toLowerCase()))
      ? data.urgency.toLowerCase()
      : 'medium';

    // 5. Visible Symptoms
    const visibleSymptoms = Array.isArray(data.visibleSymptoms)
      ? data.visibleSymptoms.filter(s => typeof s === 'string' && s.trim().length > 0).map(s => s.trim())
      : ['Visual defect detected in image'];

    // 6. Estimated Duration
    const minHours = Math.max(1, parseInt(data.estimatedDuration?.minHours, 10) || 1);
    const maxHours = Math.max(minHours, parseInt(data.estimatedDuration?.maxHours, 10) || (minHours + 1));
    const estimatedDuration = { minHours, maxHours };

    // 7. Estimated Cost (Strict INR)
    const minCost = Math.max(200, parseInt(data.estimatedCost?.min, 10) || 500);
    const maxCost = Math.max(minCost, parseInt(data.estimatedCost?.max, 10) || 1500);
    const estimatedCost = {
      min: minCost,
      max: maxCost,
      currency: 'INR', // Mandatory INR
      formatted: `₹${minCost.toLocaleString('en-IN')} - ₹${maxCost.toLocaleString('en-IN')}`,
    };

    // 8. Recommended Action
    const recommendedAction = (typeof data.recommendedAction === 'string' && data.recommendedAction.trim().length > 0)
      ? data.recommendedAction.trim()
      : `Book a qualified ${category !== 'unknown' ? category : 'service'} professional for an on-site inspection.`;

    // 9. Safety Warning & Risk Assessment
    let safetyWarning = (typeof data.safetyWarning === 'string' && data.safetyWarning.trim().length > 0)
      ? data.safetyWarning.trim()
      : null;

    let isSafetyRisk = Boolean(safetyWarning) || urgency === 'critical';

    // Automatic keyword hazard detection if safetyWarning wasn't explicitly populated
    if (!safetyWarning) {
      const combinedText = `${problem} ${visibleSymptoms.join(' ')} ${category} ${userContext}`.toLowerCase();
      const hazardFound = SAFETY_HAZARD_PATTERNS.some(pattern => pattern.test(combinedText));

      if (hazardFound || category === 'electrical') {
        isSafetyRisk = true;
        safetyWarning = 'SAFETY WARNING: This issue may involve electrical, fire, or structural hazards. Exercise extreme caution, avoid contact with exposed areas, and seek qualified professional help immediately.';
      }
    }

    // 10. Limitations & Disclaimer
    const limitations = PRELIMINARY_DISCLAIMER;

    return {
      problem,
      category,
      confidence,
      confidenceLevel,
      lowConfidenceNotice,
      urgency,
      visibleSymptoms,
      estimatedDuration,
      estimatedCost,
      recommendedAction,
      safetyWarning,
      isSafetyRisk,
      limitations,
      preliminaryNotice: 'AI diagnosis is an assistive assessment only. Final diagnosis and pricing will be determined by the worker.',
    };
  }

  /**
   * Helper to format standardized error results.
   * @private
   */
  _buildErrorResult(category, message, requestId = null) {
    return {
      success: false,
      error: {
        category,
        message,
      },
      requestId: requestId || `ai_err_${Date.now()}`,
    };
  }
}

module.exports = new AIImageDiagnosisService();
