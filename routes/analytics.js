const express = require("express");
const { client, get, all, run } = require("../db");
const { requireAuth, optionalAuth } = require("../middleware/auth");
const router = express.Router();

// เวลาไทย = UTC+7 (ฐานข้อมูลเก็บเป็น UTC ต้องบวก 7 ชั่วโมงก่อนตัดวัน ไม่งั้น "วันนี้" จะเพี้ยนไป 7 ชม.)
const TH = "+7 hours";

// สร้างตารางเก็บสถิติ (ถ้ายังไม่มี) — ไม่กระทบข้อมูลเดิม
(async () => {
  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS page_views (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event TEXT NOT NULL DEFAULT 'view',
        page TEXT,
        label TEXT,
        referrer TEXT,
        visitor_id TEXT,
        user_id INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    await client.execute("CREATE INDEX IF NOT EXISTS idx_pv_created ON page_views (created_at)");
    await client.execute("CREATE INDEX IF NOT EXISTS idx_pv_event ON page_views (event)");
    console.log("[analytics] เตรียมตาราง page_views เรียบร้อย");
  } catch (err) {
    console.error("[analytics] สร้างตาราง page_views ไม่สำเร็จ:", err);
  }
})();

const ALLOWED_EVENTS = ["view", "gem_open", "tool_open", "signup", "checkout_start"];

// ===== บันทึกสถิติ (เปิดให้ทุกคนยิงได้ ไม่ต้องล็อกอิน) =====
router.post("/view", optionalAuth, async (req, res) => {
  try {
    const { event, page, label, referrer, visitor_id } = req.body || {};
    const ev = ALLOWED_EVENTS.includes(event) ? event : "view";
    // ตัดความยาวกันข้อมูลขยะ และเก็บ referrer แค่ชื่อโดเมน ไม่เก็บ path เต็ม (ลดข้อมูลส่วนบุคคล)
    const clip = (v, n) => (v == null ? null : String(v).slice(0, n));
    let ref = null;
    if (referrer) {
      try { ref = new URL(String(referrer)).hostname; } catch { ref = clip(referrer, 80); }
    }
    await run(
      `INSERT INTO page_views (event, page, label, referrer, visitor_id, user_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [ev, clip(page, 120), clip(label, 120), ref, clip(visitor_id, 40), req.userId || null]
    );
    res.json({ ok: true });
  } catch (err) {
    // สถิติพังห้ามทำให้หน้าเว็บพัง — กลืน error แล้วตอบ ok เสมอ
    console.error("[analytics] บันทึกสถิติไม่สำเร็จ:", err);
    res.json({ ok: false });
  }
});

// ===== ดูสรุปสถิติ (เฉพาะ Super Admin LV7) =====
async function requireAdmin(req, res, next) {
  try {
    const user = await get("SELECT level FROM users WHERE id = ?", [req.userId]);
    if (!user || user.level < 7) {
      return res.status(403).json({ error: "ต้องเป็น Super Admin (LV7) เท่านั้นถึงจะดูสถิติได้" });
    }
    next();
  } catch (err) {
    next(err);
  }
}

router.get("/summary", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const one = async (sql, args = []) => {
      const row = await get(sql, args);
      return row ? Object.values(row)[0] || 0 : 0;
    };

    const totalViews = await one("SELECT COUNT(*) FROM page_views WHERE event = 'view'");
    const totalVisitors = await one("SELECT COUNT(DISTINCT visitor_id) FROM page_views WHERE visitor_id IS NOT NULL");
    const todayViews = await one(
      `SELECT COUNT(*) FROM page_views
       WHERE event = 'view' AND date(created_at, ?) = date('now', ?)`, [TH, TH]);
    const todayVisitors = await one(
      `SELECT COUNT(DISTINCT visitor_id) FROM page_views
       WHERE date(created_at, ?) = date('now', ?) AND visitor_id IS NOT NULL`, [TH, TH]);
    const weekVisitors = await one(
      `SELECT COUNT(DISTINCT visitor_id) FROM page_views
       WHERE date(created_at, ?) >= date('now', ?, '-6 days') AND visitor_id IS NOT NULL`, [TH, TH]);
    const totalMembers = await one("SELECT COUNT(*) FROM users");
    const todaySignups = await one(
      "SELECT COUNT(*) FROM users WHERE date(created_at, ?) = date('now', ?)", [TH, TH]);

    // 7 วันย้อนหลัง (เรียงเก่า -> ใหม่) เติมวันที่ไม่มีข้อมูลให้เป็น 0 ด้วย
    const rows = await all(
      `SELECT date(created_at, ?) AS d,
              COUNT(DISTINCT visitor_id) AS visitors,
              SUM(CASE WHEN event = 'view' THEN 1 ELSE 0 END) AS views
       FROM page_views
       WHERE date(created_at, ?) >= date('now', ?, '-6 days')
       GROUP BY d ORDER BY d ASC`, [TH, TH, TH]);
    const byDate = Object.fromEntries(rows.map((r) => [r.d, r]));
    const daily = [];
    for (let i = 6; i >= 0; i--) {
      const dRow = await get("SELECT date('now', ?, ?) AS d", [TH, `-${i} days`]);
      const key = dRow.d;
      daily.push({
        date: key,
        visitors: byDate[key] ? Number(byDate[key].visitors) || 0 : 0,
        views: byDate[key] ? Number(byDate[key].views) || 0 : 0,
      });
    }

    const topPages = await all(
      `SELECT page, COUNT(*) AS n FROM page_views
       WHERE event = 'view' AND page IS NOT NULL
       GROUP BY page ORDER BY n DESC LIMIT 8`);
    const topReferrers = await all(
      `SELECT referrer, COUNT(*) AS n FROM page_views
       WHERE event = 'view' AND referrer IS NOT NULL AND referrer != ''
       GROUP BY referrer ORDER BY n DESC LIMIT 8`);
    const topGems = await all(
      `SELECT label, COUNT(*) AS n FROM page_views
       WHERE event IN ('gem_open','tool_open') AND label IS NOT NULL
       GROUP BY label ORDER BY n DESC LIMIT 8`);

    res.json({
      totals: { views: totalViews, visitors: totalVisitors, members: totalMembers },
      today: { views: todayViews, visitors: todayVisitors, signups: todaySignups },
      week: { visitors: weekVisitors },
      daily,
      topPages,
      topReferrers,
      topGems,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
