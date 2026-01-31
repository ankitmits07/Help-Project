const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true },
    password: { type: String, required: true },

    location: {
      type: { type: String, default: "Point" },
      coordinates: { type: [Number], default: [0, 0] }
    },

    trustPoints: { type: Number, default: 0 }
  },
  { timestamps: true }
);

UserSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("User", UserSchema);
