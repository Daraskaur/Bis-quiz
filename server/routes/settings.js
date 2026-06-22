import express from "express";
import Settings from "../models/Settings.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// Get settings (any authenticated user)
router.get("/", authenticate, async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({ totalTimeAllowed: 30, passingThreshold: 40 });
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update settings (admin only)
router.put("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const { totalTimeAllowed, passingThreshold } = req.body;

    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({ totalTimeAllowed, passingThreshold });
    } else {
      settings.totalTimeAllowed = totalTimeAllowed;
      settings.passingThreshold = passingThreshold;
      await settings.save();
    }

    res.json({ message: "Settings updated", settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
