const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getLevelInfo } = require("../lib/levels");

const router = express.Router();

router.get("/me", requireAuth, (req, res) => {
  const user = db
    .prepare("SELECT id, username, email, points, created_at FROM users WHERE id = ?")
    .get(req.userId);

  if (!user) return res.status(404).json({ error: "ไม่พบผู้ใช" });

  const copiedPromptIds = db
    .prepare("SELECT prompt_id FROM prompt_copies WHERE user_id = ?")
    .all(req.userId)
    .map((r) => r.prompt_id);

  res.json({
    ...user,
    ...getLevelInfo(user.points),
    copiedPromptIds,
  });
});

router.get("/leaderboard", (req, res) => {
  const top = db
    .prepare("SELECT username, points FROM users ORDER BY points DESC, created_at ASC LIMIT 20")
    .all()
    .map((u, i) => ({ rank: i + 1, username: u.username, ...getLevelInfo(u.points) }));

  res.json(top);
});

module.exports = router;
