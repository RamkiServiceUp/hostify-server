
const express = require('express');


const { body } = require('express-validator');
const User = require('../models/User');
const jwtUtil = require('../utils/jwt');
const csrfUtil = require('../utils/csrf');
const validate = require('../middleware/validate');
const config = require('../config/default');

const router = express.Router();

// POST /api/auth/register
router.post(
  '/register',
  [
    body('name').isString().isLength({ min: 2, max: 100 }),
    body('phone').isString().matches(/^\+?[0-9]{7,15}$/),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('userType').isIn(['host', 'user']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, phone, email, password, userType } = req.body;
      if (await User.findOne({ email })) {
        return res.status(409).json({ message: 'Email already registered' });
      }
      if (await User.findOne({ phone })) {
        return res.status(409).json({ message: 'Phone already registered' });
      }
      const user = await User.create({ name, phone, email, password, role: userType });
      res.status(201).json({ message: 'User registered', user: { id: user._id, name: user.name, phone: user.phone, email: user.email, userType: user.role } });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').exists(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email }).select('+password');
      if (!user || !(await user.comparePassword(password))) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      const accessToken = jwtUtil.signAccessToken({ id: user._id, email: user.email, role: user.role });
      const refreshToken = jwtUtil.signRefreshToken({ id: user._id, email: user.email, role: user.role });
      const csrfToken = csrfUtil.generateCsrfToken();
      // Set cookies
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        domain: config.cookieDomain,
        path: '/api/auth/refresh',
      });
      res.cookie('csrfToken', csrfToken, {
        httpOnly: false,
        secure: config.nodeEnv === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000,
        domain: config.cookieDomain,
      });
      res.json({ accessToken, csrfToken });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;
    if (!refreshToken) return res.status(401).json({ message: 'No refresh token' });
    let payload;
    try {
      payload = jwtUtil.verifyRefreshToken(refreshToken);
    } catch {
      return res.status(403).json({ message: 'Invalid refresh token' });
    }
    const accessToken = jwtUtil.signAccessToken({ id: payload.id, email: payload.email, role: payload.role });
    const csrfToken = csrfUtil.generateCsrfToken();
    res.cookie('csrfToken', csrfToken, {
      httpOnly: false,
      secure: config.nodeEnv === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
      domain: config.cookieDomain,
    });
    res.json({ accessToken, csrfToken });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken', { path: '/api/auth/refresh', domain: config.cookieDomain });
  res.clearCookie('csrfToken', { domain: config.cookieDomain });
  res.status(204).send();
});

// GET /api/auth/me
router.get('/me', async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ message: 'No token' });
    const token = authHeader.replace('Bearer ', '');
    let payload;
    try {
      payload = jwtUtil.verifyAccessToken(token);
    } catch {
      return res.status(401).json({ message: 'Invalid token' });
    }
    const user = await User.findById(payload.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
