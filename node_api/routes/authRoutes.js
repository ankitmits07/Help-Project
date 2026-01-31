const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, lat, lng } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: "Email already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      location: {
        type: "Point",
        coordinates: [
          Number(lng) || 0,
          Number(lat) || 0
        ]
      }
    });

    res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
      trustPoints: user.trustPoints
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: "User not found" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ message: "Wrong password" });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

  res.json({ token, user });
});

router.post("/update-trust", auth, async (req, res) => {
  try {
    const { points } = req.body;
    
    await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { trustPoints: points } },
      { new: true }
    );
    
    res.json({ message: "Trust points updated" });
  } catch (err) {
    console.error("UPDATE TRUST ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
