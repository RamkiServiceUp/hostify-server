const { Session } = require('../models/Room');
const { Room } = require('../models/Room');
const User = require('../models/User');

function registerAttendanceSocket(io) {
  io.on('connection', (socket) => {
    console.log('[attendanceSocket] New socket connection:', socket.id);

    // User joins a session (call)
    socket.on('attendance:join', async ({ sessionId, userId }) => {
      console.log(`[attendanceSocket] attendance:join received`, { sessionId, userId });
      try {
        // Add user to session's attendees if not already present
        const session = await Session.findById(sessionId);
        if (!session) {
          console.warn(`[attendanceSocket] No session found for sessionId`, sessionId);
          return;
        }
        if (!session.attendees.includes(userId)) {
          session.attendees.push(userId);
          await session.save();
          console.log(`[attendanceSocket] User ${userId} added to attendees for session ${sessionId}`);
        } else {
          console.log(`[attendanceSocket] User ${userId} already in attendees for session ${sessionId}`);
        }
        // Emit updated attendees list to the session room
        io.to(sessionId).emit('attendance:update', { attendees: session.attendees });
        console.log(`[attendanceSocket] attendance:update emitted to room ${sessionId}`, session.attendees);
      } catch (err) {
        console.error('Error in attendance:join', err);
      }
    });

    // User leaves a session (optional)
    socket.on('attendance:leave', async ({ sessionId, userId }) => {
      console.log(`[attendanceSocket] attendance:leave received`, { sessionId, userId });
      try {
        const session = await Session.findById(sessionId);
        if (!session) {
          console.warn(`[attendanceSocket] No session found for sessionId`, sessionId);
          return;
        }
        session.attendees = session.attendees.filter(id => id.toString() !== userId);
        await session.save();
        io.to(sessionId).emit('attendance:update', { attendees: session.attendees });
        console.log(`[attendanceSocket] attendance:update emitted to room ${sessionId} after leave`, session.attendees);
      } catch (err) {
        console.error('Error in attendance:leave', err);
      }
    });

    // Join socket.io room for real-time updates
    socket.on('attendance:subscribe', ({ sessionId }) => {
      socket.join(sessionId);
      console.log(`[attendanceSocket] attendance:subscribe - socket ${socket.id} joined room ${sessionId}`);
    });
  });
}

module.exports = registerAttendanceSocket;
