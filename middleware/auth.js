const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "ต้องล็อกอินก่อนถึงจะใช้งานสวนนี้ได้" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch (err) {
    return res.status(401).json({ error: "เซสชันหมดอายุหรือ token ไม่ถูกต้อง กรุณาล็อกอินใหม่" });
  }
}

module.exports = { requireAuth };
