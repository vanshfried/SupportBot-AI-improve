import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";

import { sendMessage, uploadMedia } from "../../services/whatsapp.js";
import { addMessage } from "../../store/conversations.js";
import { requireAdmin } from "../../middleware/auth.js";

const router = express.Router();

/**
 * 🔥 MULTER CONFIG (safe + production ready)
 */
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    const safeName = Date.now() + "-" + file.originalname.replace(/\s+/g, "_");
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
  },
});

/**
 * 🔥 HELPER: safe delete
 */
const safeUnlink = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error("⚠️ File delete failed:", err.message);
  }
};

/**
 * 🔥 HELPER: normalize numbers
 */
const normalizeNumbers = (input) => {
  if (!input) return [];

  let numbers = [];

  if (Array.isArray(input)) {
    numbers = input;
  } else {
    try {
      const parsed = JSON.parse(input);
      numbers = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      numbers = input.split(/[\n, ]+/);
    }
  }

  return numbers
    .map((n) => String(n).replace(/\D/g, "")) // keep digits only
    .filter((n) => n.length >= 10); // basic validation
};

/**
 * 🔥 SEND (single OR multiple numbers)
 */
router.post(
  "/send",
  requireAdmin, // ✅ secure route
  upload.single("file"), // ✅ changed from "image"
  async (req, res) => {
    let { to, message } = req.body;


    // ✅ normalize numbers
    const numbers = normalizeNumbers(to);

    if (!numbers.length) {
      return res.status(400).json({ error: "No valid numbers provided" });
    }

    if (!message && !req.file) {
      return res.status(400).json({ error: "Message or file is required" });
    }

    /**
     * 🔥 UPLOAD MEDIA (ONCE ONLY)
     */
    let media = null;

    if (req.file) {
      try {
        const uploadRes = await uploadMedia(req.file.path);

        media = {
          id: uploadRes.id,
          mimeType: uploadRes.mimeType,
          filename: uploadRes.filename,
        };
      } catch (err) {
        safeUnlink(req.file.path);
        return res.status(500).json({ error: err.message });
      }

      // cleanup after upload
      safeUnlink(req.file.path);
    }

    /**
     * 🔥 SEND LOOP (with isolation)
     */
    const results = [];

    for (const number of numbers) {
      try {
        console.log(`📨 Sending to ${number}...`);

        const messageId = await sendMessage(number, message, media);

        if (!messageId) throw new Error("Send failed");

        await addMessage(
          number,
          "outgoing",
          message || "[media]",
          messageId,
          "sent",
        );

        results.push({ number, status: "sent" });
      } catch (err) {
        console.error(`❌ Failed for ${number}:`, err.message);

        results.push({
          number,
          status: "failed",
          error: err.message,
        });
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    /**
     * 🔥 RESPONSE
     */
    return res.json({
      success: true,
      total: numbers.length,
      sent: results.filter((r) => r.status === "sent").length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
    });
  },
);

export default router;
