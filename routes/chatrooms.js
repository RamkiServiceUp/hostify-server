const express = require('express');
const ChatRoom = require('../models/ChatRoom');
const auth = require('../middleware/auth');
const router = express.Router();

// Get all messages for a specific room session
router.get('/:roomId/sessions/:sessionId/messages', auth, async (req, res, next) => {
  try {
    const { roomId, sessionId } = req.params;
    const chatRoom = await ChatRoom.findOne({ roomId, sessionId });
    if (!chatRoom) return res.json({ messages: [] });
    res.json({ messages: chatRoom.messages });
  } catch (err) {
    next(err);
  }
});

// Post a new message scoped to a specific session within a room
router.post('/:roomId/sessions/:sessionId/messages', auth, async (req, res, next) => {
  try {
    const { message, roomName, sessionTitle } = req.body;
    const { roomId, sessionId } = req.params;
    if (!message) return res.status(400).json({ message: 'Message is required' });

    let chatRoom = await ChatRoom.findOne({ roomId, sessionId });
    if (!chatRoom) {
      if (!roomName) return res.status(400).json({ message: 'roomName required for new chatroom' });
      chatRoom = new ChatRoom({
        roomId,
        sessionId,
        roomName,
        sessionTitle,
        messages: [],
      });
    }

    const chatMsg = {
      userId: req.user._id,
      userName: req.user.name,
      message,
      createdAt: new Date(),
    };

    chatRoom.messages.push(chatMsg);
    await chatRoom.save();

    const io = req.app.get('io');
    if (io) {
      const channelKey = `${roomId}:${sessionId}`;
      io.to(channelKey).emit('chat:newMessage', chatMsg);
    }

    res.status(201).json({ message: chatMsg });
  } catch (err) {
    next(err);
  }
});

// Backward compatible room-level messages (no session) - kept for legacy usage
router.get('/:roomId/messages', auth, async (req, res, next) => {
  try {
    const chatRoom = await ChatRoom.findOne({ roomId: req.params.roomId, sessionId: { $exists: false } });
    if (!chatRoom) return res.json({ messages: [] });
    res.json({ messages: chatRoom.messages });
  } catch (err) {
    next(err);
  }
});

router.post('/:roomId/messages', auth, async (req, res, next) => {
  try {
    const { message, roomName } = req.body;
    const { roomId } = req.params;
    if (!message) return res.status(400).json({ message: 'Message is required' });

    let chatRoom = await ChatRoom.findOne({ roomId, sessionId: { $exists: false } });
    if (!chatRoom) {
      if (!roomName) return res.status(400).json({ message: 'roomName required for new chatroom' });
      chatRoom = new ChatRoom({ roomId, roomName, messages: [] });
    }

    const chatMsg = {
      userId: req.user._id,
      userName: req.user.name,
      message,
      createdAt: new Date(),
    };

    chatRoom.messages.push(chatMsg);
    await chatRoom.save();

    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('chat:newMessage', chatMsg);
    }

    res.status(201).json({ message: chatMsg });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
