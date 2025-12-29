const express = require('express');
const router = express.Router();
const {Room} = require('../models/Room');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');

// GET /api/calendar/host/:hostId - all sessions for host's rooms
router.get('/host/:hostId', async (req, res) => {
  try {
    const { hostId } = req.params;
    const rooms = await Room.find({ hostId }).populate('sessions').lean();
    // For each room, return only required fields and a 'session' array with required session fields
    const result = rooms.map(room => {
      return {
        _id: room._id,
        title: room.title,
        description: room.description,
        category: room.category,
        session: (room.sessions || []).map(session => {
          // Convert Mongoose Buffer/Document to plain JS object
          if (typeof session.toObject === 'function') {
            return session.toObject();
          }
          return { ...session };
        })
      };
    });
    res.json(result);
  } catch (err) {
    console.error('Error in /api/calendar/host/:hostId:', err);
    res.status(500).json({ error: 'Failed to fetch host calendar sessions.' });
  }
});

// GET /api/calendar/user/:userId - all sessions for user's enrolled rooms
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const enrollments = await Enrollment.find({ userId }).lean();
    const roomIds = enrollments.map(e => e.roomId);
    const rooms = await Room.find({ _id: { $in: roomIds } }).populate('sessions').lean();
    // For each room, return only required fields and a 'session' array with required session fields
    const result = rooms.map(room => {
      return {
        _id: room._id,
        title: room.title,
        description: room.description,
        category: room.category,
        session: (room.sessions || []).map(session => {
          if (typeof session.toObject === 'function') {
            return session.toObject();
          }
          return { ...session };
        })
      };
    });
    res.json(result);
  } catch (err) {
    console.error('Error in /api/calendar/user/:userId:', err);
    res.status(500).json({ error: 'Failed to fetch user calendar sessions.' });
  }
});

module.exports = router;
