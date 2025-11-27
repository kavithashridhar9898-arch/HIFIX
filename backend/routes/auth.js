const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { sendOTPEmail } = require('../config/email');
const router = express.Router();

// Store OTPs temporarily (in production, use Redis or database)
const otpStore = new Map();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/profiles');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d'
  });
};

// @route   POST /api/auth/register
// @desc    Register a new user (homeowner or worker)
// @access  Public
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('user_type').isIn(['homeowner', 'worker']).withMessage('Invalid user type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { name, email, phone, password, user_type } = req.body;

    // Check if user already exists
    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user
    const [result] = await pool.query(
      'INSERT INTO users (name, email, phone, password, user_type) VALUES (?, ?, ?, ?, ?)',
      [name, email, phone, hashedPassword, user_type]
    );

    const userId = result.insertId;

    // If worker, create worker profile
    if (user_type === 'worker') {
      await pool.query(
        'INSERT INTO workers (user_id, service_type, availability_status) VALUES (?, ?, ?)',
        [userId, req.body.service_type || 'other', 'available']
      );
    }

    // Get user data
    const [users] = await pool.query(
      'SELECT id, name, email, phone, user_type, profile_image FROM users WHERE id = ?',
      [userId]
    );

    const token = generateToken(userId);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: users[0]
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    console.log('🔑 Login attempt:', req.body.email, req.body.password);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user
    const [users] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = users[0];
    console.log('🔍 User found:', user.email, 'Hashed:', user.password);

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('🔒 bcrypt.compare result:', isMatch);
    if (!isMatch) {
      console.log('❌ Password mismatch for', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Remove password from response
    delete user.password;

    const token = generateToken(user.id);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        user_type: user.user_type,
        profile_image: user.profile_image
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: error.message
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', require('../middleware/auth').protect, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, name, email, phone, user_type, profile_image, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: users[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/auth/upload-profile-image
// @desc    Upload profile image
// @access  Private
router.post('/upload-profile-image', 
  require('../middleware/auth').protect,
  upload.single('profile_image'),
  async (req, res) => {
    try {
      console.log('📤 Upload request received');
      console.log('User:', req.user);
      console.log('File:', req.file);
      console.log('Body:', req.body);
      
      if (!req.file) {
        console.log('❌ No file in request');
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      // Construct the image URL (adjust based on your server setup)
      const imageUrl = `/uploads/profiles/${req.file.filename}`;
      console.log('✅ Image saved:', imageUrl);

      // Update user's profile_image in database
      await pool.query(
        'UPDATE users SET profile_image = ? WHERE id = ?',
        [imageUrl, req.user.id]
      );

      // Delete old image if it exists
      const [users] = await pool.query(
        'SELECT profile_image FROM users WHERE id = ?',
        [req.user.id]
      );

      if (users.length > 0 && users[0].profile_image && users[0].profile_image !== imageUrl) {
        const oldImagePath = path.join(__dirname, '..', users[0].profile_image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
          console.log('🗑️  Old image deleted');
        }
      }

      console.log('✅ Upload complete');
      res.json({
        success: true,
        message: 'Profile image uploaded successfully',
        imageUrl: imageUrl
      });
    } catch (error) {
      console.error('❌ Upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to upload image',
        error: error.message
      });
    }
  }
);

// @route   POST /api/auth/request-password-otp
// @desc    Request OTP for password change
// @access  Private
router.post('/request-password-otp', require('../middleware/auth').protect, async (req, res) => {
  try {
    console.log('📧 OTP request from user:', req.user.id);

    // Get user details
    const [users] = await pool.query(
      'SELECT id, name, email FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP with expiry (10 minutes)
    const otpData = {
      otp,
      userId: user.id,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      attempts: 0
    };
    otpStore.set(user.id, otpData);

    console.log('🔐 Generated OTP for user', user.id, ':', otp);

    // Send OTP email
    const emailResult = await sendOTPEmail(user.email, otp, user.name);

    // Check if user has email notifications enabled
    const [notificationSettings] = await pool.query(
      'SELECT email_notifications FROM notification_settings WHERE user_id = ?',
      [user.id]
    );

    // Create in-app notification about OTP
    if (notificationSettings.length > 0 && notificationSettings[0].email_notifications) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type) 
         VALUES (?, ?, ?, ?)`,
        [
          user.id,
          'Password Change OTP',
          `Your OTP for password change is: ${otp}. Valid for 10 minutes.`,
          'security'
        ]
      );
      console.log('📬 In-app notification created');
    }

    if (!emailResult.success) {
      console.error('❌ Email not configured or failed:', emailResult.error);
      console.log('📱 OTP (since email failed):', otp);
      // Return success with OTP in development mode
      return res.json({
        success: true,
        message: 'OTP generated. Email not configured - check server console for OTP.',
        emailSent: false,
        otp: otp, // Show OTP when email fails
        expiresIn: 600
      });
    }

    res.json({
      success: true,
      message: 'OTP sent to your email successfully',
      emailSent: true,
      expiresIn: 600 // 10 minutes in seconds
    });
  } catch (error) {
    console.error('❌ Error generating OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate OTP',
      error: error.message
    });
  }
});

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP code
// @access  Private
router.post('/verify-otp', require('../middleware/auth').protect, async (req, res) => {
  try {
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: 'OTP is required'
      });
    }

    // Get stored OTP data
    const otpData = otpStore.get(req.user.id);

    if (!otpData) {
      return res.status(400).json({
        success: false,
        message: 'No OTP found. Please request a new one.'
      });
    }

    // Check if OTP expired
    if (Date.now() > otpData.expiresAt) {
      otpStore.delete(req.user.id);
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.'
      });
    }

    // Check attempts
    if (otpData.attempts >= 3) {
      otpStore.delete(req.user.id);
      return res.status(400).json({
        success: false,
        message: 'Too many failed attempts. Please request a new OTP.'
      });
    }

    // Verify OTP
    if (otpData.otp !== otp.toString()) {
      otpData.attempts += 1;
      otpStore.set(req.user.id, otpData);
      
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${3 - otpData.attempts} attempts remaining.`
      });
    }

    // OTP is valid - mark as verified
    otpData.verified = true;
    otpStore.set(req.user.id, otpData);

    console.log('✅ OTP verified for user:', req.user.id);

    res.json({
      success: true,
      message: 'OTP verified successfully'
    });
  } catch (error) {
    console.error('❌ Error verifying OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify OTP',
      error: error.message
    });
  }
});

// @route   POST /api/auth/change-password-with-otp
// @desc    Change password after OTP verification
// @access  Private
router.post('/change-password-with-otp', 
  require('../middleware/auth').protect,
  [
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { newPassword } = req.body;

      // Check if OTP was verified
      const otpData = otpStore.get(req.user.id);
      
      if (!otpData || !otpData.verified) {
        return res.status(400).json({
          success: false,
          message: 'Please verify OTP first'
        });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // Update password
      await pool.query(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, req.user.id]
      );

      // Clear OTP from store
      otpStore.delete(req.user.id);

      // Create notification
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type) 
         VALUES (?, ?, ?, ?)`,
        [
          req.user.id,
          'Password Changed',
          'Your password has been changed successfully.',
          'security'
        ]
      );

      console.log('✅ Password changed for user:', req.user.id);

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('❌ Error changing password:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to change password',
        error: error.message
      });
    }
  }
);

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', 
  require('../middleware/auth').protect,
  [
    body('name').optional().trim().notEmpty(),
    body('email').optional().isEmail(),
    body('phone').optional().trim().notEmpty()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { name, email, phone } = req.body;
      const updates = {};
      
      if (name) updates.name = name;
      if (email) updates.email = email;
      if (phone) updates.phone = phone;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No fields to update'
        });
      }

      const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      const values = Object.values(updates);

      await pool.query(
        `UPDATE users SET ${setClause} WHERE id = ?`,
        [...values, req.user.id]
      );

      const [users] = await pool.query(
        'SELECT id, name, email, phone, user_type, profile_image FROM users WHERE id = ?',
        [req.user.id]
      );

      res.json({
        success: true,
        message: 'Profile updated successfully',
        user: users[0]
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update profile',
        error: error.message
      });
    }
  }
);

module.exports = router;

