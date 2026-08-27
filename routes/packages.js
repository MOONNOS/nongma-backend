const express = require("express");
const db = require("../db");
const router = express.Router();
router.get("/", (req, res) => {
  const packages = db.prepare("SELECT * FROM packages WHERE active = 1 ORDER BY sort_order ASC").all();
  res.json(packages);
});
module.exports = router;
