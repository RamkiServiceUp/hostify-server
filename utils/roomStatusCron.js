
const cron = require('node-cron');
const { Room, Session } = require('../models/Room');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');
const Notification = require('../models/Notification');

const { emitNotificationToUser, emitRoomNotification } = require('./notificationEmitter');
async function sendNotification(userId, title, message, type = 'session', roomId = null, session = null) {
  const notification = await Notification.create({ userId, title, message, type });
  // Emit real-time notification to user
  emitNotificationToUser(userId.toString(), {
    _id: notification._id,
    userId,
    title,
    message,
    type,
    roomId,
    session,
    createdAt: notification.createdAt,
    read: false,
  });
}

// 15-min prior notification for sessions
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    const soon = new Date(now.getTime() + 15 * 60 * 1000);
    // Sessions starting in 15 minutes
    const notifySessions = await Session.find({
      status: 'upcoming',
      startDateTime: { $gte: new Date(now.getTime() + 14.5 * 60 * 1000), $lt: soon }
    });
    for (const session of notifySessions) {
      const room = await Room.findById(session.roomId);
      if (!room) continue;
      // Notify host
      await sendNotification(room.hostId, `Session starting soon`, `Session '${session.title}' in room '${room.title}' starts in 15 minutes.`, 'session', room._id, session);
      // Notify enrolled users
      const enrollments = await Enrollment.find({ roomId: room._id });
      for (const enrollment of enrollments) {
        await sendNotification(enrollment.userId, `Session starting soon`, `Session '${session.title}' in room '${room.title}' starts in 15 minutes.`, 'session', room._id, session);
      }
      // Mark session as notified (optional: add a field if needed)
    }
  } catch (err) {
    console.error('Pre-session notification cron error:', err);
  }
});

// Session and Room status update cron
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    // Sessions that should be live
    const liveSessions = await Session.find({ status: 'upcoming', startDateTime: { $lte: now }, endDateTime: { $gt: now } });
    for (const session of liveSessions) {
      session.status = 'live';
      await session.save();
      const room = await Room.findById(session.roomId);
      if (room) {
        await sendNotification(room.hostId, `Session is live`, `Session '${session.title}' in room '${room.title}' is now live.`, 'session', room._id, session);
        const enrollments = await Enrollment.find({ roomId: room._id });
        for (const enrollment of enrollments) {
          await sendNotification(enrollment.userId, `Session is live`, `Session '${session.title}' in room '${room.title}' is now live.`, 'session', room._id, session);
        }
      }
    }
    // Sessions that should be ended
    const endedSessions = await Session.find({ status: { $in: ['upcoming', 'live'] }, endDateTime: { $lte: now } });
    for (const session of endedSessions) {
      session.status = 'ended';
      await session.save();
      const room = await Room.findById(session.roomId);
      if (room) {
        await sendNotification(room.hostId, `Session ended`, `Session '${session.title}' in room '${room.title}' has ended.`, 'session', room._id, session);
        const enrollments = await Enrollment.find({ roomId: room._id });
        for (const enrollment of enrollments) {
          await sendNotification(enrollment.userId, `Session ended`, `Session '${session.title}' in room '${room.title}' has ended.`, 'session', room._id, session);
        }
      }
    }
    // Room status update based on sessions
    const allRooms = await Room.find({});
    for (const room of allRooms) {
      const sessions = await Session.find({ roomId: room._id });
      if (sessions.some(s => s.status === 'live')) {
        if (room.status !== 'live') {
          room.status = 'live';
          await room.save();
        }
      } else if (sessions.every(s => s.status === 'ended')) {
        if (room.status !== 'ended') {
          room.status = 'ended';
          await room.save();
        }
      } else if (sessions.every(s => s.status === 'upcoming')) {
        if (room.status !== 'upcoming') {
          room.status = 'upcoming';
          await room.save();
        }
      }
    }
  } catch (err) {
    console.error('Room/session status cron error:', err);
  }
});
