const jwt = require('../utils/jwt');

module.exports = (roles = []) => {
  if (typeof roles === 'string') roles = [roles];
  return (req, res, next) => {
    // If req.user is not set, try to extract from JWT
    if (!req.user) {
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        try {
          req.user = jwt.verifyAccessToken(token);
        } catch {
          return res.status(401).json({ message: 'Invalid or expired token' });
        }
      } else {
        return res.status(401).json({ message: 'No token provided' });
      }
    }
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: insufficient role' });
    }
    next();
  };
};