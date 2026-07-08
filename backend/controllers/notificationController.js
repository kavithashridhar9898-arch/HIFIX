const pool = require('../config/database');

// Get all notifications for the logged-in user
exports.getNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [req.user.id, limit, offset]
    );

    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM notifications WHERE user_id = ?`,
      [req.user.id]
    );

    const [unreadRows] = await pool.query(
      `SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = ? AND is_read = 0`,
      [req.user.id]
    );

    res.json({
      success: true,
      notifications: rows,
      total: countRows[0].total,
      unreadCount: unreadRows[0].unread_count,
      page,
      totalPages: Math.ceil(countRows[0].total / limit)
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, message: 'Server error fetching notifications' });
  }
};

// Mark a specific notification as read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`,
      [id, req.user.id]
    );
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = 1 WHERE user_id = ?`,
      [req.user.id]
    );
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Delete a notification (Swipe to delete)
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      `DELETE FROM notifications WHERE id = ? AND user_id = ?`,
      [id, req.user.id]
    );
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Save FCM Device Token
exports.saveDeviceToken = async (req, res) => {
  try {
    const { fcm_token, device_type } = req.body;
    if (!fcm_token) {
      return res.status(400).json({ success: false, message: 'Token is required' });
    }

    // Insert or update token
    await pool.query(
      `INSERT INTO device_tokens (user_id, fcm_token, device_type) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
      [req.user.id, fcm_token, device_type || 'android']
    );

    res.json({ success: true, message: 'Device token saved successfully' });
  } catch (error) {
    console.error('Error saving device token:', error);
    res.status(500).json({ success: false, message: 'Server error saving token' });
  }
};

// Get Notification Preferences
exports.getPreferences = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM notification_settings WHERE user_id = ?`,
      [req.user.id]
    );

    if (rows.length === 0) {
      // Return defaults if not set yet
      return res.json({
        success: true,
        preferences: {
          push_notifications: 1,
          email_notifications: 1,
          booking_updates: 1,
          new_messages: 1,
          payment_alerts: 1,
          promotions: 0
        }
      });
    }

    res.json({ success: true, preferences: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Update Notification Preferences
exports.updatePreferences = async (req, res) => {
  try {
    const {
      push_notifications,
      email_notifications,
      booking_updates,
      new_messages,
      payment_alerts,
      promotions
    } = req.body;

    const [existing] = await pool.query(`SELECT id FROM notification_settings WHERE user_id = ?`, [req.user.id]);

    if (existing.length > 0) {
      // Update
      await pool.query(
        `UPDATE notification_settings SET 
         push_notifications = ?, email_notifications = ?, booking_updates = ?, 
         new_messages = ?, payment_alerts = ?, promotions = ? WHERE user_id = ?`,
        [
          push_notifications !== undefined ? push_notifications : 1,
          email_notifications !== undefined ? email_notifications : 1,
          booking_updates !== undefined ? booking_updates : 1,
          new_messages !== undefined ? new_messages : 1,
          payment_alerts !== undefined ? payment_alerts : 1,
          promotions !== undefined ? promotions : 0,
          req.user.id
        ]
      );
    } else {
      // Insert
      await pool.query(
        `INSERT INTO notification_settings 
         (user_id, push_notifications, email_notifications, booking_updates, new_messages, payment_alerts, promotions) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          push_notifications !== undefined ? push_notifications : 1,
          email_notifications !== undefined ? email_notifications : 1,
          booking_updates !== undefined ? booking_updates : 1,
          new_messages !== undefined ? new_messages : 1,
          payment_alerts !== undefined ? payment_alerts : 1,
          promotions !== undefined ? promotions : 0
        ]
      );
    }

    res.json({ success: true, message: 'Preferences updated successfully' });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
