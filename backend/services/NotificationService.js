const pool = require('../config/database');
const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Firebase Admin (safe wrapper)
try {
  if (!admin.apps.length) {
    // We expect a serviceAccountKey.json in the config folder or environment variables.
    // If it doesn't exist, firebase admin will fail gracefully in our wrapper.
    const serviceAccount = require('../config/serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin initialized');
  }
} catch (error) {
  console.log('⚠️ Firebase Admin not initialized. (Add serviceAccountKey.json to config folder to enable Push Notifications)');
}

class NotificationService {
  /**
   * Dispatch a notification (DB -> Socket -> FCM -> n8n)
   */
  static async sendNotification({ req, userId, title, message, type = 'info', relatedEntityId = null }) {
    try {
      // 1. Save to MySQL Database
      const [result] = await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, related_entity_id) VALUES (?, ?, ?, ?, ?)`,
        [userId, title, message, type, relatedEntityId]
      );
      const notificationId = result.insertId;

      const notificationPayload = {
        id: notificationId,
        user_id: userId,
        title,
        message,
        type,
        related_entity_id: relatedEntityId,
        is_read: 0,
        created_at: new Date()
      };

      // 2. Emit Real-time update via Socket.io
      if (req && req.app) {
        const io = req.app.get('io');
        if (io) {
          io.to(`user_${userId}`).emit('new_notification', notificationPayload);
          
          // Emit unread count update
          const [unreadRows] = await pool.query(
            `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0`,
            [userId]
          );
          io.to(`user_${userId}`).emit('unread_notification_count', { count: unreadRows[0].count });
        }
      }

      // 3. Fetch User Preferences
      const [prefs] = await pool.query(
        `SELECT * FROM notification_settings WHERE user_id = ?`,
        [userId]
      );
      
      const userPrefs = prefs[0] || { 
        push_notifications: 1, 
        email_notifications: 1, 
        booking_updates: 1, 
        new_messages: 1, 
        payment_alerts: 1, 
        promotions: 0 
      };

      // 4. Send FCM Push Notification
      if (userPrefs.push_notifications) {
        // Check specific toggles based on type
        let shouldSendPush = true;
        if (type === 'booking' && !userPrefs.booking_updates) shouldSendPush = false;
        if (type === 'chat' && !userPrefs.new_messages) shouldSendPush = false;
        if (type === 'payment' && !userPrefs.payment_alerts) shouldSendPush = false;
        if (type === 'promotion' && !userPrefs.promotions) shouldSendPush = false;

        if (shouldSendPush) {
          const [tokens] = await pool.query(`SELECT fcm_token FROM device_tokens WHERE user_id = ?`, [userId]);
          if (tokens.length > 0 && admin.apps.length > 0) {
            const fcmTokens = tokens.map(t => t.fcm_token);
            
            const pushPayload = {
              notification: {
                title,
                body: message,
              },
              data: {
                type,
                relatedEntityId: relatedEntityId ? relatedEntityId.toString() : '',
                notificationId: notificationId.toString()
              },
              tokens: fcmTokens
            };

            admin.messaging().sendEachForMulticast(pushPayload)
              .then((response) => {
                if (response.failureCount > 0) {
                  console.log(`⚠️ FCM sending failed for ${response.failureCount} tokens`);
                }
              })
              .catch(err => console.error('FCM Error:', err));
          }
        }
      }

      // 5. Trigger n8n Automation (if configured in env)
      if (process.env.N8N_WEBHOOK_URL) {
        // e.g. https://n8n.yourdomain.com/webhook/notification
        axios.post(process.env.N8N_WEBHOOK_URL, {
          userId,
          title,
          message,
          type,
          relatedEntityId,
          userPrefs
        }).catch(err => {
          console.log('⚠️ n8n Webhook failed:', err.message);
        });
      }

      return notificationPayload;

    } catch (error) {
      console.error('NotificationService Error:', error);
      // We don't want a notification failure to break the main application flow
      return null;
    }
  }
}

module.exports = NotificationService;
