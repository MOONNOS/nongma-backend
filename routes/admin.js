const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { getLevelInfo } = require("../lib/levels");

const router = express.Router();

function checkKey(req, res) {
  const { key } = req.query;
  if (!process.env.ADMIN_SETUP_KEY || key !== process.env.ADMIN_SETUP_KEY) {
    res.status(403).json({ error: "รหัสลับไม่ถูกต้อง" });
    return false;
  }
  return true;
}

router.get("/set-level", (req, res) => {
  if (!checkKey(req, res)) return;
  const { email, level } = req.query;
  if (!email || !level) return res.status(400).json({ error: "ต้องระบุ email และ level" });
  const lvl = parseInt(level, 10);
  if (![1, 2, 3, 4, 5].includes(lvl)) return res.status(400).json({ error: "level ต้องเป็นตัวเลข 1-5 เท่านั้น" });

  const user = db.prepare("SELECT id, username, email FROM users WHERE email = ?").get(email.toLowerCase());
  if (!user) return res.status(404).json({ error: "ไม่พบผู้ใช้ที่มีอีเมลนี้" });

  db.prepare("UPDATE users SET level = ? WHERE id = ?").run(lvl, user.id);
  res.json({ ok: true, user: { username: user.username, email: user.email }, ...getLevelInfo(lvl) });
});

router.get("/reset-password", async (req, res) => {
  if (!checkKey(req, res)) return;
  const { email, newPassword } = req.query;
  if (!email || !newPassword) return res.status(400).json({ error: "ต้องระบุ email และ newPassword" });
  if (newPassword.length < 8) return res.status(400).json({ error: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร" });

  const user = db.prepare("SELECT id, username, email FROM users WHERE email = ?").get(email.toLowerCase());
  if (!user) return res.status(404).json({ error: "ไม่พบผู้ใช้ที่มีอีเมลนี้" });

  const passwordHash = await bcrypt.hash(newPassword, 12);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, user.id);
  res.json({ ok: true, message: `ตั้งรหัสผ่านใหม่ให้ ${user.username} สำเร็จ` });
});

// ผูกลิงก์ Gem เข้ากับ prompt ที่มีอยู่แล้ว
router.get("/set-gem", (req, res) => {
  if (!checkKey(req, res)) return;
  const { id, gemUrl } = req.query;
  if (!id || !gemUrl) return res.status(400).json({ error: "ต้องระบุ id และ gemUrl" });

  const prompt = db.prepare("SELECT id FROM prompts WHERE id = ?").get(id);
  if (!prompt) return res.status(404).json({ error: "ไม่พบ prompt ที่มี id นี้" });

  db.prepare("UPDATE prompts SET gem_url = ? WHERE id = ?").run(gemUrl, id);
  res.json({ ok: true, message: `ผูก Gem ให้ ${id} สำเร็จ` });
});

// เพิ่ม prompt ใหม่เข้าคลัง (สำหรับตอนคลังโตขึ้นเรื่อยๆ ในอนาคต ไม่ต้อง redeploy)
router.get("/add-prompt", (req, res) => {
  if (!checkKey(req, res)) return;
  const { id, category, title, description, level, gemUrl } = req.query;
  if (!id || !category || !title || !level) {
    return res.status(400).json({ error: "ต้องระบุ id, category, title, level เป็นอย่างน้อย" });
  }
  const lvl = parseInt(level, 10);
  if (![1, 2, 3, 4, 5].includes(lvl)) return res.status(400).json({ error: "level ต้องเป็นตัวเลข 1-5 เท่านั้น" });

  db.prepare(`
    INSERT INTO prompts (id, category, title, description, gem_url, level_required)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      category = excluded.category, title = excluded.title,
      description = excluded.description, gem_url = excluded.gem_url,
      level_required = excluded.level_required
  `).run(id, category, title, description || "", gemUrl || null, lvl);

  res.json({ ok: true, message: `เพิ่ม/อัปเดต prompt "${title}" สำเร็จ` });
});

module.exports = router;
