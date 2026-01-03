const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Onboarding = require('../models/Onboarding');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// GET /users/profile - Get current user's profile with onboarding details
router.get('/profile', auth, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get user details (exclude password)
    const user = await User.findById(userId).select('-password -refreshToken');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get onboarding details
    const onboarding = await Onboarding.findOne({ userId, role: user.role });

    res.status(200).json({
      user,
      onboarding: onboarding || null,
    });
  } catch (error) {
    next(error);
  }
});

// GET /users/:id - Get specific user's public profile
router.get('/:id', async (req, res, next) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId).select('-password -refreshToken');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Only show onboarding if user is a host (for public viewing)
    let onboarding = null;
    if (user.role === 'host') {
      onboarding = await Onboarding.findOne({ userId, role: 'host' });
    }

    res.status(200).json({
      user,
      onboarding: onboarding || null,
    });
  } catch (error) {
    next(error);
  }
});

// POST /users/change-password - Change user password
router.post(
  '/change-password',
  auth,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      // Get user with password (explicitly select password field)
      const user = await User.findById(userId).select('+password');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Verify current password
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }

      // Assign plain new password; model pre-save hook will hash it
      user.password = newPassword;
      await user.save();

      res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /users/account - Delete user account
router.delete('/account', auth, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Delete user
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete associated onboarding records
    await Onboarding.deleteMany({ userId });

    // Note: In a real application, you might want to:
    // - Archive user data instead of deleting
    // - Delete related documents (rooms, enrollments, earnings, etc.)
    // - Log the deletion for compliance

    res.status(200).json({ message: 'Account deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
