const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/videos'));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5000000000 }, // 5GB
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['video/mp4', 'video/mpeg', 'video/webm', 'video/quicktime'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Upload video
router.post('/upload', authMiddleware, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const { title, description, videoType, price } = req.body;
    const conn = await db.getConnection();

    // Check if user has verified age
    const [user] = await conn.execute(
      'SELECT age_verified FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!user[0]?.age_verified) {
      conn.release();
      return res.status(403).json({ error: 'Age verification required before uploading' });
    }

    // Insert video record
    const [result] = await conn.execute(
      `INSERT INTO videos (user_id, title, description, file_path, video_type, price, approval_status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [req.user.id, title, description, req.file.filename, videoType || 'free', price || null]
    );

    conn.release();

    res.status(201).json({
      message: 'Video uploaded successfully. Awaiting moderation approval.',
      videoId: result.insertId,
      status: 'pending'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Get all approved videos
router.get('/', optionalAuth, async (req, res) => {
  try {
    const conn = await db.getConnection();

    const [videos] = await conn.execute(`
      SELECT v.id, v.title, v.description, v.thumbnail_path, v.video_type, v.price, 
             v.view_count, u.username, v.created_at
      FROM videos v
      JOIN users u ON v.user_id = u.id
      WHERE v.is_approved = TRUE
      ORDER BY v.created_at DESC
      LIMIT 50
    `);

    conn.release();

    res.json(videos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

// Get single video
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const conn = await db.getConnection();

    const [videos] = await conn.execute(`
      SELECT v.*, u.username, u.profile_picture
      FROM videos v
      JOIN users u ON v.user_id = u.id
      WHERE v.id = ?
    `, [req.params.id]);

    if (videos.length === 0) {
      conn.release();
      return res.status(404).json({ error: 'Video not found' });
    }

    const video = videos[0];

    // Check if user can view the video
    if (!video.is_approved) {
      conn.release();
      return res.status(403).json({ error: 'Video not approved yet' });
    }

    // Update view count
    await conn.execute('UPDATE videos SET view_count = view_count + 1 WHERE id = ?', [req.params.id]);

    conn.release();

    res.json(video);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

// Get user's videos
router.get('/user/:userId', async (req, res) => {
  try {
    const conn = await db.getConnection();

    const [videos] = await conn.execute(`
      SELECT id, title, description, thumbnail_path, approval_status, view_count, created_at
      FROM videos
      WHERE user_id = ?
      ORDER BY created_at DESC
    `, [req.params.userId]);

    conn.release();

    res.json(videos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch user videos' });
  }
});

module.exports = router;
