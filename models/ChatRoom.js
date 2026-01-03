const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const chatRoomSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: false, index: true },
  roomName: { type: String, required: true },
  sessionTitle: { type: String },
  messages: [chatMessageSchema],
});

chatRoomSchema.index({ roomId: 1, sessionId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('ChatRoom', chatRoomSchema);
