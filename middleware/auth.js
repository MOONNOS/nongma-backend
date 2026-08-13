const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "ต้องล็อกอินก่อนถึงจะใช้งานส่วนนี้ได้" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch (err) {
    return res.status(401).json({ error: "เซสชันหมดอายุหรือ token ไม่ถูกต้อง กรุณาล็อกอินใหม่" });
  }
}

// ใช้กับ endpoint ที่ทั้งคนล็อกอินและไม่ล็อกอินเข้าดูได้ แต่เนื้อหาจะต่างกัน
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.userId = payload.sub;
    } catch (err) {
      // token ไม่ถูกต้อง ถือว่ายังไม่ล็อกอิน ไม่ต้อง error
    }
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
