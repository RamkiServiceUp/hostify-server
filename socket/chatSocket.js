const { Session } = require('../models/Room');
const ChatRoom = require('../models/ChatRoom');

function registerChatSocket(io) {
  io.on('connection', (socket) => {
    // Join session room
    socket.on('join-room', ({ roomId }) => {
      socket.join(roomId);
    });

    // Leave session room
    socket.on('leave-room', ({ roomId }) => {
      socket.leave(roomId);
    });

    // Handle sending a chat message
    socket.on('chat:sendMessage', async (data, cb) => {
      // Save message to DB, then emit to room
      try {
        let chatRoom = await ChatRoom.findOne({ roomId: data.roomId });
        if (!chatRoom) {
          // If roomName is not provided, use a fallback
          chatRoom = new ChatRoom({
            roomId: data.roomId,
            roomName: data.roomName || 'Room', // Always provide a string
            messages: [],
          });
        }
        const chatMsg = {
          userId: data.userId,
          userName: data.userName,
          message: data.message,
          createdAt: data.createdAt || new Date(),
          roomId: data.roomId,
        };
        chatRoom.messages.push(chatMsg);
        console.log('About to save chatRoom');
        await chatRoom.save();
        console.log('Saved chatRoom');
        const savedMsg = chatRoom.messages[chatRoom.messages.length - 1];
        console.log('Emitting chat:newMessage', {
          _id: savedMsg._id,
          userId: savedMsg.userId,
          userName: savedMsg.userName,
          message: savedMsg.message,
          createdAt: savedMsg.createdAt,
          roomId: data.roomId,
        });
        io.to(data.roomId).emit('chat:newMessage', {
          _id: savedMsg._id,
          userId: savedMsg.userId,
          userName: savedMsg.userName,
          message: savedMsg.message,
          createdAt: savedMsg.createdAt,
          roomId: data.roomId,
        });
        if (cb) cb({ success: true });
      } catch (err) {
        console.error('Error in chat:sendMessage', err);
        if (cb) cb({ success: false, error: err.message });
      }
    });

    // Handle reactions (not persisted)
    socket.on('chat:react', ({ messageId, emoji, userId, roomId }) => {
      io.to(roomId).emit('chat:reaction', { messageId, emoji, userId });
    });
  });
}

module.exports = registerChatSocket;
