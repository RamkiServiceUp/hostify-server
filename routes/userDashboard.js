const express = require('express');
const Enrollment = require('../models/Enrollment');
const Room = require('../models/Room');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = express.Router();

// GET /api/user/dashboard - user's upcoming enrolled sessions (limit 7)
router.get('/dashboard', auth, authorize('user'), async (req, res, next) => {
  try {
    const userId = req.user.id;
    // Find upcoming enrollments for this user
    const enrollments = await Enrollment.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20); // get recent enrollments
    const roomIds = enrollments.map(e => e.roomId);
    // Find upcoming rooms
    const now = new Date();
    const upcomingRooms = await Room.find({
      _id: { $in: roomIds },
      startTime: { $gte: now }
    })
      .sort({ startTime: 1 })
      .limit(7);
    res.json({ upcomingRooms });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
