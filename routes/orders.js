const express = require("express");
const { get, all, run } = require("../db");
const { requireAuth } = require("../middleware/auth");
const router = express.Router();

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { package_id } = req.body || {};
    if (!package_id) return res.status(400).json({ error: "ต้องระบุ package_id" });

    const pkg = await get("SELECT * FROM packages WHERE id = ? AND active = 1", [package_id]);
    if (!pkg) return res.status(404).json({ error: "ไม่พบแพ็กเกจนี้" });

    const existing = await get(
      "SELECT id FROM orders WHERE user_id = ? AND package_id = ? AND status = 'pending'",
      [req.userId, package_id]
    );
    if (existing) return res.status(409).json({ error: "คุณมีคำสั่งซื้อแพ็กเกจนี้ค้างรออนุมัติอยู่แล้ว" });

    const result = await run(
      "INSERT INTO orders (user_id, package_id, status) VALUES (?, ?, 'pending')",
      [req.userId, package_id]
    );
    res.status(201).json({
      ok: true,
      orderId: Number(result.lastInsertRowid),
      message: `สร้างคำสั่งซื้อ "${pkg.name}" สำเร็จ กรุณาชำระเงินและแจ้งสลิปทาง LINE ทีมงานจะยืนยันให้เร็วที่สุด`,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const orders = await all(
      `SELECT o.id, o.status, o.created_at, o.approved_at, p.name AS package_name, p.price, p.icon
       FROM orders o JOIN packages p ON o.package_id = p.id
       WHERE o.user_id = ? ORDER BY o.created_at DESC`,
      [req.userId]
    );
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
