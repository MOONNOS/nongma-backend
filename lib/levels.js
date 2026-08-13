// ระบบ LV ของน้องหมาสอนทำคลิป — กำหนดจากหลังบ้านเท่านั้น ไม่มีระบบแต้มอัตโนมัติ
const LEVELS = [
  { level: 1, name: "สมาชิกใหม่", badge: "🐾" },
  { level: 2, name: "สมาชิก 599", badge: "🐶" },
  { level: 3, name: "สมาชิก 999", badge: "🎬" },
  { level: 4, name: "Sub-admin", badge: "🛡️" },
  { level: 5, name: "Admin", badge: "👑" },
];

function getLevelInfo(level) {
  const found = LEVELS.find((l) => l.level === level) || LEVELS[0];
  return { level: found.level, name: found.name, badge: found.badge };
}

module.exports = { LEVELS, getLevelInfo };
