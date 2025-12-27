const express = require('express');
const Notification = require('../models/Notification');
const router = express.Router();

// GET /api/notifications/user/:userId - get all notifications for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const notifications = await Notification.find({ userId }).sort({ createdAt: -1 });
    res.json({ notifications });
  } catch (err) {
    console.error('[notification API] Error:', err);
    res.status(500).json({ message: err.message || 'Failed to fetch notifications' });
  }
});

module.exports = router;
