const express = require('express');
const { Room } = require('../models/Room');

const router = express.Router();

// GET /api/public/rooms
router.get('/rooms', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      minPrice,
      maxPrice,
      startDate,
      endDate
    } = req.query;

    const query = {
      status: 'upcoming',
    };
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {};
      if (minPrice !== undefined) query.price.$gte = Number(minPrice);
      if (maxPrice !== undefined) query.price.$lte = Number(maxPrice);
    }
    if (startDate || endDate) {
      query.startDateTime = {};
      if (startDate) query.startDateTime.$gte = new Date(startDate);
      if (endDate) query.startDateTime.$lte = new Date(endDate);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [rooms, total] = await Promise.all([
      Room.find(query)
        .sort({ startDateTime: 1 })
        .skip(skip)
        .limit(Number(limit)),
      Room.countDocuments(query)
    ]);

    res.json({
      rooms,
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/public/rooms/:id - public room details (no auth)
router.get('/rooms/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const room = await Room.findById(id)
      .select('-banner')
      .populate({ path: 'sessions', select: 'name startDateTime endDateTime status' })
      .lean();

    if (!room) return res.status(404).json({ message: 'Room not found' });

    const enrolledCount = Array.isArray(room.enrolledUsers) ? room.enrolledUsers.length : 0;
    // Prevent intermediate caches from serving stale 304 responses
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });

    res.json({
      room: {
        ...room,
        enrolledCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
