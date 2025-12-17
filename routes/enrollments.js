
const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const Enrollment = require('../models/Enrollment');
const Room = require('../models/Room');

const router = express.Router();


/**
 * GET /api/enrollments/host/:hostId/total
 * Get total enrollments for all rooms created by a host
 */
router.get(
  '/host/:hostId/total',
  auth,
  authorize('host'),
  [param('hostId').isMongoId()],
  validate,
  async (req, res, next) => {
    try {
      const { hostId } = req.params;
      // Find all room IDs created by this host with status 'upcoming' or 'live'
      const rooms = await Room.find({ hostId, status: { $in: ['upcoming', 'live'] } }).select('_id');
      const roomIds = rooms.map(r => r._id);
      // Count enrollments for these rooms
      const totalEnrollments = await Enrollment.countDocuments({ roomId: { $in: roomIds } });
      res.json({ totalEnrollments });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/enrollments/rooms
 * Get all rooms the logged-in user is enrolled in
 */
router.get('/rooms', auth, async (req, res, next) => {
  try {
    const enrollments = await Enrollment.find({ userId: req.user.id })
      .populate({
        path: 'roomId',
        populate: {
          path: 'hostId',
          select: 'name email phone role',
          model: 'User'
        }
      });

    const rooms = enrollments
      .map(enrollment => {
        const room = enrollment.roomId?.toObject?.() || enrollment.roomId;
        if (!room) return null;

        const host = room.hostId;
        return {
          ...room,
          hostId: host?._id || room.hostId,
          host: host
            ? {
                _id: host._id,
                name: host.name,
                email: host.email,
                phone: host.phone,
                role: host.role
              }
            : null
        };
      })
      .filter(Boolean);

    res.json({ rooms });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/enrollments
 * Enroll user in a room
 */
router.post(
  '/',
  auth,
  [
    body('roomId').isMongoId(),
    body('paymentId').isString().notEmpty()
  ],
  validate,
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { roomId, paymentId } = req.body;

      const exists = await Enrollment.findOne({ userId, roomId });
      if (exists) {
        return res.status(409).json({ message: 'Already enrolled' });
      }

      const room = await Room.findById(roomId);
      if (!room) {
        return res.status(404).json({ message: 'Room not found' });
      }

      if (room.seatsAvailable <= 0) {
        return res.status(422).json({ message: 'No seats available' });
      }

      const enrollment = await Enrollment.create({
        userId,
        roomId,
        paymentId
      });

      room.seatsAvailable -= 1;
      await room.save();

      res.status(201).json({ enrollment });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/enrollments
 * Get all enrollments of logged-in user
 */
router.get('/', auth, async (req, res, next) => {
  try {
    const enrollments = await Enrollment.find({ userId: req.user.id })
      .populate('roomId');
    res.json({ enrollments });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/enrollments/room/:roomId
 * Host: get all enrollments for a room
 */
router.get(
  '/room/:roomId',
  auth,
  authorize('host'),
  [param('roomId').isMongoId()],
  validate,
  async (req, res, next) => {
    try {
      const { roomId } = req.params;
      const enrollments = await Enrollment.find({ roomId })
        .populate('userId');
      res.json({ enrollments });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/enrollments/:enrollmentId
 * Cancel enrollment
 */
router.delete(
  '/:enrollmentId',
  auth,
  [param('enrollmentId').isMongoId()],
  validate,
  async (req, res, next) => {
    try {
      const { enrollmentId } = req.params;
      const enrollment = await Enrollment.findById(enrollmentId);
      if (!enrollment) {
        return res.status(404).json({ message: 'Enrollment not found' });
      }
      if (String(enrollment.userId) !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      // Increment seats
      const room = await Room.findById(enrollment.roomId);
      if (room) {
        room.seatsAvailable += 1;
        await room.save();
      }
      await enrollment.deleteOne();
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
