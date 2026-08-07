const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const { validationResult } = require('express-validator');
const { protect, isWorker } = require('../middleware/auth');
const WorkTimerService = require('../services/WorkTimerService');
const {
  validateStartTimer,
  validateTimerAction,
  validateGetSession,
} = require('../validators/timerValidator');

/**
 * Work Timer Routes
 * Base: /api/work-timer
 *
 * POST /api/work-timer/start           — Start timer (worker, booking must be accepted/in_progress)
 * POST /api/work-timer/pause           — Pause active timer
 * POST /api/work-timer/resume          — Resume paused timer
 * POST /api/work-timer/complete        — Lock timer permanently
 * GET  /api/work-timer/:bookingId      — Get session state
 */

function checkValidation(req, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const err = new Error('Validation failed');
    err.statusCode = 422;
    err.errors = errors.array().map(e => ({ field: e.path || e.param, message: e.msg }));
    throw err;
  }
}

async function getWorkerProfileId(userId) {
  const [rows] = await pool.query('SELECT id FROM workers WHERE user_id = ?', [userId]);
  if (!rows.length) {
    const err = new Error('Worker profile not found'); err.statusCode = 404; throw err;
  }
  return rows[0].id;
}

// POST /api/work-timer/start
router.post('/start', protect, isWorker, validateStartTimer, async (req, res, next) => {
  try {
    checkValidation(req, next);
    const workerId = await getWorkerProfileId(req.user.id);
    const session  = await WorkTimerService.startTimer({
      bookingId: parseInt(req.body.booking_id),
      workerId,
    });
    return res.status(201).json({
      success: true, message: 'Timer started', data: { session },
    });
  } catch (err) { next(err); }
});

// POST /api/work-timer/pause
router.post('/pause', protect, isWorker, validateTimerAction, async (req, res, next) => {
  try {
    checkValidation(req, next);
    const workerId = await getWorkerProfileId(req.user.id);
    const session  = await WorkTimerService.pauseTimer({
      bookingId: parseInt(req.body.booking_id),
      workerId,
    });
    return res.json({ success: true, message: 'Timer paused', data: { session } });
  } catch (err) { next(err); }
});

// POST /api/work-timer/resume
router.post('/resume', protect, isWorker, validateTimerAction, async (req, res, next) => {
  try {
    checkValidation(req, next);
    const workerId = await getWorkerProfileId(req.user.id);
    const session  = await WorkTimerService.resumeTimer({
      bookingId: parseInt(req.body.booking_id),
      workerId,
    });
    return res.json({ success: true, message: 'Timer resumed', data: { session } });
  } catch (err) { next(err); }
});

// POST /api/work-timer/complete
router.post('/complete', protect, isWorker, validateTimerAction, async (req, res, next) => {
  try {
    checkValidation(req, next);
    const workerId = await getWorkerProfileId(req.user.id);
    const session  = await WorkTimerService.completeTimer({
      bookingId: parseInt(req.body.booking_id),
      workerId,
    });
    return res.json({ success: true, message: 'Work completed and timer locked', data: { session } });
  } catch (err) { next(err); }
});

// GET /api/work-timer/:bookingId
router.get('/:bookingId', protect, validateGetSession, async (req, res, next) => {
  try {
    checkValidation(req, next);

    let workerId = null;
    if (req.user.user_type === 'worker') {
      const [rows] = await pool.query('SELECT id FROM workers WHERE user_id = ?', [req.user.id]);
      workerId = rows.length ? rows[0].id : null;
    }

    const session = await WorkTimerService.getSession({
      bookingId: parseInt(req.params.bookingId),
      workerId,
    });

    if (!session) {
      return res.json({ success: true, data: { session: null } });
    }
    return res.json({ success: true, data: { session } });
  } catch (err) { next(err); }
});

module.exports = router;
