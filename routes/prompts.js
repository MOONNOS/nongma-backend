const express = require("express");
const { get, all } = require("../db");
const { optionalAuth } = require("../middleware/auth");
const router = express.Router();

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
