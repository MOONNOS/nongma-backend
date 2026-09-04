const { createClient } = require("@libsql/client");

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// ---------------------------------------------------------------------------
// Helper แทน db.prepare(sql).all()/.get()/.run() แบบเดิม
// ทุกตัวเป็น async ต้องใช้ await เสมอตอนเรียกใช้ใน routes
// ---------------------------------------------------------------------------
async function all(sql, args = []) {
  const result = await client.execute({ sql, args });
  return result.rows;
}

async function get(sql, args = []) {
  const result = await client.execute({ sql, args });
  return result.rows[0] || null;
}

async function run(sql, args = []) {
  const result = await client.execute({ sql, args });
  return {
    lastInsertRowid: result.lastInsertRowid,
    changes: result.rowsAffected,
  };
}

// สำหรับตอนต้องรันหลายคำสั่งพร้อมกันแบบอะตอมมิก (all-or-nothing)
// เช่น อนุมัติ order + อัปเดต level ผู้ใช้ + สร้าง notification
async function batch(statements, mode = "write") {
  return client.batch(statements, mode);
}

async function initDb() {
  await client.migrate([
    `CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      level         INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS prompts (
      id             TEXT PRIMARY KEY,
      category       TEXT NOT NULL,
      title          TEXT NOT NULL,
      description    TEXT,
      gem_url        TEXT,
      level_required INTEGER NOT NULL DEFAULT 1
    )`,
    `CREATE TABLE IF NOT EXISTS packages (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      level       INTEGER NOT NULL,
      price       TEXT NOT NULL,
      badge       TEXT,
      icon        TEXT,
      description TEXT,
      is_lifetime INTEGER NOT NULL DEFAULT 1,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      active      INTEGER NOT NULL DEFAULT 1
    )`,
    `CREATE TABLE IF NOT EXISTS orders (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      package_id  TEXT NOT NULL REFERENCES packages(id),
      status      TEXT NOT NULL DEFAULT 'pending',
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      approved_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS ai_assistants (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      role           TEXT NOT NULL,
      icon           TEXT NOT NULL,
      description    TEXT,
      level_required INTEGER NOT NULL DEFAULT 1,
      status         INTEGER NOT NULL DEFAULT 1,
      sort_order     INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS courses (
      id             TEXT PRIMARY KEY,
      title          TEXT NOT NULL,
      icon           TEXT NOT NULL,
      description    TEXT,
      lessons        TEXT,
      level_required INTEGER NOT NULL DEFAULT 1,
      status         INTEGER NOT NULL DEFAULT 1,
      sort_order     INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS community_links (
      id             TEXT PRIMARY KEY,
      platform       TEXT NOT NULL,
      icon           TEXT NOT NULL,
      url            TEXT NOT NULL,
      level_required INTEGER NOT NULL DEFAULT 1,
      sort_order     INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message    TEXT NOT NULL,
      type       TEXT NOT NULL DEFAULT 'info',
      is_read    INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id   INTEGER NOT NULL,
      action     TEXT NOT NULL,
      target     TEXT,
      details    TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  ]);

  // ---------------- seed: prompts ----------------
  // >>> เอาชุด seed Gem หมวดเก่าออกแล้ว (เคยมี 9 รายการ ใช้หมวดภาษาไทยเก่า
  //     เช่น อนิเมะ/ธรรมชาติ/ไซไฟ ที่ไม่ใช้แล้ว) เพราะมันคือสาเหตุที่ Gem
  //     หมวดเก่าโผล่กลับมาซ้ำทุกครั้งที่ deploy — ตัวล้างใน routes/prompts.js
  //     ลบออกสำเร็จ แต่โค้ดตรงนี้ (ที่รันทุกครั้งเซิร์ฟเวอร์เริ่มทำงาน) ใส่กลับเข้ามาใหม่
  //     ด้วย ON CONFLICT(id) DO NOTHING ทุกรอบ ตอนนี้แอดมินเพิ่ม Gem เองผ่านหน้า
  //     Admin ได้แล้ว จึงไม่จำเป็นต้องมีข้อมูลตัวอย่างชุดนี้อีกต่อไป

  // ---------------- seed: packages ----------------
  const seedPackages = [
    ["PACKAGE_399", "หมาลุยงาน", 2, "399", "ระดับ 1", "🐶", "เข้าเรียนคอร์สพื้นฐานครบ 4 โมดูล, ใช้งานผู้ช่วย AI 6 ตัวไม่จำกัด, ปลดล็อกคลัง Prompt พื้นฐาน", 1, 1, 1],
    ["PACKAGE_799", "หมาโตเต็มตัว", 3, "799", "🔥 ยอดนิยม", "🐕", "ทุกอย่างในหมาลุยงาน + ปลดล็อกคลัง Prompt ระดับสูงทั้งหมด รวม GEM ระบบแม่ + เทคนิคขั้นสูง", 1, 2, 1],
    ["PACKAGE_3900", "หมาเก่งพิเศษ", 4, "3900", "💎 ครั้งเดียว", "🦮", "ทุกอย่างในหมาโตเต็มตัว + เรียนสดตัวต่อตัว 6 ชม. ผ่าน Google Meet", 1, 3, 1],
    ["PACKAGE_8900", "หัวหน้าฝูง", 5, "8900", "✨ ขั้นสูงสุด", "👑", "ทุกอย่างในหมาเก่งพิเศษ + เรียนสด 1 วันเต็ม + สอน Automation ธุรกิจจริง", 1, 4, 1],
  ];
  await client.batch(
    seedPackages.map((row) => ({
      sql: `INSERT INTO packages (id, name, level, price, badge, icon, description, is_lifetime, sort_order, active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name=excluded.name, level=excluded.level, price=excluded.price, badge=excluded.badge,
              icon=excluded.icon, description=excluded.description, is_lifetime=excluded.is_lifetime,
              sort_order=excluded.sort_order, active=excluded.active`,
      args: row,
    })),
    "write"
  );

  // ---------------- seed: ai_assistants ----------------
  const seedAssistants = [
  ["nong-lens", "น้องเลนส์", "ผู้ช่วยสร้างภาพ", "📸", "สร้างภาพสินค้า/คอนเทนต์ให้สวยตรงสไตล์ พร้อมใช้ขายได้ทันที", 1, 1, 1],
  ["nong-clip", "น้องคลิป", "ผู้ช่วยวิดีโอ Flow", "🎬", "แปลงไอเดียเป็นวิดีโอโปร พร้อมมุมกล้องที่ดึงดูดคนดู", 1, 1, 2],
  ["nong-siangsai", "น้องเสียงใส", "ผู้ช่วยพากย์เสียง", "🎙️", "ใส่เสียงพากย์และเพลงให้คลิปน่าฟัง ไม่ต้องอัดเอง", 1, 1, 3],
  ["nong-tadtor", "น้องตัดต่อ", "ผู้ช่วยตัดต่อ", "✂️", "ตัดต่อให้ลื่นไหล พร้อมเอฟเฟกต์ที่คนดูอยากดูจนจบ", 1, 1, 4],
  ["nong-caption", "น้องแคปชั่น", "ผู้ช่วยเขียนสคริปต์", "✍️", "เขียนสคริปต์และแคปชั่นที่ดึงคนให้หยุดดูจนถึงกดซื้อ", 1, 1, 5],
  ["nong-idea", "น้องไอเดีย", "ผู้ช่วยคิดคอนเทนต์", "💡", "ระดมไอเดียคอนเทนต์ที่ขายได้ เวลาคิดหัวข้อไม่ออก", 1, 1, 6],
];
  await client.batch(
    seedAssistants.map((row) => ({
      sql: `INSERT INTO ai_assistants (id, name, role, icon, description, level_required, status, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name=excluded.name, role=excluded.role, icon=excluded.icon,
              description=excluded.description, level_required=excluded.level_required,
              status=excluded.status, sort_order=excluded.sort_order`,
      args: row,
    })),
    "write"
  );

  // ---------------- seed: courses ----------------
  const seedCourses = [
    ["course-image", "สร้างภาพด้วย AI", "🎨", "ปูพื้นฐานก่อนเริ่มทำคลิป ให้ได้ภาพสวยตรงใจทุกครั้ง",
      JSON.stringify(["เขียน Prompt สร้างภาพให้ตรงสไตล์ที่ต้องการ", "แต่งภาพ ลบพื้นหลัง ปรับแสงด้วย AI", "สร้างภาพสินค้า โลโก้ ธัมบ์เนล"]), 1, 1, 1],
    ["course-flow", "ทำวิดีโอด้วย Google Flow", "🎬", "แปลงไอเดียเป็นคลิปเคลื่อนไหวด้วย Prompt เดียว",
      JSON.stringify(["เขียน Prompt วิดีโอให้ Flow เข้าใจสิ่งที่อยากได้", "ต่อหลายคลิปให้เป็นเรื่องราวเดียวกัน", "คุมมุมกล้อง แสง และอารมณ์ของฉาก"]), 1, 1, 2],
    ["course-voice", "พากย์เสียงด้วย AI", "🎙️", "ให้คลิปมีเสียงพูด เสียงเพลง ครบโดยไม่ต้องอัดเอง",
      JSON.stringify(["โคลนเสียงตัวเองไว้พากย์คลิปในอนาคต", "พากย์เสียงได้หลายภาษา หลายอารมณ์", "สร้างเพลงประกอบคลิปด้วย AI"]), 1, 1, 3],
    ["course-edit", "ตัดต่อให้ดูมืออาชีพ", "✂️", "ประกอบทุกอย่างให้เป็นคลิปที่พร้อมโพสต์จริง",
      JSON.stringify(["ตัดต่อเร็วด้วยเครื่องมือ AI ช่วยตัด", "ใส่ซับไตเติลอัตโนมัติ แก้ไขง่าย", "เพิ่มเอฟเฟกต์และจังหวะให้คลิปลื่นไหล"]), 1, 1, 4],
  ];
  await client.batch(
    seedCourses.map((row) => ({
      sql: `INSERT INTO courses (id, title, icon, description, lessons, level_required, status, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              title=excluded.title, icon=excluded.icon, description=excluded.description,
              lessons=excluded.lessons, level_required=excluded.level_required,
              status=excluded.status, sort_order=excluded.sort_order`,
      args: row,
    })),
    "write"
  );

  // ---------------- seed: community_links ----------------
  const seedCommunity = [
    ["community-line", "LINE Official", "💬", "https://line.me/R/ti/p/@nongmaclip", 1, 1],
    ["community-facebook", "Facebook Group", "📘", "https://facebook.com/groups/nongmaclip", 2, 2],
    ["community-discord", "Discord Server", "🎮", "https://discord.gg/nongmaclip", 2, 3],
  ];
  await client.batch(
    seedCommunity.map((row) => ({
      sql: `INSERT INTO community_links (id, platform, icon, url, level_required, sort_order)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              platform=excluded.platform, icon=excluded.icon, url=excluded.url,
              level_required=excluded.level_required, sort_order=excluded.sort_order`,
      args: row,
    })),
    "write"
  );

  console.log("[db] Turso: สร้างตาราง + seed ข้อมูลเสร็จแล้ว");
}

module.exports = { client, all, get, run, batch, initDb };
