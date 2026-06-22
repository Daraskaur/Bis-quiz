import express from "express";
import QuizAttempt from "../models/QuizAttempt.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// Submit a quiz attempt (student)
router.post("/submit", authenticate, async (req, res) => {
  try {
    const { institution, studentCgpa, correctPercentage, timeRemainingAtSubmission, behavioralMetrics } = req.body;

    const attempt = await QuizAttempt.create({
      studentUid: req.user.uid,
      institution,
      studentCgpa,
      correctPercentage,
      timeRemainingAtSubmission,
      timestamp: new Date(),
      behavioralMetrics,
    });

    res.status(201).json({ message: "Quiz submitted successfully", id: attempt._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all quiz attempts (admin only)
router.get("/attempts", authenticate, requireAdmin, async (req, res) => {
  try {
    const attempts = await QuizAttempt.find().populate("studentUid", "email").sort({ timestamp: -1 });
    res.json(attempts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
