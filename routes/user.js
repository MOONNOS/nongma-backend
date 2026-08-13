const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getLevelInfo } = require("../lib/levels");

const router = express.Router();

router.get("/me", requireAuth, (req, res) => {
  const user = db
    .prepare("SELECT id, username, email, level, created_at FROM users WHERE id = ?")
    .get(req.userId);

  if (!user) return res.status(404).json({ error: "ไม่พบผใช้" });

  res.json({
    ...user,
    ...getLevelInfo(user.level),
  });
});

module.exports = router;
