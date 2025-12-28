const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');
const { Room } = require('../models/Room');
const User = require('../models/User');
const { sendNotificationToUser } = require('../utils/notificationEmitter');

// POST /api/feedback
router.post('/', async (req, res) => {
  try {
    const { userId, sessionId, rating, recommendation, comment } = req.body;
    const feedback = await Feedback.create({
      userId,
      sessionId,
      rating,
      recommendation,
      comment,
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
        title: 'New Feedback Received',
        message: `${user?.name || 'A user'} left feedback on your session${sessionTitle ? `: ${sessionTitle}` : ''}.`,
        type: 'session',
      });
    }
    // Notify user
    if (userId) {
      sendNotificationToUser(userId, {
        title: 'Feedback Submitted',
        message: `Thank you for your feedback${sessionTitle ? ` on session: ${sessionTitle}` : ''}.`,
        type: 'session',
      });
    }

    res.status(201).json({ message: 'Feedback submitted successfully', feedback });
  } catch (err) {
    res.status(500).json({ message: 'Failed to submit feedback', error: err.message });
  }
});

// GET /api/feedback/session/:sessionId
// List all feedback for a session (with user details)
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const feedbacks = await Feedback.find({ sessionId }).populate('userId', 'name email');
    res.json({ feedbacks });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch feedbacks', error: err.message });
  }
});

// GET /api/feedback/exists?sessionId=...&userId=...
// Check if a user has already submitted feedback for a session
router.get('/exists', async (req, res) => {
  try {
    const { sessionId, userId } = req.query;
    const exists = await Feedback.exists({ sessionId, userId });
    res.json({ exists: !!exists });
  } catch (err) {
    res.status(500).json({ message: 'Failed to check feedback existence', error: err.message });
  }
});

module.exports = router;
