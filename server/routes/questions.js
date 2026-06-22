import express from "express";
import Question from "../models/Question.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// Get all questions (authenticated users)
router.get("/", authenticate, async (req, res) => {
  try {
    const questions = await Question.find();
    res.json(questions.map((q) => ({ id: q._id, ...q.toObject(), _id: undefined, __v: undefined })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk update questions (admin only) — replaces all questions
router.put("/bulk", authenticate, requireAdmin, async (req, res) => {
  try {
    const { questions } = req.body;

    // Delete all existing questions
    await Question.deleteMany({});

    // Insert new ones
    const inserted = await Question.insertMany(
      questions.map((q) => ({
        text: q.text,
        options: q.options,
        correctAnswer: q.correctAnswer,
        type: q.type,
        difficulty: q.difficulty,
        bloomsLevel: q.bloomsLevel,
        fleschEase: q.fleschEase,
        gunningFogIndex: q.gunningFogIndex,
        lexicalDiversity: q.lexicalDiversity,
        syntacticComplexity: q.syntacticComplexity,
      }))
    );

    res.json({ message: "Questions updated", count: inserted.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
