const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getLevelInfo, POINTS_PER_PROMPT_COPY } = require("../lib/levels");

const router = express.Router();

router.get("/", (req, res) => {
  const prompts = db.prepare("SELECT * FROM prompts").all();
  res.json(prompts);
});

// เรียก endpoint นี้ทุกครั้งที่ผู้ใช้กดปุ่ม "คัดลอก" prompt ฝั่ง frontend
// ให้แต้มเฉพาะครั้งแรกที่ user คนนั้นคัดลอก prompt อันนี้ กันการยิงซ้ำเพื่อฟาร์มแต้ม
router.post("/:promptId/copy", requireAuth, (req, res) => {
  const { promptId } = req.params;

  const prompt = db.prepare("SELECT id FROM prompts WHERE id = ?").get(promptId);
  if (!prompt) return res.status(404).json({ error: "ไม่พบ prompt นี้" });

  const already = db
    .prepare("SELECT id FROM prompt_copies WHERE user_id = ? AND prompt_id = ?")
    .get(req.userId, promptId);

  let pointsAwarded = 0;

  if (!already) {
    const tx = db.transaction(() => {
      db.prepare("INSERT INTO prompt_copies (user_id, prompt_id) VALUES (?, ?)").run(
        req.userId,
        promptId
      );
      db.prepare("UPDATE users SET points = points + ? WHERE id = ?").run(
        POINTS_PER_PROMPT_COPY,
        req.userId
      );
    });
    tx();
    pointsAwarded = POINTS_PER_PROMPT_COPY;
  }

  const user = db.prepare("SELECT points FROM users WHERE id = ?").get(req.userId);

  res.json({
    pointsAwarded,
    alreadyCopiedBefore: Boolean(already),
    ...getLevelInfo(user.points),
  });
});

module.exports = router;
