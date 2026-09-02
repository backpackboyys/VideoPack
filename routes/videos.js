const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const {
  authMiddleware,
  optionalAuth
} = require("../middleware/auth");

const db = require("../config/database");

const router = express.Router();

const uploadsRoot = path.resolve(
  process.env.UPLOADS_PATH ||
    "/home/u921816028/domains/backpackboyys.com/uploads"
);

const videosDirectory = path.join(
  uploadsRoot,
  "videos"
);

fs.mkdirSync(videosDirectory, {
  recursive: true
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, videosDirectory);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(
      file.originalname
    ).toLowerCase();

    const uniqueName = `${uuidv4()}${extension}`;

    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,

  limits: {
    fileSize: 5000000000
  },

  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "video/mp4",
      "video/mpeg",
      "video/webm",
      "video/quicktime"
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  }
});

// Upload a video directly and queue it for moderation.
router.post(
  "/upload",
  authMiddleware,
  upload.single("video"),
  async (req, res) => {
    let conn;

    try {
      if (!req.file) {
        return res.status(400).json({
          error: "No video file provided"
        });
      }

      const {
        title,
        description,
        videoType,
        price
      } = req.body;

      conn = await db.getConnection();

      const [users] = await conn.execute(
        "SELECT age_verified FROM users WHERE id = ?",
        [req.user.id]
      );

      if (!users[0]?.age_verified) {
        await fs.promises.unlink(req.file.path).catch(() => {});

        return res.status(403).json({
          error:
            "Age verification required before uploading"
        });
      }

      const [result] = await conn.execute(
        `
        INSERT INTO videos
          (
            user_id,
            title,
            description,
            file_path,
            video_type,
            price,
            approval_status,
            is_approved
          )
        VALUES (?, ?, ?, ?, ?, ?, 'pending', 0)
        `,
        [
          req.user.id,
          title || null,
          description || null,
          req.file.filename,
          videoType || "free",
          price || null
        ]
      );

      res.status(201).json({
        message:
          "Video uploaded successfully. Awaiting moderation approval.",
        videoId: result.insertId,
        status: "pending",
        fileName: req.file.filename
      });
    } catch (error) {
      console.error("Video upload error:", error);

      if (req.file?.path) {
        await fs.promises.unlink(req.file.path).catch(() => {});
      }

      res.status(500).json({
        error: "Video upload failed"
      });
    } finally {
      if (conn) {
        conn.release();
      }
    }
  }
);

// Get all approved videos.
router.get("/", optionalAuth, async (req, res) => {
  let conn;

  try {
    conn = await db.getConnection();

    const [videos] = await conn.execute(`
      SELECT
        v.id,
        v.title,
        v.description,
        v.file_path,
        v.thumbnail_path,
        v.video_type,
        v.price,
        v.view_count,
        v.approval_status,
        u.username,
        v.created_at
      FROM videos v
      JOIN users u ON v.user_id = u.id
      WHERE v.is_approved = TRUE
      ORDER BY v.created_at DESC
      LIMIT 50
    `);

    res.json(videos);
  } catch (error) {
    console.error("Fetch approved videos error:", error);

    res.status(500).json({
      error: "Failed to fetch videos"
    });
  } finally {
    if (conn) {
      conn.release();
    }
  }
});

// Get the current user's videos.
router.get(
  "/user/:userId",
  authMiddleware,
  async (req, res) => {
    let conn;

    try {
      if (
        String(req.user.id) !== String(req.params.userId) &&
        req.user.role !== "admin"
      ) {
        return res.status(403).json({
          error: "You are not allowed to view these videos"
        });
      }

      conn = await db.getConnection();

      const [videos] = await conn.execute(
        `
        SELECT
          id,
          title,
          description,
          file_path,
          thumbnail_path,
          approval_status,
          view_count,
          created_at
        FROM videos
        WHERE user_id = ?
        ORDER BY created_at DESC
        `,
        [req.params.userId]
      );

      res.json(videos);
    } catch (error) {
      console.error("Fetch user videos error:", error);

      res.status(500).json({
        error: "Failed to fetch user videos"
      });
    } finally {
      if (conn) {
        conn.release();
      }
    }
  }
);

// Get one video.
router.get("/:id", optionalAuth, async (req, res) => {
  let conn;

  try {
    conn = await db.getConnection();

    const [videos] = await conn.execute(
      `
      SELECT
        v.*,
        u.username,
        u.profile_picture
      FROM videos v
      JOIN users u ON v.user_id = u.id
      WHERE v.id = ?
      `,
      [req.params.id]
    );

    if (videos.length === 0) {
      return res.status(404).json({
        error: "Video not found"
      });
    }

    const video = videos[0];

    if (!video.is_approved) {
      return res.status(403).json({
        error: "Video not approved yet"
      });
    }

    await conn.execute(
      `
      UPDATE videos
      SET view_count = view_count + 1
      WHERE id = ?
      `,
      [req.params.id]
    );

    res.json(video);
  } catch (error) {
    console.error("Fetch single video error:", error);

    res.status(500).json({
      error: "Failed to fetch video"
    });
  } finally {
    if (conn) {
      conn.release();
    }
  }
});

module.exports = router;
