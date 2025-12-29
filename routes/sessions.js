const express = require('express');
const router = express.Router();
const { Session, Room } = require('../models/Room');
const User = require('../models/User');
const Enrollment = require('../models/Enrollment');
const Notification = require('../models/Notification');
const { sendNotificationToUser } = require('../utils/notificationEmitter');
// Update a session and notify host and enrolled users
router.put('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    let updates = req.body;
    // Ensure date fields are Date objects
    if (updates.startDateTime) {
      updates.startDateTime = new Date(updates.startDateTime);
    }
    if (updates.endDateTime) {
      updates.endDateTime = new Date(updates.endDateTime);
    }
    const session = await Session.findByIdAndUpdate(sessionId, updates, { new: true });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    // Find the room for this session
    const room = await Room.findById(session.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found for session' });
    }
    // Notify host
    const hostId = room.hostId;
    const title = 'Session Updated';
    const message = `Session '${session.name || session.title || 'Untitled'}' in room '${room.title}' has been rescheduled.`;
    const notification = await Notification.create({
      userId: hostId,
      title,
      message,
      type: 'session',
    });
    sendNotificationToUser(hostId.toString(), {
      _id: notification._id,
      userId: hostId,
      title,
      message,
      type: 'session',
      roomId: room._id,
      session,
      createdAt: notification.createdAt,
      read: false,
    });
    // Notify enrolled users
    const enrollments = await Enrollment.find({ roomId: room._id });
    for (const enrollment of enrollments) {
      const userId = enrollment.userId;
      const userNotification = await Notification.create({
        userId,
        title,
        message,
        type: 'session',
      });
      sendNotificationToUser(userId.toString(), {
        _id: userNotification._id,
        userId,
        title,
        message,
        type: 'session',
        roomId: room._id,
        session,
        createdAt: userNotification.createdAt,
        read: false,
      });
    }
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update session', details: err.message });
  }
});

// End a session
router.put('/:sessionId/end', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const updates = req.body;
    const session = await Session.findByIdAndUpdate(sessionId, updates, { new: true });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: 'Failed to end session', details: err.message });
  }
});

module.exports = router;
