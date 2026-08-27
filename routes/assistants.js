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

  const assistants = db
    .prepare("SELECT * FROM ai_assistants WHERE status = 1 ORDER BY sort_order ASC")
    .all();

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
});

module.exports = router;
