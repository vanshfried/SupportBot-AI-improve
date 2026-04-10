// backend/routes/analytics.js

import express from "express";
import { pool } from "../../db.js";

const router = express.Router();

router.get("/agent-performance", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.role,

        -- 📩 messages
        COALESCE(m.message_count, 0) AS message_count,

        -- ✅ conversations closed
        COALESCE(c.conversations_closed, 0) AS conversations_closed

      FROM users u

      -- ✅ messages aggregation
      LEFT JOIN (
        SELECT sender_id, COUNT(*) AS message_count
        FROM messages
        WHERE sender_id IS NOT NULL
        GROUP BY sender_id
      ) m ON m.sender_id = u.id

      -- ✅ conversations aggregation (FIXED)
      LEFT JOIN (
        SELECT last_agent_id, COUNT(*) AS conversations_closed
        FROM conversations
        WHERE status = 'ended'
        GROUP BY last_agent_id
      ) c ON c.last_agent_id = u.id

      ORDER BY conversations_closed DESC;
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});
export default router;
