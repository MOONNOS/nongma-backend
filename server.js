require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { initDb } = require("./db");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const promptRoutes = require("./routes/prompts");
const adminRoutes = require("./routes/admin");
const packageRoutes = require("./routes/packages");
const orderRoutes = require("./routes/orders");
const assistantRoutes = require("./routes/assistants");
const courseRoutes = require("./routes/courses");
const staffRoutes = require("./routes/staff");
const adminPanelRoutes = require("./routes/admin-panel");
const communityRoutes = require("./routes/community");
const notificationRoutes = require("./routes/notifications");
const passwordResetRoutes = require("./routes/password-reset");
const analyticsRoutes = require("./routes/analytics");
const app = express();
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : true }));
// เพิ่ม limit จาก default 100kb เป็น 8mb เพื่อรองรับรูปสลิปโอนเงินที่ส่งมาเป็น base64 (ไฟล์ภาพหลังบีบอัดอาจใหญ่กว่า 100kb มาก)
app.use(express.json({ limit: "8mb" }));
app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/prompts", promptRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/packages", packageRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/assistants", assistantRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/admin-panel", adminPanelRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/auth", passwordResetRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
});
const PORT = process.env.PORT || 4000;
// ต้องรอสร้างตาราง + seed ข้อมูลบน Turso ให้เสร็จก่อน ถึงจะเริ่มรับ request ได้
async function start() {
  try {
    await initDb();
    console.log("[db] เชื่อมต่อ Turso และเตรียมตารางเรียบร้อย");
    app.listen(PORT, () => {
      console.log(`🐶 น้องหมา backend กำลังรันที่ http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("[db] เชื่อมต่อ Turso ไม่สำเร็จ:", err);
    process.exit(1);
  }
}
start();
