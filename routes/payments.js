const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { body } = require('express-validator');
const Room = require('../models/Room');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// Razorpay instance (use env vars in production)
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// POST /api/payments/create-order
router.post(
  '/create-order',
  auth,
  [body('roomId').isMongoId()],
  validate,
  async (req, res, next) => {
    try {
      const { roomId } = req.body;
      const room = await Room.findById(roomId);
      if (!room) return res.status(404).json({ message: 'Room not found' });
      // Check if already enrolled
      if (room.enrolledUsers && room.enrolledUsers.includes(req.user.id)) {
        return res.status(409).json({ message: 'Already enrolled' });
      }
      const amount = Math.round(room.price * 100); // in paise
      const order = await razorpay.orders.create({
        amount,
        currency: 'INR',
        receipt: `${roomId}_${req.user.id}_${Date.now()}`,
        payment_capture: 1,
      });
      res.json({ orderId: order.id, amount: order.amount, currency: order.currency });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/payments/verify
router.post(
  '/verify',
  auth,
  [
    body('roomId').isMongoId(),
    body('orderId').isString(),
    body('paymentId').isString(),
    body('signature').isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { roomId, orderId, paymentId, signature } = req.body;
      // Verify signature
      const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
      hmac.update(orderId + '|' + paymentId);
      const digest = hmac.digest('hex');
      if (digest !== signature) {
        return res.status(400).json({ message: 'Invalid payment signature' });
      }
      const room = await Room.findById(roomId);
      if (!room) return res.status(404).json({ message: 'Room not found' });
      // Save transaction
      const amount = room.price;
      const platformCommission = Math.round(amount * 0.15);
      const hostEarning = amount - platformCommission;
      await Transaction.create({
        userId: req.user.id,
        roomId,
        amount,
        paymentId,
        status: 'paid',
        platformCommission,
        hostEarning,
      });
      // Enroll user
      if (!room.enrolledUsers) room.enrolledUsers = [];
      if (!room.enrolledUsers.includes(req.user.id)) {
        room.enrolledUsers.push(req.user.id);
        await room.save();
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/payments/user/:userId - get all payments for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const Transaction = require('../models/Transaction');
    const payments = await Transaction.find({ userId }).sort({ createdAt: -1 });
    res.json({ payments });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch payments' });
  }
});

module.exports = router;
