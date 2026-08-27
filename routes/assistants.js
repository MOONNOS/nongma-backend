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
    const assistants = await all("SELECT * FROM ai_assistants WHERE status = 1 ORDER BY sort_order ASC");
    const result = assistants.map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role,
      icon: a.icon,
      description: a.description,
      level_required: a.level_required,
      unlocked: userLevel >= a.level_required,
    }));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
