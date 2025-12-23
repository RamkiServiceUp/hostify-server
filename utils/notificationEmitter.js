const Notification = require('../models/Notification');
const Room = require('../models/Room');
let notificationSocket = null;

function setNotificationSocket(socketInstance) {
  notificationSocket = socketInstance;
}

async function emitNotificationToUser(userId, notification) {
  if (notificationSocket) {
    notificationSocket.sendNotificationToUser(userId, notification);
  }
}

async function emitRoomNotification(roomId, notification) {
  if (notificationSocket) {
    await notificationSocket.sendRoomNotification(roomId, notification);
  }
}

module.exports = {
  setNotificationSocket,
  emitNotificationToUser,
  emitRoomNotification,
};
