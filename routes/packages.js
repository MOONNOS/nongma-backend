const express = require("express");
const { all } = require("../db");
const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const packages = await all("SELECT * FROM packages WHERE active = 1 ORDER BY sort_order ASC");
    res.json(packages);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
