const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  userName: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const helpRequestSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  helper: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  category: { type: String, required: true },
  description: { type: String, required: true },
  location: {
    type: {
      type: String,
      enum: ["Point"],
      required: true
    },
    coordinates: {
      type: [Number],
      required: true
    }
  },
  status: {
    type: String,
    enum: ["open", "accepted", "completed", "expired"],
    default: "open"
  },
  visibility: {
    type: String,
    enum: ["public", "friends", "nearby"],
    default: "public"
  },
  expiresAt: { type: Date, required: true },
  acceptedAt: { type: Date },
  completedAt: { type: Date },
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  messages: [messageSchema],
  liveLocation: {
    helper: {
      lat: Number,
      lng: Number,
      timestamp: Date
    },
    requester: {
      lat: Number,
      lng: Number,
      timestamp: Date
    }
  }
}, { timestamps: true });

helpRequestSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("HelpRequest", helpRequestSchema);
