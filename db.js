const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "data", "database.sqlite");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    level         INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS prompts (
    id             TEXT PRIMARY KEY,
    category       TEXT NOT NULL,
    title          TEXT NOT NULL,
    description    TEXT,
    gem_url        TEXT,
    level_required INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS packages (
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
  );

  CREATE TABLE IF NOT EXISTS orders (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    package_id  TEXT NOT NULL REFERENCES packages(id),
    status      TEXT NOT NULL DEFAULT 'pending',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    approved_at TEXT
  );
`);

const seedPrompts = [
  ["cinematic-alley", "หนัง/ดราม่า", "หนังสั้นดราม่า ตรอกยามเช้า", "บรรยากาศหม่นๆ ฟีลหนังฟิล์ม", null, 2],
  ["honey-jar", "โฆษณา", "โปรดักต์ช็อต น้ำผึ้งหมุน", "สไตล์โฆษณาสินค้าพรีเมียม", null, 2],
  ["anime-cliff", "อนิเมะ", "สาวผมขาวริมหน้าผา", "ฟีล Studio Ghibli พาสเทลนุ่มๆ", null, 2],
  ["rice-terrace", "ธรรมชาติ", "นาขั้นบันไดยามเช้า", "มุมกล้องโดรนบินผ่านทุ่งนาเหนือหมอก", null, 2],
  ["puppy-meadow", "คาแรคเตอร์", "ลูกหมาวิ่งเล่นในทุ่ง", "อบอุ่นน่ารัก เหมาะกับคลิปฟีลกู้ด", null, 2],
  ["night-market", "ไลฟ์สไตล์", "เดินตลาดกลางคืน", "ฟีล Vlog มุมมองบุคคลที่หนึ่ง", null, 2],
  ["scifi-city", "ไซไฟ", "เมืองแห่งอนาคตยามค่ำคืน", "ฟีล Cyberpunk แสงนีออนจัดจ้าน", null, 2],
  ["brownie", "อาหาร", "บราวนี่ราดช็อกโกแลต", "โคลสอัพน่ากินสไตล์โฆษณาอาหาร", null, 2],
  ["fashion-walk", "แฟชั่น", "เดินแบบยามเย็นกลางเมือง", "ฟีลหนังแฟชั่น ผ้าโบกสะบัดตามลม", null, 2],
];

const insertPrompt = db.prepare(`
  INSERT INTO prompts (id, category, title, description, gem_url, level_required)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO NOTHING
`);
db.transaction((rows) => { for (const row of rows) insertPrompt.run(...row); })(seedPrompts);

const seedPackages = [
  ["PACKAGE_399", "หมาลุยงาน", 2, "399", "ระดับ 1", "🐶", "เข้าเรียนคอร์สพื้นฐานครบ 4 โมดูล, ใช้งานผู้ช่วย AI 6 ตัวไม่จำกัด, ปลดล็อกคลัง Prompt พื้นฐาน", 1, 1, 1],
  ["PACKAGE_799", "หมาโตเต็มตัว", 3, "799", "🔥 ยอดนิยม", "🐕", "ทุกอย่างในหมาลุยงาน + ปลดล็อกคลัง Prompt ระดับสูงทั้งหมด รวม GEM ระบบแม่ + เทคนิคขั้นสูง", 1, 2, 1],
  ["PACKAGE_3900", "หมาเก่งพิเศษ", 4, "3900", "💎 ครั้งเดียว", "🦮", "ทุกอย่างในหมาโตเต็มตัว + เรียนสดตัวต่อตัว 6 ชม. ผ่าน Google Meet", 1, 3, 1],
  ["PACKAGE_8900", "หัวหน้าฝูง", 5, "8900", "✨ ขั้นสูงสุด", "👑", "ทุกอย่างในหมาเก่งพิเศษ + เรียนสด 1 วันเต็ม + สอน Automation ธุรกิจจริง", 1, 4, 1],
];
const insertPackage = db.prepare(`
  INSERT INTO packages (id, name, level, price, badge, icon, description, is_lifetime, sort_order, active)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    name=excluded.name, level=excluded.level, price=excluded.price, badge=excluded.badge,
    icon=excluded.icon, description=excluded.description, is_lifetime=excluded.is_lifetime,
    sort_order=excluded.sort_order, active=excluded.active
`);
db.transaction((rows) => { for (const row of rows) insertPackage.run(...row); })(seedPackages);
// เพิ่มในไฟล์ db.js — ต่อจากตาราง packages/orders

db.exec(`
  CREATE TABLE IF NOT EXISTS ai_assistants (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    role           TEXT NOT NULL,
    icon           TEXT NOT NULL,
    description    TEXT,
    level_required INTEGER NOT NULL DEFAULT 1,
    status         INTEGER NOT NULL DEFAULT 1,
    sort_order     INTEGER NOT NULL DEFAULT 0
  );
`);

const seedAssistants = [
  ["nong-lens", "น้องเลนส์", "ผู้ช่วยสร้างภาพ", "📸", "ช่วยคิด Prompt สร้างภาพให้ตรงสไตล์ที่อยากได้", 1, 1, 1],
  ["nong-clip", "น้องคลิป", "ผู้ช่วยวิดีโอ Flow", "🎬", "แนะนำ Prompt วิดีโอและมุมกล้องให้คลิปดูโปร", 1, 1, 2],
  ["nong-siangsai", "น้องเสียงใส", "ผู้ช่วยพากย์เสียง", "🎙️", "ช่วยเลือกโทนเสียงและแต่งเพลงประกอบคลิป", 1, 1, 3],
  ["nong-tadtor", "น้องตัดต่อ", "ผู้ช่วยตัดต่อ", "✂️", "แนะนำจังหวะตัดต่อและเอฟเฟกต์ให้คลิปลื่นไหล", 1, 1, 4],
  ["nong-caption", "น้องแคปชั่น", "ผู้ช่วยเขียนสคริปต์", "✍️", "ช่วยคิดแคปชั่นและสคริปต์บรรยายให้คลิปน่าติดตาม", 1, 1, 5],
  ["nong-idea", "น้องไอเดีย", "ผู้ช่วยคิดคอนเทนต์", "💡", "ช่วยระดมไอเดียคลิปเวลาคิดหัวข้อไม่ออก", 1, 1, 6],
];

const insertAssistant = db.prepare(`
  INSERT INTO ai_assistants (id, name, role, icon, description, level_required, status, sort_order)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    name=excluded.name, role=excluded.role, icon=excluded.icon,
    description=excluded.description, level_required=excluded.level_required,
    status=excluded.status, sort_order=excluded.sort_order
`);
db.transaction((rows) => { for (const row of rows) insertAssistant.run(...row); })(seedAssistants);

db.exec(`
  CREATE TABLE IF NOT EXISTS courses (
    id             TEXT PRIMARY KEY,
    title          TEXT NOT NULL,
    icon           TEXT NOT NULL,
    description    TEXT,
    lessons        TEXT,
    level_required INTEGER NOT NULL DEFAULT 1,
    status         INTEGER NOT NULL DEFAULT 1,
    sort_order     INTEGER NOT NULL DEFAULT 0
  );
`);

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

const insertCourse = db.prepare(`
  INSERT INTO courses (id, title, icon, description, lessons, level_required, status, sort_order)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    title=excluded.title, icon=excluded.icon, description=excluded.description,
    lessons=excluded.lessons, level_required=excluded.level_required,
    status=excluded.status, sort_order=excluded.sort_order
`);
db.transaction((rows) => { for (const row of rows) insertCourse.run(...row); })(seedCourses);

db.exec(`
  CREATE TABLE IF NOT EXISTS community_links (
    id             TEXT PRIMARY KEY,
    platform       TEXT NOT NULL,
    icon           TEXT NOT NULL,
    url            TEXT NOT NULL,
    level_required INTEGER NOT NULL DEFAULT 1,
    sort_order     INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message    TEXT NOT NULL,
    type       TEXT NOT NULL DEFAULT 'info',
    is_read    INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id   INTEGER NOT NULL,
    action     TEXT NOT NULL,
    target     TEXT,
    details    TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const seedCommunity = [
  ["community-line", "LINE Official", "💬", "https://line.me/R/ti/p/@nongmaclip", 1, 1],
  ["community-facebook", "Facebook Group", "📘", "https://facebook.com/groups/nongmaclip", 2, 2],
  ["community-discord", "Discord Server", "🎮", "https://discord.gg/nongmaclip", 2, 3],
];
const insertCommunity = db.prepare(`
  INSERT INTO community_links (id, platform, icon, url, level_required, sort_order)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    platform=excluded.platform, icon=excluded.icon, url=excluded.url,
    level_required=excluded.level_required, sort_order=excluded.sort_order
`);
db.transaction((rows) => { for (const row of rows) insertCommunity.run(...row); })(seedCommunity);

module.exports = db;
