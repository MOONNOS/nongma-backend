const express = require("express");
const { get, all } = require("../db");
const { optionalAuth } = require("../middleware/auth");
const router = express.Router();

router.get("/", optionalAuth, async (req, res, next) => {
  try {
    let userLevel = 1;
    if (req.userId) {
      const user = await get("SELECT level FROM users WHERE id = ?", [req.userId]);
      if (user) userLevel = user.level;
    }
    const prompts = await all("SELECT * FROM prompts");
    const result = prompts.map((p) => {
      const unlocked = userLevel >= p.level_required; // เช็คตาม level ที่ Gem นี้ต้องใช้จริงๆ (เดิมล็อกไว้ >= 2 ตายตัว)
      return {
        id: p.id,
        category: p.category,
        title: p.title,
        description: p.description,
        level_required: p.level_required, // เดิมไม่ส่งค่านี้กลับไป ทำให้หน้าเว็บโชว์ "LVundefined"
        image_url: p.image_url || null,
        unlocked,
        gem_url: unlocked ? p.gem_url : null,
      };
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
