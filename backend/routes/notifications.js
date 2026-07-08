const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

// All notification routes require authentication
router.use(protect);

// Get all notifications for user
router.get('/', notificationController.getNotifications);

// Mark specific notification as read
router.put('/read/:id', notificationController.markAsRead);

// Mark all notifications as read
router.put('/read-all', notificationController.markAllAsRead);

// Delete notification
router.delete('/:id', notificationController.deleteNotification);

// Save device token for FCM
router.post('/token', notificationController.saveDeviceToken);

// Preferences routes
router.get('/preferences', notificationController.getPreferences);
router.put('/preferences', notificationController.updatePreferences);

module.exports = router;
