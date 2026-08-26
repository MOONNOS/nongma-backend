// ระบบ LV ของน้องหมาสอนทำคลิป — LV1-4 คือระดับลูกค้า, LV5-6 สงวนสำหรับทีมงาน
const LEVELS = [
  { level: 1, name: "ลูกหมาใหม่", badge: "🐶" },
  { level: 2, name: "หมาโตเต็มตัว", badge: "🐕" },
  { level: 3, name: "หมาเก่งพิเศษ", badge: "🦮" },
  { level: 4, name: "หัวหน้าฝูง", badge: "👑" },
  { level: 5, name: "Sub-admin", badge: "🛡️" },
  { level: 6, name: "Admin", badge: "⚙️" },
];
function getLevelInfo(level) {
  const found = LEVELS.find((l) => l.level === level) || LEVELS[0];
  return { level: found.level, name: found.name, badge: found.badge };
}
module.exports = { LEVELS, getLevelInfo };
