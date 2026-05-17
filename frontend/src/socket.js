// import { io } from "socket.io-client";

// const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";

// const socket = io(SOCKET_URL, {
//   withCredentials: true,
// });

// export default socket;


import { io } from "socket.io-client";

// Same backend URL used for socket connection
const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";

// We keep one socket instance only.
// This prevents multiple duplicate connections.
// IMPORTANT: In React StrictMode, components mount/unmount/remount during development.
// Using a singleton ensures we don't create new connections on every remount.
let socketInstance = null;

/**
 * Create or reuse socket connection.
 * Token is sent in auth handshake because your backend socket auth expects it.
 */
export const getSocket = (token) => {
  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      autoConnect: false, // we connect manually after listeners are attached
      withCredentials: true,
      auth: {
        token, // backend reads socket.handshake.auth.token
      },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,        // Wait 1s before first reconnection attempt
      reconnectionDelayMax: 5000,     // Max 5s between reconnection attempts
      reconnectionAttempts: 5,        // Try 5 times before giving up
    });
  } else {
    // If socket already exists, update token
    socketInstance.auth = { token };
  }

  return socketInstance;
};

/**
 * Disconnect socket manually when user logs out or provider unmounts.
 */
export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
  }
};

export default getSocket;