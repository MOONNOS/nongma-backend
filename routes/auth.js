const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const db = require("../db");

const router = express.Router();

// จำกัดจำนวนครั้งที่ลอง login/signup ผิดเพื่อกัน brute-force
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
  if (password.length 
