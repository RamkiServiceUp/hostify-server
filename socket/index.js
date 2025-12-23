
const registerChatSocket = require('./chatSocket');
const setupNotificationSocket = require('./notificationSocket');
const registerAttendanceSocket = require('./attendanceSocket');

module.exports = function(server) {
  const { Server } = require('socket.io');
  const io = new Server(server, {
    cors: {
      origin: ['http://localhost:5173', 'http://localhost:3000'],
      credentials: true,
    },
  });
  registerChatSocket(io);
  registerAttendanceSocket(io);
  const notificationHelpers = setupNotificationSocket(io);
  require('../utils/notificationEmitter').setNotificationSocket(notificationHelpers);
  return io;
};
