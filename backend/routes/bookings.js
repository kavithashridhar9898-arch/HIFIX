const express = require('express');
const pool = require('../config/database');
const { body, validationResult } = require('express-validator');
const { protect, isHomeowner } = require('../middleware/auth');
const router = express.Router();

const VALID_PAYMENT_STATUSES = new Set(['pending_payment', 'paid', 'payment_failed']);
const VALID_PAYMENT_METHODS = new Set(['none', 'upi', 'mock', 'cash']);

const normalizePaymentStatus = (status) => {
  if (!status || !VALID_PAYMENT_STATUSES.has(status)) {
    return 'pending_payment';
  }
  return status;
};

const normalizePaymentMethod = (method) => {
  if (!method || !VALID_PAYMENT_METHODS.has(method)) {
    return 'none';
  }
  return method;
};

async function recordNotification(req, userId, title, message, type = 'booking', extra = {}) {
  if (!userId) return;
  try {
    await pool.query(
      'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
      [userId, title, message, type]
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${userId}`).emit('notification', {
        title,
        message,
        type,
        ...extra,
      });
    }
  } catch (error) {
    console.warn('Notification dispatch error:', error.message);
  }
}

async function emitBookingEvent(req, userId, eventName, payload) {
  if (!userId) return;
  try {
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${userId}`).emit(eventName, payload);
    }
  } catch (error) {
    console.warn('Socket emit error:', error.message);
  }
}

async function fetchBookingWithRelations(bookingId) {
  const [rows] = await pool.query(
    `SELECT 
        b.*,
        u.name as homeowner_name,
        u.phone as homeowner_phone,
        u.profile_image as homeowner_image,
        w.service_type,
        w.hourly_rate,
        w.average_rating,
        w.user_id as worker_user_id,
        wr.name as worker_name,
        wr.phone as worker_phone,
        wr.profile_image as worker_image,
        r.id as review_id,
        r.rating as review_rating,
        r.comment as review_comment,
        r.created_at as review_created_at
      FROM bookings b
      INNER JOIN users u ON b.homeowner_id = u.id
      INNER JOIN workers w ON b.worker_id = w.id
      INNER JOIN users wr ON w.user_id = wr.id
      LEFT JOIN reviews r ON r.booking_id = b.id AND r.reviewer_id = b.homeowner_id
      WHERE b.id = ?`,
    [bookingId]
  );
  return rows[0] || null;
}

// @route   POST /api/bookings/create
// @desc    Create a new booking from service request
// @access  Private (Homeowner only)
router.post('/create', protect, isHomeowner, [
  body('workerId').isInt().withMessage('Valid worker ID is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('bookingDate').isISO8601().withMessage('Valid booking date is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      workerId,
      description,
      bookingDate,
      serviceType,
      estimatedHours,
      estimatedPrice,
      paymentStatus: requestedPaymentStatus,
      paymentMethod: requestedPaymentMethod,
      paymentAmount: requestedPaymentAmount,
      address,
      latitude,
      longitude
    } = req.body;

    const homeownerId = req.user.id;

    const parsedEstimatedHours = Number.parseFloat(estimatedHours);
    const parsedEstimatedPrice = Number.parseFloat(estimatedPrice);
    const parsedPaymentAmount = Number.parseFloat(requestedPaymentAmount);

    const paymentStatus = normalizePaymentStatus(requestedPaymentStatus);
    const paymentMethod = normalizePaymentMethod(requestedPaymentMethod);
    const paymentAmount = Number.isFinite(parsedPaymentAmount)
      ? Math.max(parsedPaymentAmount, 0)
      : (paymentStatus === 'paid' && Number.isFinite(parsedEstimatedPrice) ? Math.max(parsedEstimatedPrice, 0) : null);

    const addressValue = typeof address === 'string' && address.trim().length > 0
      ? address.trim()
      : 'Address not provided';
    const latitudeValue = Number.isFinite(Number.parseFloat(latitude))
      ? Number.parseFloat(latitude)
      : null;
    const longitudeValue = Number.isFinite(Number.parseFloat(longitude))
      ? Number.parseFloat(longitude)
      : null;

    const bookingStatus = paymentStatus === 'paid' ? 'completed' : 'pending';

    // Verify worker exists
    const [workers] = await pool.query(
      'SELECT id, user_id, availability_status FROM workers WHERE id = ?',
      [workerId]
    );

    if (workers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    if (workers[0].availability_status !== 'available') {
      return res.status(400).json({
        success: false,
        message: 'Worker is not currently available'
      });
    }

    const [result] = await pool.query(
      `INSERT INTO bookings (
        homeowner_id,
        worker_id,
        service_type,
        description,
        booking_date,
        address,
        latitude,
        longitude,
        status,
        estimated_hours,
        estimated_price,
        payment_status,
        payment_method,
        payment_amount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      , [
        homeownerId,
        workerId,
        serviceType || null,
        description,
        bookingDate,
        addressValue,
        latitudeValue,
        longitudeValue,
        bookingStatus,
        Number.isFinite(parsedEstimatedHours) ? parsedEstimatedHours : null,
        Number.isFinite(parsedEstimatedPrice) ? parsedEstimatedPrice : null,
        paymentStatus,
        paymentMethod,
        Number.isFinite(paymentAmount) ? paymentAmount : null
      ]
    );

    const bookingId = result.insertId;

    if (bookingStatus === 'completed') {
      await pool.query('UPDATE bookings SET completed_at = NOW() WHERE id = ?', [bookingId]);
      await pool.query('UPDATE workers SET availability_status = ? WHERE id = ?', ['available', workerId]);
    }

    const booking = await fetchBookingWithRelations(bookingId);

    if (!booking) {
      return res.status(500).json({ success: false, message: 'Failed to load booking after creation' });
    }

    const workerUserId = workers[0].user_id;

    if (bookingStatus === 'completed') {
      const readableAmount = booking.payment_amount || booking.estimated_price || 0;
      const amountDisplay = Number.isFinite(Number(readableAmount)) ? Number(readableAmount).toFixed(2) : readableAmount;
      const methodLabel = paymentMethod === 'mock' ? 'Mock Wallet' : paymentMethod.toUpperCase();

      await recordNotification(
        req,
        workerUserId,
        'Work Completed',
        `Payment of Rs.${amountDisplay} received via ${methodLabel} for ${booking.service_type || 'service'}.`,
        'payment',
        { bookingId }
      );
      await recordNotification(
        req,
        homeownerId,
        'Payment Successful',
        `Payment of Rs.${amountDisplay} to ${booking.worker_name} confirmed.`,
        'payment',
        { bookingId }
      );

      await emitBookingEvent(req, workerUserId, 'booking_completed', { bookingId, booking });
      await emitBookingEvent(req, homeownerId, 'booking_completed', { bookingId, booking });
    } else {
      await recordNotification(
        req,
        workerUserId,
        'New Booking Request',
        `You have a new service request from ${booking.homeowner_name}.`,
        'booking',
        { bookingId }
      );
      await emitBookingEvent(req, workerUserId, 'new_booking', { bookingId, booking });
    }

    res.status(201).json({
      success: true,
      message: bookingStatus === 'completed' ? 'Booking created and marked as completed.' : 'Booking request sent successfully',
      booking
    });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});


// @route   POST /api/bookings
// @desc    Create a new booking
// @access  Private (Homeowner only)
router.post('/', protect, isHomeowner, [
  body('worker_id').isInt().withMessage('Valid worker ID is required'),
  body('booking_date').isISO8601().withMessage('Valid booking date is required'),
  body('address').notEmpty().withMessage('Address is required'),
  body('latitude').isFloat().withMessage('Valid latitude is required'),
  body('longitude').isFloat().withMessage('Valid longitude is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      worker_id,
      service_id,
      booking_date,
      address,
      latitude,
      longitude,
      description,
      estimated_price,
      estimated_hours,
      payment_status: requestedPaymentStatus,
      payment_method: requestedPaymentMethod,
      payment_amount: requestedPaymentAmount
    } = req.body;

    // Verify worker exists
    const [workers] = await pool.query(
      'SELECT id, user_id, availability_status FROM workers WHERE id = ?',
      [worker_id]
    );

    if (workers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    if (workers[0].availability_status !== 'available') {
      return res.status(400).json({
        success: false,
        message: 'Worker is not currently available'
      });
    }

    const parsedEstimatedHours = Number.parseFloat(estimated_hours);
    const parsedEstimatedPrice = Number.parseFloat(estimated_price);
    const parsedPaymentAmount = Number.parseFloat(requestedPaymentAmount);

    const paymentStatus = normalizePaymentStatus(requestedPaymentStatus);
    const paymentMethod = normalizePaymentMethod(requestedPaymentMethod);
    const paymentAmount = Number.isFinite(parsedPaymentAmount)
      ? Math.max(parsedPaymentAmount, 0)
      : (paymentStatus === 'paid' && Number.isFinite(parsedEstimatedPrice) ? Math.max(parsedEstimatedPrice, 0) : null);

    const bookingStatus = paymentStatus === 'paid' ? 'completed' : 'pending';

    // Create booking
    const [result] = await pool.query(
      `INSERT INTO bookings (
        homeowner_id,
        worker_id,
        service_id,
        booking_date,
        address,
        latitude,
        longitude,
        description,
        estimated_price,
        estimated_hours,
        payment_status,
        payment_method,
        payment_amount,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        worker_id,
        service_id || null,
        booking_date,
        address,
        latitude,
        longitude,
        description || null,
        Number.isFinite(parsedEstimatedPrice) ? parsedEstimatedPrice : null,
        Number.isFinite(parsedEstimatedHours) ? parsedEstimatedHours : null,
        paymentStatus,
        paymentMethod,
        Number.isFinite(paymentAmount) ? paymentAmount : null,
        bookingStatus
      ]
    );

    if (bookingStatus === 'completed') {
      await pool.query('UPDATE bookings SET completed_at = NOW() WHERE id = ?', [result.insertId]);
      await pool.query('UPDATE workers SET availability_status = ? WHERE id = ?', ['available', worker_id]);
    }

    const booking = await fetchBookingWithRelations(result.insertId);

    if (!booking) {
      return res.status(500).json({ success: false, message: 'Failed to load booking after creation' });
    }

    const workerUserId = workers[0].user_id;

    if (bookingStatus === 'completed') {
      const readableAmount = booking.payment_amount || booking.estimated_price || 0;
      const amountDisplay = Number.isFinite(Number(readableAmount)) ? Number(readableAmount).toFixed(2) : readableAmount;
      const methodLabel = paymentMethod === 'mock' ? 'Mock Wallet' : paymentMethod.toUpperCase();

      await recordNotification(
        req,
        workerUserId,
        'Work Completed',
        `Payment of Rs.${amountDisplay} received via ${methodLabel} for ${booking.service_type || 'service'}.`,
        'payment',
        { bookingId: booking.id }
      );
      await recordNotification(
        req,
        req.user.id,
        'Payment Successful',
        `Payment of Rs.${amountDisplay} to ${booking.worker_name} confirmed.`,
        'payment',
        { bookingId: booking.id }
      );

      await emitBookingEvent(req, workerUserId, 'booking_completed', { bookingId: booking.id, booking });
      await emitBookingEvent(req, req.user.id, 'booking_completed', { bookingId: booking.id, booking });
    } else {
      await recordNotification(
        req,
        workerUserId,
        'New Booking Request',
        `You have a new service request from ${booking.homeowner_name}.`,
        'booking',
        { bookingId: booking.id }
      );
      await emitBookingEvent(req, workerUserId, 'new_booking', { bookingId: booking.id, booking });
    }

    res.status(201).json({
      success: true,
      message: bookingStatus === 'completed' ? 'Booking created and marked as completed.' : 'Booking created successfully',
      booking
    });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/bookings
// @desc    Get user's bookings
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { status } = req.query;

    let query = '';
    let params = [];

    if (req.user.user_type === 'homeowner') {
      query = `
        SELECT 
          b.*,
          w.service_type,
          wr.name as worker_name,
          wr.phone as worker_phone,
          wr.profile_image as worker_image,
          w.hourly_rate,
          w.average_rating,
          r.id as review_id,
          r.rating as review_rating,
          r.comment as review_comment,
          r.created_at as review_created_at
        FROM bookings b
        INNER JOIN workers w ON b.worker_id = w.id
        INNER JOIN users wr ON w.user_id = wr.id
        LEFT JOIN reviews r ON r.booking_id = b.id AND r.reviewer_id = b.homeowner_id
        WHERE b.homeowner_id = ?
      `;
      params = [req.user.id];
    } else {
      query = `
        SELECT 
          b.*,
          u.name as homeowner_name,
          u.phone as homeowner_phone,
          u.profile_image as homeowner_image,
          w.service_type,
          r.id as review_id,
          r.rating as review_rating,
          r.comment as review_comment,
          r.created_at as review_created_at
        FROM bookings b
        INNER JOIN users u ON b.homeowner_id = u.id
        INNER JOIN workers w ON b.worker_id = w.id
        LEFT JOIN reviews r ON r.booking_id = b.id AND r.reviewer_id = b.homeowner_id
        WHERE b.worker_id = ?
      `;
      // Get worker ID from user ID
      const [workers] = await pool.query(
        'SELECT id FROM workers WHERE user_id = ?',
        [req.user.id]
      );
      if (workers.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Worker profile not found'
        });
      }
      params = [workers[0].id];
    }

    if (status) {
      query += ' AND b.status = ?';
      params.push(status);
    }

    query += ' ORDER BY b.created_at DESC';

    const [bookings] = await pool.query(query, params);

    res.json({
      success: true,
      count: bookings.length,
      bookings
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/bookings/:id/status
// @desc    Update booking status
// @access  Private
router.put('/:id/status', protect, [
  body('status').isIn(['pending', 'accepted', 'in_progress', 'completed', 'cancelled'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const bookingId = req.params.id;
    const { status } = req.body;

    // Get booking
    const [bookings] = await pool.query(
      'SELECT * FROM bookings WHERE id = ?',
      [bookingId]
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const booking = bookings[0];

    // Check authorization
    if (req.user.user_type === 'homeowner') {
      if (booking.homeowner_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized'
        });
      }
      // Homeowners can only cancel
      if (status !== 'cancelled') {
        return res.status(403).json({
          success: false,
          message: 'You can only cancel bookings'
        });
      }
    } else {
      // Worker - get worker ID
      const [workers] = await pool.query(
        'SELECT id FROM workers WHERE user_id = ?',
        [req.user.id]
      );
      if (workers.length === 0 || workers[0].id !== booking.worker_id) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized'
        });
      }
    }

    await pool.query(
      'UPDATE bookings SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, bookingId]
    );

    if (status === 'completed') {
      await pool.query('UPDATE bookings SET completed_at = NOW() WHERE id = ?', [bookingId]);
      await pool.query(
        'UPDATE workers SET availability_status = ? WHERE id = ?',
        ['available', booking.worker_id]
      );
    } else if (status === 'accepted' || status === 'in_progress') {
      await pool.query(
        'UPDATE workers SET availability_status = ? WHERE id = ?',
        ['busy', booking.worker_id]
      );
    }

    const updatedBooking = await fetchBookingWithRelations(bookingId);

    if (status === 'completed' && updatedBooking) {
      await recordNotification(
        req,
        updatedBooking.worker_user_id,
        'Work Completed',
        `Homeowner ${updatedBooking.homeowner_name} marked the booking as completed.`,
        'booking',
        { bookingId }
      );
      await recordNotification(
        req,
        updatedBooking.homeowner_id,
        'Booking Completed',
        `Work by ${updatedBooking.worker_name} is marked as completed.`,
        'booking',
        { bookingId }
      );
      await emitBookingEvent(req, updatedBooking.worker_user_id, 'booking_completed', { bookingId, booking: updatedBooking });
      await emitBookingEvent(req, updatedBooking.homeowner_id, 'booking_completed', { bookingId, booking: updatedBooking });
    }

    if (updatedBooking) {
      await emitBookingEvent(req, updatedBooking.worker_user_id, 'booking_status_updated', {
        bookingId,
        status,
        booking: updatedBooking
      });
      await emitBookingEvent(req, updatedBooking.homeowner_id, 'booking_status_updated', {
        bookingId,
        status,
        booking: updatedBooking
      });
    }

    res.json({
      success: true,
      message: 'Booking status updated',
      booking: updatedBooking || booking
    });
  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/bookings/:id/pay
// @desc    Mark a booking as paid and completed
// @access  Private (Homeowner only)
router.post('/:id/pay', protect, isHomeowner, [
  body('method').isIn(['mock', 'upi', 'cash']).withMessage('Valid payment method is required'),
  body('amount').optional().isFloat({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const bookingId = req.params.id;
    const method = normalizePaymentMethod(req.body.method);
    if (method === 'none') {
      return res.status(400).json({ success: false, message: 'Unsupported payment method' });
    }

    const amountInput = Number.parseFloat(req.body.amount);

    const [rows] = await pool.query(
      `SELECT b.*, w.user_id as worker_user_id
       FROM bookings b
       INNER JOIN workers w ON b.worker_id = w.id
       WHERE b.id = ?`,
      [bookingId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const booking = rows[0];

    if (booking.homeowner_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (booking.payment_status === 'paid') {
      return res.status(400).json({ success: false, message: 'Booking already marked as paid' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot pay for a cancelled booking' });
    }

    const fallbackAmount = Number.isFinite(Number(booking.payment_amount)) ? Number(booking.payment_amount)
      : Number.isFinite(Number(booking.estimated_price)) ? Number(booking.estimated_price)
      : null;
    const amountValue = Number.isFinite(amountInput) ? amountInput : fallbackAmount;
    const sanitizedAmount = Number.isFinite(amountValue) ? Math.max(amountValue, 0) : null;

    await pool.query(
      `UPDATE bookings 
         SET payment_status = 'paid',
             payment_method = ?,
             payment_amount = ?,
             status = 'completed',
             completed_at = NOW(),
             updated_at = NOW()
       WHERE id = ?`,
      [method, sanitizedAmount, bookingId]
    );

    await pool.query(
      'UPDATE workers SET availability_status = ? WHERE id = ?',
      ['available', booking.worker_id]
    );

    const updatedBooking = await fetchBookingWithRelations(bookingId);

    if (!updatedBooking) {
      return res.status(500).json({ success: false, message: 'Failed to load booking after payment' });
    }

    const readableAmount = updatedBooking.payment_amount || updatedBooking.estimated_price || 0;
    const amountDisplay = Number.isFinite(Number(readableAmount)) ? Number(readableAmount).toFixed(2) : readableAmount;
    const methodLabel = method === 'mock' ? 'Mock Wallet' : method.toUpperCase();

    await recordNotification(
      req,
      updatedBooking.worker_user_id,
      'Work Completed',
      `Payment of Rs.${amountDisplay} received via ${methodLabel} for ${updatedBooking.service_type || 'service'}.`,
      'payment',
      { bookingId }
    );
    await recordNotification(
      req,
      updatedBooking.homeowner_id,
      'Payment Successful',
      `Payment of Rs.${amountDisplay} to ${updatedBooking.worker_name} confirmed.`,
      'payment',
      { bookingId }
    );

    await emitBookingEvent(req, updatedBooking.worker_user_id, 'booking_completed', { bookingId, booking: updatedBooking });
    await emitBookingEvent(req, updatedBooking.homeowner_id, 'booking_completed', { bookingId, booking: updatedBooking });

    res.json({
      success: true,
      message: 'Booking marked as paid and completed',
      booking: updatedBooking
    });
  } catch (error) {
    console.error('Booking payment error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @route   POST /api/bookings/:id/review
// @desc    Submit or update a review for a completed booking
// @access  Private (Homeowner only)
router.post('/:id/review', protect, isHomeowner, [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().isLength({ max: 1000 }).withMessage('Comment too long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const bookingId = req.params.id;
    const { rating, comment } = req.body;

    const [rows] = await pool.query(
      `SELECT b.*, w.user_id as worker_user_id
       FROM bookings b
       INNER JOIN workers w ON b.worker_id = w.id
       WHERE b.id = ?`,
      [bookingId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const booking = rows[0];

    if (booking.homeowner_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (booking.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'You can only review completed bookings' });
    }

    const sanitizedComment = typeof comment === 'string' && comment.trim().length > 0 ? comment.trim() : null;

    const [existingReviews] = await pool.query(
      'SELECT id FROM reviews WHERE booking_id = ? AND reviewer_id = ?',
      [bookingId, req.user.id]
    );

    if (existingReviews.length > 0) {
      await pool.query(
        'UPDATE reviews SET rating = ?, comment = ?, created_at = NOW() WHERE id = ?',
        [rating, sanitizedComment, existingReviews[0].id]
      );
    } else {
      await pool.query(
        'INSERT INTO reviews (booking_id, reviewer_id, worker_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
        [bookingId, req.user.id, booking.worker_id, rating, sanitizedComment]
      );
    }

    await pool.query(
      'UPDATE workers SET average_rating = (SELECT IFNULL(ROUND(AVG(rating), 2), 0) FROM reviews WHERE worker_id = ?) WHERE id = ?',
      [booking.worker_id, booking.worker_id]
    );

    const updatedBooking = await fetchBookingWithRelations(bookingId);

    if (!updatedBooking) {
      return res.status(500).json({ success: false, message: 'Failed to load booking after review' });
    }

    const reviewerName = req.user.name || 'A homeowner';

    await recordNotification(
      req,
      booking.worker_user_id,
      'New Review Received',
      `${reviewerName} left a ${rating}-star review.`,
      'booking',
      { bookingId, rating }
    );
    await emitBookingEvent(req, booking.worker_user_id, 'review_added', {
      bookingId,
      rating,
      comment: sanitizedComment,
      booking: updatedBooking
    });
    await emitBookingEvent(req, booking.homeowner_id, 'review_added', {
      bookingId,
      rating,
      comment: sanitizedComment,
      booking: updatedBooking
    });

    res.json({
      success: true,
      message: 'Review submitted successfully',
      booking: updatedBooking
    });
  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @route   GET /api/bookings/:id
// @desc    Get booking details
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const bookingId = req.params.id;

    const booking = await fetchBookingWithRelations(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check authorization
    if (req.user.user_type === 'homeowner' && booking.homeowner_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    } else if (req.user.user_type === 'worker') {
      const [workers] = await pool.query(
        'SELECT id FROM workers WHERE user_id = ?',
        [req.user.id]
      );
      if (workers.length === 0 || workers[0].id !== booking.worker_id) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized'
        });
      }
    }

    res.json({
      success: true,
      booking
    });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/bookings/nearby-requests
// @desc    Get nearby pending service requests for workers
// @access  Private (Worker only)
router.get('/nearby-requests', protect, async (req, res) => {
  try {
    const { latitude, longitude, radius = 10 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const radiusKm = parseFloat(radius);

    if (isNaN(lat) || isNaN(lng) || isNaN(radiusKm)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid latitude, longitude, or radius'
      });
    }

    // Get pending bookings with location data
    const [requests] = await pool.query(
      `SELECT 
        b.*,
        u.name as homeowner_name,
        u.phone as homeowner_phone,
        u.profile_image as homeowner_image,
        w.service_type,
        (6371 * acos(
          cos(radians(?)) * 
          cos(radians(b.latitude)) * 
          cos(radians(b.longitude) - radians(?)) + 
          sin(radians(?)) * 
          sin(radians(b.latitude))
        )) AS distance
      FROM bookings b
      INNER JOIN users u ON b.homeowner_id = u.id
      INNER JOIN workers w ON b.worker_id = w.id
      WHERE b.status = 'pending'
        AND b.latitude IS NOT NULL
        AND b.longitude IS NOT NULL
      HAVING distance <= ?
      ORDER BY distance ASC
      LIMIT 50`,
      [lat, lng, lat, radiusKm]
    );

    const formattedRequests = requests.map(r => ({
      id: r.id,
      homeownerId: r.homeowner_id,
      homeownerName: r.homeowner_name,
      homeownerPhone: r.homeowner_phone,
      homeownerImage: r.homeowner_image,
      workerId: r.worker_id,
      serviceType: r.service_type,
      description: r.description,
      bookingDate: r.booking_date,
      address: r.address,
      latitude: parseFloat(r.latitude),
      longitude: parseFloat(r.longitude),
      estimatedPrice: r.estimated_price,
      status: r.status,
      distance: parseFloat(r.distance).toFixed(2),
      createdAt: r.created_at
    }));

    res.json({
      success: true,
      count: formattedRequests.length,
      requests: formattedRequests
    });
  } catch (error) {
    console.error('Nearby requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;

