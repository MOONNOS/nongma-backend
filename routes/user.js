const express = require("express");
const bcrypt = require("bcryptjs");
const { get, run } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getLevelInfo } = require("../lib/levels");
const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await get(
      "SELECT id, username, email, level, created_at FROM users WHERE id = ?",
      [req.userId]
    );
    if (!user) return res.status(404).json({ error: "ไม่พบผู้ใช้" });
    res.json({
      ...user,
      ...getLevelInfo(user.level),
    });
  } catch (err) {
    next(err);
  }
});

// เปลี่ยนรหัสผ่าน (ต้องยืนยันด้วยรหัสผ่านเดิมก่อน)
router.patch("/change-password", requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "กรุณากรอกรหัสผ่านเดิมและรหัสผ่านใหม่" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร" });
    }
    const user = await get("SELECT * FROM users WHERE id = ?", [req.userId]);
    if (!user) return res.status(404).json({ error: "ไม่พบผู้ใช้" });
    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) return res.status(401).json({ error: "รหัสผ่านเดิมไม่ถูกต้อง" });
    const newHash = await bcrypt.hash(newPassword, 12);
    await run("UPDATE users SET password_hash = ? WHERE id = ?", [newHash, req.userId]);
    res.json({ ok: true, message: "เปลี่ยนรหัสผ่านสำเร็จ" });
  } catch (err) {
    next(err);
  }
});

// เปลี่ยนอีเมล (ต้องยืนยันด้วยรหัสผ่านปัจจุบัน)
router.patch("/change-email", requireAuth, async (req, res, next) => {
  try {
    const { newEmail, currentPassword } = req.body || {};
    if (!newEmail || !currentPassword) {
      return res.status(400).json({ error: "กรุณากรอกอีเมลใหม่และรหัสผ่านปัจจุบัน" });
    }
    if (!EMAIL_RE.test(newEmail)) {
      return res.status(400).json({ error: "รูปแบบอีเมลไม่ถูกต้อง" });
    }
    const user = await get("SELECT * FROM users WHERE id = ?", [req.userId]);
    if (!user) return res.status(404).json({ error: "ไม่พบผู้ใช้" });
    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) return res.status(401).json({ error: "รหัสผ่านไม่ถูกต้อง" });
    const existing = await get(
      "SELECT id FROM users WHERE email = ? AND id != ?",
      [newEmail.toLowerCase(), req.userId]
    );
    if (existing) return res.status(409).json({ error: "อีเมลนี้ถูกใช้แล้ว" });
    await run("UPDATE users SET email = ? WHERE id = ?", [newEmail.toLowerCase(), req.userId]);
    res.json({ ok: true, message: "เปลี่ยนอีเมลสำเร็จ", email: newEmail.toLowerCase() });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
