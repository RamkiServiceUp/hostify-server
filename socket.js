const { Server } = require('socket.io');
const jwt = require('./utils/jwt');
const Enrollment = require('./models/Enrollment');
const Room = require('./models/Room');

function setupSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: '*', // Adjust for production
      methods: ['GET', 'POST']
    }
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('No token'));
      const payload = jwt.verifyAccessToken(token);
      socket.user = payload;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join-room', async ({ roomId }, cb) => {
      try {
        // Check enrollment
        const enrolled = await Enrollment.findOne({ userId: socket.user.id, roomId });
        if (!enrolled) return cb && cb({ error: 'Not enrolled' });
        const room = await Room.findById(roomId);
        if (!room) return cb && cb({ error: 'Room not found' });
        if (new Date(room.endTime) < new Date()) return cb && cb({ error: 'Session ended' });
        socket.join(roomId);
        io.to(roomId).emit('user-joined', { userId: socket.user.id });
        cb && cb({ success: true });
      } catch (err) {
        cb && cb({ error: 'Join failed' });
      }
    });

    socket.on('leave-room', ({ roomId }, cb) => {
      socket.leave(roomId);
      io.to(roomId).emit('user-left', { userId: socket.user.id });
      cb && cb({ success: true });
    });

    socket.on('offer', ({ roomId, offer, to }) => {
      socket.to(roomId).emit('offer', { from: socket.user.id, offer, to });
    });

    socket.on('answer', ({ roomId, answer, to }) => {
      socket.to(roomId).emit('answer', { from: socket.user.id, answer, to });
    });

    socket.on('ice-candidate', ({ roomId, candidate, to }) => {
      socket.to(roomId).emit('ice-candidate', { from: socket.user.id, candidate, to });
    });

    socket.on('session-start', ({ roomId }) => {
      io.to(roomId).emit('session-start', { roomId });
    });

    socket.on('session-end', ({ roomId }) => {
      io.to(roomId).emit('session-end', { roomId });
      io.in(roomId).socketsLeave(roomId);
    });
  });
}

module.exports = setupSocket;
