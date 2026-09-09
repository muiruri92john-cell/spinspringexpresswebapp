const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error('Only images allowed'));
  }
});

router.post('/image', upload.single('image'), (req, res) => {
  if (req.file) {
    res.json({ success: true, url: '/uploads/' + req.file.filename });
  } else {
    res.status(400).json({ error: 'No file uploaded' });
  }
});

router.post('/images', upload.array('images', 10), (req, res) => {
  if (req.files && req.files.length > 0) {
    const urls = req.files.map(f => '/uploads/' + f.filename);
    res.json({ success: true, urls });
  } else {
    res.status(400).json({ error: 'No files uploaded' });
  }
});

module.exports = router;