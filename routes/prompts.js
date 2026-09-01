const express = require("express");
const { get, all, run } = require("../db");
const { optionalAuth } = require("../middleware/auth");
const router = express.Router();

// หมวดหมู่ Gem ที่ใช้งานจริงมี 4 หมวดนี้เท่านั้น
const VALID_CATEGORIES = ["creative", "image", "product", "video"];

// ============================================================
// ล้าง Gem เก่าที่หมวดหมู่ไม่อยู่ใน 4 หมวดข้างบน (พวกหมวดภาษาไทย: อนิเมะ ธรรมชาติ ไซไฟ ฯลฯ)
// ทำงานเองอัตโนมัติทุกครั้งที่เซิร์ฟเวอร์เริ่มทำงาน ไม่ต้องกดปุ่มอะไรเลย
// Gem ที่เพิ่มผ่านหน้า Admin จะเป็น 1 ใน 4 หมวดเสมอ จึงไม่โดนลบแน่นอน
//
// >>> ใช้เสร็จแล้วลบบล็อกนี้ทิ้งได้เลย (ตั้งแต่บรรทัด === ถึง === ข้างล่าง) <<<
// ============================================================
(async () => {
  try {
    const rows = await all("SELECT id, title, category FROM prompts");
    const stale = rows.filter(
      (r) => !VALID_CATEGORIES.includes(String(r.category || "").trim())
    );
    if (!stale.length) {
      console.log("[prompts] ตรวจแล้ว ไม่มี Gem หมวดเก่าค้างอยู่");
      return;
    }
    for (const row of stale) {
      await run("DELETE FROM prompts WHERE id = ?", [row.id]);
      console.log(`[prompts] ลบ Gem หมวดเก่า: "${row.title}" (หมวด: ${row.category})`);
    }
    console.log(`[prompts] ล้าง Gem หมวดเก่าเรียบร้อย รวม ${stale.length} รายการ`);
  } catch (err) {
    console.error("[prompts] ล้าง Gem หมวดเก่าไม่สำเร็จ:", err);
  }
})();
// ============================================================

router.get("/", optionalAuth, async (req, res, next) => {
  try {
    // คนที่ยังไม่ล็อกอิน = ไม่มียศ (0) — ไม่ใช่ LV1 เพราะ LV1 คือคนที่สมัครสมาชิกฟรีแล้ว
    let userLevel = 0;
    if (req.userId) {
      const user = await get("SELECT level FROM users WHERE id = ?", [req.userId]);
      if (user) userLevel = user.level;
    }
    const prompts = await all("SELECT * FROM prompts");
    const result = prompts.map((p) => {
      // กัน level_required ที่เป็น NULL/0/ค่าเพี้ยน — ถ้าเจอให้ถือว่าต้อง LV2 ไว้ก่อน
      // (สำคัญมาก: JavaScript มอง 1 >= null เป็น true ถ้าไม่ดักตรงนี้ Gem จะหลุดให้คนไม่ล็อกอินใช้ฟรี)
      const requiredLevel = Number(p.level_required) || 2;
      const unlocked = userLevel >= requiredLevel; // เช็คตาม level ที่ Gem นี้ต้องใช้จริงๆ (เดิมล็อกไว้ >= 2 ตายตัว)
      return {
        id: p.id,
        category: p.category,
        title: p.title,
        description: p.description,
        level_required: requiredLevel, // เดิมไม่ส่งค่านี้กลับไป ทำให้หน้าเว็บโชว์ "LVundefined"
        image_url: p.image_url || null,
        unlocked,
        gem_url: unlocked ? p.gem_url : null,
      };
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
