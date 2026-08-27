const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/", (req, res) => {
  const courses = db.prepare("SELECT * FROM courses WHERE status = 1 ORDER BY sort_order ASC").all();
  const result = courses.map((c) => ({
    id: c.id,
    title: c.title,
    icon: c.icon,
    description: c.description,
    lessons: JSON.parse(c.lessons || "[]"),
  }));
  res.json(result);
});

module.exports = router;
