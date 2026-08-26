const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/", requireAuth, (req, res) => {
  const { package_id } = req.body || {};
  if (!package_id) return res.status(400).json({ error: "ต้องระบุ package_id" });

  const pkg = db.prepare("SELECT * FROM packages WHERE id = ? AND active = 1").get(package_id);
  if (!pkg) return res.status(404).json({ error: "ไม่พบแพ็กเกจนี้" });

  const existing = db
    .prepare("SELECT id FROM orders WHERE user_id = ? AND package_id = ? AND status = 'pending'")
    .get(req.userId, package_id);
  if (existing) return res.status(409).json({ error: "คุณมีคำสั่งซื้อแพ็กเกจนี้ค้างรออนุมัติอยู่แล้ว" });

  const result = db
    .prepare("INSERT INTO orders (user_id, package_id, status) VALUES (?, ?, 'pending')")
    .run(req.userId, package_id);

  res.status(201).json({
    ok: true,
    orderId: result.lastInsertRowid,
    message: `สร้างคำสั่งซื้อ "${pkg.name}" สำเร็จ กรุณาชำระเงินและแจ้งสลิปทาง LINE ทีมงานจะยืนยันให้เร็วที่สุด`,
  });
});

router.get("/", requireAuth, (req, res) => {
  const orders = db.prepare(`
    SELECT o.id, o.status, o.created_at, o.approved_at, p.name AS package_name, p.price, p.icon
    FROM orders o JOIN packages p ON o.package_id = p.id
    WHERE o.user_id = ? ORDER BY o.created_at DESC
  `).all(req.userId);
  res.json(orders);
});

module.exports = router;
