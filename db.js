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
    prompt_text    TEXT NOT NULL,
    level_required INTEGER NOT NULL DEFAULT 1
  );
`);

// Seed prompt catalog — level_required: 2 = พื้นฐาน, 3 = ระดับสูง
const seedPrompts = [
  ["cinematic-alley", "หนัง/ดราม่า", "หนังสั้นดราม่า ตรอกยามเช้า", "บรรยากาศหม่นๆ ฟีลหนังฟิล์ม",
    "A cinematic tracking shot through a foggy Bangkok alley at dawn, neon signs reflecting on wet pavement, a lone street food vendor lighting a stove, warm steam rising, 35mm film grain, shallow depth of field", 2],
  ["honey-jar", "โฆษณา", "โปรดักต์ช็อต น้ำผึ้งหมุน", "สไตล์โฆษณาสินค้าพรีเมียม",
    "Macro shot of a golden honey jar slowly rotating on a marble surface, soft morning light through a window, honey drizzling in slow motion, minimal clean background, commercial photography style", 2],
  ["anime-cliff", "อนิเมะ", "สาวผมขาวริมหน้าผา", "ฟีล Studio Ghibli พาสเทลนุ่มๆ",
    "Anime style, a girl with flowing white hair standing on a cliff overlooking a sunset ocean, wind blowing through cherry blossom petals, Studio Ghibli inspired, soft pastel colors, hand-drawn animation feel", 2],
  ["rice-terrace", "ธรรมชาติ", "นาขั้นบันไดยามเช้า", "มุมกล้องโดรนบินผ่านทุ่งนาเหนือหมอก",
    "Aerial drone shot flying over a misty rice terrace in northern Thailand at golden hour, gentle camera movement forward, warm amber light, cinematic color grade", 2],
  ["puppy-meadow", "คาแรคเตอร์", "ลูกหมาวิ่งเล่นในทุ่ง", "อบอุ่นน่ารัก เหมาะกับคลิปฟีลกู้ด",
    "A fluffy golden retriever puppy wearing a tiny red bandana, running joyfully through a sunlit meadow, slow motion, shallow focus, warm and playful mood", 2],
  ["night-market", "ไลฟ์สไตล์", "เดินตลาดกลางคืน", "ฟีล Vlog มุมมองบุคคลที่หนึ่ง",
    "Handheld POV shot walking through a busy night market, string lights overhead, steam from food stalls, ambient chatter atmosphere, warm cinematic tones, documentary style", 3],
  ["scifi-city", "ไซไฟ", "เมืองแห่งอนาคตยามค่ำคืน", "ฟีล Cyberpunk แสงนีออนจัดจ้าน",
    "Wide shot of a futuristic city skyline at night, flying vehicles with light trails, neon blue and purple color palette, rain reflecting city lights, cyberpunk aesthetic", 3],
  ["brownie", "อาหาร", "บราวนี่ราดช็อกโกแลต", "โคลสอัพน่ากินสไตล์โฆษณาอาหาร",
    "Close-up slow motion shot of chocolate sauce pouring over a warm brownie, steam rising, dark moody lighting, shallow depth of field, appetizing commercial food photography style", 3],
  ["fashion-walk", "แฟชั่น", "เดินแบบยามเย็นกลางเมือง", "ฟีลหนังแฟชั่น ผ้าโบกสะบัดตามลม",
    "Slow motion shot of fabric flowing in wind, a model walking confidently down an urban street at dusk, cinematic lighting, editorial fashion film style", 3],
];

const insertPrompt = db.prepare(`
  INSERT INTO prompts (id, category, title, description, prompt_text, level_required)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET level_required = excluded.level_required
`);
const seedTx = db.transaction((rows) => {
  for (const row of rows) insertPrompt.run(...row);
});
seedTx(seedPrompts);

module.exports = db;
