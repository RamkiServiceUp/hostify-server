
const express = require('express');

const { body, param } = require('express-validator');
const multer = require('multer');
const path = require('path');
// Multer setup for memory storage (for DB blob)
const upload = multer({ storage: multer.memoryStorage() });

const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const Room = require('../models/Room');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');
const router = express.Router();


// PATCH /api/rooms/:id/end - Host ends session, sets status to 'ended'
router.patch('/:id/end', auth, authorize('host'), async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    if (room.status === 'ended') return res.status(400).json({ message: 'Room is already ended' });
    room.status = 'ended';
    await room.save();
    res.json({ room });
  } catch (err) {
    next(err);
  }
});
// PATCH /api/rooms/:id/go-live - Host starts session, generates channelName and hostUid
router.patch('/:id/go-live', async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    // Allow go-live if status is not 'live', or if status is 'live' but channelName or hostUid is missing
    if (room.status === 'live' && room.channelName && room.hostUid) {
      return res.status(400).json({ message: 'Room is already live' });
    }
    // Generate unique channel name and hostUid if missing
    if (!room.channelName) {
      room.channelName = `room_${room._id}`;
    }
    if (!room.hostUid) {
      room.hostUid = Math.floor(Math.random() * 900000) + 100000; // 6-digit random
    }
    room.status = 'live';
    await room.save();
    res.json({ room });
  } catch (err) {
    next(err);
  }
});

// GET /api/rooms/categories - fetch all categories
router.get('/categories', (req, res) => {
  res.json({ categories });
});

// POST /api/rooms/categories - add a new category
router.post('/categories', auth, authorize('host'), [body('category').isString().isLength({ min: 2, max: 50 })], validate, (req, res) => {
  const { category } = req.body;
  if (categories.includes(category)) {
    return res.status(409).json({ message: 'Category already exists' });
  }
  categories.push(category);
  res.status(201).json({ category });
});


// POST /api/rooms - create a new room (host only, with banner upload)
router.post(
  '/',
  auth,
  authorize('host'),
  upload.single('banner'),
  [
    body('title').isString().isLength({ min: 2, max: 200 }),
    body('description').optional().isString().isLength({ max: 2000 }),
    body('category').optional().isString().isLength({ min: 2, max: 50 }),
    body('categories').optional().isString().isLength({ min: 2, max: 50 }),
    body('price').optional().isNumeric(),
    body('pricePerSeat').optional().isNumeric(),
    body('seatsAvailable').optional().customSanitizer(v => typeof v === 'string' ? parseInt(v, 10) : v).isInt({ min: 1 }),
    body('totalSeats').optional().customSanitizer(v => typeof v === 'string' ? parseInt(v, 10) : v).isInt({ min: 1 }),
    body('startTime').optional().isISO8601(),
    body('endTime').optional().isISO8601(),
    body('startDateTime').optional().isISO8601(),
    body('endDateTime').optional().isISO8601(),
    body('roomDuration').customSanitizer(v => {
      if (typeof v === 'string') v = parseFloat(v);
      if (typeof v === 'number' && !Number.isInteger(v)) v = Math.ceil(v);
      return v;
    }).isInt({ min: 1 }),
    body('status').optional().isIn(['upcoming', 'live', 'ended'])
  ],
  validate,
  async (req, res, next) => {
    try {
      // Accept both category and categories (string or array)
      let categories = req.body.categories || req.body.category;
      if (categories && typeof categories === 'string') {
        categories = [categories];
      }
      // Accept both price and pricePerSeat
      let price = req.body.price !== undefined ? Number(req.body.price) : (req.body.pricePerSeat !== undefined ? Number(req.body.pricePerSeat) : undefined);
      // Accept both seatsAvailable and totalSeats
      let seatsAvailable = req.body.seatsAvailable !== undefined ? Number(req.body.seatsAvailable) : (req.body.totalSeats !== undefined ? Number(req.body.totalSeats) : undefined);
      // Accept both startTime and startDateTime
      let startTime = req.body.startTime || req.body.startDateTime;
      // Accept both endTime and endDateTime
      let endTime = req.body.endTime || req.body.endDateTime;
      // Accept roomDuration
      let roomDuration = req.body.roomDuration !== undefined ? Number(req.body.roomDuration) : undefined;
      const { title, description, status } = req.body;
      if (!title || !price || !startTime || !endTime || !seatsAvailable || !roomDuration) {
        return res.status(422).json({ message: 'Missing required fields' });
      }
      if (new Date(endTime) <= new Date(startTime)) {
        return res.status(422).json({ message: 'endTime must be after startTime' });
      }
      if (price < 99) {
        return res.status(422).json({ message: 'Minimum price is ₹99' });
      }
      let bannerBuffer = undefined;
      if (req.file) {
        bannerBuffer = req.file.buffer;
      }
      const room = await Room.create({
        title,
        description,
        hostId: req.user.id,
        price,
        startTime,
        endTime,
        roomDuration,
        seatsAvailable,
        banner: bannerBuffer,
        status: status || 'upcoming',
        categories: categories || ['Other'],
      });
      res.status(201).json({ room });
    } catch (err) {
      next(err);
    }
  }
);


// GET /api/rooms/not-enrolled - get all rooms where the current user is NOT enrolled
router.get('/not-enrolled',auth, authorize('user'), auth, async (req, res, next) => {
  try {
    // Find all roomIds where the user is enrolled
    const enrolled = await Enrollment.find({ userId: req.user.id }).select('roomId');
    const enrolledRoomIds = enrolled.map(e => e.roomId);
    // Find rooms where status is not 'ended' or 'live' and user is NOT enrolled
    const roomsRaw = await Room.find({
      status: { $nin: ['ended', 'live'] },
      _id: { $nin: enrolledRoomIds }
    })
      .sort({ startTime: 1 })
      .populate({
        path: 'hostId',
        select: 'name email phone role',
        model: 'User'
      });
    const rooms = await Promise.all(roomsRaw.map(async room => {
      const r = room.toObject();
      const host = r.hostId;
      const enrollments = await Enrollment.find({ roomId: r._id });
      const userIds = enrollments.map(e => e.userId);
      const users = await User.find({ _id: { $in: userIds } }, 'name email phone');
      return {
        ...r,
        hostId: host?._id || r.hostId,
        host: host ? {
          _id: host._id,
          name: host.name,
          email: host.email,
        } : null,
        enrolledUsers: users.map(user => user ? {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone
        } : null)
      };
    }));
    res.json({ rooms });
  } catch (err) {
    next(err);
  }
});


// GET /api/rooms/active - get all rooms where status is not 'ended'
router.get('/active', async (req, res, next) => {
  try {
    const roomsRaw = await Room.find({ status: { $nin: ['ended', 'live'] } })
      .sort({ startTime: 1 })
      .populate({
        path: 'hostId',
        select: 'name email phone role',
        model: 'User'
      });
    const rooms = await Promise.all(roomsRaw.map(async room => {
      const r = room.toObject();
      const host = r.hostId;
      const enrollments = await Enrollment.find({ roomId: r._id });
      const userIds = enrollments.map(e => e.userId);
      const users = await User.find({ _id: { $in: userIds } }, 'name email phone');
      return {
        ...r,
        hostId: host?._id || r.hostId,
        host: host ? {
          _id: host._id,
          name: host.name,
          email: host.email,
        } : null,
        enrolledUsers: users.map(user => user ? {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone
        } : null)
      };
    }));
    res.json({ rooms });
  } catch (err) {
    next(err);
  }
});

// GET /api/rooms/host/:hostId - get all rooms by a specific host
router.get('/host/:hostId',auth,
  authorize('host'), async (req, res, next) => {
    try {
      const { hostId } = req.params;
      const roomsRaw = await Room.find({ hostId }).sort({ startTime: 1 })
        .populate({
          path: 'hostId',
          select: 'name email phone role',
          model: 'User'
        });
      const rooms = await Promise.all(roomsRaw.map(async room => {
        const r = room.toObject();
        const host = r.hostId;
        const enrollments = await Enrollment.find({ roomId: r._id });
        const userIds = enrollments.map(e => e.userId);
        const users = await User.find({ _id: { $in: userIds } }, 'name email phone');
        return {
          ...r,
          hostId: host?._id || r.hostId,
          host: host ? {
            _id: host._id,
            name: host.name,
            email: host.email,
          } : null,
          enrolledUsers: users.map(user => user ? {
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone
          } : null)
        };
      }));
      res.json({ rooms });
    } catch (err) {
      next(err);
    }
});

// GET /api/rooms
router.get('/',auth,
  authorize('host'), async (req, res, next) => {
    try {
      const roomsRaw = await Room.find().sort({ startTime: 1 })
        .populate({
          path: 'hostId',
          select: 'name email phone role',
          model: 'User'
        });
      const rooms = await Promise.all(roomsRaw.map(async room => {
        const r = room.toObject();
        const host = r.hostId;
        const enrollments = await Enrollment.find({ roomId: r._id });
        const userIds = enrollments.map(e => e.userId);
        const users = await User.find({ _id: { $in: userIds } }, 'name email phone');
        return {
          ...r,
          hostId: host?._id || r.hostId,
          host: host ? {
            _id: host._id,
            name: host.name,
            email: host.email,
          } : null,
          enrolledUsers: users.map(user => user ? {
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone
          } : null)
        };
      }));
      res.json({ rooms });
    } catch (err) {
      next(err);
    }
});

// GET /api/rooms/:id
router.get('/:id', [param('id').isMongoId()], validate, async (req, res, next) => {
    try {
      const room = await Room.findById(req.params.id)
        .populate({
          path: 'hostId',
          select: 'name email phone role',
          model: 'User'
        });
      if (!room) return res.status(404).json({ message: 'Room not found' });
      const r = room.toObject();
      const host = r.hostId;
      const enrollments = await Enrollment.find({ roomId: r._id });
      const userIds = enrollments.map(e => e.userId);
      const users = await User.find({ _id: { $in: userIds } }, 'name email phone');
      res.json({
        room: {
          ...r,
          hostId: host?._id || r.hostId,
          host: host ? {
            _id: host._id,
            name: host.name,
            email: host.email,
          } : null,
          enrolledUsers: users.map(user => user ? {
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone
          } : null)
        }
      });
    } catch (err) {
      next(err);
    }
	});

module.exports = router;
