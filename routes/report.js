const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const { Room } = require('../models/Room');
const User = require('../models/User');
const { sendNotificationToUser } = require('../utils/notificationEmitter');


router.post('/', async (req, res) => {
  try {
    const { userId, sessionId, reason, details } = req.body;
    const report = await Report.create({
      userId,
      sessionId,
      reason,
      details,
      createdAt: new Date(),
    });

    // Find the room and host for the session
    let hostId = null;
    let sessionTitle = '';
    const room = await Room.findOne({ sessions: sessionId });
    if (room) {
      hostId = room.hostId;
      sessionTitle = room.title;
    }
    // Get user info
    const user = await User.findById(userId);

    // Notify host
    if (hostId) {
      sendNotificationToUser(hostId, {
        title: 'Spam Report Received',
        message: `${user?.name || 'A user'} reported spam for your session${sessionTitle ? `: ${sessionTitle}` : ''}.`,
        type: 'session',
      });
    }
    // Notify user
    if (userId) {
      sendNotificationToUser(userId, {
        title: 'Report Submitted',
        message: `Your spam report${sessionTitle ? ` for session: ${sessionTitle}` : ''} has been received.`,
        type: 'session',
      });
    }

    res.status(201).json({ message: 'Report submitted successfully', report });
  } catch (err) {
    res.status(500).json({ message: 'Failed to submit report', error: err.message });
  }
});

module.exports = router;
