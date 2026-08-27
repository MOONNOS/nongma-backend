const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function requireStaff(req, res, next) {
  const user = db.prepare("SELECT level FROM users WHERE id = ?").get(req.userId);
  if (!user || user.level < 6) {
    return res.status(403).json({ error: "ต้องเป็นทีมงาน (LV6 ขึ้นไป) เท่านั้นถึงจะเข้าถึงส่วนนี้ได้" });
  }
  next();
}

router.use(requireAuth, requireStaff);

// ดูรายชื่อสมาชิกทั้งหมด
router.get("/users", (req, res) => {
  const users = db
    .prepare("SELECT id, username, email, level, created_at FROM users ORDER BY created_at DESC")
    .all();
  res.json(users);
});

// ดู Order ทั้งหมด (ทุกสถานะ)
router.get("/orders", (req, res) => {
  const orders = db.prepare(`
    SELECT o.id, o.status, o.created_at, o.approved_at, u.username, u.email, p.name AS package_name, p.price, p.level
    FROM orders o
    JOIN users u ON o.user_id = u.id
    JOIN packages p ON o.package_id = p.id
    ORDER BY o.created_at DESC
  `).all();
  res.json(orders);
});

// อนุมัติ Order → อัปเกรด Level อัตโนมัติ
router.patch("/orders/:id/approve", (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!order) return res.status(404).json({ error: "ไม่พบคำสั่งซื้อนี้" });
  if (order.status !== "pending") return res.status(400).json({ error: "คำสั่งซื้อนี้ถูกดำเนินการไปแล้ว" });

  const pkg = db.prepare("SELECT * FROM packages WHERE id = ?").get(order.package_id);

  const tx = db.transaction(() => {
    db.prepare("UPDATE orders SET status = 'approved', approved_at = datetime('now') WHERE id = ?").run(order.id);
    db.prepare("UPDATE users SET level = ? WHERE id = ? AND level < ?").run(pkg.level, order.user_id, pkg.level);
  });
  tx();

  res.json({ ok: true, message: `อนุมัติคำสั่งซื้อ #${order.id} สำเร็จ` });
});

// ปฏิเสธ Order
router.patch("/orders/:id/reject", (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!order) return res.status(404).json({ error: "ไม่พบคำสั่งซื้อนี้" });
  if (order.status !== "pending") return res.status(400).json({ error: "คำสั่งซื้อนี้ถูกดำเนินการไปแล้ว" });

  db.prepare("UPDATE orders SET status = 'rejected' WHERE id = ?").run(order.id);
  res.json({ ok: true, message: `ปฏิเสธคำสั่งซื้อ #${order.id} แล้ว` });
});

module.exports = router;
