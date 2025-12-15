const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  refreshToken: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: '7d' }
});

module.exports = mongoose.models.Token || mongoose.model('Token', tokenSchema);
