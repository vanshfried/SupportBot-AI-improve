import express from "express";
import multer from "multer";
import fs from "fs";
import { sendMessage, uploadMedia } from "../../services/whatsapp.js";
import { addMessage } from "../../store/conversations.js";
import { requireAdmin } from "../../middleware/auth.js";

const router = express.Router();
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

/**
 * 🔥 SEND (single OR multiple numbers)
 */
router.post("/send", requireAdmin, upload.single("image"), async (req, res) => {
  let { to, message } = req.body;
  let imageId = null;

  // 🔍 DEBUG INPUT
  console.log("📥 Incoming request:");
  console.log({
    to,
    message,
    file: req.file,
  });

  // 🔁 SAFE PARSE
  if (typeof to === "string") {
    try {
      to = JSON.parse(to);
    } catch {
      to = [to];
    }
  }

  // 🚫 VALIDATION (must have numbers + message or image)
  if (!to || (!(message && message.trim()) && !req.file)) {
    console.log("❌ Validation failed");
    return res.status(400).json({ error: "message or image required" });
  }

  // 🚫 IMAGE TYPE VALIDATION
  if (req.file && !req.file.mimetype.startsWith("image/")) {
    console.log("❌ Invalid file type:", req.file.mimetype);
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "Only image files allowed" });
  }

  // 📸 UPLOAD IMAGE TO WHATSAPP
  if (req.file) {
    try {
      console.log("📤 Uploading media...");
      imageId = await uploadMedia(req.file.path);
      console.log("📸 Image uploaded. ID:", imageId);
    } catch (err) {
      console.error("❌ Media upload failed:", err.message);
      return res.status(500).json({ error: err.message });
    } finally {
      fs.unlinkSync(req.file.path);
    }
  }

  // 📞 NORMALIZE NUMBERS
  let numbers = [];

  if (Array.isArray(to)) {
    numbers = to;
  } else {
    numbers = to
      .split(/[\n, ]+/)
      .map((n) => n.trim())
      .filter(Boolean);
  }

  console.log("📞 Final numbers:", numbers);

  const results = [];

  try {
    for (const number of numbers) {
      try {
        console.log(`📨 Sending to ${number}...`);

        const messageId = await sendMessage(number, message, imageId);

        if (!messageId) {
          throw new Error("WhatsApp send failed");
        }

        await addMessage(number, "outgoing", message, messageId, "sent");

        console.log(`✅ Sent to ${number}`);

        results.push({ number, status: "sent" });
      } catch (err) {
        console.error(`❌ Failed for ${number}:`, err.message);

        results.push({ number, status: "failed" });
      }
    }

    console.log("📊 Final results:", results);

    res.json({
      success: true,
      total: numbers.length,
      results,
    });
  } catch (err) {
    console.error("❌ Server error:", err);
    res.status(500).json({ error: "Failed to send" });
  }
});

export default router;
