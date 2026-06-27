import express from "express";
import QuizAttempt from "../models/QuizAttempt.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

function calculateCBMScore(behavioralMetrics) {
  let totalScore = 0;
  let maxPossible = 0;

  Object.values(behavioralMetrics).forEach((q) => {
    const confidence = Number(q.confidenceRating) || 0;
    const isCorrect = Boolean(q.isCorrect);

    maxPossible += 3;

    if (confidence <= 2 && confidence >= 1) {
      totalScore += isCorrect ? 1.0 : 0.5;
    } else if (confidence === 3) {
      totalScore += isCorrect ? 2.0 : 1.0;
    } else if (confidence >= 4) {
      totalScore += isCorrect ? 3.0 : 0.0;
    }
  });

  return { totalScore, maxPossible };
}

// Submit a quiz attempt (student)
router.post("/submit", authenticate, async (req, res) => {
  try {
    const { institution, studentCgpa, correctPercentage, timeRemainingAtSubmission, behavioralMetrics } = req.body;

    const { totalScore, maxPossible } = calculateCBMScore(behavioralMetrics || {});

    const attempt = await QuizAttempt.create({
      studentUid: req.user.uid,
      institution,
      studentCgpa,
      correctPercentage,
      cbmScore: totalScore,
      cbmMaxPossible: maxPossible,
      timeRemainingAtSubmission,
      timestamp: new Date(),
      behavioralMetrics,
    });

    res.status(201).json({
      message: "Quiz submitted successfully",
      id: attempt._id,
      cbmScore: totalScore,
      cbmMaxPossible: maxPossible,
    });
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