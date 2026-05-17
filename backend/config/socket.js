// const socketIo = require('socket.io');

// let io = null;

// const initializeSocket = (server) => {
//   io = socketIo(server, {
//     cors: {
//       origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
//       methods: ["GET", "POST"],
//       credentials: true
//     }
//   });

//   // Connection handling
//   io.on('connection', (socket) => {
//     console.log('[CONNECTION] Client connected:', socket.id);
    
//     socket.on('disconnect', () => {
//       console.log('[CONNECTION] Client disconnected:', socket.id);
//     });
//   });

//   // Make io available globally
//   global.io = io;
  
//   return io;
// };

// const getIO = () => {
//   return io;
// };

// module.exports = {
//   initializeSocket,
//   getIO
// };


const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");

let io = null;

const getTokenFromSocket = (socket) => {
  const authToken = socket.handshake.auth?.token;
  if (authToken) return authToken;

  const headerToken = socket.handshake.headers?.authorization;
  if (headerToken?.startsWith("Bearer ")) {
    return headerToken.replace("Bearer ", "").trim();
  }

  return null;
};

const getUserIdFromDecodedToken = (decoded) => {
  return String(
    decoded?.uid ||
      decoded?._id ||
      decoded?.id ||
      decoded?.userId ||
      ""
  );
};

const initializeSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token = getTokenFromSocket(socket);

      if (!token) {
        socket.user = null;
        return next();
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = getUserIdFromDecodedToken(decoded);

      socket.user = {
        id: userId,
        email: decoded?.email || "",
        roles: decoded?.roles || [],
      };

      next();
    } catch (error) {
      console.error("[SOCKET AUTH ERROR]", error.message);
      next(new Error("Socket authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    console.log("[CONNECTION] Client connected:", socket.id);

    if (socket.user?.id) {
      const roomName = `user:${socket.user.id}`;
      socket.join(roomName);
      console.log(`[ROOM] Socket ${socket.id} joined ${roomName}`);
    }

    socket.on("register-user", (userId) => {
      if (!userId) return;

      const normalizedUserId = String(userId);
      const roomName = `user:${normalizedUserId}`;
      socket.join(roomName);

      console.log(`[ROOM] Socket ${socket.id} manually joined ${roomName}`);
    });

    socket.on("disconnect", () => {
      console.log("[CONNECTION] Client disconnected:", socket.id);
    });
  });

  global.io = io;
  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO not initialized");
  }
  return io;
};

const emitToUser = (userId, eventName, payload) => {
  if (!io) {
    throw new Error("Socket.IO not initialized");
  }

  io.to(`user:${String(userId)}`).emit(eventName, payload);
};

module.exports = {
  initializeSocket,
  getIO,
  emitToUser,
};