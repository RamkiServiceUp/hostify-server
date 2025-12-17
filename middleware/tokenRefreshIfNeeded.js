const jwt = require('jsonwebtoken');
const config = require('../config/default');
const jwtUtil = require('../utils/jwt');

// Middleware to check if access token is about to expire and refresh if needed
module.exports = async function tokenRefreshIfNeeded(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return next(); // No token, skip
    const token = authHeader.replace('Bearer ', '');
    let payload;
    try {
      payload = jwt.decode(token);
    } catch {
      return next(); // Invalid token, skip
    }
    if (!payload || !payload.exp) return next();
    const now = Math.floor(Date.now() / 1000);
    const timeLeft = payload.exp - now;
    // If less than 2 minutes left, refresh
    if (timeLeft < 120 && req.cookies && req.cookies.refreshToken) {
      try {
        const refreshPayload = jwtUtil.verifyRefreshToken(req.cookies.refreshToken);
        const newAccessToken = jwtUtil.signAccessToken({ id: refreshPayload.id, email: refreshPayload.email, role: refreshPayload.role });
        const csrfToken = require('../utils/csrf').generateCsrfToken();
        res.cookie('csrfToken', csrfToken, {
          httpOnly: false,
          secure: config.nodeEnv === 'production',
          sameSite: 'strict',
          maxAge: 15 * 60 * 1000,
          domain: config.cookieDomain,
        });
        res.set('x-access-token', newAccessToken);
        // Optionally, you can attach to req for downstream use
        req.newAccessToken = newAccessToken;
        req.newCsrfToken = csrfToken;
      } catch {
        // Invalid refresh token, do nothing
      }
    }
    next();
  } catch (err) {
    next();
  }
}
