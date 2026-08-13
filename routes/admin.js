const express = require("express");
const db = require("../db");
const { getLevelInfo } = require("../lib/levels");

const router = express.Router();

// ประตูลับตั้งค่า LV แบบไม่ต้องพึ่ง Shell (ใช้ตอนตั้งค่าครั้งแรก / ไม่มี Shell บน free tier)
// ต้องแนบ ?key=ADMIN_SETUP_KEY ถึงจะใช้ได้ — ตั้งค่า ADMIN_SETUP_KEY ใน Render Environment
router.get("/set-level", (req, res) => {
  const { email, level, key } = req.query;

  if (!process.env.ADMIN_SETUP_KEY || key !== process.env.ADMIN_SETUP_KEY) {
    return res.status(403).json({ error: "รหัสลับไม่ถูกต้อง" });
  }
  if (!email || !level) {
    return res.status(400).json({ error: "ต้องระบุ email และ level" });
  }
  const lvl = parseInt(level, 10);
  if (![1, 2, 3, 4, 5].includes(lvl)) {
    return res.status(400).json({ error: "level ต้องเป็นตัวเลข 1-5 เท่านั้น" });
  }

  const user = db.prepare("SELECT id, username, email FROM users WHERE email = ?").get(email.toLowerCase());
  if (!user) {
    return res.status(404).json({ error: "ไม่พบผู้ใช้ที่มีอีเมลนี้" });
  }

  db.prepare("UPDATE users SET level = ? WHERE id = ?").run(lvl, user.id);

  res.json({
    ok: true,
    user: { username: user.username, email: user.email },
    ...getLevelInfo(lvl),
  });
});

module.exports = router;
