const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Feedback = require('../models/Feedback');
const { Room } = require('../models/Room');
const User = require('../models/User');
const { sendNotificationToUser } = require('../utils/notificationEmitter');

// Recompute host stats (avg rating, feedback count, session count) and persist on User
async function recomputeHostStats(hostId) {
  const hostRooms = await Room.find({ hostId }).select('sessions');
  const sessionIds = hostRooms.flatMap(r => (r.sessions || []).map(s => s.toString()));
  const uniqueSessionIds = [...new Set(sessionIds)];

  let avgRating = 0;
  let feedbackCount = 0;
  if (uniqueSessionIds.length) {
    const agg = await Feedback.aggregate([
      {
        $match: {
          sessionId: {
            $in: uniqueSessionIds.map(id => new mongoose.Types.ObjectId(id)),
          },
        },
      },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          feedbackCount: { $sum: 1 },
        },
      },
    ]);
    if (agg.length) {
      avgRating = agg[0].avgRating || 0;
      feedbackCount = agg[0].feedbackCount || 0;
    }
  }

  const sessionCount = uniqueSessionIds.length;
  await User.findByIdAndUpdate(hostId, {
    averageRating: avgRating || 0,
    feedbackCount,
    sessionCount,
  });

  return { avgRating: avgRating || 0, feedbackCount, sessionCount };
}

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
    // Update host aggregates (avg rating, feedback count, session count)
    let stats = null;
    if (hostId) {
      stats = await recomputeHostStats(hostId);
    }

    // Notify user
    if (userId) {
      sendNotificationToUser(userId, {
        title: 'Feedback Submitted',
        message: `Thank you for your feedback${sessionTitle ? ` on session: ${sessionTitle}` : ''}.`,
        type: 'session',
      });
    }

    res.status(201).json({ message: 'Feedback submitted successfully', feedback, stats });
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

// GET /api/feedback/host/:hostId/stats
// Returns avg rating, feedback count, and session count for the host
router.get('/host/:hostId/stats', async (req, res) => {
  try {
    const { hostId } = req.params;
    const stats = await recomputeHostStats(hostId);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch host stats', error: err.message });
  }
});

module.exports = router;
