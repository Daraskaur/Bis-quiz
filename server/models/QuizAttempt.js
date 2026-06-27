import mongoose from "mongoose";

const quizAttemptSchema = new mongoose.Schema({
  studentUid: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  institution: { type: String, required: true },
  studentCgpa: { type: Number, required: true },
  correctPercentage: { type: Number, default: 0 },
  cbmScore: { type: Number, default: 0 },
  cbmMaxPossible: { type: Number, default: 0 },
  timeRemainingAtSubmission: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now },
  behavioralMetrics: { type: mongoose.Schema.Types.Mixed, default: {} },
});

export default mongoose.model("QuizAttempt", quizAttemptSchema);