import dotenv from "dotenv";
import undici from "undici";
import fs from "fs";
import mime from "mime-types";
import path from "path";
dotenv.config();

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

  const fileBuffer = fs.readFileSync(filePath);

  const mimeType = mime.lookup(filePath);

  if (!mimeType) {
    throw new Error("❌ Could not detect MIME type");
  }

  console.log("📂 File:", filePath);
  console.log("📦 MIME:", mimeType);

  const blob = new Blob([fileBuffer], { type: mimeType });

  formData.append("file", blob, path.basename(filePath));
  formData.append("messaging_product", "whatsapp");

  const response = await fetch(
    `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/media`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      },
      body: formData,
    },
  );

  const data = await response.json();

  console.log("📤 MEDIA RESPONSE:", data);

  if (!response.ok) {
    throw new Error(data?.error?.message);
  }

  return data.id;
}
