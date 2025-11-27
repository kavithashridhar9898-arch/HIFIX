const jwt = require('jsonwebtoken');
const pool = require('../config/database');

// Verify JWT token
exports.protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from database
      const [users] = await pool.query(
        'SELECT id, name, email, phone, user_type, profile_image FROM users WHERE id = ?',
        [decoded.id]
      );

      if (users.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      req.user = users[0];
      next();
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Check if user is a worker
exports.isWorker = (req, res, next) => {
  if (req.user && req.user.user_type === 'worker') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Access denied. Worker privileges required.'
    });
  }
};

// Check if user is a homeowner
exports.isHomeowner = (req, res, next) => {
  if (req.user && req.user.user_type === 'homeowner') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Access denied. Homeowner privileges required.'
    });
  }
};

