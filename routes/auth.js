const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const db = require("../db");

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "ลองมากเกินไป กรุณารอสักครู่แล้วลองใหม่" },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

router.post("/signup", authLimiter, async (req, res) => {
  const { username, email, password } = req.body || {};

  if (!username || !email || !password) {
    return res.status(400).json({ error: "กรุณากรอกชื่อผู้ใช้ อีเมล และรหัสผ่านให้ครบ" });
  }
  if (username.length < 3 || username.length > 24) {
    return res.status(400).json({ error: "ชื่อผู้ใช้ต้องยาว 3-24 ตัวอักษร" });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "รูปแบบอีเมลไม่ถูกต้อง" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร" });
  }

  const existing = db
    .prepare("SELECT id FROM users WHERE email = ? OR username = ?")
    .get(email.toLowerCase(), username);
  if (existing) {
    return res.status(409).json({ error: "อีเมลหรือชื่อผู้ใช้นี้ถูกใช้แล้ว" });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const result = db
    .prepare("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)")
    .run(username, email.toLowerCase(), passwordHash);

  const token = signToken(result.lastInsertRowid);
  res.status(201).json({
    token,
    user: { id: result.lastInsertRowid, username, email: email.toLowerCase(), points: 0 },
  });
});

router.post("/login", authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "กรุณากรอกอีเมลและรหัสผ่าน" });
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase());
  if (!user) {
    return res.status(401).json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
  }

  const token = signToken(user.id);
  res.json({
    token,
    user: { id: user.id, username: user.username, email: user.email, points: user.points },
  });
});

module.exports = router;
