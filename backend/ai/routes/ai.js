'use strict';

/**
 * AI Routes
 * ---------
 * Registers all Phase 5.0 AI infrastructure API endpoints.
 * Mounted in server.js as: app.use('/api/ai', require('./ai/routes/ai'))
 * — but ONLY when AI_ENABLED=true (guard in server.js).
 *
 * Phase 5.0 Endpoints:
 *   GET  /api/ai/health        — Public: AI infrastructure health
 *   GET  /api/ai/status        — Auth: AI status for current user
 *   POST /api/ai/image/upload  — Auth + rate limited: image upload (no diagnosis)
 *
 * Future phase endpoints (Phase 5.1+) will be added here.
 * Existing HiFix routes are NOT modified.
 */

const express    = require('express');
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');
const router     = express.Router();

const aiController  = require('../controllers/aiController');
const { requireAuth, requireAIEnabled } = require('../middleware/aiAuth');
const { aiRateLimiter }  = require('../middleware/aiRateLimiter');
const { validateAIImageUpload, aiImageMulterOptions } = require('../validators/aiImageValidator');

// ── Multer config for AI image uploads ───────────────────────────────────────
// Separate from existing profile/chat upload configs — does NOT modify them.

const AI_UPLOAD_DIR = path.join(__dirname, '../../uploads/ai');

// Ensure upload directory exists at route load time
if (!fs.existsSync(AI_UPLOAD_DIR)) {
  fs.mkdirSync(AI_UPLOAD_DIR, { recursive: true });
}

const aiStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AI_UPLOAD_DIR),
  filename:    (req, file, cb) => {
    const timestamp  = Date.now();
    const userId     = req.user ? req.user.id : 'anon';
    const ext        = path.extname(file.originalname).toLowerCase();
    cb(null, `ai-${userId}-${timestamp}${ext}`);
  },
});

const aiUpload = multer({
  storage:    aiStorage,
  ...aiImageMulterOptions,
});

// ── Route definitions ─────────────────────────────────────────────────────────

/**
 * GET /api/ai/health
 * Public endpoint — no auth required.
 * Returns AI infrastructure operational status.
 * Safe for load balancers, monitoring systems, uptime checks.
 */
router.get('/health', aiController.health);

/**
 * GET /api/ai/status
 * Authenticated — returns AI feature availability for the current user.
 * Does NOT require AI_ENABLED (user can see "disabled" status).
 */
router.get('/status', requireAuth, aiController.status);

/**
 * POST /api/ai/image/upload
 * Authenticated + AI-enabled required + image rate limiting.
 *
 * Phase 5.0: Upload and validate only.
 * Field name: "image" (single file)
 */
router.post(
  '/image/upload',
  requireAuth,           // Must be authenticated
  requireAIEnabled,      // AI must be enabled
  aiRateLimiter({ isImage: true }), // Image-specific rate limit
  aiUpload.single('image'),         // multer processes the file
  validateAIImageUpload,            // Validate metadata fields
  aiController.uploadImage
);

/**
 * POST /api/ai/image-diagnosis
 * Authenticated + AI-enabled required + image rate limiting.
 *
 * Phase 5.1: AI Image Diagnosis endpoint.
 * Accepts image upload, performs vision AI analysis via AIGateway & AIImageDiagnosisService,
 * returns structured diagnosis with INR indicative pricing and safety alerts.
 */
router.post(
  '/image-diagnosis',
  requireAuth,
  requireAIEnabled,
  aiRateLimiter({ isImage: true }),
  aiUpload.single('image'),
  validateAIImageUpload,
  aiController.diagnoseImage
);

// Alias route for convenience
router.post(
  '/image/diagnose',
  requireAuth,
  requireAIEnabled,
  aiRateLimiter({ isImage: true }),
  aiUpload.single('image'),
  validateAIImageUpload,
  aiController.diagnoseImage
);

// ── Multer error handler (image upload specific) ──────────────────────────────
// Handles multer-thrown errors (wrong type, too large) gracefully.
// Must be declared AFTER the routes it covers.
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
  // Pass non-AI errors to the global error handler
  next(err);
});

module.exports = router;
