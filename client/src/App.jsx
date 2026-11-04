
import { useEffect, useRef, useState } from "react";
import { socket } from "./socket";
import "./App.css";

function App() {
  // ======================================
  // 1. APPLICATION STATE
  // ======================================

  const [nameInput, setNameInput] = useState("");
  const [roomInput, setRoomInput] = useState("general");

  const [username, setUsername] = useState("");
  const [room, setRoom] = useState("general");

  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");

  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");

  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);

  // BONUS: Private messaging state
  const [privateUser, setPrivateUser] = useState(null);
  const [privateMessages, setPrivateMessages] = useState([]);
  const [privateContacts, setPrivateContacts] = useState([]);
  const [unread, setUnread] = useState({});

  // Refs preserve the latest values for socket listeners.
  const roomRef = useRef("general");
  const privateUserRef = useRef(null);

  const typingTimeout = useRef(null);
  const messagesEndRef = useRef(null);

  // ======================================
  // 2. KEEP REFS SYNCHRONISED
  // ======================================

  useEffect(() => {
    privateUserRef.current = privateUser;
  }, [privateUser]);

  // ======================================
  // 3. SOCKET CONNECTION AND EVENTS
  // ======================================

  useEffect(() => {
    if (!username) return;

    // On every connection or reconnection,
    // register the user and rejoin the room.
    const handleConnect = () => {
      setConnected(true);
      setError("");

      socket.emit("user-join", username, (response) => {
        if (!response?.success) {
          setError(
            response?.error || "Unable to join chat."
          );

          socket.disconnect();
          setConnected(false);
          return;
        }

        socket.emit(
          "join-room",
          roomRef.current,
          (result) => {
            if (!result?.success) {
              setError(
                result?.error || "Could not join room."
              );
            }
          }
        );
      });
    };

    const handleDisconnect = () => {
      setConnected(false);
      setOnlineUsers([]);
      setTypingUsers([]);
    };

    // TASK 1: Receive live room messages.
    const handleChatMessage = (message) => {
      if (message.room !== roomRef.current) return;

      setMessages((previous) => [
        ...previous,
        message,
      ]);

      // Remove sender from typing indicator.
      setTypingUsers((previous) =>
        previous.filter(
          (name) => name !== message.username
        )
      );
    };

    // TASK 2: Receive system notifications.
    const handleSystemMessage = (message) => {
      if (message.room !== roomRef.current) return;

      setMessages((previous) => [
        ...previous,
        {
          ...message,
          system: true,
        },
      ]);
    };

    // TASK 2: Update the online users sidebar.
    const handleUserList = (users) => {
      setOnlineUsers(users);
    };

    // TASK 2: Confirm successful room change.
    const handleRoomJoined = (newRoom) => {
      if (newRoom === roomRef.current) {
        setRoom(newRoom);
        setError("");
      }
    };

    // TASK 3: Load recent message history.
    const handleMessageHistory = (
      history,
      historyRoom
    ) => {
      if (historyRoom !== roomRef.current) return;

      setMessages(history);
    };

    // TASK 3: Show users who are typing.
    const handleTypingStart = (name) => {
      setTypingUsers((previous) =>
        previous.includes(name)
          ? previous
          : [...previous, name]
      );
    };

    // TASK 3: Remove users who stopped typing.
    const handleTypingStop = (name) => {
      setTypingUsers((previous) =>
        previous.filter((user) => user !== name)
      );
    };

    // BONUS: Receive private message history.
    const handlePrivateHistory = (data) => {
      const expectedRoom = [
        username,
        privateUserRef.current,
      ]
        .sort()
        .join("-");

      if (
        privateUserRef.current &&
        data.room === `private-${expectedRoom}`
      ) {
        setPrivateMessages(data.messages);
      }
    };

    // BONUS: Receive direct messages.
    const handlePrivateMessage = (message) => {
      const otherUser =
        message.username === username
          ? message.to
          : message.username;

      // Remember conversations in the sidebar.
      setPrivateContacts((previous) =>
        previous.includes(otherUser)
          ? previous
          : [...previous, otherUser]
      );

      if (privateUserRef.current === otherUser) {
        setPrivateMessages((previous) => [
          ...previous,
          message,
        ]);
      } else if (message.username !== username) {
        // Show an unread notification.
        setUnread((previous) => ({
          ...previous,
          [otherUser]:
            (previous[otherUser] || 0) + 1,
        }));
      }
    };

    const handleConnectError = (err) => {
      setError(
        err.message || "Unable to connect to server."
      );
    };

    // Register listeners before connecting.
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    socket.on("chat-message", handleChatMessage);
    socket.on("system-message", handleSystemMessage);
    socket.on("user-list", handleUserList);
    socket.on("room-joined", handleRoomJoined);

    socket.on("message-history", handleMessageHistory);
    socket.on("typing-start", handleTypingStart);
    socket.on("typing-stop", handleTypingStop);

    socket.on("private-history", handlePrivateHistory);
    socket.on("private-message", handlePrivateMessage);

    if (socket.connected) {
      handleConnect();
    } else {
      socket.connect();
    }

    // Important: Clean up listeners.
    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);

      socket.off("chat-message", handleChatMessage);
      socket.off("system-message", handleSystemMessage);
      socket.off("user-list", handleUserList);
      socket.off("room-joined", handleRoomJoined);

      socket.off(
        "message-history",
        handleMessageHistory
      );

      socket.off("typing-start", handleTypingStart);
      socket.off("typing-stop", handleTypingStop);

      socket.off("private-history", handlePrivateHistory);
      socket.off("private-message", handlePrivateMessage);

      clearTimeout(typingTimeout.current);
      socket.disconnect();
    };
  }, [username]);

  // ======================================
  // 4. SCROLL TO THE LATEST MESSAGE
  // ======================================

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, privateMessages, privateUser]);

  // ======================================
  // 5. JOIN THE CHAT
  // ======================================

  const handleJoinChat = (event) => {
    event.preventDefault();

    const name = nameInput.trim();
    const selectedRoom = roomInput.trim().toLowerCase();

    if (!name || !selectedRoom) {
      setError("Enter your username and room name.");
      return;
    }

    if (name.length > 30) {
      setError("Username must be 30 characters or less.");
      return;
    }

    if (
      !/^[a-z0-9_-]{1,30}$/.test(selectedRoom)
    ) {
      setError(
        "Room name must contain only letters, numbers, _ or -."
      );
      return;
    }

    roomRef.current = selectedRoom;

    setRoom(selectedRoom);
    setMessages([]);
    setError("");
    setUsername(name);
  };

  // ======================================
  // 6. SWITCH CHAT ROOMS
  // ======================================

  const handleChangeRoom = (event) => {
    event.preventDefault();

    const newRoom = roomInput.trim().toLowerCase();

    if (!/^[a-z0-9_-]{1,30}$/.test(newRoom)) {
      setError("Enter a valid room name.");
      return;
    }

    if (!connected) {
      setError("Wait for the server connection.");
      return;
    }

    if (newRoom === roomRef.current) {
      setPrivateUser(null);
      privateUserRef.current = null;
      setMessageInput("");
      return;
    }

    // Clear any active typing timer.
    clearTimeout(typingTimeout.current);

    socket.emit("typing-stop");

    roomRef.current = newRoom;
    privateUserRef.current = null;

    setPrivateUser(null);
    setMessages([]);
    setTypingUsers([]);
    setMessageInput("");
    setError("");

    socket.emit("join-room", newRoom, (response) => {
      if (!response?.success) {
        setError(
          response?.error || "Unable to change room."
        );
      }
    });
  };

  // ======================================
  // 7. SEND A ROOM MESSAGE
  // ======================================

  const handleSendMessage = (event) => {
    event.preventDefault();

    const text = messageInput.trim();

    if (!text || !connected) return;

    if (privateUser) {
      // BONUS: Send private message.
      socket.emit(
        "private-message",
        { to: privateUser, text },
        (response) => {
          if (!response?.success) {
            setError(
              response?.error ||
                "Private message could not be sent."
            );
          }
        }
      );
    } else {
      // TASK 1: Send room message.
      socket.emit("chat-message", text);

      // TASK 3: Stop typing immediately.
      socket.emit("typing-stop");
    }

    clearTimeout(typingTimeout.current);
    setMessageInput("");
  };

  // ======================================
  // 8. TYPING INDICATOR
  // ======================================

  const handleMessageInput = (event) => {
    const text = event.target.value;

    setMessageInput(text);

    // Typing events apply to group rooms.
    if (privateUser || !connected) return;

    clearTimeout(typingTimeout.current);

    if (!text.trim()) {
      socket.emit("typing-stop");
      return;
    }

    // Notify others on each keystroke.
    socket.emit("typing-start");

    // Stop after 2 seconds without typing.
    typingTimeout.current = setTimeout(() => {
      socket.emit("typing-stop");
    }, 2000);
  };

  // ======================================
  // 9. BONUS: OPEN PRIVATE CHAT
  // ======================================

  const handleOpenPrivate = (targetUsername) => {
    if (targetUsername === username) return;

    clearTimeout(typingTimeout.current);
    socket.emit("typing-stop");

    // Update ref immediately for incoming events.
    privateUserRef.current = targetUsername;

    setPrivateUser(targetUsername);
    setPrivateMessages([]);
    setMessageInput("");
    setError("");

    // Clear unread badge for this conversation.
    setUnread((previous) => ({
      ...previous,
      [targetUsername]: 0,
    }));

    socket.emit(
      "open-private",
      targetUsername,
      (response) => {
        if (!response?.success) {
          setError(
            response?.error ||
              "Unable to open conversation."
          );
        }
      }
    );
  };

  // ======================================
  // 10. RETURN TO GROUP CHAT
  // ======================================

  const handleBackToRoom = () => {
    privateUserRef.current = null;

    setPrivateUser(null);
    setMessageInput("");
    setError("");
  };

  // ======================================
  // 11. LOG OUT
  // ======================================

  const handleLogout = () => {
    clearTimeout(typingTimeout.current);

    socket.emit("leave-room");
    socket.disconnect();

    roomRef.current = "general";
    privateUserRef.current = null;

    setUsername("");
    setRoom("general");
    setRoomInput("general");
    setMessages([]);
    setMessageInput("");
    setOnlineUsers([]);
    setTypingUsers([]);
    setPrivateUser(null);
    setPrivateMessages([]);
    setPrivateContacts([]);
    setUnread({});
    setConnected(false);
    setError("");
  };

  // ======================================
  // 12. FORMAT HELPERS
  // ======================================

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  };

  // Typing indicator formatting.
  const typingText = () => {
    if (typingUsers.length === 0) return "";

    if (typingUsers.length === 1) {
      return `${typingUsers[0]} is typing...`;
    }

    return `${typingUsers.join(", ")} are typing...`;
  };

  // ======================================
  // 13. LOGIN SCREEN
  // ======================================

  if (!username) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="brand-icon">💬</div>

          <h1>WebSocket Chat</h1>

          <p className="login-description">
            Connect, communicate, and collaborate
            in real time.
          </p>

          <form onSubmit={handleJoinChat}>
            <label htmlFor="username">
              Your username
            </label>

            <input
              id="username"
              type="text"
              placeholder="e.g. Wanjiku"
              value={nameInput}
              maxLength={30}
              onChange={(e) =>
                setNameInput(e.target.value)
              }
              required
            />

            <label htmlFor="room">
              Chat room
            </label>

            <input
              id="room"
              type="text"
              placeholder="e.g. general"
              value={roomInput}
              maxLength={30}
              onChange={(e) =>
                setRoomInput(e.target.value)
              }
              required
            />

            {error && (
              <p className="error-message">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="primary-button"
            >
              Join Chat
            </button>
          </form>

          <p className="login-footer">
            Powered by React + Socket.IO
          </p>
        </div>
      </div>
    );
  }

  // ======================================
  // 14. CHAT SCREEN
  // ======================================

  const displayedMessages = privateUser
    ? privateMessages
    : messages;

  const contacts = [
    ...new Set([
      ...onlineUsers.map((user) => user.username),
      ...privateContacts,
    ]),
  ].filter((name) => name !== username);

  return (
    <div className="chat-layout">
      {/* LEFT SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            💬 WebSocket Chat
          </div>

          <div className="user-profile">
            <div className="avatar">
              {username[0].toUpperCase()}
            </div>

            <div>
              <strong>{username}</strong>
              <span className="connection-text">
                <span
                  className={
                    connected
                      ? "status-dot online"
                      : "status-dot offline"
                  }
                />

                {connected
                  ? "Connected"
                  : "Disconnected"}
              </span>
            </div>
          </div>
        </div>

        <div className="sidebar-content">
          <div className="sidebar-section">
            <h3>CHAT ROOM</h3>

            <div className="current-room">
              # {room}
            </div>

            <form
              onSubmit={handleChangeRoom}
              className="room-form"
            >
              <input
                value={roomInput}
                onChange={(e) =>
                  setRoomInput(e.target.value)
                }
                placeholder="Enter room name"
                maxLength={30}
                aria-label="Room name"
              />

              <button
                type="submit"
                disabled={!connected}
              >
                Join Room
              </button>
            </form>
          </div>

          <div className="sidebar-section">
            <h3>
              ONLINE IN ROOM ({onlineUsers.length})
            </h3>

            <div className="user-list">
              {onlineUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className={
                    "user-item " +
                    (privateUser === user.username
                      ? "selected"
                      : "")
                  }
                  onClick={() =>
                    handleOpenPrivate(user.username)
                  }
                  disabled={
                    user.username === username
                  }
                >
                  <span className="small-avatar">
                    {user.username[0].toUpperCase()}
                  </span>

                  <span className="user-item-name">
                    {user.username}
                    {user.username === username &&
                      " (You)"}
                  </span>

                  <span className="online-dot" />

                  {unread[user.username] > 0 && (
                    <span className="unread-badge">
                      {unread[user.username]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* BONUS: PRIVATE CONVERSATIONS */}
          <div className="sidebar-section">
            <h3>DIRECT MESSAGES</h3>

            {contacts.length === 0 ? (
              <p className="sidebar-hint">
                Select an online user to chat privately.
              </p>
            ) : (
              contacts.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={
                    "user-item " +
                    (privateUser === name
                      ? "selected"
                      : "")
                  }
                  onClick={() =>
                    handleOpenPrivate(name)
                  }
                >
                  <span className="small-avatar">
                    {name[0].toUpperCase()}
                  </span>

                  <span className="user-item-name">
                    {name}
                  </span>

                  {unread[name] > 0 && (
                    <span className="unread-badge">
                      {unread[name]}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="sidebar-footer">
          <button
            className="logout-button"
            onClick={handleLogout}
          >
            Leave Chat
          </button>
        </div>
      </aside>

      {/* MAIN CHAT AREA */}
      <main className="chat-main">
        <header className="chat-header">
          <div>
            {privateUser ? (
              <>
                <button
                  onClick={handleBackToRoom}
                  className="back-button"
                >
                  ← Back to Room
                </button>

                <h2>🔒 {privateUser}</h2>

                <p>Private conversation</p>
              </>
            ) : (
              <>
                <h2># {room}</h2>

                <p>
                  {onlineUsers.length} online
                  {" · "}Real-time group chat
                </p>
              </>
            )}
          </div>

          <span className="header-status">
            {connected ? "● Live" : "○ Offline"}
          </span>
        </header>

        {error && (
          <div className="chat-error">
            {error}
          </div>
        )}

        {/* MESSAGES */}
        <section className="messages-container">
          {displayedMessages.length === 0 && (
            <div className="empty-chat">
              <div className="empty-icon">💭</div>

              <h3>
                {privateUser
                  ? `Chat with ${privateUser}`
                  : `Welcome to #${room}`}
              </h3>

              <p>
                {privateUser
                  ? "Start your private conversation."
                  : "Send a message to get started."}
              </p>
            </div>
          )}

          {displayedMessages.map((message) => {
            // System notifications are centered.
            if (message.system) {
              return (
                <div
                  key={message.id}
                  className="system-message"
                >
                  {message.text}
                </div>
              );
            }

            const isOwn =
              message.username === username;

            return (
              <div
                key={message.id}
                className={
                  "message-row " +
                  (isOwn ? "own" : "other")
                }
              >
                <div
                  className={
                    "message-bubble " +
                    (isOwn ? "own-bubble" : "")
                  }
                >
                  <div className="message-info">
                    <strong>
                      {isOwn
                        ? "You"
                        : message.username}
                    </strong>

                    <span>
                      {formatTime(message.timestamp)}
                    </span>
                  </div>

                  <p>{message.text}</p>
                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </section>

        {/* TYPING INDICATOR */}
        {!privateUser && (
          <div className="typing-indicator">
            {typingText()}
          </div>
        )}

        {/* MESSAGE INPUT */}
        <form
          onSubmit={handleSendMessage}
          className="message-form"
        >
          <input
            type="text"
            value={messageInput}
            onChange={handleMessageInput}
            placeholder={
              privateUser
                ? `Message ${privateUser}...`
                : `Message #${room}...`
            }
            maxLength={2000}
            disabled={!connected}
            aria-label="Message"
          />

          <button
            type="submit"
            disabled={
              !connected || !messageInput.trim()
            }
          >
            Send ➤
          </button>
        </form>
      </main>
    </div>
  );
}

export default App;
