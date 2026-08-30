const express = require("express");
const { client, get, all, run } = require("../db");
const { requireAuth } = require("../middleware/auth");
const router = express.Router();

// เพิ่มคอลัมน์ image_url ให้ตาราง prompts (ถ้ายังไม่มี) — ไม่กระทบข้อมูลเดิม
(async () => {
  try {
    await client.execute("ALTER TABLE prompts ADD COLUMN image_url TEXT");
    console.log("[admin-panel] เพิ่มคอลัมน์ image_url ให้ตาราง prompts แล้ว");
  } catch (err) {
    const msg = String((err && err.message) || err).toLowerCase();
    if (!msg.includes("duplicate column")) {
      console.error("[admin-panel] เพิ่มคอลัมน์ image_url ไม่สำเร็จ:", err);
    }
  }
})();

// หมวดหมู่ Gem ที่อนุญาต ตั้งแต่นี้ไปเพิ่ม/แก้ Gem ต้องเลือกจาก 4 ตัวนี้เท่านั้น
const VALID_CATEGORIES = ["creative", "image", "product", "video"];

async function requireAdmin(req, res, next) {
  try {
    const user = await get("SELECT level FROM users WHERE id = ?", [req.userId]);
    if (!user || user.level < 7) {
      return res.status(403).json({ error: "ต้องเป็น Super Admin (LV7) เท่านั้นถึงจะเข้าถึงส่วนนี้ได้" });
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
router.use(requireAuth, requireAdmin);
// ===== Users =====
router.get("/users", async (req, res, next) => {
  try {
    const users = await all("SELECT id, username, email, level, created_at FROM users ORDER BY created_at DESC");
    res.json(users);
  } catch (err) {
    next(err);
  }
});
router.patch("/users/:id/level", async (req, res, next) => {
  try {
    const { level } = req.body || {};
    const lvl = parseInt(level, 10);
    if (![1, 2, 3, 4, 5, 6, 7].includes(lvl)) {
      return res.status(400).json({ error: "level ต้องเป็นตัวเลข 1-7 เท่านั้น" });
    }
    const user = await get("SELECT id FROM users WHERE id = ?", [req.params.id]);
    if (!user) return res.status(404).json({ error: "ไม่พบผู้ใช้นี้" });
    await run("UPDATE users SET level = ? WHERE id = ?", [lvl, req.params.id]);
    await logAction(req.userId, "CHANGE_USER_LEVEL", `user:${req.params.id}`, `เปลี่ยนเป็น LV${lvl}`);
    res.json({ ok: true, message: `เปลี่ยน LV ของสมาชิกนี้เป็น LV${lvl} แล้ว` });
  } catch (err) {
    next(err);
  }
});
// ===== Packages =====
router.get("/packages", async (req, res, next) => {
  try {
    const packages = await all("SELECT * FROM packages ORDER BY sort_order ASC");
    res.json(packages);
  } catch (err) {
    next(err);
  }
});
router.patch("/packages/:id", async (req, res, next) => {
  try {
    const { name, price, active } = req.body || {};
    const pkg = await get("SELECT * FROM packages WHERE id = ?", [req.params.id]);
    if (!pkg) return res.status(404).json({ error: "ไม่พบแพ็กเกจนี้" });
    await run(
      "UPDATE packages SET name = ?, price = ?, active = ? WHERE id = ?",
      [
        name ?? pkg.name,
        price ?? pkg.price,
        active !== undefined ? (active ? 1 : 0) : pkg.active,
        req.params.id,
      ]
    );
    await logAction(req.userId, "UPDATE_PACKAGE", `package:${req.params.id}`, `แก้ไข ${name ?? pkg.name}`);
    res.json({ ok: true, message: `อัปเดตแพ็กเกจ "${name ?? pkg.name}" สำเร็จ` });
  } catch (err) {
    next(err);
  }
});
// ===== Prompts / Gems =====
router.get("/prompts", async (req, res, next) => {
  try {
    const prompts = await all("SELECT * FROM prompts ORDER BY category ASC");
    res.json(prompts);
  } catch (err) {
    next(err);
  }
});
router.patch("/prompts/:id", async (req, res, next) => {
  try {
    const { title, category, description, gem_url, image_url, level_required } = req.body || {};
    if (category !== undefined && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `หมวดหมู่ต้องเป็นหนึ่งใน: ${VALID_CATEGORIES.join(", ")}` });
    }
    const prompt = await get("SELECT * FROM prompts WHERE id = ?", [req.params.id]);
    if (!prompt) return res.status(404).json({ error: "ไม่พบ Prompt นี้" });
    await run(
      `UPDATE prompts SET title = ?, category = ?, description = ?, gem_url = ?, image_url = ?, level_required = ?
       WHERE id = ?`,
      [
        title ?? prompt.title,
        category ?? prompt.category,
        description ?? prompt.description,
        gem_url !== undefined ? gem_url : prompt.gem_url,
        image_url !== undefined ? image_url : prompt.image_url,
        level_required ?? prompt.level_required,
        req.params.id,
      ]
    );
    await logAction(req.userId, "UPDATE_PROMPT", `prompt:${req.params.id}`, `แก้ไข ${title ?? prompt.title}`);
    res.json({ ok: true, message: `อัปเดต "${title ?? prompt.title}" สำเร็จ` });
  } catch (err) {
    next(err);
  }
});
router.post("/prompts", async (req, res, next) => {
  try {
    const { id, title, category, description, gem_url, image_url, level_required } = req.body || {};
    if (!id || !title || !category) {
      return res.status(400).json({ error: "ต้องระบุ id, title, category เป็นอย่างน้อย" });
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `หมวดหมู่ต้องเป็นหนึ่งใน: ${VALID_CATEGORIES.join(", ")}` });
    }
    await run(
      `INSERT INTO prompts (id, category, title, description, gem_url, image_url, level_required)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, category, title, description || "", gem_url || null, image_url || null, level_required || 2]
    );
    await logAction(req.userId, "CREATE_PROMPT", `prompt:${id}`, `เพิ่ม Gem ใหม่ ${title}`);
    res.json({ ok: true, message: `เพิ่ม Gem "${title}" สำเร็จ` });
  } catch (err) {
    next(err);
  }
});
// ===== AI Assistants (ผู้ช่วย AI 6 ตัว) =====
router.get("/assistants", async (req, res, next) => {
  try {
    const assistants = await all("SELECT * FROM ai_assistants ORDER BY sort_order ASC");
    res.json(assistants);
  } catch (err) {
    next(err);
  }
});
router.patch("/assistants/:id", async (req, res, next) => {
  try {
    const { name, role, icon, description, tool_url, level_required, status } = req.body || {};
    const assistant = await get("SELECT * FROM ai_assistants WHERE id = ?", [req.params.id]);
    if (!assistant) return res.status(404).json({ error: "ไม่พบผู้ช่วย AI นี้" });
    await run(
      `UPDATE ai_assistants SET name = ?, role = ?, icon = ?, description = ?, tool_url = ?, level_required = ?, status = ?
       WHERE id = ?`,
      [
        name ?? assistant.name,
        role ?? assistant.role,
        icon ?? assistant.icon,
        description ?? assistant.description,
        tool_url !== undefined ? tool_url : assistant.tool_url,
        level_required ?? assistant.level_required,
        status !== undefined ? (status ? 1 : 0) : assistant.status,
        req.params.id,
      ]
    );
    await logAction(req.userId, "UPDATE_ASSISTANT", `assistant:${req.params.id}`, `แก้ไข ${name ?? assistant.name}`);
    res.json({ ok: true, message: `อัปเดตผู้ช่วย AI "${name ?? assistant.name}" สำเร็จ` });
  } catch (err) {
    next(err);
  }
});
// ===== Audit Logs =====
router.get("/audit-logs", async (req, res, next) => {
  try {
    const logs = await all(`
      SELECT al.*, u.username AS admin_name
      FROM audit_logs al
      LEFT JOIN users u ON al.admin_id = u.id
      ORDER BY al.created_at DESC LIMIT 100
    `);
    res.json(logs);
  } catch (err) {
    next(err);
  }
});
module.exports = router;
