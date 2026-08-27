const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function requireAdmin(req, res, next) {
  const user = db.prepare("SELECT level FROM users WHERE id = ?").get(req.userId);
  if (!user || user.level < 7) {
    return res.status(403).json({ error: "ต้องเป็น Super Admin (LV7) เท่านั้นถึงจะเข้าถึงส่วนนี้ได้" });
  }
  next();
}

function logAction(adminId, action, target, details) {
  db.prepare("INSERT INTO audit_logs (admin_id, action, target, details) VALUES (?, ?, ?, ?)").run(
    adminId, action, target, details || ""
  );
}

router.use(requireAuth, requireAdmin);

// ===== Users =====
router.get("/users", (req, res) => {
  const users = db.prepare("SELECT id, username, email, level, created_at FROM users ORDER BY created_at DESC").all();
  res.json(users);
});

router.patch("/users/:id/level", (req, res) => {
  const { level } = req.body || {};
  const lvl = parseInt(level, 10);
  if (![1, 2, 3, 4, 5, 6, 7].includes(lvl)) {
    return res.status(400).json({ error: "level ต้องเป็นตัวเลข 1-7 เท่านั้น" });
  }
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "ไม่พบผู้ใช้นี้" });

  db.prepare("UPDATE users SET level = ? WHERE id = ?").run(lvl, req.params.id);
  logAction(req.userId, "CHANGE_USER_LEVEL", `user:${req.params.id}`, `เปลี่ยนเป็น LV${lvl}`);

  res.json({ ok: true, message: `เปลี่ยน LV ของสมาชิกนี้เป็น LV${lvl} แล้ว` });
});

// ===== Packages =====
router.get("/packages", (req, res) => {
  const packages = db.prepare("SELECT * FROM packages ORDER BY sort_order ASC").all();
  res.json(packages);
});

router.patch("/packages/:id", (req, res) => {
  const { name, price, active } = req.body || {};
  const pkg = db.prepare("SELECT * FROM packages WHERE id = ?").get(req.params.id);
  if (!pkg) return res.status(404).json({ error: "ไม่พบแพ็กเกจนี้" });

  db.prepare("UPDATE packages SET name = ?, price = ?, active = ? WHERE id = ?").run(
    name ?? pkg.name,
    price ?? pkg.price,
    active !== undefined ? (active ? 1 : 0) : pkg.active,
    req.params.id
  );
  logAction(req.userId, "UPDATE_PACKAGE", `package:${req.params.id}`, `แก้ไข ${name ?? pkg.name}`);

  res.json({ ok: true, message: `อัปเดตแพ็กเกจ "${name ?? pkg.name}" สำเร็จ` });
});

// ===== Prompts / Gems =====
router.get("/prompts", (req, res) => {
  const prompts = db.prepare("SELECT * FROM prompts ORDER BY category ASC").all();
  res.json(prompts);
});

router.patch("/prompts/:id", (req, res) => {
  const { title, category, description, gem_url, level_required } = req.body || {};
  const prompt = db.prepare("SELECT * FROM prompts WHERE id = ?").get(req.params.id);
  if (!prompt) return res.status(404).json({ error: "ไม่พบ Prompt นี้" });

  db.prepare(`
    UPDATE prompts SET title = ?, category = ?, description = ?, gem_url = ?, level_required = ?
    WHERE id = ?
  `).run(
    title ?? prompt.title,
    category ?? prompt.category,
    description ?? prompt.description,
    gem_url !== undefined ? gem_url : prompt.gem_url,
    level_required ?? prompt.level_required,
    req.params.id
  );
  logAction(req.userId, "UPDATE_PROMPT", `prompt:${req.params.id}`, `แก้ไข ${title ?? prompt.title}`);

  res.json({ ok: true, message: `อัปเดต "${title ?? prompt.title}" สำเร็จ` });
});

router.post("/prompts", (req, res) => {
  const { id, title, category, description, gem_url, level_required } = req.body || {};
  if (!id || !title || !category) {
    return res.status(400).json({ error: "ต้องระบุ id, title, category เป็นอย่างน้อย" });
  }
  db.prepare(`
    INSERT INTO prompts (id, category, title, description, gem_url, level_required)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, category, title, description || "", gem_url || null, level_required || 2);
  logAction(req.userId, "CREATE_PROMPT", `prompt:${id}`, `เพิ่ม Gem ใหม่ ${title}`);

  res.json({ ok: true, message: `เพิ่ม Gem "${title}" สำเร็จ` });
});

// ===== Audit Logs =====
router.get("/audit-logs", (req, res) => {
  const logs = db.prepare(`
    SELECT al.*, u.username AS admin_name
    FROM audit_logs al
    LEFT JOIN users u ON al.admin_id = u.id
    ORDER BY al.created_at DESC LIMIT 100
  `).all();
  res.json(logs);
});

module.exports = router;
