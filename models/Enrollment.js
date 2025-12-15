const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
    index: true,
  },
  paymentId: {
    type: String,
    required: true,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
    index: true,
  },
  preSessionNotified: {
    type: Boolean,
    default: false,
  },
}, {
  indexes: [
    { fields: { userId: 1, roomId: 1 }, options: { unique: true } }
  ]
});

module.exports = mongoose.model('Enrollment', enrollmentSchema);
