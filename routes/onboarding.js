const express = require('express');
const { body } = require('express-validator');
const Onboarding = require('../models/Onboarding');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

const hostValidations = [
  body('bio').optional().trim().isLength({ max: 500 }).withMessage('Bio must be less than 500 characters'),
  body('location').optional().trim().isLength({ max: 100 }).withMessage('Location must be less than 100 characters'),
  body('timezone').optional().trim().notEmpty().withMessage('Timezone is required if provided'),
  body('expertise').optional().isArray().withMessage('Expertise must be an array'),
  body('experience').optional().trim(),
  body('linkedinUrl').optional().trim().if(value => value && value.length > 0).isURL().withMessage('Invalid LinkedIn URL'),
  body('websiteUrl').optional().trim().if(value => value && value.length > 0).isURL().withMessage('Invalid website URL'),
  body('notificationPreferences.email').optional().isBoolean(),
  body('notificationPreferences.push').optional().isBoolean(),
  body('notificationPreferences.sms').optional().isBoolean(),
];

const userValidations = [
  body('bio').optional().trim().isLength({ max: 500 }).withMessage('Bio must be less than 500 characters'),
  body('location').optional().trim().isLength({ max: 100 }).withMessage('Location must be less than 100 characters'),
  body('timezone').optional().trim().notEmpty().withMessage('Timezone is required if provided'),
  body('interests').optional().isArray().withMessage('Interests must be an array'),
  body('learningGoals').optional().trim().isLength({ max: 500 }).withMessage('Learning goals must be less than 500 characters'),
  body('notificationPreferences.email').optional().isBoolean(),
  body('notificationPreferences.push').optional().isBoolean(),
  body('notificationPreferences.sms').optional().isBoolean(),
];

const upsertOnboarding = async ({ userId, role, payload }) => {
  let onboarding = await Onboarding.findOne({ userId });

  if (onboarding) {
    Object.assign(onboarding, payload, { role, completed: true });

    // Ensure nested notificationPreferences merges correctly
    if (payload.notificationPreferences) {
      onboarding.notificationPreferences = {
        ...onboarding.notificationPreferences,
        ...payload.notificationPreferences,
      };
    }

    await onboarding.save();
    return onboarding;
  }

  onboarding = new Onboarding({
    userId,
    role,
    ...payload,
    timezone: payload.timezone || 'UTC',
    notificationPreferences: payload.notificationPreferences || {
      email: true,
      push: true,
      sms: false,
    },
    completed: true,
  });

  await onboarding.save();
  return onboarding;
};

// HOST onboarding (separate flow)
router.post(
  '/host',
  auth,
  hostValidations,
  validate,
  async (req, res, next) => {
    try {
      if (req.user.role !== 'host') {
        return res.status(403).json({ message: 'Only hosts can complete host onboarding' });
      }

      const {
        bio,
        location,
        timezone,
        expertise,
        experience,
        linkedinUrl,
        websiteUrl,
        profilePicture,
        notificationPreferences,
      } = req.body;

      const onboarding = await upsertOnboarding({
        userId: req.user.id,
        role: 'host',
        payload: {
          bio,
          location,
          timezone,
          expertise,
          experience,
          linkedinUrl,
          websiteUrl,
          profilePicture,
          notificationPreferences,
        },
      });

      res.status(200).json({
        message: 'Host onboarding completed successfully',
        onboarding,
      });
    } catch (error) {
      next(error);
    }
  }
);

// USER onboarding (separate flow)
router.post(
  '/user',
  auth,
  userValidations,
  validate,
  async (req, res, next) => {
    try {
      if (req.user.role !== 'user') {
        return res.status(403).json({ message: 'Only users can complete user onboarding' });
      }

      const {
        bio,
        location,
        timezone,
        interests,
        learningGoals,
        profilePicture,
        notificationPreferences,
      } = req.body;

      const onboarding = await upsertOnboarding({
        userId: req.user.id,
        role: 'user',
        payload: {
          bio,
          location,
          timezone,
          interests,
          learningGoals,
          profilePicture,
          notificationPreferences,
        },
      });

      res.status(200).json({
        message: 'User onboarding completed successfully',
        onboarding,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/onboarding/status - Get onboarding status
router.get('/status', auth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const onboarding = await Onboarding.findOne({ userId, role: req.user.role });

    if (!onboarding) {
      return res.status(200).json({
        completed: false,
        onboarding: null,
      });
    }

    res.status(200).json({
      completed: onboarding.completed,
      onboarding,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/onboarding - Get onboarding details
router.get('/', auth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const onboarding = await Onboarding.findOne({ userId, role: req.user.role }).populate('userId', 'name email role');

    if (!onboarding) {
      return res.status(404).json({
        message: 'Onboarding not found',
      });
    }

    res.status(200).json({
      onboarding,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/onboarding - Update onboarding data
router.put(
  '/',
  auth,
  [
    body('bio').optional().trim().isLength({ max: 500 }),
    body('location').optional().trim().isLength({ max: 100 }),
    body('timezone').optional().trim(),
    body('expertise').optional().isArray(),
    body('experience').optional().trim(),
    body('linkedinUrl').optional().trim().isURL(),
    body('websiteUrl').optional().trim().isURL(),
    body('interests').optional().isArray(),
    body('learningGoals').optional().trim().isLength({ max: 500 }),
    body('notificationPreferences.email').optional().isBoolean(),
    body('notificationPreferences.push').optional().isBoolean(),
    body('notificationPreferences.sms').optional().isBoolean(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const role = req.user.role;
      const updateData = req.body;

      const allowedKeys = role === 'host'
        ? ['bio', 'location', 'timezone', 'expertise', 'experience', 'linkedinUrl', 'websiteUrl', 'profilePicture', 'notificationPreferences']
        : ['bio', 'location', 'timezone', 'interests', 'learningGoals', 'profilePicture', 'notificationPreferences'];

      const sanitizedUpdate = {};
      for (const key of Object.keys(updateData)) {
        if (allowedKeys.includes(key)) {
          sanitizedUpdate[key] = updateData[key];
        }
      }

      sanitizedUpdate.role = role;
      sanitizedUpdate.updatedAt = new Date();

      const onboarding = await Onboarding.findOneAndUpdate(
        { userId, role },
        sanitizedUpdate,
        { new: true, runValidators: true }
      );

      if (!onboarding) {
        return res.status(404).json({
          message: 'Onboarding not found',
        });
      }

      res.status(200).json({
        message: 'Onboarding updated successfully',
        onboarding,
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/onboarding - Delete onboarding data (optional)
router.delete('/', auth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const onboarding = await Onboarding.findOneAndDelete({ userId, role: req.user.role });

    if (!onboarding) {
      return res.status(404).json({
        message: 'Onboarding not found',
      });
    }

    res.status(200).json({
      message: 'Onboarding deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
