
import { io } from "socket.io-client";

// Backend Socket.IO server URL.
const URL =
  import.meta.env.VITE_SOCKET_URL ||
  "http://localhost:3001";

// Create the socket but do not connect yet.
// We connect after the user enters a username.
export const socket = io(URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
});
