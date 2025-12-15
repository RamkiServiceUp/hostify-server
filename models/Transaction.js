const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
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
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  paymentId: {
    type: String,
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['created', 'paid', 'failed'],
    required: true,
    index: true,
  },
  platformCommission: {
    type: Number,
    required: true,
    min: 0,
  },
  hostEarning: {
    type: Number,
    required: true,
    min: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
    index: true,
  },
});

module.exports = mongoose.model('Transaction', transactionSchema);
