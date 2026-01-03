const express = require('express');
const { body, validationResult } = require('express-validator');
const PayoutRequest = require('../models/PayoutRequest');
const Earning = require('../models/Earning');
const User = require('../models/User');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// Middleware to ensure user is authenticated
router.use(auth);

// POST /api/payouts - Create new payout request
router.post(
  '/',
  [
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('bankAccount.accountHolderName').notEmpty().withMessage('Account holder name is required'),
    body('bankAccount.bankName').notEmpty().withMessage('Bank name is required'),
    body('bankAccount.accountNumber').notEmpty().withMessage('Account number is required'),
    body('bankAccount.ifscCode').notEmpty().withMessage('IFSC code is required'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { amount, bankAccount, notes } = req.body;
      const hostId = req.user.id;

      // Check if host has sufficient available balance
      const earnings = await Earning.find({ hostId });
      const totalEarnings = earnings.reduce((sum, e) => sum + e.amount, 0);

      // Calculate pending payouts
      const pendingPayouts = await PayoutRequest.find({
        hostId,
        status: { $in: ['pending', 'processing'] },
      });
      const pendingAmount = pendingPayouts.reduce((sum, p) => sum + p.amount, 0);

      const availableBalance = totalEarnings - pendingAmount;

      if (amount > availableBalance) {
        return res.status(400).json({
          message: 'Insufficient balance',
          availableBalance,
        });
      }

      const payout = new PayoutRequest({
        hostId,
        amount,
        bankAccount,
        notes,
        status: 'pending',
      });

      await payout.save();

      res.status(201).json(payout);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/payouts - Get all payout requests for authenticated host
router.get('/', async (req, res, next) => {
  try {
    const hostId = req.user.id;

    const payouts = await PayoutRequest.find({ hostId }).sort({ createdAt: -1 });

    res.json(payouts);
  } catch (err) {
    next(err);
  }
});

// GET /api/payouts/earnings/summary - Get host earnings summary (must come before /:id)
router.get('/earnings/summary', async (req, res, next) => {
  try {
    const hostId = req.user.id;

    const earnings = await Earning.find({ hostId });
    const totalEarnings = earnings.reduce((sum, e) => sum + e.amount, 0);

    const pendingPayouts = await PayoutRequest.find({
      hostId,
      status: { $in: ['pending', 'processing'] },
    });
    const pendingAmount = pendingPayouts.reduce((sum, p) => sum + p.amount, 0);

    const completedPayouts = await PayoutRequest.find({
      hostId,
      status: 'completed',
    });
    const withdrawnAmount = completedPayouts.reduce((sum, p) => sum + p.amount, 0);

    const availableBalance = totalEarnings - pendingAmount;

    res.json({
      totalEarnings,
      availableBalance,
      pendingBalance: pendingAmount,
      withdrawnAmount,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/payouts/:id - Get specific payout request
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const hostId = req.user.id;

    const payout = await PayoutRequest.findOne({
      _id: id,
      hostId,
    });

    if (!payout) {
      return res.status(404).json({ message: 'Payout request not found' });
    }

    res.json(payout);
  } catch (err) {
    next(err);
  }
});

// PUT /api/payouts/:id - Update payout request (draft/pending only)
router.put('/:id', validate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const hostId = req.user.id;
    const { amount, bankAccount, notes } = req.body;

    const payout = await PayoutRequest.findOne({
      _id: id,
      hostId,
    });

    if (!payout) {
      return res.status(404).json({ message: 'Payout request not found' });
    }

    // Only allow updates if status is pending
    if (payout.status !== 'pending') {
      return res.status(400).json({
        message: 'Can only update pending payout requests',
      });
    }

    // If amount changed, validate available balance
    if (amount && amount !== payout.amount) {
      const earnings = await Earning.find({ hostId });
      const totalEarnings = earnings.reduce((sum, e) => sum + e.amount, 0);

      const pendingPayouts = await PayoutRequest.find({
        hostId,
        status: { $in: ['pending', 'processing'] },
        _id: { $ne: id },
      });
      const pendingAmount = pendingPayouts.reduce((sum, p) => sum + p.amount, 0);

      const availableBalance = totalEarnings - pendingAmount;

      if (amount > availableBalance) {
        return res.status(400).json({
          message: 'Insufficient balance',
          availableBalance,
        });
      }

      payout.amount = amount;
    }

    if (bankAccount) {
      payout.bankAccount = { ...payout.bankAccount, ...bankAccount };
    }

    if (notes !== undefined) {
      payout.notes = notes;
    }

    await payout.save();

    res.json(payout);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/payouts/:id/status - Update payout status (admin only in production)
router.patch('/:id/status', [body('status').isIn(['pending', 'processing', 'completed', 'failed'])], validate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const hostId = req.user.id;

    const payout = await PayoutRequest.findOne({
      _id: id,
      hostId,
    });

    if (!payout) {
      return res.status(404).json({ message: 'Payout request not found' });
    }

    payout.status = status;

    if (status === 'completed') {
      payout.completedDate = new Date();
    }

    await payout.save();

    res.json(payout);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/payouts/:id - Cancel payout request (pending only)
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const hostId = req.user.id;

    const payout = await PayoutRequest.findOne({
      _id: id,
      hostId,
    });

    if (!payout) {
      return res.status(404).json({ message: 'Payout request not found' });
    }

    // Only allow deletion if status is pending
    if (payout.status !== 'pending') {
      return res.status(400).json({
        message: 'Can only cancel pending payout requests',
      });
    }

    await PayoutRequest.findByIdAndDelete(id);

    res.json({ message: 'Payout request cancelled successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
