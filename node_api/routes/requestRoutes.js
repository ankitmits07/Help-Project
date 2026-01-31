const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const HelpRequest = require("../models/HelpRequest");

/**
 * CREATE REQUEST
 */
router.post("/", auth, async (req, res) => {
  try {
    const { category, description, lat, lng, minutes, visibility } = req.body;

    if (!category || !description || !lat || !lng) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const expiresAt = new Date(Date.now() + (minutes || 30) * 60000);

    const request = await HelpRequest.create({
      user: req.user._id,
      category,
      description,
      location: {
        type: "Point",
        coordinates: [lng, lat]
      },
      status: "open",
      visibility: visibility || "public",
      expiresAt
    });

    const populatedRequest = await HelpRequest.findById(request._id).populate("user", "name trustPoints");
    res.status(201).json(populatedRequest);
  } catch (err) {
    console.error("CREATE REQUEST ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * NEARBY REQUESTS (exclude user's own requests)
 */
router.get("/nearby", auth, async (req, res) => {
  try {
    const { lat, lng } = req.query;
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60000);

    const requests = await HelpRequest.find({
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [Number(lng), Number(lat)]
          },
          $maxDistance: 5000
        }
      },
      status: "open",
      createdAt: { $gte: thirtyMinutesAgo }
    }).populate("user", "name trustPoints").populate("helper", "name");

    res.json(requests);
  } catch (err) {
    console.error("NEARBY REQUEST ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * ACCEPT REQUEST
 */
router.post("/:id/accept", auth, async (req, res) => {
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60000);
    const request = await HelpRequest.findById(req.params.id);

    if (!request)
      return res.status(404).json({ message: "Request not found" });

    if (request.status !== "open")
      return res.status(400).json({ message: "Already taken" });

    if (request.createdAt < thirtyMinutesAgo)
      return res.status(400).json({ message: "Request expired (30 min limit)" });

    if (request.user.toString() === req.user._id.toString())
      return res.status(400).json({ message: "Cannot accept your own request" });

    request.helper = req.user._id;
    request.status = "accepted";
    request.acceptedAt = new Date();
    await request.save();

    const populatedRequest = await HelpRequest.findById(request._id)
      .populate("user", "name trustPoints")
      .populate("helper", "name trustPoints");

    res.json(populatedRequest);
  } catch (err) {
    console.error("ACCEPT REQUEST ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * COMPLETE REQUEST
 */
router.post("/:id/complete", auth, async (req, res) => {
  try {
    const request = await HelpRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.user.toString() !== req.user._id.toString() && request.helper?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not allowed" });
    }

    request.status = "completed";
    request.completedAt = new Date();
    request.completedBy = req.user._id;
    await request.save();

    const populatedRequest = await HelpRequest.findById(request._id)
      .populate("user", "name trustPoints")
      .populate("helper", "name trustPoints")
      .populate("completedBy", "name");

    res.json(populatedRequest);
  } catch (err) {
    console.error("COMPLETE REQUEST ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET MY REQUESTS (created by user)
 */
router.get("/my-requests", auth, async (req, res) => {
  try {
    const requests = await HelpRequest.find({ user: req.user._id })
      .populate("helper", "name trustPoints")
      .populate("completedBy", "name")
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    console.error("MY REQUESTS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET MY ACCEPTED REQUESTS (accepted by user as helper)
 */
router.get("/my-accepted", auth, async (req, res) => {
  try {
    const requests = await HelpRequest.find({ 
      helper: req.user._id,
      status: "accepted"
    })
      .populate("user", "name trustPoints")
      .sort({ acceptedAt: -1 });

    res.json(requests);
  } catch (err) {
    console.error("MY ACCEPTED ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * SEND MESSAGE (Updated to use Chat model)
 */
router.post("/:id/message", auth, async (req, res) => {
  try {
    const { message } = req.body;
    const Chat = require("../models/Chat");
    const request = await HelpRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.user.toString() !== req.user._id.toString() && request.helper?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const newMessage = await Chat.create({
      requestId: req.params.id,
      senderId: req.user._id,
      senderName: req.user.name,
      message
    });

    res.json(newMessage);
  } catch (err) {
    console.error("SEND MESSAGE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * UPDATE LIVE LOCATION
 */
router.post("/:id/location", auth, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const request = await HelpRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.user.toString() !== req.user._id.toString() && request.helper?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const isHelper = request.helper?.toString() === req.user._id.toString();
    const locationKey = isHelper ? "helper" : "requester";

    if (!request.liveLocation) {
      request.liveLocation = {};
    }

    request.liveLocation[locationKey] = {
      lat,
      lng,
      timestamp: new Date()
    };

    await request.save();
    res.json({ message: "Location updated" });
  } catch (err) {
    console.error("UPDATE LOCATION ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});


/**
 * GET MESSAGES FOR REQUEST (Updated to use Chat model)
 */
router.get("/:id/messages", auth, async (req, res) => {
  try {
    const Chat = require("../models/Chat");
    const messages = await Chat.find({ requestId: req.params.id })
      .sort({ timestamp: 1 })
      .limit(100);

    res.json(messages);
  } catch (err) {
    console.error("GET MESSAGES ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET ALL REQUESTS (24 hours)
 */
router.get("/all", auth, async (req, res) => {
  try {
    const { lat, lng } = req.query;
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60000);

    const requests = await HelpRequest.find({
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [Number(lng), Number(lat)]
          },
          $maxDistance: 5000
        }
      },
      createdAt: { $gte: twentyFourHoursAgo }
    }).populate("user", "name trustPoints").populate("helper", "name");

    res.json(requests);
  } catch (err) {
    console.error("ALL REQUESTS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
