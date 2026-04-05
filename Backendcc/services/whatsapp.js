import dotenv from "dotenv";
import FormData from "form-data";
import fs from "fs";
import mime from "mime-types";
import path from "path";

dotenv.config();

const WHATSAPP_BASE = "https://graph.facebook.com/v19.0";

/**
 * 🔥 Safe fetch with timeout
 */
async function safeFetch(url, options = {}, timeout = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/**
 * 🔥 SEND MESSAGE (text / image / video / audio / document)
 */
export async function sendMessage(to, message, media = null) {
  try {
    if (!to) throw new Error("Recipient (to) is required");

    let body;

    if (media) {
      const { id, mimeType, filename } = media;

      if (!id || !mimeType) {
        throw new Error("Invalid media object");
      }

      let type = "document";

      if (mimeType.startsWith("image/")) type = "image";
      else if (mimeType.startsWith("video/")) type = "video";
      else if (mimeType.startsWith("audio/")) type = "audio";

      const mediaPayload = {
        id,
      };

      // ✅ caption allowed only for image/video/document
      if (type !== "audio" && message) {
        mediaPayload.caption = message;
      }

      // ✅ documents should include filename
      if (type === "document") {
        mediaPayload.filename = filename || "file";
      }

      body = {
        messaging_product: "whatsapp",
        to,
        type,
        [type]: mediaPayload,
      };
    } else {
      if (!message) throw new Error("Message text is required");

      body = {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message },
      };
    }

    const response = await safeFetch(
      `${WHATSAPP_BASE}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data?.messages?.[0]?.id) {
      console.error("❌ WhatsApp API Error:", data);
      throw new Error(data?.error?.message || "WhatsApp send failed");
    }

    return data.messages[0].id;
  } catch (err) {
    console.error("❌ sendMessage error:", {
      message: err.message,
      to,
    });
    return null;
  }
}

/**
 * 🔥 UPLOAD MEDIA (ANY FILE TYPE)
 */
export async function uploadMedia(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error("File not found");
    }

    const stats = fs.statSync(filePath);

    // 🚫 100MB hard safety (WhatsApp doc limit)
    if (stats.size > 100 * 1024 * 1024) {
      throw new Error("File too large (max 100MB)");
    }

    const mimeType = mime.lookup(filePath) || "application/octet-stream";

    const fileName = path.basename(filePath);

    console.log("📂 Uploading:", fileName);
    console.log("📦 MIME:", mimeType);
    console.log("📏 Size:", stats.size);

    const formData = new FormData();

    // ✅ FIXED (THIS LINE ONLY)
    formData.append("file", fs.createReadStream(filePath), {
      filename: fileName,
      contentType: mimeType,
    });

    formData.append("messaging_product", "whatsapp");

    const response = await safeFetch(
      `${WHATSAPP_BASE}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/media`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          ...formData.getHeaders(), // ✅ VERY IMPORTANT
        },
        body: formData,
      },
      30000,
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data?.id) {
      console.error("❌ MEDIA UPLOAD ERROR:", data);
      throw new Error(data?.error?.message || "Media upload failed");
    }

    return {
      id: data.id,
      mimeType,
      filename: fileName,
    };
  } catch (err) {
    console.error("❌ uploadMedia error:", err.message);
    throw err;
  }
}
