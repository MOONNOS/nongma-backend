const express = require("express");
const { get, all, run, batch } = require("../db");
const { requireAuth } = require("../middleware/auth");
const router = express.Router();
async function requireStaff(req, res, next) {
  try {
    const user = await get("SELECT level FROM users WHERE id = ?", [req.userId]);
    if (!user || user.level < 6) {
      return res.status(403).json({ error: "ต้องเป็นทีมงาน (LV6 ขึ้นไป) เท่านั้นถึงจะเข้าถึงส่วนนี้ได้" });
    }
    next();
  } catch (err) {
    next(err);
  }
}
async function logAction(adminId, action, target, details) {
  await run(
    "INSERT INTO audit_logs (admin_id, action, target, details) VALUES (?, ?, ?, ?)",
    [adminId, action, target, details || ""]
  );
}
router.use(requireAuth, requireStaff);
router.get("/users", async (req, res, next) => {
  try {
    const users = await all("SELECT id, username, email, level, created_at FROM users ORDER BY created_at DESC");
    res.json(users);
  } catch (err) {
    next(err);
  }
});
router.get("/orders", async (req, res, next) => {
  try {
    const orders = await all(`
      SELECT o.id, o.status, o.created_at, o.approved_at, o.slip_image,
             COALESCE(o.amount_due, p.price) AS price,
             u.username, u.email, p.name AS package_name, p.level
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN packages p ON o.package_id = p.id
      ORDER BY o.created_at DESC
    `);
    res.json(orders);
  } catch (err) {
    next(err);
  }
});
router.patch("/orders/:id/approve", async (req, res, next) => {
  try {
    const order = await get("SELECT * FROM orders WHERE id = ?", [req.params.id]);
    if (!order) return res.status(404).json({ error: "ไม่พบคำสั่งซื้อนี้" });
    if (order.status !== "pending") return res.status(400).json({ error: "คำสั่งซื้อนี้ถูกดำเนินการไปแล้ว" });
    const pkg = await get("SELECT * FROM packages WHERE id = ?", [order.package_id]);
    await batch([
      {
        sql: "UPDATE orders SET status = 'approved', approved_at = datetime('now') WHERE id = ?",
        args: [order.id],
      },
      {
        sql: "UPDATE users SET level = ? WHERE id = ? AND level < ?",
        args: [pkg.level, order.user_id, pkg.level],
      },
      {
        sql: "INSERT INTO notifications (user_id, message, type) VALUES (?, ?, 'success')",
        args: [order.user_id, `คำสั่งซื้อ "${pkg.name}" ได้รับการอนุมัติแล้ว 🎉 ยินดีต้อนรับสู่ LV${pkg.level}!`],
      },
    ]);
    await logAction(req.userId, "APPROVE_ORDER", `order:${order.id}`, `อนุมัติแพ็กเกจ ${pkg.name} ให้ user ${order.user_id}`);
    res.json({ ok: true, message: `อนุมัติคำสั่งซื้อ #${order.id} สำเร็จ` });
  } catch (err) {
    next(err);
  }
});
router.patch("/orders/:id/reject", async (req, res, next) => {
  try {
    const order = await get("SELECT * FROM orders WHERE id = ?", [req.params.id]);
    if (!order) return res.status(404).json({ error: "ไม่พบคำสั่งซื้อนี้" });
    if (order.status !== "pending") return res.status(400).json({ error: "คำสั่งซื้อนี้ถูกดำเนินการไปแล้ว" });
    await batch([
      { sql: "UPDATE orders SET status = 'rejected' WHERE id = ?", args: [order.id] },
      {
        sql: "INSERT INTO notifications (user_id, message, type) VALUES (?, ?, 'error')",
        args: [order.user_id, `คำสั่งซื้อ #${order.id} ถูกปฏิเสธ กรุณาติดต่อทีมงานหากมีข้อสงสัย`],
      },
    ]);
    await logAction(req.userId, "REJECT_ORDER", `order:${order.id}`, "ปฏิเสธคำสั่งซื้อ");
    res.json({ ok: true, message: `ปฏิเสธคำสั่งซื้อ #${order.id} แล้ว` });
  } catch (err) {
    next(err);
  }
});
module.exports = router;
