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

  const links = db.prepare("SELECT * FROM community_links ORDER BY sort_order ASC").all();
  const result = links.map((l) => ({
    id: l.id,
    platform: l.platform,
    icon: l.icon,
    level_required: l.level_required,
    unlocked: userLevel >= l.level_required,
    url: userLevel >= l.level_required ? l.url : null,
  }));

  res.json(result);
});

module.exports = router;
