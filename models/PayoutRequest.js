const mongoose = require('mongoose');

const payoutRequestSchema = new mongoose.Schema({
  payoutNumber: {
    type: String,
    unique: true,
    required: true,
  },
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
    index: true,
  },
  bankAccount: {
    accountHolderName: String,
    bankName: String,
    accountNumber: String,
    ifscCode: String,
  },
  requestDate: {
    type: Date,
    default: Date.now,
  },
  completedDate: Date,
  notes: String,
  failureReason: String,
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Auto-generate payout number
payoutRequestSchema.pre('save', async function (next) {
  if (this.isNew) {
    const count = await mongoose.model('PayoutRequest').countDocuments();
    this.payoutNumber = `PRQ${String(count + 1).padStart(6, '0')}`;
  }
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('PayoutRequest', payoutRequestSchema);
