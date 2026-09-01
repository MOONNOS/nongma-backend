const express = require("express");
const { client, get, all } = require("../db");
const { optionalAuth } = require("../middleware/auth");
const router = express.Router();

// เพิ่มคอลัมน์ tool_url ให้ตาราง ai_assistants (ถ้ายังไม่มี) — ไว้เก็บลิงก์ Gem/เครื่องมือของผู้ช่วยแต่ละตัว ไม่กระทบข้อมูลเดิม
(async () => {
  try {
    await client.execute("ALTER TABLE ai_assistants ADD COLUMN tool_url TEXT");
    console.log("[assistants] เพิ่มคอลัมน์ tool_url ให้ตาราง ai_assistants แล้ว");
  } catch (err) {
    const msg = String((err && err.message) || err).toLowerCase();
    if (!msg.includes("duplicate column")) {
      console.error("[assistants] เพิ่มคอลัมน์ tool_url ไม่สำเร็จ:", err);
    }
  }
})();

router.get("/", optionalAuth, async (req, res, next) => {
  try {
    // คนที่ยังไม่ล็อกอิน = ไม่มียศ (0) — ไม่ใช่ LV1 เพราะ LV1 คือคนที่สมัครสมาชิกฟรีแล้ว
    let userLevel = 0;
    if (req.userId) {
      const user = await get("SELECT level FROM users WHERE id = ?", [req.userId]);
      if (user) userLevel = user.level;
    }
    const assistants = await all("SELECT * FROM ai_assistants WHERE status = 1 ORDER BY sort_order ASC");
    const result = assistants.map((a) => {
      // กัน level_required ที่เป็น NULL/0/ค่าเพี้ยน — ถ้าเจอให้ถือว่าต้อง LV3 ไว้ก่อน (ผู้ช่วย AI = แพ็กเกจ ฿799)
      const requiredLevel = Number(a.level_required) || 3;
      const unlocked = userLevel >= requiredLevel;
      return {
        id: a.id,
        name: a.name,
        role: a.role,
        icon: a.icon,
        description: a.description,
        level_required: requiredLevel,
        tool_url: unlocked ? (a.tool_url || null) : null, // ส่งลิงก์เฉพาะคนที่ปลดล็อกแล้วเท่านั้น
        unlocked,
      };
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
