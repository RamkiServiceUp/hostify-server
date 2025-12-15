const express = require('express');
const { body } = require('express-validator');
const HostProfile = require('../models/HostProfile');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');

const router = express.Router();

// Create host profile
router.post(
  '/profile',
  auth,
  authorize('host'),
  [
    body('displayName').isString().isLength({ min: 2, max: 100 }),
    body('bio').optional().isString().isLength({ max: 1000 }),
    body('category').isString().isLength({ min: 2, max: 100 }),
    body('profileImage').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { displayName, bio, category, profileImage } = req.body;
      const userId = req.user.id;
      const exists = await HostProfile.findOne({ userId });
      if (exists) return res.status(409).json({ message: 'Profile already exists' });
      const profile = await HostProfile.create({
        userId,
        displayName,
        bio,
        category,
        profileImage,
      });
      res.status(201).json({ profile });
    } catch (err) {
      next(err);
    }
  }
);

// Get host profile
router.get('/profile', auth, authorize('host'), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const profile = await HostProfile.findOne({ userId });
    if (!profile) return res.status(404).json({ message: 'Profile not found' });
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

// Update host profile
router.put(
  '/profile',
  auth,
  authorize('host'),
  [
    body('displayName').optional().isString().isLength({ min: 2, max: 100 }),
    body('bio').optional().isString().isLength({ max: 1000 }),
    body('category').optional().isString().isLength({ min: 2, max: 100 }),
    body('profileImage').optional().isString(),
    body('verified').optional().isBoolean(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const update = req.body;
      const profile = await HostProfile.findOneAndUpdate(
        { userId },
        { $set: update },
        { new: true, runValidators: true }
      );
      if (!profile) return res.status(404).json({ message: 'Profile not found' });
      res.json({ profile });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
