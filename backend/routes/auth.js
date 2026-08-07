const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const pool = require('../config/database');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { sendOTPEmail } = require('../config/email');
const router = express.Router();

// Store OTPs temporarily (in production, use Redis or database)
const otpStore = new Map();
const forgotPasswordOtpStore = new Map();

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

// Generate JWT Token (Access Token)
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '15m'
  });
};

// Generate Refresh Token
const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET, {
    expiresIn: '7d'
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
      const wLat = req.body.latitude || 19.0760;
      const wLng = req.body.longitude || 72.8777;
      await pool.query(
        `INSERT INTO workers (user_id, service_type, availability_status, latitude, longitude, city, state)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, req.body.service_type || 'other', 'available', wLat, wLng, req.body.city || 'Mumbai', req.body.state || 'Maharashtra']
      );
    }

    // Get user data
    const [users] = await pool.query(
      'SELECT id, name, email, phone, user_type, profile_image FROM users WHERE id = ?',
      [userId]
    );

    const token = generateToken(userId);
    const refreshToken = generateRefreshToken(userId);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      refreshToken,
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

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Remove password from response
    delete user.password;

    const token = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      refreshToken,
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

// @route   POST /api/auth/forgot-password
// @desc    Request OTP for forgot password
// @access  Public
router.post('/forgot-password', [
  body('email').isEmail().withMessage('Please provide a valid email')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email } = req.body;
    const [users] = await pool.query('SELECT id, name, email FROM users WHERE email = ?', [email]);

    if (users.length === 0) {
      // Return success even if user not found to prevent email enumeration
      return res.json({ success: true, message: 'If an account exists, an OTP has been sent.' });
    }

    const user = users[0];

    // Check rate limit (60 seconds)
    const existingOtp = forgotPasswordOtpStore.get(email);
    if (existingOtp && Date.now() - existingOtp.lastSentAt < 60000) {
      return res.status(429).json({ success: false, message: 'Please wait 60 seconds before requesting another OTP.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    forgotPasswordOtpStore.set(email, {
      otp,
      userId: user.id,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      attempts: 0,
      lastSentAt: Date.now(),
      verified: false
    });

    const emailResult = await sendOTPEmail(user.email, otp, user.name);

    if (!emailResult.success) {
      return res.json({
        success: true,
        message: 'OTP generated. Email not configured - check server console for OTP.',
        emailSent: false,
        otp: otp
      });
    }

    res.json({ success: true, emailSent: true, message: 'OTP sent to your email successfully.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Server error generating OTP' });
  }
});

// @route   POST /api/auth/verify-forgot-password-otp
// @desc    Verify OTP for forgot password
// @access  Public
router.post('/verify-forgot-password-otp', [
  body('email').isEmail(),
  body('otp').notEmpty()
], async (req, res) => {
  try {
    const { email, otp } = req.body;
    const otpData = forgotPasswordOtpStore.get(email);

    if (!otpData) {
      return res.status(400).json({ success: false, message: 'No active password reset request found.' });
    }

    if (Date.now() > otpData.expiresAt) {
      forgotPasswordOtpStore.delete(email);
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    if (otpData.attempts >= 5) {
      forgotPasswordOtpStore.delete(email);
      return res.status(400).json({ success: false, message: 'Too many failed attempts. Please request a new OTP.' });
    }

    if (otpData.otp !== otp.toString()) {
      otpData.attempts += 1;
      forgotPasswordOtpStore.set(email, otpData);
      return res.status(400).json({ success: false, message: `Invalid OTP. ${5 - otpData.attempts} attempts remaining.` });
    }

    otpData.verified = true;
    forgotPasswordOtpStore.set(email, otpData);

    res.json({ success: true, message: 'OTP verified successfully.' });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: 'Server error verifying OTP' });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password after OTP verification
// @access  Public
router.post('/reset-password', [
  body('email').isEmail(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  try {
    const { email, password } = req.body;
    const otpData = forgotPasswordOtpStore.get(email);

    if (!otpData || !otpData.verified) {
      return res.status(400).json({ success: false, message: 'Please verify OTP first.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, otpData.userId]);

    forgotPasswordOtpStore.delete(email);

    res.json({ success: true, message: 'Password has been reset successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Server error resetting password' });
  }
});

// Verify Google Token Helper
const verifyGoogleToken = async (idToken) => {
  try {
    // If it's a dev/mock token, return mock profile details
    if (process.env.NODE_ENV === 'development' && idToken.startsWith('mock_token_')) {
      const mockEmail = idToken.replace('mock_token_', '') + '@example.com';
      const mockName = idToken.replace('mock_token_', '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      return {
        sub: `mock_google_id_${idToken}`,
        email: mockEmail,
        name: mockName,
        picture: 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'
      };
    }

    const response = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    const payload = response.data;
    
    if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
      throw new Error('Invalid token issuer');
    }
    
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture
    };
  } catch (error) {
    console.error('Google token verification failed:', error.message);
    throw new Error('Invalid Google token');
  }
};

// @route   POST /api/auth/google
// @desc    Authenticate with Google (Login or Auto-Register)
// @access  Public
router.post('/google', async (req, res) => {
  try {
    const { idToken, user_type, service_type } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'Google ID token is required'
      });
    }

    // 1. Verify Google Token
    let googleProfile;
    try {
      googleProfile = await verifyGoogleToken(idToken);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Google token',
        error: err.message
      });
    }

    const { sub: googleId, name, email, picture } = googleProfile;

    // 2. Check if user exists by google_id
    let [users] = await pool.query(
      'SELECT id, name, email, phone, user_type, profile_image FROM users WHERE google_id = ?',
      [googleId]
    );

    let user;

    if (users.length > 0) {
      // User exists with this Google account -> Log in
      user = users[0];
    } else {
      // 3. Check if user exists with the same email
      let [existingEmailUsers] = await pool.query(
        'SELECT id, name, email, phone, user_type, profile_image FROM users WHERE email = ?',
        [email]
      );

      if (existingEmailUsers.length > 0) {
        // Link Google ID to existing account
        user = existingEmailUsers[0];
        await pool.query(
          'UPDATE users SET google_id = ?' + (user.profile_image ? '' : ', profile_image = ?') + ' WHERE id = ?',
          user.profile_image ? [googleId, user.id] : [googleId, picture, user.id]
        );
        // Refresh user record
        const [updatedUsers] = await pool.query(
          'SELECT id, name, email, phone, user_type, profile_image FROM users WHERE id = ?',
          [user.id]
        );
        user = updatedUsers[0];
      } else {
        // 4. User does not exist at all -> Registration needed
        if (!user_type) {
          // Send ROLE_REQUIRED so front-end shows selection screen
          return res.json({
            success: false,
            code: 'ROLE_REQUIRED',
            message: 'Account role is required to complete registration',
            googleProfile
          });
        }

        // Validate user_type
        if (!['homeowner', 'worker'].includes(user_type)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid user type'
          });
        }

        // Insert new user
        // Note: Password can be null for Google users
        const [result] = await pool.query(
          'INSERT INTO users (name, email, google_id, user_type, profile_image, password) VALUES (?, ?, ?, ?, ?, NULL)',
          [name, email, googleId, user_type, picture]
        );

        const userId = result.insertId;

        // If worker, create worker profile
        if (user_type === 'worker') {
          const wLat = req.body.latitude || 19.0760;
          const wLng = req.body.longitude || 72.8777;
          await pool.query(
            `INSERT INTO workers (user_id, service_type, availability_status, latitude, longitude, city, state)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, service_type || 'other', 'available', wLat, wLng, req.body.city || 'Mumbai', req.body.state || 'Maharashtra']
          );
        }

        // Create default notification settings
        await pool.query(
          'INSERT INTO notification_settings (user_id, email_notifications, push_notifications, sms_notifications) VALUES (?, TRUE, TRUE, FALSE) ON DUPLICATE KEY UPDATE user_id=user_id',
          [userId]
        );

        // Fetch new user
        const [newUsers] = await pool.query(
          'SELECT id, name, email, phone, user_type, profile_image FROM users WHERE id = ?',
          [userId]
        );
        user = newUsers[0];
      }
    }

    // 5. Generate Access and Refresh tokens
    const token = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    res.json({
      success: true,
      message: 'Authentication successful',
      token,
      refreshToken,
      user
    });
  } catch (error) {
    console.error('Google authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during Google authentication',
      error: error.message
    });
  }
});

// @route   POST /api/auth/refresh
// @desc    Refresh JWT access token
// @access  Public
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    try {
      const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET);
      
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

      const user = users[0];
      const token = generateToken(user.id);
      const newRefreshToken = generateRefreshToken(user.id); // Rotating refresh token

      res.json({
        success: true,
        token,
        refreshToken: newRefreshToken,
        user
      });
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during token refresh',
      error: error.message
    });
  }
});

module.exports = router;
