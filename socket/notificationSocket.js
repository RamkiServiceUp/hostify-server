const { Server } = require('socket.io');
const Notification = require('../models/Notification');
const Room = require('../models/Room');

function setupNotificationSocket(io) {

  io.on('connection', (socket) => {
    // Join user to their own room for direct notifications
    socket.on('notification:join', (userId) => {
      socket.join(userId);
    });

    // Host or user can join a room for room-based notifications
    socket.on('notification:joinRoom', (roomId) => {
      socket.join(`room_${roomId}`);
    });
  });

  // Helper to emit notification to a user
  function sendNotificationToUser(userId, notification) {
    io.to(userId).emit('notification', notification);
  }

  // Helper to emit notification to all enrolled users and host
  async function sendRoomNotification(roomId, notification) {
    const room = await Room.findById(roomId);
    if (!room) return;
    // Notify host
    io.to(room.hostId.toString()).emit('notification', notification);
    // Notify enrolled users
    if (Array.isArray(room.enrolledUsers)) {
      room.enrolledUsers.forEach(userId => {
        io.to(userId.toString()).emit('notification', notification);
      });
    }
  }

  return {
    sendNotificationToUser,
    sendRoomNotification,
    io,
  };
}

module.exports = setupNotificationSocket;
