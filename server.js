require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const promptRoutes = require("./routes/prompts");

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
  })
);
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/prompts", promptRoutes);

// จัดการ error ที่ไม่ได้ดักไว้ ไม่ให้ server ล่มเงียบๆ
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🐶 น้องหมา backend กำลังรันที่ http://localhost:${PORT}`);
});
