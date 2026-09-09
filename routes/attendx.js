const express = require("express");
const router = express.Router();
const crypto = require("crypto");

function generateAttendXApiKey() {
  return "AX-" + crypto.randomBytes(16).toString("hex");
}

// Login page
router.get("/login", (req, res) => {
  if (req.session.attendxUser) return res.redirect("/attendx/dashboard");
  res.render("attendx/login", { title: "AttendX Login - Ardthon Solutions" });
});

// Login handler
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const bcrypt = require("bcryptjs");

    const [users] = await req.db.query(
      "SELECT * FROM attendx_users WHERE email = ? AND is_active = 1",
      [email],
    );

    if (users.length === 0) {
      req.flash("error_msg", "Invalid AttendX credentials");
      return res.redirect("/attendx/login");
    }

    const user = users[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      req.flash("error_msg", "Invalid AttendX credentials");
      return res.redirect("/attendx/login");
    }

    req.session.attendxUser = {
      id: user.id,
      email: user.email,
      name: user.full_name,
      institution: user.institution_name,
    };

    req.flash("success_msg", "Welcome to AttendX!");
    res.redirect("/attendx/dashboard");
  } catch (err) {
    console.error("AttendX login error:", err);
    req.flash("error_msg", "Login failed");
    res.redirect("/attendx/login");
  }
});

// Register page
router.get("/register", (req, res) => {
  res.render("attendx/register", {
    title: "Register AttendX - Ardthon Solutions",
  });
});

// Register handler
router.post("/register", async (req, res) => {
  try {
    const {
      email,
      password,
      password2,
      full_name,
      institution_name,
      institution_type,
      phone,
    } = req.body;
    const bcrypt = require("bcryptjs");

    if (password !== password2) {
      req.flash("error_msg", "Passwords do not match");
      return res.redirect("/attendx/register");
    }

    const [existing] = await req.db.query(
      "SELECT id FROM attendx_users WHERE email = ?",
      [email],
    );
    if (existing.length > 0) {
      req.flash("error_msg", "Email already registered");
      return res.redirect("/attendx/register");
    }

    const hash = await bcrypt.hash(password, 10);
    await req.db.query(
      "INSERT INTO attendx_users (email, password, full_name, institution_name, institution_type, phone) VALUES (?, ?, ?, ?, ?, ?)",
      [
        email,
        hash,
        full_name,
        institution_name,
        institution_type || "School",
        phone,
      ],
    );

    req.flash("success_msg", "AttendX account created! Please login.");
    res.redirect("/attendx/login");
  } catch (err) {
    console.error("AttendX register error:", err);
    req.flash("error_msg", "Registration failed");
    res.redirect("/attendx/register");
  }
});

// Logout
router.get("/logout", (req, res) => {
  delete req.session.attendxUser;
  res.redirect("/attendx/login");
});

// Dashboard
router.get("/dashboard", async (req, res) => {
  if (!req.session.attendxUser) return res.redirect("/attendx/login");
  try {
    const userId = req.session.attendxUser.id;
    const [devices] = await req.db.query(
      "SELECT * FROM attendx_devices WHERE owner_id = ? ORDER BY created_at DESC",
      [userId],
    );

    for (let device of devices) {
      const [todayEntries] = await req.db.query(
        "SELECT COUNT(*) as count FROM attendx_records WHERE device_id = ? AND event_type = 'entry' AND DATE(recorded_at) = CURDATE()",
        [device.device_id],
      );
      const [todayExits] = await req.db.query(
        "SELECT COUNT(*) as count FROM attendx_records WHERE device_id = ? AND event_type = 'exit' AND DATE(recorded_at) = CURDATE()",
        [device.device_id],
      );
      const [studentCount] = await req.db.query(
        "SELECT COUNT(*) as count FROM attendx_students WHERE device_id = ?",
        [device.device_id],
      );

      device.today_entries = todayEntries[0].count;
      device.today_exits = todayExits[0].count;
      device.student_count = studentCount[0].count;
      device.is_online = device.status === "online";
    }

    res.render("attendx/dashboard", {
      title: "AttendX Dashboard - Ardthon Solutions",
      devices,
      user: req.session.attendxUser,
    });
  } catch (err) {
    console.error("AttendX dashboard error:", err);
    res.render("attendx/dashboard", {
      title: "AttendX Dashboard",
      devices: [],
      user: req.session.attendxUser,
    });
  }
});

// Register device page
router.get("/register-device", (req, res) => {
  if (!req.session.attendxUser) return res.redirect("/attendx/login");
  res.render("attendx/register-device", { title: "Register AttendX Device" });
});

// Register device handler
router.post("/register-device", async (req, res) => {
  if (!req.session.attendxUser) return res.redirect("/attendx/login");
  try {
    const { device_name, location, mode } = req.body;
    const ownerId = req.session.attendxUser.id;

    const deviceId =
      "ATTENDX-" +
      Date.now().toString(36).toUpperCase() +
      "-" +
      crypto.randomBytes(3).toString("hex").toUpperCase();
    const apiKey = generateAttendXApiKey();

    await req.db.query(
      `INSERT INTO attendx_devices (device_id, device_name, api_key, owner_id, location_area, mode, status)
       VALUES (?, ?, ?, ?, ?, ?, 'offline')`,
      [deviceId, device_name, apiKey, ownerId, location, mode || "both"],
    );

    req.session.newAttendXDevice = {
      device_id: deviceId,
      device_name,
      api_key: apiKey,
    };
    req.flash("success_msg", "Device registered successfully!");
    res.redirect("/attendx/device-credentials");
  } catch (err) {
    console.error("Device registration error:", err);
    req.flash("error_msg", "Failed to register device");
    res.redirect("/attendx/register-device");
  }
});

// Device credentials page
router.get("/device-credentials", (req, res) => {
  if (!req.session.attendxUser) return res.redirect("/attendx/login");
  const device = req.session.newAttendXDevice;
  if (!device) return res.redirect("/attendx/dashboard");
  delete req.session.newAttendXDevice;
  res.render("attendx/device-credentials", {
    title: "Device Credentials - AttendX",
    device,
  });
});

// Device detail page
router.get("/device/:deviceId", async (req, res) => {
  if (!req.session.attendxUser) return res.redirect("/attendx/login");
  try {
    const userId = req.session.attendxUser.id;
    const { deviceId } = req.params;

    const [devices] = await req.db.query(
      "SELECT * FROM attendx_devices WHERE device_id = ? AND owner_id = ?",
      [deviceId, userId],
    );

    if (devices.length === 0) {
      req.flash("error_msg", "Device not found");
      return res.redirect("/attendx/dashboard");
    }

    const device = devices[0];
    const [records] = await req.db.query(
      "SELECT * FROM attendx_records WHERE device_id = ? ORDER BY recorded_at DESC LIMIT 50",
      [deviceId],
    );
    const [students] = await req.db.query(
      "SELECT * FROM attendx_students WHERE device_id = ? ORDER BY full_name",
      [deviceId],
    );
    const [todayStats] = await req.db.query(
      `SELECT SUM(CASE WHEN event_type = 'entry' THEN 1 ELSE 0 END) as entries,
              SUM(CASE WHEN event_type = 'exit' THEN 1 ELSE 0 END) as exits
       FROM attendx_records WHERE device_id = ? AND DATE(recorded_at) = CURDATE()`,
      [deviceId],
    );

    res.render("attendx/device-detail", {
      title: `${device.device_name} - AttendX`,
      device,
      records,
      students,
      todayStats: todayStats[0],
    });
  } catch (err) {
    console.error("Device detail error:", err);
    res.redirect("/attendx/dashboard");
  }
});

// Add student
router.post("/device/:deviceId/student", async (req, res) => {
  if (!req.session.attendxUser) return res.redirect("/attendx/login");
  try {
    const { deviceId } = req.params;
    const {
      student_id,
      full_name,
      class_grade,
      parent_name,
      parent_phone,
      fingerprint_id,
    } = req.body;

    await req.db.query(
      `INSERT INTO attendx_students (device_id, student_id, full_name, class_grade, parent_name, parent_phone, fingerprint_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE full_name=VALUES(full_name), class_grade=VALUES(class_grade),
       parent_name=VALUES(parent_name), parent_phone=VALUES(parent_phone)`,
      [
        deviceId,
        student_id,
        full_name,
        class_grade,
        parent_name,
        parent_phone,
        fingerprint_id || null,
      ],
    );

    req.flash("success_msg", "Student registered!");
    res.redirect(`/attendx/device/${deviceId}`);
  } catch (err) {
    console.error("Add student error:", err);
    req.flash("error_msg", "Failed to add student");
    res.redirect(`/attendx/device/${req.params.deviceId}`);
  }
});

// ===== ATTENDX API ENDPOINTS =====

// Device sync - Receive attendance data from ESP32
router.post("/api/sync", async (req, res) => {
  try {
    const deviceId = req.headers["x-device-id"];
    const apiKey = req.headers["x-api-key"];

    if (!deviceId || !apiKey)
      return res.status(401).json({ error: "Missing credentials" });

    const [devices] = await req.db.query(
      "SELECT * FROM attendx_devices WHERE device_id = ? AND api_key = ?",
      [deviceId, apiKey],
    );

    if (devices.length === 0)
      return res.status(401).json({ error: "Invalid credentials" });

    const data = req.body;

    await req.db.query(
      "UPDATE attendx_devices SET status = 'online', last_sync = NOW() WHERE device_id = ?",
      [deviceId],
    );

    if (data.events && Array.isArray(data.events)) {
      for (const event of data.events) {
        const [students] = await req.db.query(
          "SELECT * FROM attendx_students WHERE device_id = ? AND (student_id = ? OR fingerprint_id = ?)",
          [deviceId, event.student_id, event.fingerprint_id],
        );
        const student = students.length > 0 ? students[0] : null;

        await req.db.query(
          "INSERT INTO attendx_records (device_id, student_id, student_name, event_type, parent_phone, sms_sent) VALUES (?, ?, ?, ?, ?, ?)",
          [
            deviceId,
            event.student_id,
            student ? student.full_name : "Unknown",
            event.event_type,
            student ? student.parent_phone : null,
            0,
          ],
        );

        if (student && student.parent_phone) {
          const time = new Date().toLocaleTimeString("en-KE", { hour12: true });
          const action =
            event.event_type === "entry" ? "ARRIVED at" : "DEPARTED from";
          const message = `${student.full_name} has ${action} school at ${time}. - ${devices[0].device_name}`;
          await req.db.query(
            "INSERT INTO attendx_sms_log (device_id, student_id, parent_phone, message, status) VALUES (?, ?, ?, ?, 'pending')",
            [deviceId, event.student_id, student.parent_phone, message],
          );
        }
      }
    }

    res.json({
      status: "success",
      message: "Sync complete",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("AttendX sync error:", err);
    res.status(500).json({ error: "Sync failed" });
  }
});

// API: Get dashboard data for auto-refresh
router.get("/api/dashboard-data", async (req, res) => {
  if (!req.session.attendxUser)
    return res.status(401).json({ error: "Not authenticated" });
  try {
    const userId = req.session.attendxUser.id;
    const [devices] = await req.db.query(
      "SELECT device_id, device_name, status, last_sync FROM attendx_devices WHERE owner_id = ?",
      [userId],
    );

    for (let device of devices) {
      const [entries] = await req.db.query(
        "SELECT COUNT(*) as count FROM attendx_records WHERE device_id = ? AND event_type = 'entry' AND DATE(recorded_at) = CURDATE()",
        [device.device_id],
      );
      const [exits] = await req.db.query(
        "SELECT COUNT(*) as count FROM attendx_records WHERE device_id = ? AND event_type = 'exit' AND DATE(recorded_at) = CURDATE()",
        [device.device_id],
      );
      device.today_entries = entries[0].count;
      device.today_exits = exits[0].count;
    }

    res.json({ success: true, devices });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to load data" });
  }
});

module.exports = router;
