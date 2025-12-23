const { Server } = require('socket.io');
const jwt = require('./utils/jwt');
const Enrollment = require('./models/Enrollment');
const Room = require('./models/Room');

const registerChatSocket = require('./socket/chatSocket');
const registerAttendanceSocket = require('./socket/attendanceSocket');


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


  // Register chat socket events
  registerChatSocket(io);
  // Register attendance socket events
  registerAttendanceSocket(io);

  return io;
}

module.exports = setupSocket;
