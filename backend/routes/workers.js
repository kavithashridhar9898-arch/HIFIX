const express = require('express');
const pool = require('../config/database');
const { body, validationResult } = require('express-validator');
const { protect, isWorker } = require('../middleware/auth');
const router = express.Router();

// Calculate distance using Haversine formula (in kilometers)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// @route   GET /api/workers/nearby
// @desc    Find nearby workers based on GPS location
// @access  Private
router.get('/nearby', protect, async (req, res) => {
  try {
    const { latitude, longitude, radius = 10, service_type } = req.query;

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

    // Build query
    let query = `
      SELECT 
        w.id,
        w.user_id,
        w.service_type,
        w.experience_years,
        w.hourly_rate,
        w.min_charge,
        w.bio,
        w.skills,
        w.availability_status,
        w.latitude,
        w.longitude,
        w.address,
        w.city,
        w.state,
        w.zip_code,
        w.license_number,
        w.verified,
        w.total_jobs,
        w.average_rating,
        u.name,
        u.email,
        u.phone,
        u.profile_image,
        (6371 * acos(
          cos(radians(?)) * 
          cos(radians(w.latitude)) * 
          cos(radians(w.longitude) - radians(?)) + 
          sin(radians(?)) * 
          sin(radians(w.latitude))
        )) AS distance
      FROM workers w
      INNER JOIN users u ON w.user_id = u.id
      WHERE w.availability_status = 'available'
        AND w.latitude IS NOT NULL
        AND w.longitude IS NOT NULL
    `;

    const params = [lat, lng, lat];

    if (service_type) {
      query += ' AND w.service_type = ?';
      params.push(service_type);
    }

    query += ` HAVING distance <= ? ORDER BY distance ASC LIMIT 50`;
    params.push(radiusKm);

    const [workers] = await pool.query(query, params);

    // Format response
    const formattedWorkers = workers.map(worker => ({
      id: worker.id,
      userId: worker.user_id,
      name: worker.name,
      email: worker.email,
      phone: worker.phone,
      profileImage: worker.profile_image,
      serviceType: worker.service_type,
      experienceYears: worker.experience_years,
      hourlyRate: parseFloat(worker.hourly_rate) || 0,
      minCharge: parseFloat(worker.min_charge) || 0,
      bio: worker.bio,
      skills: worker.skills,
      availabilityStatus: worker.availability_status,
      location: {
        latitude: parseFloat(worker.latitude),
        longitude: parseFloat(worker.longitude),
        address: worker.address,
        city: worker.city,
        state: worker.state,
        zipCode: worker.zip_code
      },
      licenseNumber: worker.license_number,
      verified: worker.verified === 1,
      totalJobs: worker.total_jobs,
      averageRating: parseFloat(worker.average_rating) || 0,
      distance: parseFloat(worker.distance).toFixed(2)
    }));

    res.json({
      success: true,
      count: formattedWorkers.length,
      workers: formattedWorkers
    });
  } catch (error) {
    console.error('Nearby workers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/workers/:id
// @desc    Get worker details by ID
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const workerId = req.params.id;

    // Get worker info
    const [workers] = await pool.query(
      `SELECT 
        w.*,
        u.name,
        u.email,
        u.phone,
        u.profile_image
      FROM workers w
      INNER JOIN users u ON w.user_id = u.id
      WHERE w.id = ?`,
      [workerId]
    );

    if (workers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    const worker = workers[0];

    // Get reviews
    const [reviews] = await pool.query(
      `SELECT 
        r.*,
        u.name as reviewer_name,
        u.profile_image as reviewer_image
      FROM reviews r
      INNER JOIN users u ON r.reviewer_id = u.id
      WHERE r.worker_id = ?
      ORDER BY r.created_at DESC
      LIMIT 20`,
      [workerId]
    );

    // Get gallery images
    const [gallery] = await pool.query(
      'SELECT * FROM worker_gallery WHERE worker_id = ? ORDER BY created_at DESC',
      [workerId]
    );

    res.json({
      success: true,
      worker: {
        id: worker.id,
        userId: worker.user_id,
        name: worker.name,
        email: worker.email,
        phone: worker.phone,
        profileImage: worker.profile_image,
        serviceType: worker.service_type,
        experienceYears: worker.experience_years,
        hourlyRate: parseFloat(worker.hourly_rate) || 0,
        minCharge: parseFloat(worker.min_charge) || 0,
        bio: worker.bio,
        skills: worker.skills,
        availabilityStatus: worker.availability_status,
        location: {
          latitude: parseFloat(worker.latitude),
          longitude: parseFloat(worker.longitude),
          address: worker.address,
          city: worker.city,
          state: worker.state,
          zipCode: worker.zip_code
        },
        licenseNumber: worker.license_number,
        verified: worker.verified === 1,
        totalJobs: worker.total_jobs,
        averageRating: parseFloat(worker.average_rating) || 0,
        reviews: reviews.map(r => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          reviewerName: r.reviewer_name,
          reviewerImage: r.reviewer_image,
          createdAt: r.created_at
        })),
        gallery: gallery
      }
    });
  } catch (error) {
    console.error('Get worker error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/workers/profile
// @desc    Update worker profile
// @access  Private (Worker only)
router.put('/profile', protect, isWorker, [
  body('service_type').optional().isIn(['painter', 'electrician', 'plumber', 'carpenter', 'handyman', 'other']),
  body('hourly_rate').optional().isNumeric(),
  body('bio').optional().isString()
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
      service_type,
      experience_years,
      hourly_rate,
      min_charge,
      bio,
      skills,
      latitude,
      longitude,
      address,
      city,
      state,
      zip_code,
      license_number,
      availability_status
    } = req.body;

    // Get worker ID
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

    const workerId = workers[0].id;

    // Build update query
    const updates = {};
    if (service_type) updates.service_type = service_type;
    if (experience_years !== undefined) updates.experience_years = experience_years;
    if (hourly_rate !== undefined) updates.hourly_rate = hourly_rate;
    if (min_charge !== undefined) updates.min_charge = min_charge;
    if (bio !== undefined) updates.bio = bio;
    if (skills !== undefined) updates.skills = skills;
    if (latitude !== undefined) updates.latitude = latitude;
    if (longitude !== undefined) updates.longitude = longitude;
    if (address !== undefined) updates.address = address;
    if (city !== undefined) updates.city = city;
    if (state !== undefined) updates.state = state;
    if (zip_code !== undefined) updates.zip_code = zip_code;
    if (license_number !== undefined) updates.license_number = license_number;
    if (availability_status) updates.availability_status = availability_status;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);

    await pool.query(
      `UPDATE workers SET ${setClause} WHERE id = ?`,
      [...values, workerId]
    );

    // Get updated worker
    const [updatedWorkers] = await pool.query(
      `SELECT 
        w.*,
        u.name,
        u.email,
        u.phone,
        u.profile_image
      FROM workers w
      INNER JOIN users u ON w.user_id = u.id
      WHERE w.id = ?`,
      [workerId]
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      worker: updatedWorkers[0]
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/workers/search
// @desc    Search workers by city/state and optional service_type (no GPS required)
// @access  Private
router.get('/search', protect, async (req, res) => {
  try {
    const { city, state, service_type } = req.query;

    if (!city && !state) {
      return res.status(400).json({ success: false, message: 'city or state is required' });
    }

    let query = `
      SELECT 
        w.id,
        w.user_id,
        w.service_type,
        w.experience_years,
        w.hourly_rate,
        w.min_charge,
        w.bio,
        w.skills,
        w.availability_status,
        w.latitude,
        w.longitude,
        w.address,
        w.city,
        w.state,
        w.zip_code,
        w.license_number,
        w.verified,
        w.total_jobs,
        w.average_rating,
        u.name,
        u.email,
        u.phone,
        u.profile_image
      FROM workers w
      INNER JOIN users u ON w.user_id = u.id
      WHERE w.availability_status = 'available'
    `;

    const params = [];
    if (city) {
      query += ' AND LOWER(w.city) LIKE LOWER(?)';
      params.push(`%${city}%`);
    }
    if (state) {
      query += ' AND LOWER(w.state) LIKE LOWER(?)';
      params.push(`%${state}%`);
    }
    if (service_type) {
      query += ' AND w.service_type = ?';
      params.push(service_type);
    }

    query += ' ORDER BY w.total_jobs DESC, w.average_rating DESC LIMIT 50';

    const [rows] = await pool.query(query, params);

    const workers = rows.map(worker => ({
      id: worker.id,
      userId: worker.user_id,
      name: worker.name,
      email: worker.email,
      phone: worker.phone,
      profileImage: worker.profile_image,
      serviceType: worker.service_type,
      experienceYears: worker.experience_years,
      hourlyRate: parseFloat(worker.hourly_rate) || 0,
      minCharge: parseFloat(worker.min_charge) || 0,
      bio: worker.bio,
      skills: worker.skills,
      availabilityStatus: worker.availability_status,
      location: {
        latitude: worker.latitude ? parseFloat(worker.latitude) : null,
        longitude: worker.longitude ? parseFloat(worker.longitude) : null,
        address: worker.address,
        city: worker.city,
        state: worker.state,
        zipCode: worker.zip_code
      },
      licenseNumber: worker.license_number,
      verified: worker.verified === 1,
      totalJobs: worker.total_jobs,
      averageRating: parseFloat(worker.average_rating) || 0,
      distance: null
    }));

    res.json({ success: true, count: workers.length, workers });
  } catch (error) {
    console.error('Search workers error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/workers/location
// @desc    Update worker's current location (for real-time tracking)
// @access  Private (Worker only)
router.put('/location', protect, isWorker, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    // Get worker ID
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

    const workerId = workers[0].id;

    // Update location
    await pool.query(
      'UPDATE workers SET latitude = ?, longitude = ?, updated_at = NOW() WHERE id = ?',
      [latitude, longitude, workerId]
    );

    res.json({
      success: true,
      message: 'Location updated successfully'
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;

