function registerAgoraSocket(io) {
  // Room-scoped state keyed by channelName
  const rooms = new Map();

  const getRoom = (channelName) => {
    if (!channelName) return null;
    if (!rooms.has(channelName)) {
      rooms.set(channelName, {
        users: [],
        status: "lobby",
        screenShareUserId: null,
      });
    }
    return rooms.get(channelName);
  };

  io.on("connection", (socket) => {

    socket.on("join", async (data) => {
      let { id: participantId, userId, role, channelName } = data;
      const room = getRoom(channelName);
      if (!room) {
        socket.emit("joinError", { message: "Missing channel" });
        return;
      }

      let fullName = "";
      try {
        const User = require("../models/User.js");
        const userDoc = await User.findById(userId);
        if (userDoc) {
          fullName = userDoc.name || userDoc.fullName || userDoc.username || "";
        }
      } catch (err) {
        console.warn("[agoraSocket] Could not fetch user full name for userId", userId, err);
      }
      // Fallbacks for required fields
      const participant = {
        id: participantId,
        userId,
        username: fullName || `User${participantId}`,
        role: role || 'audience',
        isMuted: true,
        isCameraOn: false,
        isHandRaised: false,
        isScreenSharing: false,
        socketId: socket.id,
        channelName,
      };

      // Replace any existing participant with same id
      room.users = room.users.filter(u => String(u.id) !== String(participantId));
      room.users.push(participant);

      socket.join(channelName);

      try {
        const { Session } = require("../models/Room");
        const { default: mongoose } = require("mongoose");
        if (mongoose.Types.ObjectId.isValid(channelName)) {
          // Persist attendee (without socket-only fields)
          const attendeeObj = {
            id: participant.id,
            userId: participant.userId,
            username: participant.username,
            role: participant.role,
            isMuted: participant.isMuted,
            isCameraOn: participant.isCameraOn,
            isHandRaised: participant.isHandRaised,
            isScreenSharing: participant.isScreenSharing,
          };

          const session = await Session.findById(channelName);
          let attendees = Array.isArray(session?.attendees) ? [...session.attendees] : [];
          attendees.push(attendeeObj);
          const seen = new Set();
          attendees = attendees.filter(att => {
            if (seen.has(String(att.userId))) return false;
            seen.add(String(att.userId));
            return true;
          });

          await Session.findByIdAndUpdate(
            channelName,
            { attendees },
            { new: true }
          );
        } else {
          console.warn("[agoraSocket] channelName is not a valid session ObjectId:", channelName);
        }
      } catch (err) {
        console.error("[agoraSocket] Failed to add attendee to session DB:", err);
      }

      if (role === "host") {
        room.status = "live";
      }

      io.to(channelName).emit("userJoined", participant);
      socket.emit("joined", { userId: participantId, channelName });
      io.to(channelName).emit("userList", room.users);
      io.to(channelName).emit("meetingStatus", { status: room.status });

      // Load and send previous chat messages to the newly joined user
      try {
        const ChatRoom = require("../models/ChatRoom");
        const { default: mongoose } = require("mongoose");
        const { Session } = require("../models/Room");
        
        if (mongoose.Types.ObjectId.isValid(channelName)) {
          const session = await Session.findById(channelName).populate('roomId');
          if (session) {
            const roomId = session.roomId?._id || session.roomId;
            const chatRoom = await ChatRoom.findOne({ 
              roomId: roomId, 
              sessionId: channelName 
            });
            
            if (chatRoom && chatRoom.messages && chatRoom.messages.length > 0) {
              // Convert DB messages to socket message format
              const previousMessages = chatRoom.messages.map(msg => ({
                id: msg._id.toString(),
                senderId: msg.userId.toString(),
                senderName: msg.userName,
                senderRole: 'participant', // Default role
                text: msg.message,
                timestamp: new Date(msg.createdAt).getTime()
              }));
              
              // Send previous messages to the newly joined user
              socket.emit("chatHistory", previousMessages);
            }
          }
        }
      } catch (err) {
        console.error('[agoraSocket] Failed to load chat history:', err);
      }

      // If someone is already sharing, inform the new joiner so UI reflects it
      if (room.screenShareUserId) {
        const sharer = room.users.find(u => String(u.id) === String(room.screenShareUserId));
        socket.emit("screenShareStart", {
          userId: room.screenShareUserId,
          username: sharer?.username || "Screen Sharer",
        });
      } else {
      }
    });

    

    // Handle Media Toggle
    socket.on("toggleMedia", (data) => {
      const room = getRoom(data.channelName);
      if (!room) return;
      let user = room.users.find(u => u.socketId === socket.id);
      if (!user && data.userId) {
        user = room.users.find(u => String(u.id) === String(data.userId) || String(u.userId) === String(data.userId));
      }
      if (!user) return;

      if (data.type === "audio") user.isMuted = !data.enabled;
      if (data.type === "video") user.isCameraOn = data.enabled;

      const payload = {
        userId: user.id,
        type: data.type,
        enabled: data.enabled,
        availableAttendees: room.users,
      };
      io.to(user.channelName).emit("mediaStateChange", payload);
    });

    socket.on("raiseHand", (isRaised) => {
      const room = [...rooms.values()].find(r => r.users.some(u => u.socketId === socket.id));
      if (!room) return;
      const user = room.users.find(u => u.socketId === socket.id);
      if (!user) return;

      user.isHandRaised = isRaised;
      io.to(user.channelName).emit("handUpdate", {
        userId: user.id,
        isHandRaised: isRaised,
      });
    });

    // Handle Chat - Store in MongoDB and broadcast
    socket.on("chatMessage", async (text) => {
      const room = [...rooms.values()].find(r => r.users.some(u => u.socketId === socket.id));
      if (!room) return;
      const user = room.users.find(u => u.socketId === socket.id);
      if (!user) return;

      const message = {
        id: Math.random().toString(36).substr(2, 9),
        senderId: user.id,
        senderName: user.username,
        senderRole: user.role,
        text,
        timestamp: Date.now()
      };

      // Store message in MongoDB
      try {
        const ChatRoom = require("../models/ChatRoom");
        const { default: mongoose } = require("mongoose");
        const { Session } = require("../models/Room");
        
        const sessionId = user.channelName;
        if (mongoose.Types.ObjectId.isValid(sessionId)) {
          const session = await Session.findById(sessionId).populate('roomId');
          if (session) {
            const roomId = session.roomId?._id || session.roomId;
            
            let chatRoom = await ChatRoom.findOne({ 
              roomId: roomId, 
              sessionId: sessionId 
            });
            
            if (!chatRoom) {
              chatRoom = new ChatRoom({
                roomId: roomId,
                sessionId: sessionId,
                roomName: session.roomId?.title || 'Live Session',
                sessionTitle: session.title || session.name,
                messages: []
              });
            }
            
            chatRoom.messages.push({
              userId: user.userId,
              userName: user.username,
              message: text,
              createdAt: new Date(message.timestamp)
            });
            
            await chatRoom.save();
          }
        }
      } catch (err) {
        console.error('[agoraSocket] Failed to save chat message to DB:', err);
      }

      // Broadcast to all users in the same channel, including sender
      io.to(user.channelName).emit("chatMessage", message);
    });

    // Handle Reactions
    socket.on("reaction", (type) => {
      const room = [...rooms.values()].find(r => r.users.some(u => u.socketId === socket.id));
      if (!room) return;
      const user = room.users.find(u => u.socketId === socket.id);
      if (!user) return;

      io.to(user.channelName).emit("reaction", {
        id: Math.random().toString(36).substr(2, 9),
        senderId: user.id,
        type,
      });
    });

    // Handle Screen Share Start/Stop
    socket.on("screenShareStart", (data) => {
      const { userId: sharerUserId, username } = data || {};
      const room = [...rooms.values()].find(r => r.users.some(u => u.socketId === socket.id));
      if (!room) return;
      const user = room.users.find(u => u.socketId === socket.id);
      if (!user) return;
      
      // If someone else is already sharing, stop their share first
      if (room.screenShareUserId && String(room.screenShareUserId) !== String(sharerUserId || user.id)) {
        const previousSharer = room.users.find(u => String(u.id) === String(room.screenShareUserId));
        if (previousSharer) {
          previousSharer.isScreenSharing = false;
          io.to(user.channelName).emit("screenShareStop", { userId: room.screenShareUserId });
        }
      }
      
      room.screenShareUserId = sharerUserId || user.id;
      user.isScreenSharing = true;
      io.to(user.channelName).emit("screenShareStart", { 
        userId: room.screenShareUserId, 
        username: username || user.username 
      });
    });

    socket.on("screenShareStop", (data) => {
      const { userId: sharerUserId } = data || {};
      const room = [...rooms.values()].find(r => r.users.some(u => u.socketId === socket.id));
      if (!room) return;
      const user = room.users.find(u => u.socketId === socket.id);
      if (!user) return;
      
      room.screenShareUserId = null;
      user.isScreenSharing = false;
      io.to(user.channelName).emit("screenShareStop", { userId: sharerUserId || user.id });
    });

    // Handle request for current room state (for late joiners)
    socket.on("requestRoomState", (data) => {
      const { channelName } = data || {};
      const room = getRoom(channelName);
      if (!room) return;
      
      
      if (room.screenShareUserId) {
        const sharer = room.users.find(u => String(u.id) === String(room.screenShareUserId));
        socket.emit("screenShareStart", {
          userId: room.screenShareUserId,
          username: sharer?.username || "Screen Sharer",
        });
      }
      
      socket.emit("roomState", {
        screenShareUserId: room.screenShareUserId,
        meetingStatus: room.status,
        users: room.users
      });
    });

    // Handle Disconnect
    socket.on("disconnect", () => {
      const roomEntry = [...rooms.entries()].find(([, r]) => r.users.some(u => u.socketId === socket.id));
      if (!roomEntry) return;
      const [channelName, room] = roomEntry;

      const index = room.users.findIndex(u => u.socketId === socket.id);
      if (index === -1) return;

      const user = room.users[index];
      const wasSharing = user.isScreenSharing;
      room.users.splice(index, 1);

      io.to(channelName).emit("userLeft", { userId: user.id });
      if (wasSharing) {
        room.screenShareUserId = null;
        io.to(channelName).emit("screenShareStop", { userId: user.id });
      }

      // If room empty, clean up
      if (room.users.length === 0) {
        rooms.delete(channelName);
      }
    });
  });


  return io;
}

module.exports = registerAgoraSocket;
