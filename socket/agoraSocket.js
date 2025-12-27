const { Server: SocketIOServer } = require("socket.io");
const { RtcTokenBuilder, RtcRole } = require("agora-token");

function registerAgoraSocket(io) {
  

  const roomState = {
    users: [], // currently connected users
    sessionAttendees: [], // all users who have ever joined
    status: "lobby"
  };

  io.on("connection", (socket) => {

    socket.on("join", async (data) => {
      let { id, userId, role, channelName } = data;
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
      const attendeeObj = {
        id: userId,
        userId: id,
        username: fullName || `User${userId}`,
        role: role || 'audience',
        isMuted: true,
        isCameraOn: false,
        isHandRaised: false,
        isScreenSharing: false
      };
      const user = {
        ...attendeeObj,
        socketId: socket.id,
        channelName // Store channelName for later use
      };

      roomState.users.push(user);
      if (!roomState.sessionAttendees.some(u => u.userId === userId)) {
        const attendee = { ...attendeeObj };
        roomState.sessionAttendees.push(attendee);
      }
      // Always join the socket to the channel
      socket.join(channelName);

      try {
        const { Session } = require("../models/Room");
        const { default: mongoose } = require("mongoose");
        if (mongoose.Types.ObjectId.isValid(channelName)) {
          // Only add if not already present (by id)
          await Session.findByIdAndUpdate(
            channelName,
            { $addToSet: { attendees: attendeeObj } },
            { new: true }
          );
        } else {
          console.warn("[agoraSocket] channelName is not a valid session ObjectId:", channelName);
        }
      } catch (err) {
        console.error("[agoraSocket] Failed to add attendee to session DB:", err);
      }

      if (role === "host") {
        roomState.status = "live";
        io.to(channelName).emit("meetingStatus", { status: "live" });
      } else {
        // If not host and host hasn't joined, ensure meetingStatus is 'lobby'
        if (roomState.status !== "live") {
          roomState.status = "lobby";
          socket.emit("meetingStatus", { status: "lobby" });
        }
      }

      io.to(channelName).emit("userJoined", user);
      socket.emit("joined", { userId:id, channelName }); // Confirmation for client
      // Always emit the full sessionAttendees list
      socket.emit("userList", roomState.sessionAttendees);
      socket.emit("meetingStatus", { status: roomState.status });
    });

    // Handle Media Toggle
    socket.on("toggleMedia", (data) => {
      let user = roomState.users.find(u => u.socketId === socket.id);
      // Fallback: try to find by userId from data
      if (!user && data.userId) {
        user = roomState.users.find(u => u.id == data.userId || u.userId == data.userId);
      }
      if (!user) return;

      if (data.type === "audio") user.isMuted = !data.enabled;
      if (data.type === "video") user.isCameraOn = data.enabled;


      // Emit to all clients in the channel, including the updated user list
      const payload = {
        userId: user.id,
        type: data.type,
        enabled: data.enabled,
        availableAttendees: roomState.users
      };
      if (data.channelName) {
        io.to(data.channelName).emit("mediaStateChange", payload);
      } else {
        io.emit("mediaStateChange", payload);
      }
    });

    socket.on("raiseHand", (isRaised) => {
      const user = roomState.users.find(u => u.socketId === socket.id);
      if (!user) return;

      user.isHandRaised = isRaised;
      if (user.channelName) {
        io.to(user.channelName).emit("handUpdate", {
          userId: user.id,
          isHandRaised: isRaised
        });
      } else {
        socket.emit("handUpdate", {
          userId: user.id,
          isHandRaised: isRaised
        });
      }
    });

    // Handle Chat
    socket.on("chatMessage", (text) => {
      const user = roomState.users.find(u => u.socketId === socket.id);
      if (!user) return;

      const message = {
        id: Math.random().toString(36).substr(2, 9),
        senderId: user.id,
        senderName: user.username,
        senderRole: user.role,
        text,
        timestamp: Date.now()
      };

      // Broadcast to all users in the same channel, including sender
      if (user.channelName) {
        io.to(user.channelName).emit("chatMessage", message);
      } else {
        socket.emit("chatMessage", message);
      }
    });

    // Handle Reactions
    socket.on("reaction", (type) => {
      const user = roomState.users.find(u => u.socketId === socket.id);
      if (!user) return;

      if (user.channelName) {
        io.to(user.channelName).emit("reaction", {
          id: Math.random().toString(36).substr(2, 9),
          senderId: user.id,
          type
        });
      } else {
        socket.emit("reaction", {
          id: Math.random().toString(36).substr(2, 9),
          senderId: user.id,
          type
        });
      }
    });

    // Handle Screen Share Stop
    socket.on("screenShareStop", () => {
      const user = roomState.users.find(u => u.socketId === socket.id);
      if (!user) return;

      user.isScreenSharing = false;
      if (user.channelName) {
        io.to(user.channelName).emit("screenShareStop", {
          userId: user.id
        });
      } else {
        socket.emit("screenShareStop", {
          userId: user.id
        });
      }
    });

    // Handle Disconnect
    socket.on("disconnect", () => {
      const index = roomState.users.findIndex(u => u.socketId === socket.id);
      if (index === -1) return;

      const user = roomState.users[index];
      roomState.users.splice(index, 1);

      // Remove from sessionAttendees as well
      const attendeeIdx = roomState.sessionAttendees.findIndex(u => u.id === user.id);
      if (attendeeIdx !== -1) {
        roomState.sessionAttendees.splice(attendeeIdx, 1);
      }

      if (user.channelName) {
        io.to(user.channelName).emit("userLeft", { userId: user.id });
      } else {
        socket.emit("userLeft", { userId: user.id });
      }
    });
  });


  return io;
}

module.exports = registerAgoraSocket;
