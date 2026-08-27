const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, (req, res) => {
  const notifs = db
    .prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30")
    .all(req.userId);
  res.json(notifs);
});

router.patch("/:id/read", requireAuth, (req, res) => {
  db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?").run(req.params.id, req.userId);
  res.json({ ok: true });
});

module.exports = router;
