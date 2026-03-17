import express from "express";
import { AccessToken } from "livekit-server-sdk";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// POST /api/voice/token
router.post("/token", requireAuth, async (req, res) => {
  const { channelId } = req.body;
  if (!channelId) return res.status(400).json({ error: "Missing channelId" });

  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    { identity: String(req.user.id), name: req.user.username }
  );

  at.addGrant({ roomJoin: true, room: channelId, canPublish: true, canSubscribe: true });

  res.json({ token: await at.toJwt(), url: process.env.LIVEKIT_URL });
});

export default router;