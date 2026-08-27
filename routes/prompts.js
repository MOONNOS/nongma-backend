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
  } catch (err) {
    next(err);
  }
});

module.exports = router;
