const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { protect } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/chat';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|pdf|doc|docx|mp3|wav/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type'));
  }
});

// @route   GET /api/chat/conversations
// @desc    Get all conversations for current user
// @access  Private
router.get('/conversations', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const [conversations] = await pool.query(`
      SELECT 
        c.*,
        CASE 
          WHEN c.homeowner_id = ? THEN w.name
          ELSE h.name
        END as other_user_name,
        CASE 
          WHEN c.homeowner_id = ? THEN w.profile_image
          ELSE h.profile_image
        END as other_user_avatar,
        CASE 
          WHEN c.homeowner_id = ? THEN c.worker_id
          ELSE c.homeowner_id
        END as other_user_id,
        CASE 
          WHEN c.homeowner_id = ? THEN 'worker'
          ELSE 'homeowner'
        END as other_user_type,
        (SELECT COUNT(*) FROM messages m 
         WHERE m.conversation_id = c.id 
         AND m.sender_id != ? 
         AND m.is_read = FALSE) as unread_count
      FROM conversations c
      INNER JOIN users h ON c.homeowner_id = h.id
      INNER JOIN users w ON c.worker_id = w.id
      WHERE c.homeowner_id = ? OR c.worker_id = ?
      ORDER BY c.last_message_time DESC
    `, [userId, userId, userId, userId, userId, userId, userId]);

    res.json({
      success: true,
      conversations
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/chat/conversation/:otherUserId
// @desc    Get or create conversation with another user
// @access  Private
router.get('/conversation/:otherUserId', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const otherUserId = parseInt(req.params.otherUserId);

    // Determine who is homeowner and who is worker
    const [users] = await pool.query(
      'SELECT id, user_type FROM users WHERE id IN (?, ?)',
      [userId, otherUserId]
    );

    const currentUser = users.find(u => u.id === userId);
    const otherUser = users.find(u => u.id === otherUserId);

    if (!currentUser || !otherUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    let homeownerId, workerId;
    if (currentUser.user_type === 'homeowner') {
      homeownerId = userId;
      workerId = otherUserId;
    } else {
      homeownerId = otherUserId;
      workerId = userId;
    }

    // Try to find existing conversation
    let [conversations] = await pool.query(
      'SELECT * FROM conversations WHERE homeowner_id = ? AND worker_id = ?',
      [homeownerId, workerId]
    );

    if (conversations.length === 0) {
      // Create new conversation
      const [result] = await pool.query(
        'INSERT INTO conversations (homeowner_id, worker_id) VALUES (?, ?)',
        [homeownerId, workerId]
      );

      [conversations] = await pool.query(
        'SELECT * FROM conversations WHERE id = ?',
        [result.insertId]
      );
    }

    res.json({
      success: true,
      conversation: conversations[0]
    });
  } catch (error) {
    console.error('Get/create conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/chat/messages/:conversationId
// @desc    Get messages for a conversation
// @access  Private
router.get('/messages/:conversationId', protect, async (req, res) => {
  try {
    const conversationId = req.params.conversationId;
    const limit = parseInt(req.query.limit) || 50;
    const before = req.query.before; // Timestamp for pagination

    // Verify user is part of conversation
    const [conversations] = await pool.query(
      'SELECT * FROM conversations WHERE id = ? AND (homeowner_id = ? OR worker_id = ?)',
      [conversationId, req.user.id, req.user.id]
    );

    if (conversations.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    let query = `
      SELECT 
        m.*,
        u.name as sender_name,
        u.profile_image as sender_avatar,
        mm.media_url,
        mm.media_type as media_media_type,
        mm.file_name,
        mm.file_size
      FROM messages m
      INNER JOIN users u ON m.sender_id = u.id
      LEFT JOIN message_media mm ON m.id = mm.message_id
      WHERE m.conversation_id = ?
    `;

    const params = [conversationId];

    if (before) {
      query += ' AND m.created_at < ?';
      params.push(before);
    }

    query += ' ORDER BY m.created_at DESC LIMIT ?';
    params.push(limit);

    const [messages] = await pool.query(query, params);

    // Reverse to chronological order
    const formattedMessages = messages.reverse();

    console.log(`📨 Fetched ${formattedMessages.length} messages for conversation ${conversationId}`);
    const mediaMessages = formattedMessages.filter(m => m.media_url);
    if (mediaMessages.length > 0) {
      console.log(`📎 ${mediaMessages.length} messages have media:`, 
        mediaMessages.map(m => ({ id: m.id, type: m.message_type, url: m.media_url }))
      );
    }

    res.json({
      success: true,
      messages: formattedMessages
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/chat/message
// @desc    Send a new message
// @access  Private
router.post('/message', protect, async (req, res) => {
  try {
    const { conversationId, content, messageType = 'text' } = req.body;
    const senderId = req.user.id;

    // Verify user is part of conversation
    const [conversations] = await pool.query(
      'SELECT * FROM conversations WHERE id = ? AND (homeowner_id = ? OR worker_id = ?)',
      [conversationId, senderId, senderId]
    );

    if (conversations.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Insert message
    const [result] = await pool.query(
      'INSERT INTO messages (conversation_id, sender_id, message_type, content) VALUES (?, ?, ?, ?)',
      [conversationId, senderId, messageType, content]
    );

    // Update conversation last message
    await pool.query(
      'UPDATE conversations SET last_message = ?, last_message_time = NOW() WHERE id = ?',
      [content || '[Media]', conversationId]
    );

    // Get the created message with sender info
    const [messages] = await pool.query(`
      SELECT 
        m.*,
        u.name as sender_name,
        u.profile_image as sender_avatar
      FROM messages m
      INNER JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
    `, [result.insertId]);

    const message = messages[0];

    // Emit socket event for real-time delivery
    const conversation = conversations[0];
    const receiverId = conversation.homeowner_id === senderId 
      ? conversation.worker_id 
      : conversation.homeowner_id;

    req.app.get('io').to(`user_${receiverId}`).emit('new_message', {
      message,
      conversationId
    });

    res.json({
      success: true,
      message
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/chat/upload
// @desc    Upload media file
// @access  Private
router.post('/upload', protect, upload.single('file'), async (req, res) => {
  try {
    console.log('📤 Upload request received:', {
      hasFile: !!req.file,
      file: req.file ? {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path
      } : null,
      conversationId: req.body.conversationId
    });

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const { conversationId } = req.body;

    // Verify user is part of conversation
    const [conversations] = await pool.query(
      'SELECT * FROM conversations WHERE id = ? AND (homeowner_id = ? OR worker_id = ?)',
      [conversationId, req.user.id, req.user.id]
    );

    if (conversations.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Determine media type
    const ext = path.extname(req.file.originalname).toLowerCase();
    let mediaType = 'document';
    if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) mediaType = 'image';
    else if (['.mp4', '.mov', '.avi'].includes(ext)) mediaType = 'video';
    else if (['.mp3', '.wav'].includes(ext)) mediaType = 'audio';

    console.log('📁 File type determined:', { ext, mediaType });

    // Create message
    const [messageResult] = await pool.query(
      'INSERT INTO messages (conversation_id, sender_id, message_type, content) VALUES (?, ?, ?, ?)',
      [conversationId, req.user.id, mediaType, req.file.originalname]
    );

    // Create media record
    const mediaUrl = `/uploads/chat/${req.file.filename}`;
    await pool.query(
      'INSERT INTO message_media (message_id, media_type, media_url, file_name, file_size) VALUES (?, ?, ?, ?, ?)',
      [messageResult.insertId, mediaType, mediaUrl, req.file.originalname, req.file.size]
    );

    console.log('✅ Media record created:', { messageId: messageResult.insertId, mediaUrl });

    // Update conversation
    await pool.query(
      'UPDATE conversations SET last_message = ?, last_message_time = NOW() WHERE id = ?',
      [`[${mediaType}]`, conversationId]
    );

    // Get message with media
    const [messages] = await pool.query(`
      SELECT 
        m.*,
        u.name as sender_name,
        u.profile_image as sender_avatar,
        mm.media_url,
        mm.media_type,
        mm.file_name,
        mm.file_size
      FROM messages m
      INNER JOIN users u ON m.sender_id = u.id
      LEFT JOIN message_media mm ON m.id = mm.message_id
      WHERE m.id = ?
    `, [messageResult.insertId]);

    console.log('📨 Sending message response:', messages[0]);

    // Emit socket event
    const conversation = conversations[0];
    const receiverId = conversation.homeowner_id === req.user.id 
      ? conversation.worker_id 
      : conversation.homeowner_id;

    req.app.get('io').to(`user_${receiverId}`).emit('new_message', {
      message: messages[0],
      conversationId
    });

    res.json({
      success: true,
      message: messages[0]
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/chat/mark-read/:conversationId
// @desc    Mark all messages in conversation as read
// @access  Private
router.put('/mark-read/:conversationId', protect, async (req, res) => {
  try {
    const conversationId = req.params.conversationId;

    await pool.query(
      'UPDATE messages SET is_read = TRUE WHERE conversation_id = ? AND sender_id != ? AND is_read = FALSE',
      [conversationId, req.user.id]
    );

    res.json({
      success: true,
      message: 'Messages marked as read'
    });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/chat/typing
// @desc    Update typing status
// @access  Private
router.post('/typing', protect, async (req, res) => {
  try {
    const { conversationId, isTyping } = req.body;

    await pool.query(
      'INSERT INTO typing_status (conversation_id, user_id, is_typing) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE is_typing = ?, updated_at = NOW()',
      [conversationId, req.user.id, isTyping, isTyping]
    );

    // Emit socket event
    const [conversations] = await pool.query(
      'SELECT * FROM conversations WHERE id = ?',
      [conversationId]
    );

    if (conversations.length > 0) {
      const conversation = conversations[0];
      const receiverId = conversation.homeowner_id === req.user.id 
        ? conversation.worker_id 
        : conversation.homeowner_id;

      req.app.get('io').to(`user_${receiverId}`).emit('typing_status', {
        conversationId,
        userId: req.user.id,
        isTyping
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Typing status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;
