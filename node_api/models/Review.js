const mongoose = require("mongoose");

const ReviewSchema = new mongoose.Schema(
  {
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    toUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rating: { type: Number, min: 1, max: 5 },
    comment: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("Review", ReviewSchema);
