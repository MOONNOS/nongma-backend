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
    const links = await all("SELECT * FROM community_links ORDER BY sort_order ASC");
    const result = links.map((l) => ({
      id: l.id,
      platform: l.platform,
      icon: l.icon,
      level_required: l.level_required,
      unlocked: userLevel >= l.level_required,
      url: userLevel >= l.level_required ? l.url : null,
    }));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
