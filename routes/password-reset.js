const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const { client, get, run } = require("../db");

const router = express.Router();

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "ลองมากเกินไป กรุณารอสักครู่แล้วลองใหม่" },
});

// สร้างตารางของตัวเอง ไม่ไปแตะ migrate เดิมใน db.js เลย ปลอดภัยกับของเก่า 100%
(async () => {
  try {
    await client.execute(`CREATE TABLE IF NOT EXISTS password_resets (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      token      TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used       INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    console.log("[password-reset] ตาราง password_resets พร้อมใช้งาน");
  } catch (err) {
    console.error("[password-reset] สร้างตารางไม่สำเร็จ:", err);
  }
})();

const FRONTEND_URL = process.env.FRONTEND_URL || "https://nongma-website.pages.dev";
const RESEND_API_KEY = process.env.RESEND_API_KEY;

async function sendResetEmail(toEmail, resetLink) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "น้องหมาสอนทำคลิป <onboarding@resend.dev>",
      to: toEmail,
      subject: "🐾 รีเซ็ตรหัสผ่าน น้องหมาสอนทำคลิป",
      html: `
        <div style="font-family:sans-serif; max-width:480px; margin:0 auto;">
          <h2>🐾 รีเซ็ตรหัสผ่านของคุณ</h2>
          <p>กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ ลิงก์นี้ใช้ได้ภายใน 1 ชั่วโมง</p>
          <p style="text-align:center; margin:24px 0;">
            <a href="${resetLink}" style="background:#F2785C; color:#fff; padding:12px 28px; border-radius:999px; text-decoration:none; font-weight:bold;">ตั้งรหัสผ่านใหม่</a>
          </p>
          <p style="color:#888; font-size:13px;">ถ้าคุณไม่ได้ขอรีเซ็ตรหัสผ่าน สามารถเพิกเฉยต่ออีเมลนี้ได้เลยค่ะ ไม่มีอะไรเปลี่ยนแปลง</p>
        </div>
      `,
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error("ส่งอีเมลไม่สำเร็จ: " + errText);
  }
}

// ===== POST /api/auth/forgot-password =====
router.post("/forgot-password", resetLimiter, async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "กรุณากรอกอีเมล" });

    const user = await get("SELECT id, email FROM users WHERE email = ?", [email.toLowerCase()]);

    const genericMsg =
      "ถ้าอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์รีเซ็ตรหัสผ่านไปให้แล้ว กรุณาตรวจสอบกล่องข้อความ (หรือ Spam) ค่ะ 🐾";

    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await run(
        "INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)",
        [user.id, token, expiresAt]
      );
      const resetLink = `${FRONTEND_URL}/reset-password.html?token=${token}`;
      try {
        await sendResetEmail(user.email, resetLink);
      } catch (mailErr) {
        console.error("[password-reset] ส่งอีเมลไม่สำเร็จ:", mailErr);
      }
    }

    res.json({ message: genericMsg });
  } catch (err) {
    next(err);
  }
});

// ===== POST /api/auth/reset-password =====
router.post("/reset-password", resetLimiter, async (req, res, next) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) {
      return res.status(400).json({ error: "ข้อมูลไม่ครบถ้วน" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร" });
    }

    const record = await get("SELECT * FROM password_resets WHERE token = ?", [token]);
    if (!record) {
      return res.status(400).json({ error: "ลิงก์รีเซ็ตไม่ถูกต้อง หรือถูกใช้ไปแล้ว" });
    }
    if (record.used) {
      return res.status(400).json({ error: "ลิงก์นี้ถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่" });
    }
    if (new Date(record.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: "ลิงก์นี้หมดอายุแล้ว กรุณาขอลิงก์ใหม่" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await run("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, record.user_id]);
    await run("UPDATE password_resets SET used = 1 WHERE id = ?", [record.id]);

    res.json({ message: "ตั้งรหัสผ่านใหม่สำเร็จแล้วค่ะ 🐾 เข้าสู่ระบบด้วยรหัสผ่านใหม่ได้เลย" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
