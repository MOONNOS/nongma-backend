const express = require("express");
const db = require("../db");
const { optionalAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", optionalAuth, (req, res) => {
  let userLevel = 1;
  if (req.userId) {
    const user = db.prepare("SELECT level FROM users WHERE id = ?").get(req.userId);
    if (user) userLevel = user.level;
  }

  const prompts = db.prepare("SELECT * FROM prompts").all();

  const result = prompts.map((p) => {
    const unlocked = userLevel >= 2; // LV2 ขึ้นไปเห็นได้ทั้งหมดเหมือนกัน
    return {
      id: p.id,
      category: p.category,
      title: p.title,
      description: p.description,
      unlocked,
      gem_url: unlocked ? p.gem_url : null,
    };
  });

  res.json(result);
});

module.exports = router;
