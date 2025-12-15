const express = require('express');
const { body } = require('express-validator');
const Enrollment = require('../models/Enrollment');
const Transaction = require('../models/Transaction');
const Room = require('../models/Room');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// POST /api/enroll
router.post(
  '/',
  auth,
  [
    body('roomId').isMongoId(),
    body('paymentId').isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { roomId, paymentId } = req.body;
      // Check for duplicate enrollment
      const exists = await Enrollment.findOne({ userId: req.user.id, roomId });
      if (exists) return res.status(409).json({ message: 'Already enrolled' });
      // Validate payment
      const txn = await Transaction.findOne({ userId: req.user.id, roomId, paymentId, status: 'paid' });
      if (!txn) return res.status(403).json({ message: 'Payment not found or not completed' });
      // Validate room timing
      const room = await Room.findById(roomId);
      if (!room) return res.status(404).json({ message: 'Room not found' });
      if (new Date(room.endTime) < new Date()) {
        return res.status(422).json({ message: 'Room has already ended' });
      }
      // Enroll
      const enrollment = await Enrollment.create({
        userId: req.user.id,
        roomId,
        paymentId,
      });
      res.status(201).json({ enrollment });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
