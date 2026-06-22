import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctAnswer: { type: String, required: true },
  type: { type: String, enum: ["theoretical", "numerical"], default: "theoretical" },
  difficulty: { type: String, enum: ["low", "medium", "high"], default: "medium" },
  bloomsLevel: { type: String, default: "Understanding" },
  fleschEase: { type: Number },
  gunningFogIndex: { type: Number },
  lexicalDiversity: { type: Number },
  syntacticComplexity: { type: String },
});

export default mongoose.model("Question", questionSchema);
