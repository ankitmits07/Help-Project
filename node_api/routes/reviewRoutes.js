const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const Review = require("../models/Review");
const User = require("../models/User");

router.post("/", auth, async (req, res) => {
  const { toUser, rating, comment } = req.body;

  await Review.create({
    fromUser: req.user.id,
    toUser,
    rating,
    comment
  });

  await User.findByIdAndUpdate(toUser, {
    $inc: { trustPoints: rating >= 4 ? 10 : 2 }
  });

  res.json({ message: "Review added" });
});

module.exports = router;
