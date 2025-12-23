const express = require('express');
const Notification = require('../models/Notification');
const router = express.Router();

// GET /api/notifications/user/:userId - get all notifications for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('[notification API] GET /user/:userId called with userId:', userId);
    const notifications = await Notification.find({ userId }).sort({ createdAt: -1 });
    console.log('[notification API] Found notifications:', notifications.length);
    res.json({ notifications });
  } catch (err) {
    console.error('[notification API] Error:', err);
    res.status(500).json({ message: err.message || 'Failed to fetch notifications' });
  }
});

module.exports = router;
