// BACKEND SOCKET HANDLER - Add this to your Node.js server
// File: server.js or socket-handler.js

const io = require('socket.io')(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Store connected users and their locations
const connectedUsers = new Map();
const requestRooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle user connection with user info
  socket.on('userConnect', ({ userId, userName }) => {
    connectedUsers.set(socket.id, { userId, userName, socketId: socket.id });
    console.log(`User ${userName} connected with ID: ${userId}`);
  });

  // Handle new request creation
  socket.on('createRequest', (data) => {
    console.log('New request created:', data);
    
    // Broadcast to all connected users except the creator
    socket.broadcast.emit('newRequestCreated', {
      requestId: data.requestId,
      userId: data.userId,
      userName: data.userName,
      category: data.category,
      description: data.description,
      location: data.location
    });
  });

  // Handle request acceptance
  socket.on('acceptRequest', (data) => {
    console.log('Request accepted:', data);
    
    // Find the requester's socket and notify them
    const requesterSocket = Array.from(connectedUsers.values())
      .find(user => user.userId === data.requesterId);
    
    if (requesterSocket) {
      io.to(requesterSocket.socketId).emit('requestAccepted', {
        requestId: data.requestId,
        helperId: data.helperId,
        helperName: data.helperName,
        requesterId: data.requesterId
      });
    }

    // Broadcast status update to all users
    io.emit('requestStatusUpdated', {
      requestId: data.requestId,
      status: 'accepted',
      helperId: data.helperId,
      helperName: data.helperName
    });
  });

  // Handle request completion
  socket.on('completeRequest', (data) => {
    console.log('Request completed:', data);
    
    // Notify both users
    const requesterSocket = Array.from(connectedUsers.values())
      .find(user => user.userId === data.requesterId);
    
    if (requesterSocket) {
      io.to(requesterSocket.socketId).emit('requestCompleted', {
        requestId: data.requestId,
        message: 'Your help request has been completed!'
      });
    }

    // Broadcast status update
    io.emit('requestStatusUpdated', {
      requestId: data.requestId,
      status: 'completed'
    });
  });

  // Handle joining a request room for chat
  socket.on('joinRequest', ({ requestId, userId, userName }) => {
    socket.join(requestId);
    
    if (!requestRooms.has(requestId)) {
      requestRooms.set(requestId, new Set());
    }
    requestRooms.get(requestId).add({ userId, userName, socketId: socket.id });
    
    console.log(`${userName} joined request room: ${requestId}`);
    
    // Notify room about user joining
    socket.to(requestId).emit('userJoined', { userId, userName });
  });

  // Handle leaving a request room
  socket.on('leaveRequest', ({ requestId, userId }) => {
    socket.leave(requestId);
    
    if (requestRooms.has(requestId)) {
      const roomUsers = requestRooms.get(requestId);
      roomUsers.forEach(user => {
        if (user.userId === userId) {
          roomUsers.delete(user);
        }
      });
      
      if (roomUsers.size === 0) {
        requestRooms.delete(requestId);
      }
    }
    
    console.log(`User ${userId} left request room: ${requestId}`);
  });

  // Handle sending messages
  socket.on('sendMessage', (data) => {
    console.log('Message sent:', data);
    
    // Broadcast message to all users in the request room except sender
    socket.to(data.requestId).emit('receiveMessage', {
      message: data.message,
      userId: data.userId,
      userName: data.userName,
      timestamp: data.timestamp,
      self: false
    });

    // Send notification to other users in the room
    socket.to(data.requestId).emit('newMessage', {
      userId: data.userId,
      userName: data.userName,
      message: data.message,
      requestId: data.requestId
    });
  });

  // Handle typing indicators
  socket.on('typing', ({ requestId, userId, isTyping }) => {
    socket.to(requestId).emit('userTyping', { userId, isTyping });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const user = connectedUsers.get(socket.id);
    
    if (user) {
      console.log(`User ${user.userName} disconnected`);
      
      // Remove from all request rooms
      requestRooms.forEach((roomUsers, requestId) => {
        roomUsers.forEach(roomUser => {
          if (roomUser.socketId === socket.id) {
            roomUsers.delete(roomUser);
            socket.to(requestId).emit('userLeft', { userId: user.userId });
          }
        });
        
        if (roomUsers.size === 0) {
          requestRooms.delete(requestId);
        }
      });
      
      connectedUsers.delete(socket.id);
    }
    
    console.log('User disconnected:', socket.id);
  });
});

// Optional: Add these API endpoints to your Express server

// Get chat messages for a request
app.get('/api/requests/:requestId/messages', async (req, res) => {
  try {
    const { requestId } = req.params;
    // If you want to store messages in database:
    // const messages = await Message.find({ requestId }).populate('userId', 'name').sort({ createdAt: 1 });
    // res.json(messages);
    
    // For now, return empty array (messages are handled in real-time)
    res.json([]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Optional: Store message in database
app.post('/api/requests/:requestId/messages', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { message, userId } = req.body;
    
    // If you want to store messages:
    // const savedMessage = await Message.create({ requestId, userId, message });
    // res.json(savedMessage);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

console.log('Socket.IO server initialized with real-time features');

// Export for use in other files if needed
module.exports = { io, connectedUsers, requestRooms };