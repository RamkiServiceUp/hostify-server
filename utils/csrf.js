const crypto = require('crypto');
const config = require('../config/default');

function generateCsrfToken() {
  return crypto.randomBytes(24).toString('hex');
}

function verifyCsrfToken(token, sessionToken) {
  return token && sessionToken && token === sessionToken;
}

module.exports = {
  generateCsrfToken,
  verifyCsrfToken,
};
