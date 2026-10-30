'use strict';

/**
 * AI Controller
 * -------------
 * Thin Express controller layer for AI infrastructure, image diagnosis,
 * optional OCR text extraction, 19-section report generation, and PDF export.
 */

const path              = require('path');
const fs                = require('fs');
const { validationResult } = require('express-validator');
const AIGateway         = require('../gateway/AIGateway');
const { promptRegistry } = require('../prompts/promptRegistry');
const AICache           = require('../cache/AICache');
const aiConfig          = require('../config/aiConfig');
const { validateImageFile, scheduleCleanup, deleteImageNow } = require('../utils/imageSanitizer');
const aiLogger          = require('../utils/aiLogger');
const AIImageDiagnosisService = require('../services/AIImageDiagnosisService');
const AIMaintenanceReportPdfService = require('../services/AIMaintenanceReportPdfService');

// ── Health Check ──────────────────────────────────────────────────────────────

exports.health = async (req, res) => {
  try {
    const health = await AIGateway.health();

    return res.json({
      success: true,
      message: 'AI infrastructure health check',
      data: {
        status:             health.aiEnabled ? 'operational' : 'disabled',
        aiEnabled:          health.aiEnabled,
        cacheEnabled:       health.cacheEnabled,
        provider:           health.provider,
        model:              health.model,
        providerAvailable:  health.providerAvailable,
        registeredFeatures: promptRegistry.list().length,
        cacheL1Size:        AICache.l1Size(),
        timestamp:          new Date().toISOString(),
      },
    });
  } catch (err) {
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

exports.status = async (req, res) => {
  try {
    const features = promptRegistry.list();

    return res.json({
      success: true,
      message: 'AI status retrieved',
      data: {
        aiEnabled: aiConfig.enabled,
        features:  features.map(f => ({
          id:          f.id,
          description: f.description,
          status:      f.status,
          available:   aiConfig.enabled && f.status === 'active',
        })),
        userRole:  req.user.user_type,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve AI status',
    });
  }
};

// ── Image Upload (Infrastructure Only) ────────────────────────────────────────

exports.uploadImage = async (req, res) => {
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
      message: 'No image file provided. Include an image under the field name "image".',
    });
  }

  const { valid, error: validationError } = validateImageFile(req.file);
  if (!valid) {
    deleteImageNow(req.file.path);
    return res.status(400).json({
      success: false,
      message: validationError,
    });
  }

  scheduleCleanup(req.file.path);

  const context         = req.body.context || null;
  const serviceTypeHint = req.body.serviceTypeHint || null;

  aiLogger.info({
    requestId: req.aiRequestId,
    feature:   'IMAGE_UPLOAD',
    userId:    req.user ? req.user.id : null,
    status:    'uploaded',
    message:   'AI image upload received and validated',
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

// ── Optional Image Text / Label Extraction (Phase 3 OCR) ─────────────────────

exports.extractImageText = async (req, res) => {
  try {
    const hasFile = Boolean(req.file);
    const rawBase64 = typeof req.body?.imageBase64 === 'string' && req.body.imageBase64.trim().length > 0
      ? req.body.imageBase64.trim()
      : null;

    if (!hasFile && !rawBase64) {
      return res.status(400).json({
        success: false,
        message: 'No image provided for text extraction.',
      });
    }

    const result = await AIImageDiagnosisService.extractText({
      filePath:    req.file ? req.file.path : null,
      mimeType:    req.file ? req.file.mimetype : (req.body.imageMimeType || 'image/jpeg'),
      imageBase64: rawBase64,
      userId:      req.user ? req.user.id : null,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error?.message || 'Unable to extract text from image.',
        code:    result.error?.category || 'OCR_FAILED',
      });
    }

    const summaryNote =
      result.data?.equipmentSummary ||
      (result.data?.hasReadableText
        ? 'Readable equipment text/labels extracted. You may review or edit below.'
        : 'No readable text or equipment rating plate detected in the photograph. You may proceed directly to report generation.');

    const payload = {
      ...result.data,
      summaryNote,
    };

    return res.json({
      success: true,
      message: 'Image text extraction completed',
      data: {
        ...payload,
        ocr: payload,
      },
    });
  } catch (err) {
    if (req.file) deleteImageNow(req.file.path);
    const fallbackOcr = {
      hasReadableText: false,
      extractedText: '',
      detectedLabels: [],
      ocrUnavailable: true,
      summaryNote: 'Optional text extraction skipped; you may proceed directly to report generation.',
    };
    return res.status(200).json({
      success: true,
      message: 'Optional text extraction skipped',
      data: {
        ...fallbackOcr,
        ocr: fallbackOcr,
      },
    });
  }
};

// ── AI Image Diagnosis & Full 19-Section Report Generation ───────────────────

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

    const rawBase64 = typeof req.body?.imageBase64 === 'string' && req.body.imageBase64.trim().length > 0
      ? req.body.imageBase64.trim()
      : null;

    if (!req.file && !rawBase64) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided. Please attach an image under field name "image".',
      });
    }

    const serviceContext       = req.body.serviceContext || req.body.context || req.body.contextNotes || '';
    const locationContext      = req.body.locationContext || '';
    const propertyType         = req.body.propertyType || '';
    const affectedArea         = req.body.affectedArea || '';
    const extractedText        = req.body.extractedText || '';
    const previousObservations = req.body.previousObservations || '';

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
      filePath:             req.file ? req.file.path : null,
      mimeType:             req.file ? req.file.mimetype : (req.body.imageMimeType || 'image/jpeg'),
      imageBase64:          rawBase64,
      userId:               req.user ? req.user.id : null,
      serviceContext,
      locationContext,
      propertyType,
      affectedArea,
      extractedText,
      previousObservations,
      mockResult,
    });

    if (!result.success) {
      const errCategory = result.error?.category || 'DIAGNOSIS_FAILED';
      const STATUS = {
        QUOTA_EXCEEDED: 503, RATE_LIMITED: 429, AI_DISABLED: 503, PROVIDER_UNAVAILABLE: 503,
        NO_COMPATIBLE_PROVIDER: 503, TIMEOUT: 504, NETWORK_ERROR: 502, PROVIDER_ERROR: 502,
        INVALID_RESPONSE: 502, AUTH_FAILURE: 503, MODEL_NOT_FOUND: 503,
        INVALID_IMAGE: 400, INVALID_REQUEST: 400, SERVICE_ERROR: 500,
      };
      const MESSAGES = {
        QUOTA_EXCEEDED: 'AI diagnosis quota is temporarily exhausted.',
        RATE_LIMITED:   'AI diagnosis is busy. Please try again shortly.',
        TIMEOUT:        'AI diagnosis took too long to respond. Please try again shortly.',
        NETWORK_ERROR:  'The AI service could not be reached. Please try again shortly.',
        INVALID_IMAGE:  result.error?.message,
        INVALID_REQUEST:'The image could not be analysed. Try a clearer JPEG or PNG photo.',
      };
      const attempts = result.error?.attempts || {};
      const retryAfterSec = result.error?.retryAfterSec ?? null;
      if (retryAfterSec) res.set('Retry-After', String(retryAfterSec));

      return res.status(STATUS[errCategory] || 502).json({
        success: false,
        message: MESSAGES[errCategory] || 'AI diagnosis is currently unavailable.',
        code:    errCategory,
        retryAfterSec,
        primaryQuotaExhausted: Boolean(attempts.primaryQuotaExhausted),
        alternativeConfigured: Boolean(attempts.alternativeConfigured),
        alternativeOutcome:    attempts.alternativeOutcome || null,
        requestId: result.requestId,
      });
    }

    return res.json({
      success: true,
      message: 'AI diagnosis and maintenance report completed successfully',
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

// ── PDF Report Generation & Download (Phase 8) ───────────────────────────────

exports.generateReportPdf = async (req, res) => {
  try {
    const reportRefParam = req.params?.reportReference || req.body?.reportReference || req.body?.requestId || null;
    const stored = reportRefParam ? AIImageDiagnosisService.getStoredReport(reportRefParam) : null;

    const reportPayload = req.body?.report || req.body?.diagnosis || stored?.report || stored?.diagnosis || null;
    if (!reportPayload || typeof reportPayload !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Valid report data or reportReference is required to generate a PDF.',
      });
    }

    const imageBase64   = req.body?.imageBase64 || stored?.imageBase64 || null;
    const imageMimeType = req.body?.imageMimeType || stored?.mimeType || 'image/jpeg';

    const pdfBuffer = await AIMaintenanceReportPdfService.generateReportPdf({
      report: reportPayload,
      imageBase64,
      imageMimeType,
    });

    const refClean = String(
      reportPayload.reportReference ||
      reportPayload.report?.reportReference ||
      reportRefParam ||
      `HFX-RPT-${Date.now()}`
    ).replace(/[^a-zA-Z0-9_-]/g, '');
    const filename = `${refClean}.pdf`;

    // Persist a temporary downloadable copy in uploads/ai/reports for mobile link/share support
    const reportsDir = path.join(__dirname, '../../uploads/ai/reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    const pdfFilePath = path.join(reportsDir, filename);
    fs.writeFileSync(pdfFilePath, pdfBuffer);
    scheduleCleanup(pdfFilePath, 2 * 60 * 60 * 1000); // 2 hours

    if (req.query?.format === 'json' || req.body?.returnJson === true) {
      return res.json({
        success: true,
        message: 'Maintenance report PDF generated successfully',
        data: {
          reportReference: refClean,
          filename,
          fileName:        filename,
          sizeBytes:       pdfBuffer.length,
          downloadUrl:     `/uploads/ai/reports/${filename}`,
          apiDownloadUrl:  `/api/ai/report/pdf/${refClean}`,
          pdfBase64:       pdfBuffer.toString('base64'),
        },
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(pdfBuffer.length));
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).end(pdfBuffer);
  } catch (err) {
    aiLogger.error({ feature: 'REPORT_PDF', userId: req.user ? req.user.id : null, message: err.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to generate maintenance report PDF.',
    });
  }
};
