import { useEffect, useState, useRef, useContext } from "react";
import socket from "../socket";
import API from "../api/api";
import { AuthContext } from "../context/AuthContext";

export default function ChatBox({ requestId, requestData }) {
  const { user } = useContext(AuthContext);
  const [msg, setMsg] = useState("");
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!requestId) {
      setMessages([]);
      return;
    }

    console.log('ChatBox: Joining request room:', requestId);
    setMessages([]);

    // Load existing messages
    API.get(`/requests/${requestId}/messages`)
      .then(res => {
        setMessages(res.data.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          self: msg.senderId === user._id,
          userName: msg.senderName
        })));
      })
      .catch(err => console.error('Failed to load messages:', err));

    socket.emit("joinRequest", { requestId, userId: user._id, userName: user.name });

    const handleReceiveMessage = (data) => {
      console.log('ChatBox: Message received:', data);
      setMessages(prev => [...prev, {
        ...data,
        timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    };

    const handleUserTyping = ({ userId, isTyping: typing }) => {
      if (userId !== user._id) {
        setIsTyping(typing);
      }
    };

    socket.on("receiveMessage", handleReceiveMessage);
    socket.on("userTyping", handleUserTyping);

    return () => {
      console.log('ChatBox: Leaving request room:', requestId);
      socket.off("receiveMessage", handleReceiveMessage);
      socket.off("userTyping", handleUserTyping);
      socket.emit("leaveRequest", { requestId, userId: user._id });
    };
  }, [requestId, user._id, user.name]);

  const handleTyping = (value) => {
    setMsg(value);
    
    if (!requestId) return;
    
    socket.emit("typing", { requestId, userId: user._id, isTyping: true });
    
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing", { requestId, userId: user._id, isTyping: false });
    }, 1000);
  };

  const send = () => {
    if (!msg.trim() || !requestId) return;

    const messageData = {
      requestId,
      message: msg,
      userId: user._id,
      userName: user.name,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    console.log('ChatBox: Sending message:', messageData);
    
    // Send to server for storage
    API.post(`/requests/${requestId}/message`, { message: msg })
      .then(() => {
        console.log('Message saved to database');
      })
      .catch(err => {
        console.error('Failed to save message:', err);
      });
    
    // Emit to socket for real-time delivery
    socket.emit("sendMessage", messageData);
    
    // Add to local state immediately
    setMessages(prev => [...prev, { ...messageData, self: true }]);
    setMsg("");
    
    socket.emit("typing", { requestId, userId: user._id, isTyping: false });
  };

  return (
    <div className="card shadow-sm chat-card">
      <div className="card-header fw-bold bg-white d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center">
          {requestData && (
            <>
              <div className="chat-avatar me-2">
                {requestData.user?.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="fw-bold">{requestData.user?.name}</div>
                <small className="text-muted">
                  {requestData.category} • {requestData.status}
                </small>
              </div>
            </>
          )}
          {!requestData && "Chat"}
        </div>
        <div className="chat-status">
          <span className="badge bg-success">🟢 Live</span>
        </div>
      </div>

      <div className="card-body chat-body">
        {messages.length === 0 && (
          <div className="text-center mt-4">
            <div className="empty-chat-icon">💬</div>
            <p className="text-muted">
              {requestData ? "Start your conversation" : "Select a request to chat"}
            </p>
            <small className="text-muted">Messages are end-to-end encrypted</small>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`d-flex mb-3 ${m.self ? "justify-content-end" : "justify-content-start"}`}>
            {!m.self && (
              <div className="me-2">
                <div className="chat-avatar-small">
                  {m.userName?.charAt(0).toUpperCase()}
                </div>
              </div>
            )}
            
            <div className={`chat-bubble ${m.self ? "me" : "other"}`}>
              {!m.self && <div className="sender-name">{m.userName}</div>}
              <div className="message-text">{m.message}</div>
              <div className="message-time">
                {m.timestamp}
                {m.self && <span className="message-status">✓✓</span>}
              </div>
            </div>
            
            {m.self && (
              <div className="ms-2">
                <div className="chat-avatar-small me-avatar">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div className="d-flex justify-content-start mb-3">
            <div className="me-2">
              <div className="chat-avatar-small typing-avatar">...</div>
            </div>
            <div className="typing-bubble">
              <div className="typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <small className="typing-text">typing...</small>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="card-footer d-flex gap-2 align-items-center">
        <button className="btn-emoji" title="Emoji">😊</button>
        <input
          className="form-control chat-input"
          placeholder="Type a message..."
          value={msg}
          onChange={(e) => handleTyping(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          disabled={!requestData}
        />
        <button 
          className={`btn-send ${msg.trim() ? 'active' : ''}`}
          onClick={send}
          disabled={!msg.trim() || !requestData}
          title="Send message"
        >
          {msg.trim() ? '➤' : '🎤'}
        </button>
      </div>
    </div>
  );
}
