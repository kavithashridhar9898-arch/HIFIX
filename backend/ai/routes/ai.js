'use strict';

/**
 * AI Routes
 * ---------
 * Registers all AI infrastructure, image diagnosis, optional OCR, and
 * maintenance report PDF generation endpoints.
 */

const express    = require('express');
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');
const jwt        = require('jsonwebtoken');
const router     = express.Router();

const aiController  = require('../controllers/aiController');
const { requireAuth, requireAIEnabled } = require('../middleware/aiAuth');
const { aiRateLimiter }  = require('../middleware/aiRateLimiter');
const { validateAIImageUpload, aiImageMulterOptions } = require('../validators/aiImageValidator');

// Non-blocking optional auth for OCR & PDF download routes (e.g. external browser PDF open)
function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded && decoded.id) {
        req.user = { id: decoded.id };
      }
    }
  } catch (_) {
    // Proceed as anonymous / guest for non-protected auxiliary endpoints
  }
  return next();
}

const AI_UPLOAD_DIR = path.join(__dirname, '../../uploads/ai');

if (!fs.existsSync(AI_UPLOAD_DIR)) {
  fs.mkdirSync(AI_UPLOAD_DIR, { recursive: true });
}

const aiStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AI_UPLOAD_DIR),
  filename:    (req, file, cb) => {
    const timestamp = Date.now();
    const userId    = req.user ? req.user.id : 'anon';
    const rawExt    = path.extname(file.originalname || '').toLowerCase();
    const ext       = rawExt || '.jpg';
    cb(null, `ai-${userId}-${timestamp}${ext}`);
  },
});

const aiUpload = multer({
  storage: aiStorage,
  ...aiImageMulterOptions,
});

// Optional multer wrapper that only invokes multer when Content-Type is multipart/form-data
function optionalMultipartImage(req, res, next) {
  const ct = String(req.headers['content-type'] || '').toLowerCase();
  if (ct.includes('multipart/form-data')) {
    return aiUpload.single('image')(req, res, next);
  }
  return next();
}

// ── Route definitions ─────────────────────────────────────────────────────────

/**
 * GET /api/ai/health
 * Public endpoint — no auth required.
 */
router.get('/health', aiController.health);

/**
 * GET /api/ai/status
 * Authenticated — returns AI feature availability for the current user.
 */
router.get('/status', requireAuth, aiController.status);

/**
 * POST /api/ai/image/upload
 * Authenticated + AI-enabled required + image rate limiting.
 */
router.post(
  '/image/upload',
  requireAuth,
  requireAIEnabled,
  aiRateLimiter({ isImage: true }),
  aiUpload.single('image'),
  validateAIImageUpload,
  aiController.uploadImage
);

/**
 * POST /api/ai/image-ocr
 * Optional non-blocking text/label reading from uploaded photograph.
 */
router.post(
  '/image-ocr',
  optionalAuth,
  requireAIEnabled,
  optionalMultipartImage,
  aiController.extractImageText
);

/**
 * POST /api/ai/image-diagnosis
 * Authenticated + AI-enabled required + image rate limiting.
 * Accepts multipart image or base64 payload, runs Gemini Vision (with OpenRouter fallback),
 * and returns the validated 19-section maintenance report.
 */
router.post(
  '/image-diagnosis',
  requireAuth,
  requireAIEnabled,
  aiRateLimiter({ isImage: true }),
  optionalMultipartImage,
  validateAIImageUpload,
  aiController.diagnoseImage
);

// Alias route for convenience
router.post(
  '/image/diagnose',
  requireAuth,
  requireAIEnabled,
  aiRateLimiter({ isImage: true }),
  optionalMultipartImage,
  validateAIImageUpload,
  aiController.diagnoseImage
);

/**
 * POST /api/ai/report/pdf
 * Generates and downloads (or returns JSON metadata for) the consultancy-grade
 * maintenance report PDF from validated report data.
 */
router.post(
  '/report/pdf',
  optionalAuth,
  aiController.generateReportPdf
);

/**
 * GET /api/ai/report/pdf/:reportReference
 * Direct download of a recently generated report PDF by reference.
 */
router.get(
  '/report/pdf/:reportReference',
  optionalAuth,
  aiController.generateReportPdf
);

// ── Multer error handler (image upload specific) ──────────────────────────────
router.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: `Image file too large. Maximum size is ${process.env.AI_IMAGE_MAX_SIZE_MB || 10}MB.`,
    });
  }
  if (err && err.message && err.message.includes('File type not allowed')) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  next(err);
});

module.exports = router;
