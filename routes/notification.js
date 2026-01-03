const express = require('express');
const Notification = require('../models/Notification');
const router = express.Router();

// GET /api/notifications/user/:userId - get all notifications for a user (with pagination)
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const offset = parseInt(req.query.offset) || 0;
    const limit = parseInt(req.query.limit) || 15;
    
    // Get total count
    const totalCount = await Notification.countDocuments({ userId });
    
    // Get paginated notifications
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit);
    
    res.json({ 
      notifications,
      totalCount,
      offset,
      limit
    });
  } catch (err) {
    console.error('[notification API] Error:', err);
    res.status(500).json({ message: err.message || 'Failed to fetch notifications' });
  }
});

module.exports = router;

// PATCH /api/notifications/:notificationId/read - mark as read
router.patch('/:notificationId/read', async (req, res) => {
  try {
    const { notificationId } = req.params;
    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      { read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json(notification);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to mark as read' });
  }
});

// PATCH /api/notifications/:notificationId/unread - mark as unread
router.patch('/:notificationId/unread', async (req, res) => {
  try {
    const { notificationId } = req.params;
    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      { read: false },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json(notification);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to mark as unread' });
  }
});
