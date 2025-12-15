
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

const router = express.Router();
// In-memory category list (replace with DB in production)
let categories = [
  'Technology',
  'Yoga Trainer',
  'Music',
  'Art',
  'Cooking',
  'Business',
  'Fitness',
  'Language',
  'Other'
];
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


// GET /api/rooms
router.get('/', async (req, res, next) => {
  try {
    const rooms = await Room.find().sort({ startTime: 1 });
    res.json({ rooms });
  } catch (err) {
    next(err);
  }
});

// GET /api/rooms/:id
router.get('/:id', [param('id').isMongoId()], validate, async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    res.json({ room });
  } catch (err) {
    next(err);
  }
});

// POST /api/rooms (host only)
router.post(
  '/',
  auth,
  authorize('host'),
  upload.single('banner'),
  [
    body('title').isString().isLength({ min: 2, max: 200 }),
    body('description').optional().isString().isLength({ max: 2000 }),
    body('price').isNumeric().custom((v) => v >= 99),
    body('startTime').isISO8601(),
    body('endTime').isISO8601(),
    body('roomDuration').isInt({ min: 1 }),
    body('seatsAvailable').isInt({ min: 1 }),
    body('status').optional().isIn(['upcoming', 'live', 'ended']),
    body('categories').optional().isString().isLength({ min: 2, max: 50 })
  ],
  validate,
  async (req, res, next) => {
    try {
      const { title, description, price, startTime, endTime, roomDuration, seatsAvailable, status, category } = req.body;
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

// PUT /api/rooms/:id (host only, must own)
router.put(
  '/:id',
  auth,
  authorize('host'),
  upload.single('banner'),
  validate,
  async (req, res, next) => {
    try {
      const room = await Room.findById(req.params.id);
      console.log('PUT /api/rooms/:id req.body:', req.body);
      if (!room) return res.status(404).json({ message: 'Room not found' });
      if (String(room.hostId) !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden: not your room' });
      }
      if (req.body.startTime && req.body.endTime && new Date(req.body.endTime) <= new Date(req.body.startTime)) {
        return res.status(422).json({ message: 'endTime must be after startTime' });
      }
      if (req.body.price !== undefined && req.body.price < 99) {
        return res.status(422).json({ message: 'Minimum price is ₹99' });
      }
      // Ensure seatsAvailable is a number if present
      if (req.body.seatsAvailable !== undefined) {
        room.seatsAvailable = Number(req.body.seatsAvailable);
      }
      // Update banner if file is present
      if (req.file) {
        room.banner = req.file.buffer;
      }
      Object.assign(room, req.body);
      await room.save();
      res.json({ room });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/rooms/:id (host only, must own)
router.delete('/:id', auth, authorize('host'), [param('id').isMongoId()], validate, async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    if (String(room.hostId) !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: not your room' });
    }
    await room.deleteOne();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
