const express = require('express');
const Room = require('../models/Room');
const Earning = require('../models/Earning');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = express.Router();

// GET /api/host/dashboard
router.get('/dashboard', auth, authorize('host'), async (req, res, next) => {
  try {
    const hostId = req.user.id;
    // Parallelize queries for performance
    const [
      totalRooms,
      upcomingRooms,
      totalEarnings,
      totalEnrolledUsers,
      upcomingRoomsList,
      liveRoomsList
    ] = await Promise.all([
      Room.countDocuments({ hostId }),
      Room.countDocuments({ hostId, startTime: { $gte: new Date() } }),
      Earning.aggregate([
        { $match: { hostId: new (require('mongoose').Types.ObjectId)(hostId) } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Room.aggregate([
        { $match: { hostId: new (require('mongoose').Types.ObjectId)(hostId) } },
        { $unwind: '$enrolledUsers' },
        { $group: { _id: null, count: { $sum: 1 } } }
      ]),
      Room.find({ hostId, status: 'upcoming', startTime: { $gte: new Date() } })
        .sort({ startTime: -1 })
        .limit(7),
      Room.find({ hostId, status: 'live' })
        .sort({ startTime: -1 })
        .limit(7)
    ]);
    res.json({
      totalRooms,
      upcomingRooms,
      totalEarnings: totalEarnings[0]?.total || 0,
      totalEnrolledUsers: totalEnrolledUsers[0]?.count || 0,
      upcomingRoomsList,
      liveRoomsList
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
