import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "./models/User.js";

dotenv.config();

async function seedAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const adminEmail = "admin@bisquiz.com";
    const adminPassword = "Admin@123";

    const existing = await User.findOne({ email: adminEmail });
    if (existing) {
      console.log("Admin already exists:", adminEmail);
    } else {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await User.create({
        email: adminEmail,
        password: hashedPassword,
        role: "admin",
      });
      console.log("✅ Admin created:");
      console.log("   Email:", adminEmail);
      console.log("   Password:", adminPassword);
    }
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedAdmin();
