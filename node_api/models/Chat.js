const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: "HelpRequest", required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  senderName: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

// Index for faster queries
chatSchema.index({ requestId: 1, timestamp: -1 });

module.exports = mongoose.model("Chat", chatSchema);