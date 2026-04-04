import express from "express";
import multer from "multer";
import fs from "fs";
import { sendMessage, uploadMedia } from "../../services/whatsapp.js";
import { addMessage } from "../../store/conversations.js";
import { requireAdmin } from "../../middleware/auth.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });
/**
 * 🔥 SEND (single OR multiple numbers)
 */
router.post("/send", requireAdmin, upload.single("image"), async (req, res) => {
  let { to, message } = req.body;
  let imageId = null;

  if (typeof to === "string") {
    to = JSON.parse(to);
  }
  // 📸 if image uploaded → upload to WhatsApp
  if (req.file) {
    try {
      imageId = await uploadMedia(req.file.path);
    } catch (err) {
      console.error("Media upload failed:", err);
      return res.status(500).json({ error: "Image upload failed" });
    } finally {
      fs.unlinkSync(req.file.path);
    }
  }
  if (!to || (!message && !req.file)) {
    return res.status(400).json({ error: "message or image required" });
  }

  // 👉 normalize numbers
  let numbers = [];

  if (Array.isArray(to)) {
    numbers = to;
  } else {
    numbers = to
      .split(/[\n, ]+/)
      .map((n) => n.trim())
      .filter(Boolean);
  }

  const results = [];

  try {
    for (const number of numbers) {
      try {
        const messageId = await sendMessage(number, message, imageId);

        await addMessage(number, "outgoing", message, messageId, "sent");

        results.push({ number, status: "sent" });
      } catch (err) {
        results.push({ number, status: "failed" });
      }
    }

    res.json({
      success: true,
      total: numbers.length,
      results,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send" });
  }
});

export default router;
