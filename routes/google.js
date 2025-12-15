const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const router = express.Router();
const mongoose = require('mongoose');
const User = mongoose.models.User || mongoose.model('User');
const jwtSecret = process.env.JWT_SECRET;

// Google OAuth callback
router.get('/google/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).json({ message: 'No code provided' });
  try {
    // Exchange code for tokens
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', null, {
      params: {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const { id_token, access_token } = tokenRes.data;
    // Get user info
    const userRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const { email, name, sub } = userRes.data;
    // Upsert user in MongoDB
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ name, email, mobile: sub, password: '', userType: 'attendee' });
    }
    // Issue JWT
    const token = jwt.sign({ id: user._id, name: user.name, email: user.email }, jwtSecret, { expiresIn: '30m' });
    // Redirect or respond with token
    res.redirect(`${process.env.CLIENT_REDIRECT_URI || 'http://localhost:3000'}?token=${token}`);
  } catch (err) {
    res.status(500).json({ message: 'Google OAuth failed', error: err.message });
  }
});

module.exports = router;
