// ระบบ LV ของน้องหมาสอนทำคลิป
// ปรับ threshold หรือชื่อเลเวลตรงนี้ได้เลย ไม่กระทบส่วนอื่น

const LEVELS = [
  { level: 1, name: "ลูกหมาใหม่", badge: "🐾", minPoints: 0 },
  { level: 2, name: "หมาลุยงาน", badge: "🐶", minPoints: 50 },
  { level: 3, name: "หมาเจนสนาม", badge: "🎬", minPoints: 120 },
  { level: 4, name: "หมาอาวุโส", badge: "🏆", minPoints: 250 },
  { level: 5, name: "หัวหน้าฝูง", badge: "👑", minPoints: 450 },
];

// แต้มที่ได้จากการกด "คัดลอก" prompt แต่ละอัน (นับครังแรกต่อ 1 prompt เท่านั้น)
const POINTS_PER_PROMPT_COPY = 10;

function getLevelInfo(points) {
  let current = LEVELS[0];
  for (const lv of LEVELS) {
    if (points >= lv.minPoints) current = lv;
  }
  const currentIndex = LEVELS.findIndex((l) => l.level === current.level);
  const next = LEVELS[currentIndex + 1] || null;

  return {
    level: current.level,
    name: current.name,
    badge: current.badge,
    points,
    nextLevel: next
      ? { level: next.level, name: next.name, pointsNeeded: next.minPoints - points }
      : null,
  };
}

module.exports = { LEVELS, POINTS_PER_PROMPT_COPY, getLevelInfo };
