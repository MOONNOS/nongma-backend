const express = require("express");
const { client, get, all, run } = require("../db");
const { requireAuth } = require("../middleware/auth");
const router = express.Router();

// เพิ่มคอลัมน์ slip_image และ amount_due ให้ตาราง orders (ถ้ายังไม่มี) — ไม่กระทบข้อมูลเดิม
(async () => {
  for (const col of ["slip_image TEXT", "amount_due REAL"]) {
    try {
      await client.execute(`ALTER TABLE orders ADD COLUMN ${col}`);
      console.log(`[orders] เพิ่มคอลัมน์ ${col.split(" ")[0]} ให้ตาราง orders แล้ว`);
    } catch (err) {
      const msg = String((err && err.message) || err).toLowerCase();
      if (!msg.includes("duplicate column")) {
        console.error(`[orders] เพิ่มคอลัมน์ ${col.split(" ")[0]} ไม่สำเร็จ:`, err);
      }
    }
  }
})();

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { package_id, slip_image } = req.body || {};
    if (!package_id) return res.status(400).json({ error: "ต้องระบุ package_id" });
    if (!slip_image) return res.status(400).json({ error: "กรุณาแนบรูปสลิปการโอนเงินก่อนยืนยัน" });

    const pkg = await get("SELECT * FROM packages WHERE id = ? AND active = 1", [package_id]);
    if (!pkg) return res.status(404).json({ error: "ไม่พบแพ็กเกจนี้" });

    const user = await get("SELECT level FROM users WHERE id = ?", [req.userId]);
    if (!user) return res.status(404).json({ error: "ไม่พบบัญชีผู้ใช้นี้" });

    if (pkg.level <= user.level) {
      return res.status(409).json({
        error: "คุณมีระดับสมาชิกนี้อยู่แล้ว หรือสูงกว่าแพ็กเกจนี้แล้ว ไม่สามารถซื้อซ้ำหรือซื้อแพ็กเกจที่ต่ำกว่าระดับปัจจุบันได้",
      });
    }

    // คำนวณยอดที่ต้องจ่ายจริง = ราคาแพ็กเกจใหม่ - ราคาแพ็กเกจของระดับปัจจุบัน (จ่ายเฉพาะส่วนต่างตอนอัปเกรด)
    const currentPkg = await get("SELECT price FROM packages WHERE level = ?", [user.level]);
    const basePrice = currentPkg ? currentPkg.price : 0;
    let amountDue = pkg.price - basePrice;
    if (amountDue <= 0) amountDue = pkg.price; // กันเหนียว ไม่ควรเกิดขึ้นเพราะเช็ค level ไปแล้วด้านบน

    const existing = await get(
      "SELECT id FROM orders WHERE user_id = ? AND package_id = ? AND status = 'pending'",
      [req.userId, package_id]
    );
    if (existing) return res.status(409).json({ error: "คุณมีคำสั่งซื้อแพ็กเกจนี้ค้างรออนุมัติอยู่แล้ว" });

    const result = await run(
      "INSERT INTO orders (user_id, package_id, status, slip_image, amount_due) VALUES (?, ?, 'pending', ?, ?)",
      [req.userId, package_id, slip_image, amountDue]
    );
    res.status(201).json({
      ok: true,
      orderId: Number(result.lastInsertRowid),
      amountDue,
      message: `ส่งคำสั่งซื้อ "${pkg.name}" พร้อมสลิปเรียบร้อยแล้ว (ยอด ฿${amountDue.toLocaleString("th-TH")}) ทีมงานจะตรวจสอบและยืนยันให้เร็วที่สุด`,
    });
  } catch (err) {
    next(err);
  }
});
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const orders = await all(
      `SELECT o.id, o.status, o.created_at, o.approved_at, p.name AS package_name, p.icon,
              COALESCE(o.amount_due, p.price) AS price
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
