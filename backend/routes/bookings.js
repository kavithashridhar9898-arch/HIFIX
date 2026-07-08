const express = require('express');
const pool = require('../config/database');
const { body, validationResult } = require('express-validator');
const { protect, isHomeowner } = require('../middleware/auth');
const NotificationService = require('../services/NotificationService');
const router = express.Router();

// @route   POST /api/bookings/:id/review
// @desc    Submit a review for a completed booking
// @access  Private (Homeowner only)
router.post('/:id/review', protect, isHomeowner, [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
  body('comment').optional().isString().trim()
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
    const { rating, comment } = req.body;
    const userId = req.user.id;

    // Get booking and check status
    const [bookings] = await pool.query('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    if (bookings.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    const booking = bookings[0];
    if (booking.homeowner_id !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    if (booking.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'You can only review completed bookings' });
    }

    // Check if review already exists for this booking
    const [existing] = await pool.query('SELECT id FROM reviews WHERE booking_id = ?', [bookingId]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Review already submitted for this booking' });
    }

    // Insert review
    await pool.query(
      'INSERT INTO reviews (booking_id, worker_id, reviewer_id, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [bookingId, booking.worker_id, userId, rating, comment || '']
    );

    // Update worker's average rating
    const [ratings] = await pool.query('SELECT AVG(rating) as avgRating FROM reviews WHERE worker_id = ?', [booking.worker_id]);
    const avgRating = ratings[0].avgRating || 0;
    await pool.query('UPDATE workers SET average_rating = ? WHERE id = ?', [avgRating, booking.worker_id]);

    res.json({ success: true, message: 'Review submitted!' });
  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

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
            serviceType
        } = req.body;
        const homeownerId = req.user.id;

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

        const mysqlDate = new Date(bookingDate).toISOString().slice(0, 19).replace('T', ' ');

        // Create booking
        const [result] = await pool.query(
            `INSERT INTO bookings (
                homeowner_id, worker_id, service_type, description, booking_date, status
            ) VALUES (?, ?, ?, ?, ?, 'pending')`,
            [
                homeownerId,
                workerId,
                serviceType,
                description,
                mysqlDate
            ]
        );

        const bookingId = result.insertId;

        // Get created booking with details
        const [bookings] = await pool.query(
            `SELECT 
                b.*,
                u.name as homeowner_name,
                u.phone as homeowner_phone,
                w.service_type,
                wr.name as worker_name,
                wr.phone as worker_phone
            FROM bookings b
            INNER JOIN users u ON b.homeowner_id = u.id
            INNER JOIN workers w ON b.worker_id = w.id
            INNER JOIN users wr ON w.user_id = wr.id
            WHERE b.id = ?`,
            [bookingId]
        );

        const booking = bookings[0];

        // Send notification to worker
        const workerUserId = workers[0].user_id;
        await NotificationService.sendNotification({
            req,
            userId: workerUserId,
            title: 'New Booking Request',
            message: `You have a new service request from ${booking.homeowner_name}`,
            type: 'booking',
            relatedEntityId: bookingId
        });

        res.status(201).json({
            success: true,
            message: 'Booking request sent successfully',
            booking: booking
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
  // address is now optional
  body('latitude').optional().isFloat().withMessage('Valid latitude is required'),
  body('longitude').optional().isFloat().withMessage('Valid longitude is required')
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
      address = null,
      latitude = null,
      longitude = null,
      description = null,
      estimated_price = null
    } = req.body;

    // Verify worker exists
    const [workers] = await pool.query(
      'SELECT id, availability_status FROM workers WHERE id = ?',
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

    const mysqlDate = new Date(booking_date).toISOString().slice(0, 19).replace('T', ' ');

    // Create booking
    const [result] = await pool.query(
      `INSERT INTO bookings (
        homeowner_id, worker_id, service_id, booking_date,
        address, latitude, longitude, description, estimated_price
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        worker_id,
        service_id || null,
        mysqlDate,
        address,
        latitude,
        longitude,
        description,
        estimated_price
      ]
    );

    // Respond with booking created (add your logic here if needed)
    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      bookingId: result.insertId
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
          w.average_rating
        FROM bookings b
        INNER JOIN workers w ON b.worker_id = w.id
        INNER JOIN users wr ON w.user_id = wr.id
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
          w.service_type
        FROM bookings b
        INNER JOIN users u ON b.homeowner_id = u.id
        INNER JOIN workers w ON b.worker_id = w.id
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

    // Update status
    await pool.query(
      'UPDATE bookings SET status = ? WHERE id = ?',
      [status, bookingId]
    );

    // Update worker availability if completed
    if (status === 'completed') {
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

    // Get updated booking
    const [updatedBookings] = await pool.query(
      `SELECT 
        b.*,
        u.name as homeowner_name,
        w.service_type,
        wr.name as worker_name
      FROM bookings b
      INNER JOIN users u ON b.homeowner_id = u.id
      INNER JOIN workers w ON b.worker_id = w.id
      INNER JOIN users wr ON w.user_id = wr.id
      WHERE b.id = ?`,
      [bookingId]
    );

    const updatedBooking = updatedBookings[0];

    // Dispatch Notification based on status
    let notifyUserId, notifyTitle, notifyMessage;
    if (req.user.user_type === 'homeowner' && status === 'cancelled') {
       // Notify Worker
       notifyUserId = updatedBooking.worker_id; // wait, worker_id is the profile ID, we need user_id
       const [w] = await pool.query('SELECT user_id FROM workers WHERE id = ?', [updatedBooking.worker_id]);
       if (w.length > 0) notifyUserId = w[0].user_id;
       notifyTitle = 'Booking Cancelled';
       notifyMessage = `${updatedBooking.homeowner_name} has cancelled the booking.`;
    } else if (req.user.user_type === 'worker') {
       // Notify Homeowner
       notifyUserId = updatedBooking.homeowner_id;
       if (status === 'accepted') {
         notifyTitle = 'Booking Accepted';
         notifyMessage = `${updatedBooking.worker_name} has accepted your booking.`;
       } else if (status === 'in_progress') {
         notifyTitle = 'Worker Arrived / Started';
         notifyMessage = `${updatedBooking.worker_name} has started your service.`;
       } else if (status === 'completed') {
         notifyTitle = 'Service Completed';
         notifyMessage = `${updatedBooking.worker_name} has completed the service.`;
       } else if (status === 'cancelled') {
         notifyTitle = 'Booking Cancelled';
         notifyMessage = `${updatedBooking.worker_name} has cancelled the booking.`;
       }
    }

    if (notifyUserId && notifyTitle) {
      await NotificationService.sendNotification({
        req,
        userId: notifyUserId,
        title: notifyTitle,
        message: notifyMessage,
        type: 'booking',
        relatedEntityId: bookingId
      });
    }

    res.json({
      success: true,
      message: 'Booking status updated',
      booking: updatedBookings[0]
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

// @route   GET /api/bookings/:id
// @desc    Get booking details
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const bookingId = req.params.id;

    const [bookings] = await pool.query(
      `SELECT 
        b.*,
        u.name as homeowner_name,
        u.phone as homeowner_phone,
        u.profile_image as homeowner_image,
        w.service_type,
        w.id as worker_id,
        wr.name as worker_name,
        wr.phone as worker_phone,
        wr.profile_image as worker_image,
        w.hourly_rate,
        w.average_rating
      FROM bookings b
      INNER JOIN users u ON b.homeowner_id = u.id
      INNER JOIN workers w ON b.worker_id = w.id
      INNER JOIN users wr ON w.user_id = wr.id
      WHERE b.id = ?`,
      [bookingId]
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check authorization
    const booking = bookings[0];
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
      booking: bookings[0]
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

