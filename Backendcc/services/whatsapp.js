import dotenv from "dotenv";
import undici from "undici";
import fs from "fs";
import mime from "mime-types";
import path from "path";
dotenv.config();
import undici from "undici";

const { FormData, fileFromPath } = undici;

export async function sendMessage(to, message, imageId = null) {
  try {
    let body;

    if (imageId) {
      body = {
        messaging_product: "whatsapp",
        to,
        type: "image",
        image: {
          id: imageId,
          caption: message || "",
        },
      };
    } else {
      body = {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message },
      };
    }

    const response = await fetch(
      `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    const data = await response.json();

    console.log("📩 WhatsApp FULL response:", JSON.stringify(data, null, 2));

    if (!response.ok || !data?.messages?.[0]?.id) {
      throw new Error(data?.error?.message || "WhatsApp send failed");
    }

    return data.messages[0].id;
  } catch (err) {
    console.error("❌ sendMessage error:", err.message);
    return null; // ✅ correct behavior
  }
}

export async function uploadMedia(filePath) {
  const formData = new FormData();

  formData.set("messaging_product", "whatsapp");

  // 🔥 THIS IS THE REAL FIX
  const file = await fileFromPath(filePath);
  formData.set("file", file);

  try {
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/media`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        },
        body: formData,
      }
    );

    const data = await response.json();

    console.log("📤 MEDIA RESPONSE:", data);

    if (!response.ok) {
      throw new Error(data?.error?.message || "Media upload failed");
    }

    if (!data.id) {
      throw new Error("No media ID returned");
    }

    console.log("📸 Media ID:", data.id);

    return data.id;
  } catch (err) {
    console.error("❌ uploadMedia error:", err.message);
    throw err;
  }
}
