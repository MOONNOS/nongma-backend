const express = require("express");
const bcrypt = require("bcryptjs");
const { get, all, run, batch } = require("../db");
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

router.get("/set-level", async (req, res, next) => {
  try {
    if (!checkKey(req, res)) return;
    const { email, level } = req.query;
    if (!email || !level) return res.status(400).json({ error: "ต้องระบุ email และ level" });
    const lvl = parseInt(level, 10);
    if (![1, 2, 3, 4, 5, 6, 7].includes(lvl)) return res.status(400).json({ error: "level ต้องเป็นตัวเลข 1-7 เท่านั้น" });
    const user = await get("SELECT id, username, email FROM users WHERE email = ?", [email.toLowerCase()]);
    if (!user) return res.status(404).json({ error: "ไม่พบผู้ใช้ที่มีอีเมลนี้" });
    await run("UPDATE users SET level = ? WHERE id = ?", [lvl, user.id]);
    res.json({ ok: true, user: { username: user.username, email: user.email }, ...getLevelInfo(lvl) });
  } catch (err) {
    next(err);
  }
});

router.get("/reset-password", async (req, res, next) => {
  try {
    if (!checkKey(req, res)) return;
    const { email, newPassword } = req.query;
    if (!email || !newPassword) return res.status(400).json({ error: "ต้องระบุ email และ newPassword" });
    if (newPassword.length < 8) return res.status(400).json({ error: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร" });
    const user = await get("SELECT id, username, email FROM users WHERE email = ?", [email.toLowerCase()]);
    if (!user) return res.status(404).json({ error: "ไม่พบผู้ใช้ที่มีอีเมลนี้" });
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await run("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, user.id]);
    res.json({ ok: true, message: `ตั้งรหัสผ่านใหม่ให้ ${user.username} สำเร็จ` });
  } catch (err) {
    next(err);
  }
});

// ผูกลิงก์ Gem เข้ากับ prompt ที่มีอยู่แล้ว
router.get("/set-gem", async (req, res, next) => {
  try {
    if (!checkKey(req, res)) return;
    const { id, gemUrl } = req.query;
    if (!id || !gemUrl) return res.status(400).json({ error: "ต้องระบุ id และ gemUrl" });
    const prompt = await get("SELECT id FROM prompts WHERE id = ?", [id]);
    if (!prompt) return res.status(404).json({ error: "ไม่พบ prompt ที่มี id นี้" });
    await run("UPDATE prompts SET gem_url = ? WHERE id = ?", [gemUrl, id]);
    res.json({ ok: true, message: `ผูก Gem ให้ ${id} สำเร็จ` });
  } catch (err) {
    next(err);
  }
});

// เพิ่ม prompt ใหม่เข้าคลัง (สำหรับตอนคลังโตขึ้นเรื่อยๆ ในอนาคต ไม่ต้อง redeploy)
router.get("/add-prompt", async (req, res, next) => {
  try {
    if (!checkKey(req, res)) return;
    const { id, category, title, description, level, gemUrl } = req.query;
    if (!id || !category || !title || !level) {
      return res.status(400).json({ error: "ต้องระบุ id, category, title, level เป็นอย่างน้อย" });
    }
    const lvl = parseInt(level, 10);
    if (![1, 2, 3, 4, 5].includes(lvl)) return res.status(400).json({ error: "level ต้องเป็นตัวเลข 1-5 เท่านั้น" });
    await run(
      `INSERT INTO prompts (id, category, title, description, gem_url, level_required)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         category = excluded.category, title = excluded.title,
         description = excluded.description, gem_url = excluded.gem_url,
         level_required = excluded.level_required`,
      [id, category, title, description || "", gemUrl || null, lvl]
    );
    res.json({ ok: true, message: `เพิ่ม/อัปเดต prompt "${title}" สำเร็จ` });
  } catch (err) {
    next(err);
  }
});

// ดูรายการ Order ที่รออนุมัติทั้งหมด
router.get("/pending-orders", async (req, res, next) => {
  try {
    if (!checkKey(req, res)) return;
    const orders = await all(`
      SELECT o.id, o.status, o.created_at, u.username, u.email, p.name AS package_name, p.price, p.level
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN packages p ON o.package_id = p.id
      WHERE o.status = 'pending'
      ORDER BY o.created_at ASC
    `);
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

// อนุมัติ Order → อัปเกรด Level ให้ลูกค้าอัตโนมัติ
router.get("/approve-order", async (req, res, next) => {
  try {
    if (!checkKey(req, res)) return;
    const { orderId } = req.query;
    if (!orderId) return res.status(400).json({ error: "ต้องระบุ orderId" });
    const order = await get("SELECT * FROM orders WHERE id = ?", [orderId]);
    if (!order) return res.status(404).json({ error: "ไม่พบคำสั่งซื้อนี้" });
    if (order.status !== "pending") return res.status(400).json({ error: "คำสั่งซื้อนี้ถูกดำเนินการไปแล้ว" });
    const pkg = await get("SELECT * FROM packages WHERE id = ?", [order.package_id]);

    await batch([
      {
        sql: "UPDATE orders SET status = 'approved', approved_at = datetime('now') WHERE id = ?",
        args: [orderId],
      },
      {
        sql: "UPDATE users SET level = ? WHERE id = ? AND level < ?",
        args: [pkg.level, order.user_id, pkg.level],
      },
    ]);

    res.json({ ok: true, message: `อนุมัติคำสั่งซื้อ #${orderId} สำเร็จ อัปเกรดลูกค้าเป็น ${pkg.name} (LV${pkg.level}) แล้ว` });
  } catch (err) {
    next(err);
  }
});

// ปฏิเสธ Order
router.get("/reject-order", async (req, res, next) => {
  try {
    if (!checkKey(req, res)) return;
    const { orderId } = req.query;
    if (!orderId) return res.status(400).json({ error: "ต้องระบุ orderId" });
    const order = await get("SELECT * FROM orders WHERE id = ?", [orderId]);
    if (!order) return res.status(404).json({ error: "ไม่พบคำสั่งซื้อนี้" });
    await run("UPDATE orders SET status = 'rejected' WHERE id = ?", [orderId]);
    res.json({ ok: true, message: `ปฏิเสธคำสั่งซื้อ #${orderId} แล้ว` });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
