
# Real-Time WebSocket Chat Application

## Project Overview

A full-stack real-time chat application developed using
React, Node.js, Express, and Socket.IO.

This project demonstrates event-based communication
through persistent, bidirectional connections.

## Learning Objectives

- Understand real-time communication using WebSockets.
- Implement Socket.IO client and server connections.
- Build room-based messaging.
- Manage users joining and leaving rooms.
- Implement typing indicators.
- Store and display recent message history.
- Develop private messaging between users.
- Apply React state management and useEffect cleanup.

## Tech Stack

### Backend
- Node.js
- Express.js
- Socket.IO
- CORS

### Frontend
- React
- Vite
- Socket.IO Client
- CSS

## Features

1. Real-time group messaging.
2. Username-based chat login.
3. Multiple chat rooms.
4. Online users sidebar.
5. Join and leave notifications.
6. Typing indicators.
7. Recent 20-message history per room.
8. Private/direct messaging.
9. Unread private-message notifications.
10. Responsive chat interface.
11. Automatic Socket.IO reconnection.

## Installation

Clone the repository:

```bash
git clone <https://github.com/Dominic-kores/week-10-websockets-assignment>
cd week-10-day-1-assignment
```

### Backend

```bash
cd server
npm install
```

Create `.env`:

```env
PORT=3001
CLIENT_URL=http://localhost:5173
```

Run:

```bash
npm run dev
```

### Frontend

Open another terminal:

```bash
cd client
npm install
```

Create `.env`:

```env
VITE_SOCKET_URL=http://localhost:3001
```

Run:

```bash
npm run dev
```

Open http://localhost:5173.

## Testing

- Open two browser tabs with different usernames.
- Join the same room.
- Send messages from both tabs.
- Create another room to test message isolation.
- Verify typing indicators.
- Join as a new user to confirm message history.
- Test private messages and unread badges.

## Live Pages


## Future Improvements

- PostgreSQL database and Prisma ORM.
- JWT authentication.
- User registration and login.
- Persistent message history.
- File and image sharing.
- Message delivery status.
- Notifications.
- Deployment to Railway and Vercel.

## Author

Dominic Kores Kisioya

Full-Stack Software & AI Engineer



