const registerAgoraSocket = require('./agoraSocket');


module.exports = function(server) {
  const { Server } = require('socket.io');
  const io = new Server(server, {
    cors: {
      origin: ['http://localhost:5173', 'http://localhost:3000'],
      credentials: true,
    },
  });
  registerAgoraSocket(io);
  return io;
};