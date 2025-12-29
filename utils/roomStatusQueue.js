const { Room, Session } = require('../models/Room');
const Enrollment = require('../models/Enrollment');
const Notification = require('../models/Notification');
const { emitNotificationToUser } = require('./notificationEmitter');
const Queue = require('bull');

// Create a Bull queue for session notifications
const sessionQueue = new Queue('sessionQueue', {
  redis: { port: 6379, host: '127.0.0.1' },
});

// Add jobs to the queue for 15-min notifications, live, and ended events
async function scheduleSessionJobs() {
  const now = new Date();
  const soon = new Date(now.getTime() + 15 * 60 * 1000);
  const notifySessions = await Session.find({
    status: 'upcoming',
    startDateTime: { $gte: new Date(now.getTime() + 14.5 * 60 * 1000), $lt: soon },
  });
  for (const session of notifySessions) {
    await sessionQueue.add('notify15min', { sessionId: session._id }, { delay: 0 });
  }
  // Add jobs for live and ended events as needed
}

// Process jobs
sessionQueue.process('notify15min', async (job) => {
  const session = await Session.findById(job.data.sessionId);
  if (!session) return;
  const room = await Room.findById(session.roomId);
  if (!room) return;
  // Notify host
  const notification = await Notification.create({
    userId: room.hostId,
    title: 'Session starting soon',
    message: `Session '${session.name || session.title }' in room '${room.name ||room.title}' starts in 15 minutes.`,
    type: 'session',
  });
  emitNotificationToUser(room.hostId.toString(), notification);
  // Notify enrolled users
  const enrollments = await Enrollment.find({ roomId: room._id });
  for (const enrollment of enrollments) {
    const userNotification = await Notification.create({
      userId: enrollment.userId,
      title: 'Session starting soon',
      message: `Session '${session.name || session.title }' in room '${room.name ||room.title}' starts in 15 minutes.`,
      type: 'session',
    });
    emitNotificationToUser(enrollment.userId.toString(), userNotification);
  }
});

module.exports = { scheduleSessionJobs };
