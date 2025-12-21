const express = require('express');
const ChatRoom = require('../models/ChatRoom');
const auth = require('../middleware/auth');
const router = express.Router();

// Get all messages for a room (by roomId or roomName)
router.get('/:roomId/messages', auth, async (req, res, next) => {
  try {
    const chatRoom = await ChatRoom.findOne({ roomId: req.params.roomId });
    if (!chatRoom) return res.json({ messages: [] });
    res.json({ messages: chatRoom.messages });
  } catch (err) {
    next(err);
  }
});

// Post a new message to a room
router.post('/:roomId/messages', auth, async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ message: 'Message is required' });
    let chatRoom = await ChatRoom.findOne({ roomId: req.params.roomId });
    if (!chatRoom) {
      // Optionally, require roomName in body for new chatroom creation
      if (!req.body.roomName) return res.status(400).json({ message: 'roomName required for new chatroom' });
      chatRoom = new ChatRoom({
        roomId: req.params.roomId,
        roomName: req.body.roomName,
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
    // Emit socket event if io is available
    if (req.app.get('io')) {
      req.app.get('io').to(req.params.roomId).emit('chat:newMessage', chatMsg);
    }
    res.status(201).json({ message: chatMsg });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
