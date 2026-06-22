import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema({
  totalTimeAllowed: { type: Number, default: 30 },
  passingThreshold: { type: Number, default: 40 },
});

export default mongoose.model("Settings", settingsSchema);
