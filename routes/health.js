const express = require("express");
const router = express.Router();

// Display health readings page
router.get("/", async (req, res) => {
  try {
    const [readings] = await req.db.query(
      "SELECT * FROM health_readings ORDER BY recorded_at DESC LIMIT 50",
    );
    const [latest] = await req.db.query(
      "SELECT * FROM health_readings ORDER BY recorded_at DESC LIMIT 1",
    );
    const [stats] = await req.db.query(
      `SELECT AVG(spo2) as avg_spo2, AVG(temperature) as avg_temp,
              AVG(heart_rate) as avg_hr, MIN(heart_rate) as min_hr,
              MAX(heart_rate) as max_hr, COUNT(*) as total_readings
       FROM health_readings WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
    );

    res.render("health", {
      title: "Health Monitoring - Ardthon Solutions",
      readings,
      latest: latest[0] || null,
      stats: stats[0] || {},
      user: req.session.user || null,
    });
  } catch (err) {
    console.error("Health page error:", err);
    res.render("health", {
      title: "Health Monitoring",
      readings: [],
      latest: null,
      stats: {},
      user: req.session.user || null,
    });
  }
});

// API: Receive health data from ESP32/device
router.post("/api/submit", async (req, res) => {
  try {
    const { device_id, spo2, temperature, heart_rate } = req.body;
    if (!device_id)
      return res.status(400).json({ error: "device_id required" });

    await req.db.query(
      "INSERT INTO health_readings (device_id, spo2, temperature, heart_rate) VALUES (?, ?, ?, ?)",
      [
        device_id,
        parseFloat(spo2) || 0,
        parseFloat(temperature) || 0,
        parseInt(heart_rate) || 0,
      ],
    );

    res.json({ status: "success", message: "Reading recorded" });
  } catch (err) {
    console.error("Health API error:", err);
    res.status(500).json({ error: "Failed to save reading" });
  }
});

// API: Get latest health data (for auto-refresh)
router.get("/api/latest", async (req, res) => {
  try {
    const [latest] = await req.db.query(
      "SELECT * FROM health_readings ORDER BY recorded_at DESC LIMIT 1",
    );
    const [recent] = await req.db.query(
      "SELECT * FROM health_readings ORDER BY recorded_at DESC LIMIT 20",
    );
    const [stats] = await req.db.query(
      `SELECT AVG(spo2) as avg_spo2, AVG(temperature) as avg_temp,
              AVG(heart_rate) as avg_hr, MIN(heart_rate) as min_hr,
              MAX(heart_rate) as max_hr
       FROM health_readings WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
    );

    res.json({
      latest: latest[0] || null,
      recent: recent.reverse(),
      stats: stats[0] || {},
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get data" });
  }
});

module.exports = router;
