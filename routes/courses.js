const express = require("express");
const { all } = require("../db");
const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const courses = await all("SELECT * FROM courses WHERE status = 1 ORDER BY sort_order ASC");
    const result = courses.map((c) => ({
      id: c.id,
      title: c.title,
      icon: c.icon,
      description: c.description,
      lessons: JSON.parse(c.lessons || "[]"),
    }));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
