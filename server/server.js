const express = require("express");
const http = require("http");
const socketIO = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3001;

// In-memory storage
const rooms = new Map();

// Helper to generate room ID
function generateRoomId() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Create room
  socket.on("create-room", (callback) => {
    const roomId = generateRoomId();
    rooms.set(roomId, {
      id: roomId,
      host: socket.id,
      participants: [socket.id],
      videoState: {
        time: 0,
        playing: false,
        videoPath: null,
      },
    });

    socket.join(roomId);
    socket.roomId = roomId;
    socket.isHost = true;

    console.log(`Room created: ${roomId} by ${socket.id}`);

    callback({ success: true, roomId, isHost: true });
  });

  // Join room
  socket.on("join-room", (roomId, callback) => {
    const room = rooms.get(roomId);

    if (!room) {
      callback({ success: false, error: "Room not found" });
      return;
    }

    room.participants.push(socket.id);
    socket.join(roomId);
    socket.roomId = roomId;
    socket.isHost = false;

    console.log(`User ${socket.id} joined room ${roomId}`);

    // Notify others in room
    socket.to(roomId).emit("user-joined", {
      userId: socket.id,
      participants: room.participants,
    });

    callback({
      success: true,
      roomId,
      isHost: false,
      videoState: room.videoState,
      participants: room.participants,
    });
  });

  // WebRTC signaling
  socket.on("signal", (data) => {
    io.to(data.to).emit("signal", {
      from: socket.id,
      signal: data.signal,
    });
  });

  // Request connection to peer
  socket.on("request-connection", (targetId) => {
    io.to(targetId).emit("connection-request", socket.id);
  });

  // Video playback sync
  socket.on("video-play", (data) => {
    const room = rooms.get(socket.roomId);
    if (room) {
      room.videoState.playing = true;
      room.videoState.time = data.time;
      socket.to(socket.roomId).emit("video-play", data);
    }
  });

  socket.on("video-pause", (data) => {
    const room = rooms.get(socket.roomId);
    if (room) {
      room.videoState.playing = false;
      room.videoState.time = data.time;
      socket.to(socket.roomId).emit("video-pause", data);
    }
  });

  socket.on("video-seek", (data) => {
    const room = rooms.get(socket.roomId);
    if (room) {
      room.videoState.time = data.time;
      socket.to(socket.roomId).emit("video-seek", data);
    }
  });

  socket.on("video-selected", (videoPath) => {
    const room = rooms.get(socket.roomId);
    if (room && socket.isHost) {
      room.videoState.videoPath = videoPath;
      socket.to(socket.roomId).emit("video-selected", videoPath);
    }
  });

  socket.on("subtitle-selected", (subtitlePath) => {
    const room = rooms.get(socket.roomId);
    if (room && socket.isHost) {
      socket.to(socket.roomId).emit("subtitle-selected", subtitlePath);
    }
  });

  // Get room info
  socket.on("get-room-info", (callback) => {
    const room = rooms.get(socket.roomId);
    if (room) {
      callback({
        participants: room.participants,
        videoState: room.videoState,
        isHost: socket.isHost,
      });
    }
  });

  // Chat message
  socket.on("chat-message", (message) => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit("chat-message", message);
    }
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    if (socket.roomId) {
      const room = rooms.get(socket.roomId);
      if (room) {
        room.participants = room.participants.filter((p) => p !== socket.id);

        // Notify others
        socket.to(socket.roomId).emit("user-left", {
          userId: socket.id,
          participants: room.participants,
        });

        // If host left, delete room
        if (room.host === socket.id) {
          rooms.delete(socket.roomId);
          io.to(socket.roomId).emit("room-closed");
          console.log(`Room ${socket.roomId} closed`);
        } else if (room.participants.length === 0) {
          rooms.delete(socket.roomId);
        }
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
