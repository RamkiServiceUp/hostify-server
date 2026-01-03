const express = require('express');
const { Room } = require('../models/Room');
const Earning = require('../models/Earning');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = express.Router();

// GET /api/host/dashboard
router.get('/dashboard', auth, authorize('host'), async (req, res, next) => {
  try {
    const hostId = req.user.id;
    const ObjectId = require('mongoose').Types.ObjectId;
    const hostObjectId = new ObjectId(hostId);

    // Parallelize queries for performance
    const [
      totalRooms,
      upcomingRooms,
      totalEarnings,
      totalEnrolledUsers,
      upcomingRoomsList,
      liveRoomsList,
      allRooms
    ] = await Promise.all([
      Room.countDocuments({ hostId: hostObjectId }),
      Room.countDocuments({ hostId: hostObjectId, startDateTime: { $gte: new Date() } }),
      Earning.aggregate([
        { $match: { hostId: hostObjectId } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Room.aggregate([
        { $match: { hostId: hostObjectId } },
        { $unwind: '$enrolledUsers' },
        { $group: { _id: null, count: { $sum: 1 } } }
      ]),
      Room.find({ hostId: hostObjectId, status: 'upcoming', startDateTime: { $gte: new Date() } })
        .sort({ startDateTime: -1 })
        .limit(7),
      Room.find({ hostId: hostObjectId, status: 'live' })
        .sort({ startDateTime: -1 })
        .limit(7),
      Room.find({ hostId: hostObjectId })
    ]);

    // Calculate live revenue from earnings and live rooms
    const liveRevenueFromEarnings = totalEarnings[0]?.total || 0;
    let liveRevenueFromRooms = 0;
    for (const room of liveRoomsList) {
      const enrolledCount = room.enrolledUsers?.length || 0;
      liveRevenueFromRooms += (room.price * enrolledCount * 0.85);
    }
    const liveRevenue = Math.max(liveRevenueFromEarnings, liveRevenueFromRooms);

    // Calculate projected revenue from upcoming rooms
    let projectedRevenue = 0;
    for (const room of allRooms) {
      if (room.status === 'upcoming' && new Date(room.startDateTime) > new Date()) {
        const enrolledCount = room.enrolledUsers?.length || 0;
        projectedRevenue += (room.price * enrolledCount * 0.85);
      }
    }

    // Calculate percentages
    const totalRevenue = liveRevenue + projectedRevenue;
    const liveRevenuePercentage = totalRevenue > 0
      ? Math.round((liveRevenue / totalRevenue) * 100)
      : 0;
    const projectedRevenuePercentage = totalRevenue > 0
      ? Math.round((projectedRevenue / totalRevenue) * 100)
      : 0;

    res.json({
      totalRooms,
      upcomingRooms,
      totalEarnings: totalEarnings[0]?.total || 0,
      totalEnrolledUsers: totalEnrolledUsers[0]?.count || 0,
      upcomingRoomsList,
      liveRoomsList,
      liveRevenue: Math.round(liveRevenue * 100) / 100,
      liveRevenuePercentage,
      projectedRevenue: Math.round(projectedRevenue * 100) / 100,
      projectedRevenuePercentage
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/host/revenue-metrics
router.get('/revenue-metrics', auth, authorize('host'), async (req, res, next) => {
  try {
    const hostId = req.user.id;
    const ObjectId = require('mongoose').Types.ObjectId;
    const hostObjectId = new ObjectId(hostId);

    // Get all rooms for the host - convert hostId to ObjectId
    const rooms = await Room.find({ hostId: hostObjectId });
    
   

    // Calculate live revenue (from earnings records for completed sessions)
    const liveRevenueData = await Earning.aggregate([
      {
        $match: { hostId: hostObjectId }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' }
        }
      }
    ]);

    const liveRevenue = liveRevenueData[0]?.totalRevenue || 0;

    // Calculate projected revenue (from available seats in upcoming/live rooms)
    // This is the potential revenue from seats that haven't been filled yet
    let projectedRevenue = 0;
    for (const room of rooms) {
      if (room.status === 'upcoming' || room.status === 'live') {
        const enrolledCount = room.enrolledUsers?.length || 0;
        const availableSeats = Math.max(0, (room.seatsAvailable || 0) - enrolledCount);
        const roomRevenue = (room.price * availableSeats * 0.85);
        projectedRevenue += roomRevenue;
      }
    }

    // Calculate live revenue from live rooms (based on enrolled users)
    let liveRevenueFromRooms = 0;
    for (const room of rooms) {
      if (room.status === 'live' || room.status === 'ended') {
        const enrolledCount = room.enrolledUsers?.length || 0;
        const roomRevenue = (room.price * enrolledCount * 0.85);
        liveRevenueFromRooms += roomRevenue;
      }
    }

    // Use the greater of earnings or calculated live revenue
    const finalLiveRevenue = Math.max(liveRevenue, liveRevenueFromRooms);

    // Calculate utilization (total enrolled users / total available seats)
    let totalEnrolledUsers = 0;
    let totalSeatsAvailable = 0;

    for (const room of rooms) {
      totalEnrolledUsers += room.enrolledUsers?.length || 0;
      totalSeatsAvailable += room.seatsAvailable || 0;
    }

    // Avoid division by zero
    const utilizationRaw = totalSeatsAvailable > 0
      ? (totalEnrolledUsers / totalSeatsAvailable) * 100
      : 0;
    
    // Round to 2 decimal places
    const utilization = Math.round(utilizationRaw * 100) / 100;


    // Calculate percentages
    const totalRevenue = finalLiveRevenue + projectedRevenue;
    const liveRevenuePercentage = totalRevenue > 0
      ? Math.round((finalLiveRevenue / totalRevenue) * 100)
      : 0;
    const projectedRevenuePercentage = totalRevenue > 0
      ? Math.round((projectedRevenue / totalRevenue) * 100)
      : 0;


    res.json({
      liveRevenue: Math.round(finalLiveRevenue * 100) / 100,
      liveRevenuePercentage,
      projectedRevenue: Math.round(projectedRevenue * 100) / 100,
      projectedRevenuePercentage,
      utilization,
      totalEnrolledUsers,
      totalSeatsAvailable
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
