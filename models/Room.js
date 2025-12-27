const mongoose = require('mongoose');



const sessionSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
  },
  title: { type: String, required: true },
  description: { type: String },
  startDateTime: { type: Date, required: true },
  endDateTime: { type: Date, required: true },
  status: {
    type: String,
    enum: ['upcoming', 'live', 'ended'],
    default: 'upcoming',
  },
  channelName: { type: String, required: false },
  uuid: { type: String, required: false },
  attendees: [{
    id: { type: Number },
    username: { type: String },
    role: { type: String, enum: ['host', 'audience'] },
    isMuted: { type: Boolean },
    isCameraOn: { type: Boolean },
    isHandRaised: { type: Boolean },
    isScreenSharing: { type: Boolean }
  }],
  createdAt: { type: Date, default: Date.now },
});

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
  category: {
    type: String,
    trim: true,
    maxlength: 100,
    default: 'General',
  },
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  hostName: {
    type: String,
    trim: true,
    maxlength: 100,
    default: '',
  },
  price: {
    type: Number,
    default: 0,
    min: 0,
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
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
    index: true,
  },
  sessions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
  }],
  startDateTime: {
    type: Date,
    required: true,
  },
  endDateTime: {
    type: Date,
    required: true,
  },
});

const Room = mongoose.model('Room', roomSchema);
const Session = mongoose.model('Session', sessionSchema);

module.exports = { Room, Session };
