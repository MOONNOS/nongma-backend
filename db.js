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
`);

// Seed prompt catalog — gem_url เป็น null ไว้ก่อน ค่อยเติมผ่าน /api/admin/set-gem ทีหลัง
// level_required: 2 = พื้นฐาน, 3 = ระดับสูง
const seedPrompts = [
  ["cinematic-alley", "หนัง/ดราม่า", "หนังสั้นดราม่า ตรอกยามเช้า", "บรรยากาศหม่นๆ ฟีลหนังฟิล์ม", null, 2],
  ["honey-jar", "โฆษณา", "โปรดักต์ช็อต น้ำผึ้งหมุน", "สไตล์โฆษณาสินค้าพรีเมียม", null, 2],
  ["anime-cliff", "อนิเมะ", "สาวผมขาวริมหน้าผา", "ฟีล Studio Ghibli พาสเทลนุ่มๆ", null, 2],
  ["rice-terrace", "ธรรมชาติ", "นาขั้นบันไดยามเช้า", "มุมกล้องโดรนบินผ่านทุ่งนาเหนอหมอก", null, 2],
  ["puppy-meadow", "คาแรคเตอร์", "ลูกหมาวิ่งเล่นในทุ่ง", "อบอุ่นนารัก เหมาะกับคลิปฟีลกูด", null, 2],
  ["night-market", "ไลฟ์สไตล์", "เดินตลาดกลางคืน", "ฟีล Vlog มุมมองบุคคลที่หนึ่ง", null, 3],
  ["scifi-city", "ไซไฟ", "เมืองแห่งอนาคตยามค่ำคืน", "ฟีล Cyberpunk แสงนีออนจัดจ้าน", null, 3],
  ["brownie", "อาหาร", "บราวนี่ราดช็อกโกแลต", "โคลสอัพน่ากินสไตล์โฆษณาอาหาร", null, 3],
  ["fashion-walk", "แฟชั่น", "เดินแบบยามเย็นกลางเมือง", "ฟีลหนังแฟชั่น ผ้าโบกสะบัดตามลม", null, 3],
];

const insertPrompt = db.prepare(`
  INSERT INTO prompts (id, category, title, description, gem_url, level_required)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO NOTHING
`);
const seedTx = db.transaction((rows) => {
  for (const row of rows) insertPrompt.run(...row);
});
seedTx(seedPrompts);

module.exports = db;
