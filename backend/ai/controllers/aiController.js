'use strict';

/**
 * AI Controller
 * -------------
 * Thin Express controller layer for AI infrastructure endpoints.
 * Delegates all business logic to AIGateway — controllers contain
 * ZERO provider-specific code.
 *
 * Phase 5.0 Endpoints:
 *   GET  /api/ai/health       — Infrastructure health check (no auth required)
 *   GET  /api/ai/status       — User-facing AI status (authenticated)
 *   POST /api/ai/image/upload — Secure image upload (authenticated, no diagnosis)
 *
 * Note:
 *   - Admin usage stats endpoint is deferred (per modification #3).
 *   - Feature endpoints (diagnosis, recommendation, etc.) are deferred to Phase 5.1+.
 *   - Existing HiFix response convention: { success, message, data }
 */

const path              = require('path');
const { validationResult } = require('express-validator');
const AIGateway         = require('../gateway/AIGateway');
const { promptRegistry } = require('../prompts/promptRegistry');
const AICache           = require('../cache/AICache');
const aiConfig          = require('../config/aiConfig');
const { validateImageFile, scheduleCleanup, deleteImageNow } = require('../utils/imageSanitizer');
const aiLogger          = require('../utils/aiLogger');

// ── Health Check ──────────────────────────────────────────────────────────────

/**
 * GET /api/ai/health
 * Public endpoint — returns infrastructure status without exposing internals.
 * Safe to call from monitoring systems without authentication.
 */
exports.health = async (req, res) => {
  try {
    const health = await AIGateway.health();

    return res.json({
      success: true,
      message: 'AI infrastructure health check',
      data: {
        status:          health.aiEnabled ? 'operational' : 'disabled',
        aiEnabled:       health.aiEnabled,
        cacheEnabled:    health.cacheEnabled,
        provider:        health.provider,
        model:           health.model,
        providerAvailable: health.providerAvailable,
        registeredFeatures: promptRegistry.list().length,
        cacheL1Size:     AICache.l1Size(),
        timestamp:       new Date().toISOString(),
      },
    });
  } catch (err) {
    // Health check must never crash
    return res.status(200).json({
      success: true,
      message: 'AI infrastructure health check',
      data: {
        status:    'degraded',
        aiEnabled: aiConfig.enabled,
        error:     'Health check encountered an internal error',
        timestamp: new Date().toISOString(),
      },
    });
  }
};

// ── User Status ───────────────────────────────────────────────────────────────

/**
 * GET /api/ai/status
 * Authenticated — returns AI availability status for the current user.
 * Does not require AI_ENABLED=true (user can see "disabled" status).
 */
exports.status = async (req, res) => {
  try {
    const features = promptRegistry.list();

    return res.json({
      success: true,
      message: 'AI status retrieved',
      data: {
        aiEnabled:    aiConfig.enabled,
        features:     features.map(f => ({
          id:          f.id,
          description: f.description,
          status:      f.status,
          available:   aiConfig.enabled && f.status === 'active',
        })),
        userRole:     req.user.user_type,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve AI status',
    });
  }
};

const AIImageDiagnosisService = require('../services/AIImageDiagnosisService');

// ── Image Upload (Infrastructure Only) ────────────────────────────────────────

/**
 * POST /api/ai/image/upload
 * Authenticated + rate limited.
 *
 * Phase 5.0: Accepts, validates, and stores the image securely.
 * Returns the upload receipt. Does NOT perform any AI diagnosis.
 */
exports.uploadImage = async (req, res) => {
  // Validate any metadata fields
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Clean up uploaded file on validation failure
    if (req.file) deleteImageNow(req.file.path);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors:  errors.array(),
    });
  }

  // Multer may have rejected the file already (wrong type / too large)
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No image file provided. Include an image under the field name "image".',
    });
  }

  // Application-level file validation (in addition to multer)
  const { valid, error: validationError } = validateImageFile(req.file);
  if (!valid) {
    deleteImageNow(req.file.path);
    return res.status(400).json({
      success: false,
      message: validationError,
    });
  }

  // Schedule automatic cleanup of the temporary file
  scheduleCleanup(req.file.path);

  const context         = req.body.context || null;
  const serviceTypeHint = req.body.serviceTypeHint || null;

  aiLogger.info({
    requestId:  req.aiRequestId,
    feature:    'IMAGE_UPLOAD',
    userId:     req.user ? req.user.id : null,
    status:     'uploaded',
    message:    'AI image upload received and validated',
  });

  return res.status(201).json({
    success: true,
    message: 'Image uploaded successfully. Use /api/ai/image-diagnosis for AI analysis.',
    data: {
      uploadId:       path.basename(req.file.path),
      filename:       req.file.filename,
      size:           req.file.size,
      mimetype:       req.file.mimetype,
      context,
      serviceTypeHint,
      status:         'uploaded',
      diagnosisReady: true,
    },
  });
};

// ── AI Image Diagnosis (Phase 5.1) ───────────────────────────────────────────

/**
 * POST /api/ai/image-diagnosis
 * Authenticated + Rate Limited (Image Tier)
 *
 * Receives an image upload, runs AI vision diagnosis via AIImageDiagnosisService & AIGateway,
 * validates and normalizes output, returns safe preliminary diagnosis with INR costs.
 */
exports.diagnoseImage = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      if (req.file) deleteImageNow(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors:  errors.array(),
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided. Please attach an image under field name "image".',
      });
    }

    const serviceContext  = req.body.serviceContext || req.body.context || '';
    const locationContext = req.body.locationContext || '';

    // Mock test mode parameter (passed in header or body during test runner)
    let mockResult = null;
    if (req.headers['x-ai-mock-diagnosis']) {
      try {
        mockResult = JSON.parse(req.headers['x-ai-mock-diagnosis']);
      } catch (_) {}
    } else if (req.body.mockResult) {
      try {
        mockResult = typeof req.body.mockResult === 'string'
          ? JSON.parse(req.body.mockResult)
          : req.body.mockResult;
      } catch (_) {}
    }

    const result = await AIImageDiagnosisService.diagnose({
      filePath:        req.file.path,
      mimeType:        req.file.mimetype,
      userId:          req.user ? req.user.id : null,
      serviceContext,
      locationContext,
      mockResult,
    });

    if (!result.success) {
      const errCategory = result.error?.category;
      let statusCode = 400;
      if (errCategory === 'RATE_LIMITED') statusCode = 429;
      else if (errCategory === 'AI_DISABLED' || errCategory === 'PROVIDER_UNAVAILABLE') statusCode = 503;
      else if (errCategory === 'TIMEOUT') statusCode = 504;

      return res.status(statusCode).json({
        success: false,
        message: result.error?.message || 'AI diagnosis failed',
        code:    errCategory || 'DIAGNOSIS_FAILED',
        requestId: result.requestId,
      });
    }

    return res.json({
      success: true,
      message: 'AI diagnosis completed successfully',
      data:    result.data,
    });

  } catch (err) {
    if (req.file) deleteImageNow(req.file.path);
    aiLogger.error({ feature: 'IMAGE_DIAGNOSIS', userId: req.user ? req.user.id : null, message: err.message });
    return res.status(500).json({
      success: false,
      message: 'Internal server error during image diagnosis',
    });
  }
};

