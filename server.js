const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = 3000;

// เปิดใช้งาน JSON และไฟล์เกมใน public
app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));

// สร้างฐานข้อมูลไว้ที่โฟลเดอร์หลัก
const db = new Database(
  path.join(__dirname, "robo-escape.db")
);

db.pragma("journal_mode = WAL");

// สร้างตารางเก็บคะแนน ถ้ายังไม่มี
db.exec(`
  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_name TEXT NOT NULL,
    score INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (
      strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    )
  );
`);

// API ตรวจสอบว่าเซิร์ฟเวอร์ทำงาน
app.get("/api/status", (req, res) => {
  res.json({
    success: true,
    message: "Robo Escape Backend is running!"
  });
});

// API บันทึกคะแนน
app.post("/api/scores", (req, res) => {
  const name = String(req.body.playerName || "Player")
    .trim()
    .slice(0, 20);

  const score = req.body.score;

  if (
    !Number.isSafeInteger(score) ||
    score < 0 ||
    score > 10000000
  ) {
    return res.status(400).json({
      success: false,
      message: "คะแนนไม่ถูกต้อง"
    });
  }

  const result = db.prepare(`
    INSERT INTO scores (player_name, score)
    VALUES (?, ?)
  `).run(name || "Player", score);

  res.status(201).json({
    success: true,
    message: "บันทึกคะแนนแล้ว",
    id: result.lastInsertRowid
  });
});

// API แสดงคะแนนสูงสุด 10 อันดับ
app.get("/api/leaderboard", (req, res) => {
  const rows = db.prepare(`
    SELECT player_name, score, created_at
    FROM scores
    ORDER BY score DESC, id ASC
    LIMIT 10
  `).all();

  res.json({
    success: true,
    leaderboard: rows
  });
});

// API สถิติสำหรับหน้า Admin
app.get("/api/admin/stats", (req, res) => {
  const stats = db.prepare(`
    SELECT
      COUNT(*) AS totalGames,
      COALESCE(MAX(score), 0) AS highestScore,
      COALESCE(ROUND(AVG(score), 1), 0) AS averageScore
    FROM scores
  `).get();

  res.json({
    success: true,
    stats
  });
});

// จัดการ Error ที่ไม่คาดคิดจาก API
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    success: false,
    message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์"
  });
});

app.get("/api/history", (req, res) => {
  try {
    const history = db.prepare(`
      SELECT id, player_name, score, created_at
      FROM scores
      ORDER BY created_at DESC, id DESC
      LIMIT 50
    `).all();

    res.json({
      success: true,
      history: history
    });
  } catch (error) {
    console.error("โหลดประวัติการเล่นไม่สำเร็จ:", error);

    res.status(500).json({
      success: false,
      message: "ไม่สามารถโหลดประวัติการเล่นได้"
    });
  }
});
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Robo Escape server running on port ${PORT}`);
  console.log("Local: http://localhost:" + PORT);
});