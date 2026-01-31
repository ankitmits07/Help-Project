module.exports = io => {
  const connectedUsers = new Map();

  io.on("connection", socket => {
    console.log('User connected:', socket.id);

    socket.on('userConnect', ({ userId, userName }) => {
      connectedUsers.set(userId, { socketId: socket.id, userName });
      socket.userId = userId;
      console.log(`User ${userName} connected with ID: ${userId}`);
    });

    socket.on("joinRequest", ({ requestId, userId, userName }) => {
      socket.join(requestId);
      console.log(`${userName} joined request room: ${requestId}`);
    });

    socket.on("leaveRequest", ({ requestId, userId }) => {
      socket.leave(requestId);
      console.log(`User ${userId} left request room: ${requestId}`);
    });

    socket.on("sendMessage", (data) => {
      console.log('Broadcasting message:', data);
      socket.to(data.requestId).emit("receiveMessage", data);
    });

    socket.on("typing", (data) => {
      socket.to(data.requestId).emit("userTyping", data);
    });

    socket.on("createRequest", (data) => {
      console.log('New request created:', data);
      // Broadcast to all users including the creator for their own list
      io.emit("newRequestCreated", data);
    });

    socket.on("acceptRequest", (data) => {
      console.log('Request accepted:', data);
      io.to(data.requestId).emit("requestAccepted", data);
      
      // Send notification to requester
      const requesterSocket = Array.from(connectedUsers.entries())
        .find(([userId, userData]) => userId === data.requesterId);
      
      if (requesterSocket) {
        io.to(requesterSocket[1].socketId).emit("notification", {
          type: "request_accepted",
          title: "Your Request Accepted!",
          message: `${data.helperName} accepted your help request`,
          requestId: data.requestId,
          timestamp: new Date()
        });
      }
    });

    socket.on("completeRequest", (data) => {
      console.log('Request completed:', data);
      io.to(data.requestId).emit("requestCompleted", data);
    });

    socket.on("shareLocation", (data) => {
      console.log('Location shared:', data);
      socket.to(data.requestId).emit("locationUpdate", data);
    });

    socket.on("startNavigation", (data) => {
      console.log('Navigation started:', data);
      socket.to(data.requestId).emit("navigationStarted", data);
    });

    socket.on("chatRequest", (data) => {
      console.log('Chat request received:', data);
      
      // Send notification to the other user
      const targetSocket = Array.from(connectedUsers.entries())
        .find(([userId, userData]) => userId === data.toUserId);
      
      if (targetSocket) {
        io.to(targetSocket[1].socketId).emit("notification", {
          type: "chat_request",
          title: "Chat Request",
          message: `${data.fromUserName} wants to chat with you`,
          requestId: data.requestId,
          fromUserId: data.fromUserId,
          timestamp: new Date()
        });
      }
    });

    socket.on('disconnect', () => {
      if (socket.userId) {
        connectedUsers.delete(socket.userId);
        console.log(`User ${socket.userId} disconnected`);
      }
    });
  });
};  
