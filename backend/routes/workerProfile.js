const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const { protect, isWorker } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

/**
 * Worker Professional Details Routes
 * Base: /api/worker-profile
 *
 * GET  /api/worker-profile/me           — Own professional details (worker only)
 * PUT  /api/worker-profile/professional — Update professional settings (worker only)
 */

// GET /api/worker-profile/me
router.get('/me', protect, isWorker, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT w.id, w.service_type, w.experience_years, w.hourly_rate, w.min_charge,
              w.travel_charge_per_km, w.emergency_charge, w.working_hours, w.service_radius,
              w.bio, w.skills, w.availability_status, w.average_rating, w.total_jobs,
              w.verified, w.license_number,
              u.name, u.email, u.phone, u.profile_image
       FROM workers w
       INNER JOIN users u ON w.user_id = u.id
       WHERE w.user_id = ?`,
      [req.user.id]
    );

    if (rows.length === 0) {
      const err = new Error('Worker profile not found'); err.statusCode = 404; throw err;
    }

    return res.json({ success: true, data: { workerProfile: rows[0] } });
  } catch (err) {
    next(err);
  }
});

// PUT /api/worker-profile/professional
const validateProfessional = [
  body('hourly_rate').optional().isFloat({ min: 1 }).withMessage('hourly_rate must be >= 1'),
  body('min_charge').optional().isFloat({ min: 0 }).withMessage('min_charge must be >= 0'),
  body('travel_charge_per_km').optional().isFloat({ min: 0 }).withMessage('Must be >= 0'),
  body('emergency_charge').optional().isFloat({ min: 0 }).withMessage('Must be >= 0'),
  body('working_hours').optional().isString().isLength({ max: 100 }).trim(),
  body('service_radius').optional().isInt({ min: 1, max: 200 }).withMessage('1–200 km'),
  body('experience_years').optional().isInt({ min: 0, max: 60 }),
  body('bio').optional().isString().isLength({ max: 1000 }).trim(),
  body('skills').optional().isString().isLength({ max: 500 }).trim(),
  body('service_type').optional().isIn(['painter','electrician','plumber','carpenter','handyman','hvac','other']),
];

router.put('/professional', protect, isWorker, validateProfessional, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const err = new Error('Validation failed');
      err.statusCode = 422;
      err.errors = errors.array().map(e => ({ field: e.path || e.param, message: e.msg }));
      throw err;
    }

    const {
      hourly_rate, min_charge, travel_charge_per_km, emergency_charge,
      working_hours, service_radius, experience_years, bio, skills, service_type,
    } = req.body;

    const [workers] = await pool.query('SELECT id FROM workers WHERE user_id = ?', [req.user.id]);
    if (!workers.length) {
      const err = new Error('Worker profile not found'); err.statusCode = 404; throw err;
    }
    const workerId = workers[0].id;

    const updates = {};
    if (hourly_rate           !== undefined) updates.hourly_rate            = parseFloat(hourly_rate);
    if (min_charge            !== undefined) updates.min_charge             = parseFloat(min_charge);
    if (travel_charge_per_km  !== undefined) updates.travel_charge_per_km   = parseFloat(travel_charge_per_km);
    if (emergency_charge      !== undefined) updates.emergency_charge        = parseFloat(emergency_charge);
    if (working_hours         !== undefined) updates.working_hours           = working_hours;
    if (service_radius        !== undefined) updates.service_radius          = parseInt(service_radius);
    if (experience_years      !== undefined) updates.experience_years        = parseInt(experience_years);
    if (bio                   !== undefined) updates.bio                     = bio;
    if (skills                !== undefined) updates.skills                  = skills;
    if (service_type          !== undefined) updates.service_type            = service_type;

    if (!Object.keys(updates).length) {
      const err = new Error('No fields to update'); err.statusCode = 400; throw err;
    }

    const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    await pool.query(`UPDATE workers SET ${setClause} WHERE id = ?`, [...Object.values(updates), workerId]);

    const [updated] = await pool.query(
      `SELECT w.*, u.name, u.email, u.phone, u.profile_image
       FROM workers w INNER JOIN users u ON w.user_id = u.id WHERE w.id = ?`,
      [workerId]
    );

    return res.json({
      success: true,
      message: 'Professional details updated successfully',
      data: { workerProfile: updated[0] },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
