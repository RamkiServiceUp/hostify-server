const mongoose = require('mongoose');

const hostProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  bio: {
    type: String,
    maxlength: 1000,
    trim: true,
  },
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  profileImage: {
    type: String,
    trim: true,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
    index: true,
  },
});

module.exports = mongoose.model('HostProfile', hostProfileSchema);
