const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
    index: true,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 2000,
  },
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  price: {
    type: Number,
    default: 0,
    min: 0,
  },
  startTime: {
    type: Date,
    required: true,
    index: true,
  },
  endTime: {
    type: Date,
    required: true,
    index: true,
  },
  roomDuration: {
    type: Number, // in minutes
    required: true,
    min: 1,
  },
  status: {
    type: String,
    enum: ['upcoming', 'live', 'ended'],
    default: 'upcoming',
    index: true,
  },
  enrolledUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  seatsAvailable: {
    type: Number,
    required: true,
    min: 1,
  },
  banner: {
    type: Buffer, // store image as binary (longblob)
    required: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
    index: true,
  },
});

module.exports = mongoose.model('Room', roomSchema);
