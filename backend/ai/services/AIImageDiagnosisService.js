'use strict';

/**
 * AI Image Diagnosis & Enterprise Maintenance Report Service
 * ----------------------------------------------------------
 * Core business service for AI-powered property problem diagnosis,
 * optional OCR text/label extraction, and 19-section technical report generation.
 *
 * Responsibilities:
 *   - Preprocess & sanitize uploaded image (JPEG, PNG, WebP)
 *   - Call AIGateway (NEVER calls AI providers directly)
 *   - Validate & normalize structured 19-section maintenance report output
 *   - Enforce INR currency & indicative pricing contract
 *   - Clearly distinguish customer-supplied context, observed visual evidence,
 *     AI-generated technical hypotheses, and recommendations requiring verification
 *   - Support optional non-blocking OCR / equipment label extraction
 *   - Cache validated report + image buffer briefly for PDF generation
 *   - Ensure temporary file cleanup
 */

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const AIGateway = require('../gateway/AIGateway');
const {
  validateImageFile,
  normalizeImageMimeType,
  imageToBase64,
  deleteImageNow,
} = require('../utils/imageSanitizer');
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

const SPECIALIST_TITLES = {
  plumbing:         'Licensed Plumbing & Sanitary Systems Technician',
  electrical:       'Licensed Domestic & Commercial Electrician',
  carpentry:        'Qualified Carpentry & Structural Joinery Specialist',
  painting:         'Surface Finishing, Waterproofing & Coating Specialist',
  cleaning:         'Deep Sanitation & Surface Restoration Specialist',
  appliance_repair: 'Certified Household Appliance Diagnostic Technician',
  ac_repair:        'Certified HVAC & Refrigeration Systems Engineer',
  pest_control:     'Licensed Pest Management & Remediation Technician',
  other:            'Qualified Multi-Trade Property Maintenance Technician',
  unknown:          'Qualified Property Inspection & Maintenance Technician',
};

// High-risk keywords for automatic safety classification
const SAFETY_HAZARD_PATTERNS = [
  /spark/i, /wire/i, /wiring/i, /shock/i, /short circuit/i, /live current/i,
  /switchboard/i, /socket/i, /breaker/i, /mcb/i, /gas/i, /fume/i, /smell/i,
  /leakage/i, /seepage/i, /fire/i, /smoke/i, /burn/i, /scorch/i,
  /structural/i, /collapse/i, /crack/i, /load-bearing/i,
];

const PRELIMINARY_DISCLAIMER =
  'AI analysis is preliminary and based only on visual inspection. Final diagnosis and pricing will be determined by the assigned professional worker.';

const COST_ESTIMATE_DISCLAIMER =
  'All figures are indicative engineering estimates in Indian Rupees (INR), not a binding quotation. Actual costs depend on physical on-site inspection, component specifications, accessibility, and regional labour rates.';

const EVIDENCE_DISTINCTION_NOTICE =
  'This report distinguishes between customer-provided information, direct visual observations from the submitted photograph, AI-generated engineering hypotheses, and remediation steps requiring on-site professional verification.';

// Bounded in-memory store of recent reports (for instant PDF generation with embedded photo)
const _reportStore = new Map(); // reportReference -> { report, diagnosis, imageBase64, mimeType, createdAt }
const REPORT_STORE_MAX = 50;
const REPORT_STORE_TTL_MS = 60 * 60 * 1000; // 1 hour

function formatINRRange(min, max) {
  return `₹${Number(min).toLocaleString('en-IN')} - ₹${Number(max).toLocaleString('en-IN')}`;
}

function generateReportReference() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `HFX-RPT-${yyyy}${mm}${dd}-${suffix}`;
}

function formatReportDate(date = new Date()) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dd = String(date.getDate()).padStart(2, '0');
  const mmm = months[date.getMonth()];
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return {
    iso: date.toISOString(),
    formatted: `${dd} ${mmm} ${yyyy}, ${hh}:${min}`,
  };
}

class AIImageDiagnosisService {
  /**
   * Store a generated report and its image buffer briefly for PDF generation.
   */
  _storeReportArtifact(reportReference, payload) {
    const now = Date.now();
    for (const [k, v] of _reportStore.entries()) {
      if (now - v.createdAt > REPORT_STORE_TTL_MS) _reportStore.delete(k);
    }
    if (_reportStore.size >= REPORT_STORE_MAX) {
      const oldestKey = _reportStore.keys().next().value;
      if (oldestKey) _reportStore.delete(oldestKey);
    }
    _reportStore.set(reportReference, { ...payload, createdAt: now });
  }

  /**
   * Retrieve a stored report artifact by reportReference or requestId.
   */
  getStoredReport(identifier) {
    if (!identifier) return null;
    if (_reportStore.has(identifier)) return _reportStore.get(identifier);
    for (const v of _reportStore.values()) {
      if (v.requestId === identifier) return v;
    }
    return null;
  }

  /**
   * Optional Phase 3 Text Reading / OCR extraction from an uploaded photograph.
   * Never blocks image analysis if OCR fails or no readable text exists.
   */
  async extractText({ filePath, mimeType = 'image/jpeg', imageBase64: rawBase64 = null, userId = null }) {
    let imageBase64 = rawBase64;
    const normalizedMime = normalizeImageMimeType(mimeType, filePath || '');

    try {
      if (!imageBase64) {
        if (!filePath || !fs.existsSync(filePath)) {
          return this._buildErrorResult('INVALID_IMAGE', 'Image file does not exist on server.');
        }
        const fileStats = fs.statSync(filePath);
        const validation = validateImageFile({
          originalname: path.basename(filePath),
          mimetype:     normalizedMime,
          size:         fileStats.size,
          path:         filePath,
        });
        if (!validation.valid) {
          return this._buildErrorResult('INVALID_IMAGE', validation.error);
        }
        imageBase64 = imageToBase64(filePath);
      }

      const gatewayResponse = await AIGateway.request({
        feature:       'IMAGE_DIAGNOSIS',
        userPrompt:    '[OCR_ONLY]',
        imageBase64,
        imageMimeType: normalizedMime,
        userId,
      });

      if (!gatewayResponse.success) {
        // Non-blocking fallback for optional OCR
        return {
          success: true,
          data: {
            hasReadableText: false,
            extractedText: '',
            detectedLabels: [],
            equipmentSummary: 'Automatic text extraction is temporarily unavailable. You may enter any equipment labels or description manually.',
            ocrUnavailable: true,
            disclaimer: 'Readable text extraction is optional and does not block image diagnosis.',
          },
        };
      }

      const raw = gatewayResponse.result || {};
      const extractedText = typeof raw.extractedText === 'string'
        ? raw.extractedText.trim()
        : (typeof raw.readableTextInImage === 'string' ? raw.readableTextInImage.trim() : '');
      const detectedLabels = Array.isArray(raw.detectedLabels)
        ? raw.detectedLabels.filter(l => typeof l === 'string' && l.trim().length > 0).map(l => l.trim())
        : [];
      const hasReadableText = Boolean(extractedText.length > 0 || detectedLabels.length > 0);

      return {
        success: true,
        data: {
          hasReadableText,
          extractedText: extractedText || detectedLabels.join(', '),
          detectedLabels,
          equipmentSummary: typeof raw.equipmentSummary === 'string' && raw.equipmentSummary.trim()
            ? raw.equipmentSummary.trim()
            : (hasReadableText ? 'Readable equipment markings or text detected in photograph.' : 'No legible text or equipment labels detected in the photograph.'),
          provider: gatewayResponse.provider,
          model: gatewayResponse.model,
          requestId: gatewayResponse.requestId,
          disclaimer: 'Extracted text reflects visible labels or markings only and is not treated as proof of a physical defect.',
        },
      };
    } catch (err) {
      aiLogger.warn({ feature: 'IMAGE_DIAGNOSIS', userId, message: `Optional OCR failed: ${err.message}` });
      return {
        success: true,
        data: {
          hasReadableText: false,
          extractedText: '',
          detectedLabels: [],
          equipmentSummary: 'No readable text extracted. You can proceed with image analysis normally.',
          ocrUnavailable: true,
          disclaimer: 'Readable text extraction is optional and does not block image diagnosis.',
        },
      };
    } finally {
      if (filePath && fs.existsSync(filePath)) {
        deleteImageNow(filePath);
      }
    }
  }

  /**
   * Main entry point: Process an image, analyze visual evidence via Gemini Vision
   * (with configured fallback), and generate the complete 19-section maintenance report.
   */
  async diagnose({
    filePath,
    mimeType = 'image/jpeg',
    imageBase64: providedBase64 = null,
    userId,
    serviceContext = '',
    locationContext = '',
    propertyType = '',
    affectedArea = '',
    extractedText = '',
    previousObservations = '',
    mockResult = null,
  }) {
    let imageBase64 = providedBase64;
    const normalizedMime = normalizeImageMimeType(mimeType, filePath || '');

    const contextMetadata = {
      serviceContext:       String(serviceContext || '').trim(),
      locationContext:      String(locationContext || '').trim(),
      propertyType:         String(propertyType || '').trim(),
      affectedArea:         String(affectedArea || '').trim(),
      extractedText:        String(extractedText || '').trim(),
      previousObservations: String(previousObservations || '').trim(),
    };

    try {
      // ── 1. Validation ─────────────────────────────────────────────────────
      if (!mockResult && !imageBase64) {
        if (!filePath || !fs.existsSync(filePath)) {
          return this._buildErrorResult('INVALID_IMAGE', 'Image file does not exist on server.');
        }

        const fileStats = fs.statSync(filePath);
        const fileObj = {
          originalname: path.basename(filePath),
          mimetype:     filePath.endsWith('.gif') ? 'image/gif' : mimeType,
          size:         fileStats.size,
          path:         filePath,
        };

        const validation = validateImageFile(fileObj);
        if (!validation.valid) {
          return this._buildErrorResult('INVALID_IMAGE', validation.error);
        }

        imageBase64 = imageToBase64(filePath);
      }

      // ── 2. Handle Mock Test Mode (Automated Test Suite Only) ──────────────
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

        const normalized = this._normalizeDiagnosis(mockResult, contextMetadata, {
          provider: 'google-gemini',
          model: 'gemini-flash-latest',
          requestId: mockReqId,
        });

        this._storeReportArtifact(normalized.report.reportReference, {
          requestId: mockReqId,
          diagnosis: normalized,
          report: normalized.report,
          imageBase64: imageBase64 || null,
          mimeType: normalizedMime,
        });

        return {
          success: true,
          data: {
            diagnosis: normalized,
            report:    normalized.report,
            requestId: mockReqId,
            mocked:    true,
          },
        };
      }

      // ── 3. Build Structured Multi-Source Prompt Context ───────────────────
      const promptLines = [];
      if (contextMetadata.serviceContext) {
        promptLines.push(`Homeowner Written Description: "${contextMetadata.serviceContext}"`);
      } else {
        promptLines.push('Homeowner Written Description: None provided (rely strictly on visual evidence in the photograph).');
      }
      if (contextMetadata.extractedText) {
        promptLines.push(`Extracted / Reviewed Text or Labels from Image (Metadata only, not proof of defect): "${contextMetadata.extractedText}"`);
      }
      if (contextMetadata.propertyType) {
        promptLines.push(`Property Type: "${contextMetadata.propertyType}"`);
      }
      if (contextMetadata.affectedArea) {
        promptLines.push(`Room / Affected Area: "${contextMetadata.affectedArea}"`);
      }
      if (contextMetadata.locationContext) {
        promptLines.push(`Location Context: "${contextMetadata.locationContext}"`);
      }
      if (contextMetadata.previousObservations) {
        promptLines.push(`Previous Observations / History: "${contextMetadata.previousObservations}"`);
      }

      // ── 4. Call AI Gateway ────────────────────────────────────────────────
      const gatewayResponse = await AIGateway.request({
        feature:       'IMAGE_DIAGNOSIS',
        userPrompt:    promptLines.join('\n'),
        imageBase64,
        imageMimeType: normalizedMime,
        userId,
      });

      if (!gatewayResponse.success) {
        return this._buildErrorResult(
          gatewayResponse.error?.category || 'GATEWAY_ERROR',
          gatewayResponse.error?.message  || 'AI diagnosis failed to complete.',
          gatewayResponse.requestId,
          {
            retryAfterSec: gatewayResponse.error?.retryAfterSec ?? null,
            attempts:      gatewayResponse.error?.attempts ?? null,
          }
        );
      }

      // ── 5. Extract, Validate & Normalize Full 19-Section Report ───────────
      const rawResult = gatewayResponse.result;
      const normalizedDiagnosis = this._normalizeDiagnosis(rawResult, contextMetadata, {
        provider:  gatewayResponse.provider,
        model:     gatewayResponse.model,
        requestId: gatewayResponse.requestId,
        latencyMs: gatewayResponse.latencyMs,
      });

      this._storeReportArtifact(normalizedDiagnosis.report.reportReference, {
        requestId:   gatewayResponse.requestId,
        diagnosis:   normalizedDiagnosis,
        report:      normalizedDiagnosis.report,
        imageBase64: imageBase64 || null,
        mimeType:    normalizedMime,
      });

      return {
        success: true,
        data: {
          diagnosis: normalizedDiagnosis,
          report:    normalizedDiagnosis.report,
          requestId: gatewayResponse.requestId,
          provider:  gatewayResponse.provider,
          model:     gatewayResponse.model,
          latencyMs: gatewayResponse.latencyMs,
        },
      };

    } catch (err) {
      aiLogger.error({ feature: 'IMAGE_DIAGNOSIS', userId, message: err.message });
      return this._buildErrorResult('SERVICE_ERROR', 'Internal error occurred during image diagnosis.');
    } finally {
      // ── 6. Always Cleanup Temp Image ──────────────────────────────────────
      if (filePath && fs.existsSync(filePath)) {
        deleteImageNow(filePath);
      }
    }
  }

  /**
   * Normalize and validate raw model output into both:
   * - Top-level diagnosis fields (backwards-compatible with Phase 5.1 tests & booking bridge)
   * - Complete 19-section enterprise maintenance report (`diagnosis.report`)
   * @private
   */
  _normalizeDiagnosis(raw, contextMeta = {}, meta = {}) {
    const data = (raw && typeof raw === 'object') ? raw : {};
    const userContext = typeof contextMeta === 'string'
      ? contextMeta
      : (contextMeta.serviceContext || '');

    // 1. Problem title & Report title (Section 1)
    const problem = (typeof data.problem === 'string' && data.problem.trim().length > 0)
      ? data.problem.trim()
      : (typeof data.reportTitle === 'string' && data.reportTitle.trim().length > 0
          ? data.reportTitle.trim()
          : (typeof data.raw === 'string' ? data.raw.slice(0, 100) : 'Visual Property Maintenance Issue'));

    const reportTitle = (typeof data.reportTitle === 'string' && data.reportTitle.trim().length > 0)
      ? data.reportTitle.trim()
      : `Technical Maintenance Assessment: ${problem}`;

    // 2. Unique Report Reference (Section 2) & Creation Date (Section 3)
    const reportReference = (typeof data.reportReference === 'string' && /^HFX-RPT-/i.test(data.reportReference))
      ? data.reportReference.trim()
      : generateReportReference();
    const reportDate = formatReportDate(new Date());

    // 3. Category mapping
    let category = (typeof data.category === 'string') ? data.category.toLowerCase().trim() : 'unknown';
    if (!VALID_CATEGORIES.includes(category)) {
      category = 'other';
    }

    // 4. Confidence & Visual Clarity
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

    const visualClarity = (typeof data.visualClarity === 'string' && ['clear', 'moderate', 'limited', 'insufficient'].includes(data.visualClarity.toLowerCase()))
      ? data.visualClarity.toLowerCase()
      : (confidence >= 0.75 ? 'clear' : confidence >= 0.55 ? 'moderate' : 'limited');

    // 5. Urgency & Severity/Priority Assessment (Section 10)
    const validUrgencies = ['low', 'medium', 'high', 'critical'];
    const urgency = (typeof data.urgency === 'string' && validUrgencies.includes(data.urgency.toLowerCase()))
      ? data.urgency.toLowerCase()
      : 'medium';

    const severityMap = {
      low:      { severity: 'Low',      priority: 'Routine' },
      medium:   { severity: 'Moderate', priority: 'Scheduled' },
      high:     { severity: 'High',     priority: 'Urgent' },
      critical: { severity: 'Critical', priority: 'Emergency' },
    };
    const defaultSev = severityMap[urgency] || severityMap.medium;
    const rationaleText = (typeof data.severityAssessment?.rationale === 'string' && data.severityAssessment.rationale.trim().length > 0)
      ? data.severityAssessment.rationale.trim()
      : `Assigned ${defaultSev.severity.toLowerCase()} severity (${defaultSev.priority.toLowerCase()} priority) based on visual condition and potential operational or safety impact.`;
    const severityAndPriority = {
      severity:                  data.severityAssessment?.severity || defaultSev.severity,
      severityLevel:             data.severityAssessment?.severity || defaultSev.severity,
      priority:                  data.severityAssessment?.priority || defaultSev.priority,
      priorityBadge:             String(data.severityAssessment?.priority || defaultSev.priority).toUpperCase(),
      urgencyCode:               urgency,
      rationale:                 rationaleText,
      priorityRationale:         rationaleText,
      recommendedResponseWindow: urgency === 'critical' ? 'Immediate (< 2 hours)' : urgency === 'high' ? 'Within 4–12 hours' : 'Within 24–48 hours',
    };

    // 6. Visible Symptoms & Visual Observations (Section 7)
    const visibleSymptoms = Array.isArray(data.visibleSymptoms) && data.visibleSymptoms.length > 0
      ? data.visibleSymptoms.filter(s => typeof s === 'string' && s.trim().length > 0).map(s => s.trim())
      : (Array.isArray(data.visualObservations) && data.visualObservations.length > 0
          ? data.visualObservations.filter(s => typeof s === 'string' && s.trim().length > 0).map(s => s.trim())
          : ['Visual condition recorded from submitted photograph; on-site inspection required for physical verification.']);

    const visualObservations = Array.isArray(data.visualObservations) && data.visualObservations.length > 0
      ? data.visualObservations.filter(s => typeof s === 'string' && s.trim().length > 0).map(s => s.trim())
      : visibleSymptoms;

    // 7. Property & Affected Area (Section 4)
    const propTypeStr = (typeof contextMeta === 'object' && contextMeta.propertyType) ? contextMeta.propertyType : 'Residential Property';
    const affAreaStr  = (typeof contextMeta === 'object' && contextMeta.affectedArea) ? contextMeta.affectedArea : 'General Inspection Area';
    const locStr      = (typeof contextMeta === 'object' && contextMeta.locationContext) ? contextMeta.locationContext : 'India (Standard Service Region)';
    const propertyAndArea = {
      propertyType: propTypeStr,
      affectedArea: affAreaStr,
      location:     locStr,
      summary:      `${propTypeStr} — ${affAreaStr}`,
    };

    // 8. Customer-Reported Issue & Optional Extracted Text (Section 6)
    const readableTextInImage = (typeof data.readableTextInImage === 'string' && data.readableTextInImage.trim().length > 0)
      ? data.readableTextInImage.trim()
      : ((typeof contextMeta === 'object' && contextMeta.extractedText) ? contextMeta.extractedText : '');

    const customerReportedIssue = {
      description: userContext || 'No written problem description was entered by the homeowner.',
      hasCustomerDescription: Boolean(userContext && userContext.length > 0),
      extractedText: readableTextInImage || null,
      previousObservations: (typeof contextMeta === 'object' && contextMeta.previousObservations) ? contextMeta.previousObservations : null,
      sourceNote: 'Customer-supplied description and extracted label text are recorded as contextual inputs and are distinguished from visual findings.',
    };

    // 9. Executive Summary (Section 5)
    const executiveSummary = (typeof data.executiveSummary === 'string' && data.executiveSummary.trim().length > 0)
      ? data.executiveSummary.trim()
      : `Visual technical assessment of the submitted photograph indicates "${problem}" within the ${category !== 'unknown' ? category.replace('_', ' ') : 'property maintenance'} domain. Observed indicators include: ${visibleSymptoms.slice(0, 2).join('; ')}. On-site verification by a qualified technician is recommended prior to remediation.`;

    // 10. AI Technical Assessment (Section 8)
    const aiAssessment = {
      technicalAnalysis: (typeof data.aiAssessment?.technicalAnalysis === 'string' && data.aiAssessment.technicalAnalysis.trim().length > 0)
        ? data.aiAssessment.technicalAnalysis.trim()
        : `Based on the submitted visual evidence, the condition exhibits characteristics consistent with ${problem.toLowerCase()}. Physical inspection is required to confirm component-level condition.`,
      evidenceBasis: (typeof data.aiAssessment?.evidenceBasis === 'string' && data.aiAssessment.evidenceBasis.trim().length > 0)
        ? data.aiAssessment.evidenceBasis.trim()
        : (userContext
            ? 'Assessment combines direct visual observations from the submitted photograph with the homeowner-supplied problem description.'
            : 'Assessment is derived strictly from direct visual observations of the submitted photograph.'),
      uncertaintyNotes: (typeof data.aiAssessment?.uncertaintyNotes === 'string' && data.aiAssessment.uncertaintyNotes.trim().length > 0)
        ? data.aiAssessment.uncertaintyNotes.trim()
        : 'A 2D photograph cannot confirm internal electrical continuity, concealed piping pressure, or subsurface structural integrity without physical instrument testing.',
      visualClarity,
    };

    // 11. Possible Underlying Causes (Section 9)
    const possibleUnderlyingCauses = Array.isArray(data.possibleCauses) && data.possibleCauses.length > 0
      ? data.possibleCauses.filter(s => typeof s === 'string' && s.trim().length > 0).map(s => s.trim())
      : [
          `Component wear, material fatigue, or localized fault associated with ${problem.toLowerCase()}.`,
          'Concealed connection looseness, seal degradation, or environmental exposure requiring on-site verification.',
        ];

    // 12. Recommended Inspection (Section 11) & Repair Recommendations (Section 12)
    const recommendedAction = (typeof data.recommendedAction === 'string' && data.recommendedAction.trim().length > 0)
      ? data.recommendedAction.trim()
      : `Book a qualified ${category !== 'unknown' ? category.replace('_', ' ') : 'service'} professional for an on-site inspection.`;

    const recommendedInspection = Array.isArray(data.recommendedInspection) && data.recommendedInspection.length > 0
      ? data.recommendedInspection.filter(s => typeof s === 'string' && s.trim().length > 0).map(s => s.trim())
      : [
          `Perform a physical and instrument-assisted inspection of the affected ${propertyAndArea.affectedArea.toLowerCase()} area.`,
          'Verify the condition of adjacent fittings, connections, and isolation points before commencing repair work.',
        ];

    const repairRecommendations = Array.isArray(data.repairRecommendations) && data.repairRecommendations.length > 0
      ? data.repairRecommendations.filter(s => typeof s === 'string' && s.trim().length > 0).map(s => s.trim())
      : [
          recommendedAction,
          'Replace or remediate any damaged components identified during the on-site technical inspection using standard-compliant materials.',
        ];

    // 13. Estimated Duration & Commercial Cost Breakdown in INR (Sections 13, 14, 15)
    const minHours = Math.max(1, parseInt(data.estimatedDuration?.minHours, 10) || 1);
    const maxHours = Math.max(minHours, parseInt(data.estimatedDuration?.maxHours, 10) || (minHours + 1));
    const estimatedDuration = { minHours, maxHours };

    // Total cost
    const rawTotalMin = parseInt(data.estimatedCost?.min, 10);
    const rawTotalMax = parseInt(data.estimatedCost?.max, 10);

    // Material & Labour costs
    const rawMatMin = parseInt(data.estimatedMaterialCosts?.min, 10);
    const rawMatMax = parseInt(data.estimatedMaterialCosts?.max, 10);
    const rawLabMin = parseInt(data.estimatedLabourCosts?.min, 10);
    const rawLabMax = parseInt(data.estimatedLabourCosts?.max, 10);

    let totalMin = Math.max(200, !isNaN(rawTotalMin) ? rawTotalMin : 500);
    let totalMax = Math.max(totalMin, !isNaN(rawTotalMax) ? rawTotalMax : 1500);

    const matMin = !isNaN(rawMatMin) && rawMatMin >= 0 ? rawMatMin : Math.round(totalMin * 0.40);
    const matMax = !isNaN(rawMatMax) && rawMatMax >= matMin ? rawMatMax : Math.round(totalMax * 0.45);
    const labMin = !isNaN(rawLabMin) && rawLabMin >= 100 ? rawLabMin : Math.max(150, totalMin - matMin);
    const labMax = !isNaN(rawLabMax) && rawLabMax >= labMin ? rawLabMax : Math.max(labMin, totalMax - matMax);

    // Keep legacy estimatedCost exact if raw.estimatedCost was provided (for unit test compatibility)
    if (isNaN(rawTotalMin)) totalMin = matMin + labMin;
    if (isNaN(rawTotalMax)) totalMax = matMax + labMax;

    const matItemsNormalized = Array.isArray(data.estimatedMaterialCosts?.items) && data.estimatedMaterialCosts.items.length > 0
      ? data.estimatedMaterialCosts.items.map(it => {
          if (typeof it === 'string') {
            return { item: it.trim(), estimatedRange: formatINRRange(matMin, matMax) };
          }
          return {
            item: String(it.item || 'Replacement parts & consumables').trim(),
            estimatedRange: String(it.estimatedRange || formatINRRange(matMin, matMax)).trim(),
          };
        })
      : [
          {
            item: 'Standard replacement components, fasteners, or sealing consumables (subject to on-site verification)',
            estimatedRange: formatINRRange(matMin, matMax),
          },
        ];

    const estimatedMaterialCosts = {
      min: matMin,
      max: matMax,
      currency: 'INR',
      formatted: formatINRRange(matMin, matMax),
      formattedRange: formatINRRange(matMin, matMax),
      items: matItemsNormalized,
      itemizedMaterials: matItemsNormalized.map(it => `${it.item} (${it.estimatedRange})`),
      notes: 'Indicative material cost band subject to on-site verification.',
    };

    const labourScopeStr = (typeof data.estimatedLabourCosts?.scope === 'string' && data.estimatedLabourCosts.scope.trim().length > 0)
      ? data.estimatedLabourCosts.scope.trim()
      : `On-site inspection, fault isolation, and professional remediation (${minHours}–${maxHours} hours estimated).`;

    const estimatedLabourCosts = {
      min: labMin,
      max: labMax,
      currency: 'INR',
      formatted: formatINRRange(labMin, labMax),
      formattedRange: formatINRRange(labMin, labMax),
      estimatedHours: `${minHours}–${maxHours} Hours`,
      durationObject: estimatedDuration,
      scope: labourScopeStr,
      labourScope: labourScopeStr,
    };

    const estimatedCost = {
      min: totalMin,
      max: totalMax,
      currency: 'INR',
      formatted: formatINRRange(totalMin, totalMax),
      formattedRange: formatINRRange(totalMin, totalMax),
    };

    const estimatedTotalCostRange = {
      ...estimatedCost,
      pricingAssumptions: (typeof data.pricingAssumptions === 'string' && data.pricingAssumptions.trim().length > 0)
        ? data.pricingAssumptions.trim()
        : COST_ESTIMATE_DISCLAIMER,
      costDisclaimer: COST_ESTIMATE_DISCLAIMER,
    };

    // 14. Recommended Service Professional (Section 16)
    const specTitle = (typeof data.recommendedProfessional?.specialistTitle === 'string' && data.recommendedProfessional.specialistTitle.trim().length > 0)
      ? data.recommendedProfessional.specialistTitle.trim()
      : (SPECIALIST_TITLES[category] || SPECIALIST_TITLES.other);
    const qualNotes = (typeof data.recommendedProfessional?.qualificationNotes === 'string' && data.recommendedProfessional.qualificationNotes.trim().length > 0)
      ? data.recommendedProfessional.qualificationNotes.trim()
      : 'Verified HiFix professional equipped with appropriate diagnostic tools and safety gear.';

    const recommendedServiceProfessional = {
      category,
      primaryTrade: specTitle,
      specialistTitle: specTitle,
      qualificationNotes: qualNotes,
      qualificationRequirement: qualNotes,
      estimatedDuration: `${minHours}–${maxHours} Hours`,
    };

    // 15. Safety Precautions & Risk Assessment (Section 17)
    let safetyWarning = (typeof data.safetyWarning === 'string' && data.safetyWarning.trim().length > 0)
      ? data.safetyWarning.trim()
      : null;

    let isSafetyRisk = Boolean(safetyWarning) || urgency === 'critical';

    if (!safetyWarning) {
      const combinedText = `${problem} ${visibleSymptoms.join(' ')} ${category} ${userContext}`.toLowerCase();
      const hazardFound = SAFETY_HAZARD_PATTERNS.some(pattern => pattern.test(combinedText));

      if (hazardFound || category === 'electrical') {
        isSafetyRisk = true;
        safetyWarning = 'SAFETY WARNING: This issue may involve electrical, fire, or structural hazards. Exercise extreme caution, avoid contact with exposed areas, and seek qualified professional help immediately.';
      }
    }

    const safetyPrecautionsList = Array.isArray(data.safetyPrecautions) && data.safetyPrecautions.length > 0
      ? data.safetyPrecautions.filter(s => typeof s === 'string' && s.trim().length > 0).map(s => s.trim())
      : (isSafetyRisk
          ? [
              'Do not touch exposed wiring, damp electrical fixtures, or damaged components with bare hands.',
              'Isolate the relevant main electrical breaker or water supply shut-off valve if safe to do so.',
              'Keep children, pets, and occupants clear of the affected area until a qualified technician completes inspection.',
            ]
          : [
              'Keep the affected work area clear and accessible for the inspecting technician.',
              'Do not attempt internal disassembly without appropriate tools and isolation.',
            ]);

    const primaryWarnStr = safetyWarning || 'Observe standard household safety precautions prior to professional inspection.';
    const safetyPrecautions = {
      isSafetyRisk,
      riskLevel: urgency === 'critical' ? 'Critical' : isSafetyRisk ? 'Elevated' : 'Standard',
      primaryWarning: primaryWarnStr,
      warningSummary: primaryWarnStr,
      precautions: safetyPrecautionsList,
      precautionsList: safetyPrecautionsList,
    };

    // 16. Immediate Next Steps (Section 18)
    const immediateNextSteps = Array.isArray(data.immediateNextSteps) && data.immediateNextSteps.length > 0
      ? data.immediateNextSteps.filter(s => typeof s === 'string' && s.trim().length > 0).map(s => s.trim())
      : [
          isSafetyRisk
            ? 'Safely isolate the affected circuit or supply valve before touching any nearby fixtures.'
            : 'Avoid using the affected fixture or area until on-site inspection is completed.',
          `Schedule an on-site inspection with a ${recommendedServiceProfessional.specialistTitle}.`,
          'Provide this technical report (or downloadable PDF) to the attending professional upon arrival.',
        ];

    // 17. Limitations and Disclaimer (Section 19)
    const limitations = PRELIMINARY_DISCLAIMER;
    const limitationsAndDisclaimer = {
      limitations: (typeof data.limitations === 'string' && data.limitations.trim().length > 0)
        ? data.limitations.trim()
        : PRELIMINARY_DISCLAIMER,
      costDisclaimer: COST_ESTIMATE_DISCLAIMER,
      evidenceDistinctionNotice: EVIDENCE_DISTINCTION_NOTICE,
    };

    // Full 19-Section Structured Enterprise Report Object
    const report = {
      reportTitle,                         // 1. Professional report title
      reportReference,                     // 2. Unique report reference
      reportDate,                          // 3. Report creation date
      propertyAndArea,                     // 4. Property and affected area
      executiveSummary,                    // 5. Executive summary
      customerReportedIssue,               // 6. Customer-reported issue
      extractedText: readableTextInImage,  // Optional OCR extracted text
      visualObservations,                  // 7. Visual observations
      aiAssessment,                        // 8. AI assessment
      possibleUnderlyingCauses,            // 9. Possible underlying causes
      severityAndPriority,                 // 10. Severity and priority assessment
      recommendedInspection,               // 11. Recommended inspection
      repairRecommendations,               // 12. Professional repair recommendations
      estimatedMaterialCosts,              // 13. Estimated material costs
      estimatedLabourCosts,                // 14. Estimated labour costs
      estimatedTotalCostRange,             // 15. Estimated total cost range
      recommendedServiceProfessional,      // 16. Recommended service professional
      safetyPrecautions,                   // 17. Safety precautions
      immediateNextSteps,                  // 18. Immediate next steps
      limitationsAndDisclaimer,            // 19. Limitations and disclaimer
      meta: {
        reportStatus: 'AI_GENERATED',
        provider:     meta.provider || 'google-gemini',
        model:        meta.model || 'gemini-flash-latest',
        requestId:    meta.requestId || null,
        latencyMs:    meta.latencyMs || null,
      },
    };

    return {
      problem,
      reportTitle,
      reportReference,
      reportDate: reportDate.formatted,
      category,
      confidence,
      confidenceLevel,
      visualClarity,
      lowConfidenceNotice,
      urgency,
      readableTextInImage,
      executiveSummary,
      visibleSymptoms,
      visualObservations,
      possibleCauses: possibleUnderlyingCauses,
      recommendedInspection,
      repairRecommendations,
      estimatedDuration,
      estimatedMaterialCosts,
      estimatedLabourCosts,
      estimatedCost,
      recommendedAction,
      recommendedServiceProfessional,
      safetyWarning,
      safetyPrecautions: safetyPrecautionsList,
      immediateNextSteps,
      isSafetyRisk,
      limitations,
      preliminaryNotice: 'AI diagnosis is an assistive assessment only. Final diagnosis and pricing will be determined by the worker.',
      reportStatus: 'AI_GENERATED',
      isSimulated: false,
      report,
    };
  }

  /**
   * Helper to format standardized error results.
   * @private
   */
  _buildErrorResult(category, message, requestId = null, extra = {}) {
    return {
      success: false,
      error: {
        category,
        message,
        retryAfterSec: extra.retryAfterSec ?? null,
        attempts:      extra.attempts ?? null,
      },
      requestId: requestId || `ai_err_${Date.now()}`,
    };
  }
}

module.exports = new AIImageDiagnosisService();
