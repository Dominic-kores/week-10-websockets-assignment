
require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { randomUUID } = require("crypto");

// ========================================
// 1. EXPRESS AND SOCKET.IO SETUP
// ========================================

const app = express();

const PORT = Number(process.env.PORT) || 3001;
const CLIENT_URL =
  process.env.CLIENT_URL || "http://localhost:5173";

app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

// Socket.IO must use the HTTP server.
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
  },
});

// ========================================
// 2. IN-MEMORY DATA STORAGE
// ========================================

// socketId -> { username, room }
const users = new Map();

// roomName -> last 20 messages
const roomHistory = new Map();

// privateRoomName -> last 20 messages
const privateHistory = new Map();

const MAX_MESSAGES = 20;

// ========================================
// 3. HELPER FUNCTIONS
// ========================================

// Limit message history to 20 messages.
function saveMessage(store, key, message) {
  if (!store.has(key)) {
    store.set(key, []);
  }

  const messages = store.get(key);

  messages.push(message);

  if (messages.length > MAX_MESSAGES) {
    messages.shift();
  }
}

// Create a consistent message object.
function createMessage(username, text, extra = {}) {
  return {
    id: randomUUID(),
    username,
    text,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

// Return all users currently inside a room.
function getRoomUsers(roomName) {
  return Array.from(users.entries())
    .filter(([, user]) => user.room === roomName)
    .map(([id, user]) => ({
      id,
      username: user.username,
    }));
}

// Broadcast the updated room members.
function updateUserList(roomName) {
  if (!roomName) return;

  io.to(roomName).emit(
    "user-list",
    getRoomUsers(roomName)
  );
}

// Used for private messaging.
// Sorting makes both users generate the same name.
function getPrivateRoom(user1, user2) {
  return `private-${[user1, user2]
    .sort()
    .join("-")}`;
}

// Find an online user by username.
function findUserByName(username) {
  return Array.from(users.entries()).find(
    ([, user]) => user.username === username
  );
}

// Notify a room when someone joins or leaves.
function sendSystemMessage(roomName, text) {
  io.to(roomName).emit("system-message", {
    id: randomUUID(),
    text,
    room: roomName,
    timestamp: new Date().toISOString(),
  });
}

// Leave a room and notify the remaining users.
function leaveCurrentRoom(socket) {
  const user = users.get(socket.id);

  if (!user || !user.room) return;

  const oldRoom = user.room;

  socket.leave(oldRoom);
  user.room = null;

  sendSystemMessage(
    oldRoom,
    `${user.username} left ${oldRoom}`
  );

  updateUserList(oldRoom);
}

// ========================================
// 4. HTTP HEALTH CHECK
// ========================================

app.get("/", (req, res) => {
  res.json({
    message: "WebSocket Chat API is running",
    status: "OK",
  });
});

// ========================================
// 5. SOCKET.IO CONNECTION
// ========================================

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // ----------------------------------------
  // TASK 1: USER REGISTRATION
  // ----------------------------------------

  socket.on("user-join", (rawUsername, callback) => {
    const username =
      typeof rawUsername === "string"
        ? rawUsername.trim()
        : "";

    if (!username || username.length > 30) {
      callback?.({
        success: false,
        error: "Use a username of 1–30 characters.",
      });
      return;
    }

    const existingUser = findUserByName(username);

    if (
      existingUser &&
      existingUser[0] !== socket.id
    ) {
      callback?.({
        success: false,
        error: "Username is already in use.",
      });
      return;
    }

    users.set(socket.id, {
      username,
      room: null,
    });

    console.log(`${username} joined chat`);

    callback?.({ success: true, username });
  });

  // ----------------------------------------
  // TASK 2: JOIN ROOM
  // ----------------------------------------

  socket.on("join-room", (rawRoomName, callback) => {
    const user = users.get(socket.id);

    if (!user) {
      callback?.({
        success: false,
        error: "Please join the chat first.",
      });
      return;
    }

    const roomName =
      typeof rawRoomName === "string"
        ? rawRoomName.trim().toLowerCase()
        : "";

    if (
      !roomName ||
      roomName.length > 30 ||
      !/^[a-z0-9_-]+$/.test(roomName)
    ) {
      callback?.({
        success: false,
        error:
          "Room names must use 1–30 letters, numbers, _ or -.",
      });
      return;
    }

    // Do not send another join notification
    // if the user is already in this room.
    if (user.room === roomName) {
      socket.emit("room-joined", roomName);
      socket.emit(
        "message-history",
        roomHistory.get(roomName) || [],
        roomName
      );

      updateUserList(roomName);
      callback?.({ success: true, room: roomName });
      return;
    }

    // Leave the previous room first.
    leaveCurrentRoom(socket);

    socket.join(roomName);
    user.room = roomName;

    // Notify everyone except the sender.
    socket.to(roomName).emit("system-message", {
      id: randomUUID(),
      text: `${user.username} joined ${roomName}`,
      room: roomName,
      timestamp: new Date().toISOString(),
    });

    // Send room history only to this user.
    socket.emit(
      "message-history",
      roomHistory.get(roomName) || [],
      roomName
    );

    socket.emit("room-joined", roomName);

    updateUserList(roomName);

    callback?.({ success: true, room: roomName });

    console.log(
      `${user.username} joined room ${roomName}`
    );
  });

  // ----------------------------------------
  // TASK 2: LEAVE ROOM
  // ----------------------------------------

  socket.on("leave-room", () => {
    leaveCurrentRoom(socket);
    socket.emit("room-left");
  });

  // ----------------------------------------
  // TASK 1 + 2: ROOM MESSAGING
  // ----------------------------------------

  socket.on("chat-message", (rawText) => {
    const user = users.get(socket.id);

    if (!user || !user.room) return;

    if (typeof rawText !== "string") return;

    const text = rawText.trim();

    if (!text || text.length > 2000) return;

    const message = createMessage(
      user.username,
      text,
      { room: user.room }
    );

    // Store the latest message.
    saveMessage(
      roomHistory,
      user.room,
      message
    );

    // Everyone in the current room sees it.
    io.to(user.room).emit("chat-message", message);

    // Stop the sender's typing indicator.
    socket.to(user.room).emit(
      "typing-stop",
      user.username
    );
  });

  // ----------------------------------------
  // TASK 3: TYPING INDICATORS
  // ----------------------------------------

  socket.on("typing-start", () => {
    const user = users.get(socket.id);

    if (!user?.room) return;

    // Broadcast to others, not the sender.
    socket.to(user.room).emit(
      "typing-start",
      user.username
    );
  });

  socket.on("typing-stop", () => {
    const user = users.get(socket.id);

    if (!user?.room) return;

    socket.to(user.room).emit(
      "typing-stop",
      user.username
    );
  });

  // ----------------------------------------
  // BONUS: OPEN PRIVATE CONVERSATION
  // ----------------------------------------

  socket.on("open-private", (targetUsername, callback) => {
    const sender = users.get(socket.id);

    if (!sender) return;

    const target = findUserByName(targetUsername);

    if (!target) {
      callback?.({
        success: false,
        error: "This user is not online.",
      });
      return;
    }

    if (sender.username === targetUsername) {
      callback?.({
        success: false,
        error: "You cannot message yourself.",
      });
      return;
    }

    const [targetSocketId] = target;

    const privateRoom = getPrivateRoom(
      sender.username,
      targetUsername
    );

    // Both users join the same private room.
    socket.join(privateRoom);

    io.sockets.sockets
      .get(targetSocketId)
      ?.join(privateRoom);

    // Only send history to the user opening it.
    socket.emit("private-history", {
      room: privateRoom,
      messages:
        privateHistory.get(privateRoom) || [],
    });

    callback?.({
      success: true,
      room: privateRoom,
    });
  });

  // ----------------------------------------
  // BONUS: PRIVATE MESSAGE
  // ----------------------------------------

  socket.on("private-message", (data, callback) => {
    const sender = users.get(socket.id);

    if (!sender) return;

    const targetUsername = data?.to;

    const text =
      typeof data?.text === "string"
        ? data.text.trim()
        : "";

    if (
      !targetUsername ||
      !text ||
      text.length > 2000
    ) {
      callback?.({
        success: false,
        error: "Invalid private message.",
      });
      return;
    }

    const target = findUserByName(targetUsername);

    if (!target) {
      callback?.({
        success: false,
        error: "Recipient is offline.",
      });
      return;
    }

    const [targetSocketId] = target;

    if (targetSocketId === socket.id) return;

    const privateRoom = getPrivateRoom(
      sender.username,
      targetUsername
    );

    socket.join(privateRoom);

    io.sockets.sockets
      .get(targetSocketId)
      ?.join(privateRoom);

    const message = createMessage(
      sender.username,
      text,
      {
        to: targetUsername,
        room: privateRoom,
        private: true,
      }
    );

    saveMessage(
      privateHistory,
      privateRoom,
      message
    );

    // Send only to these two users.
    io.to(privateRoom).emit(
      "private-message",
      message
    );

    callback?.({ success: true });
  });

  // ----------------------------------------
  // TASK 1 + 2: DISCONNECT
  // ----------------------------------------

  socket.on("disconnect", () => {
    const user = users.get(socket.id);

    if (user) {
      const oldRoom = user.room;

      users.delete(socket.id);

      if (oldRoom) {
        sendSystemMessage(
          oldRoom,
          `${user.username} left ${oldRoom}`
        );

        updateUserList(oldRoom);
      }

      console.log(
        `${user.username} disconnected`
      );
    }

    console.log("Socket disconnected:", socket.id);
  });
});

// ========================================
// 6. START HTTP SERVER
// ========================================

server.listen(PORT, () => {
  console.log(
    `Server running on http://localhost:${PORT}`
  );
});
