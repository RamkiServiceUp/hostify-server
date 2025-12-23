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
      query.startTime = {};
      if (startDate) query.startTime.$gte = new Date(startDate);
      if (endDate) query.startTime.$lte = new Date(endDate);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [rooms, total] = await Promise.all([
      Room.find(query)
        .sort({ startTime: 1 })
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

module.exports = router;
