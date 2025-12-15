const cron = require('node-cron');
const Room = require('../models/Room');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');

async function sendNotification(user, room, type) {
  // Example: console.log, replace with real notification
  console.log(`Notify ${user.email}: Room '${room.title}' is now ${type}`);
}
// 15-min prior notification
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    const soon = new Date(now.getTime() + 15 * 60 * 1000);
    // Find rooms starting in 15 minutes (±30s window)
    const notifyRooms = await Room.find({
      status: 'upcoming',
      startTime: { $gte: new Date(now.getTime() + 14.5 * 60 * 1000), $lt: soon }
    });
    for (const room of notifyRooms) {
      const enrollments = await Enrollment.find({ roomId: room._id, preSessionNotified: { $ne: true } });
      for (const enrollment of enrollments) {
        const user = await User.findById(enrollment.userId);
        if (user) {
          await sendNotification(user, room, '15min');
          enrollment.preSessionNotified = true;
          await enrollment.save();
        }
      }
    }
  } catch (err) {
    console.error('Pre-session notification cron error:', err);
  }
});

cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    // Find rooms that should be live
    const liveRooms = await Room.find({
      status: 'upcoming',
      startTime: { $lte: now },
      endTime: { $gt: now }
    });
    for (const room of liveRooms) {
      room.status = 'live';
      await room.save();
      const enrollments = await Enrollment.find({ roomId: room._id });
      for (const enrollment of enrollments) {
        const user = await User.findById(enrollment.userId);
        if (user) await sendNotification(user, room, 'live');
      }
    }
    // Find rooms that should be ended
    const endedRooms = await Room.find({
      status: { $in: ['upcoming', 'live'] },
      endTime: { $lte: now }
    });
    for (const room of endedRooms) {
      room.status = 'ended';
      await room.save();
      const enrollments = await Enrollment.find({ roomId: room._id });
      for (const enrollment of enrollments) {
        const user = await User.findById(enrollment.userId);
        if (user) await sendNotification(user, room, 'ended');
      }
    }
  } catch (err) {
    console.error('Room status cron error:', err);
  }
});
