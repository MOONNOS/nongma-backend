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

module.exports = db;
