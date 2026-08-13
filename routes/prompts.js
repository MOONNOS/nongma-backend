const express = require("express");
const db = require("../db");
const { optionalAuth } = require("../middleware/auth");

const router = express.Router();

// ทุกคนเห็นการ์ดทั้งหมด แต่เนื้อหา prompt_text จะถูกซ่อนถ้า LV ไม่ถึงเกณฑ
router.get("/", optionalAuth, (req, res) => {
  let userLevel = 1;
  if (req.userId) {
    const user = db.prepare("SELECT level FROM users WHERE id = ?").get(req.userId);
    if (user) userLevel = user.level;
  }

  const prompts = db.prepare("SELECT * FROM prompts").all();

  const result = prompts.map((p) => {
    const unlocked = userLevel >= p.level_required;
    return {
      id: p.id,
      category: p.category,
      title: p.title,
      description: p.description,
      level_required: p.level_required,
      unlocked,
      prompt_text: unlocked ? p.prompt_text : null,
    };
  });

  res.json(result);
});

module.exports = router;
