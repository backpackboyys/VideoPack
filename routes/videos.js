const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const { v4: uuidv4 } = require("uuid");
const ffmpegPath = require("ffmpeg-static");

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

const temporaryVideosDirectory = path.join(
  videosDirectory,
  "temporary"
);

fs.mkdirSync(videosDirectory, {
  recursive: true
});

fs.mkdirSync(temporaryVideosDirectory, {
  recursive: true
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, temporaryVideosDirectory);
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

function convertVideo(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      return reject(
        new Error("FFmpeg binary was not found")
      );
    }

    const ffmpeg = spawn(ffmpegPath, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      inputPath,
      "-map_metadata",
      "-1",
      "-vf",
      "scale=w='min(1920,iw)':h=-2:force_original_aspect_ratio=decrease",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "24",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-y",
      outputPath
    ]);

    let errorOutput = "";

    ffmpeg.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    ffmpeg.on("error", (error) => {
      reject(error);
    });

    ffmpeg.on("close", (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve();
        return;
      }

      reject(
        new Error(
          `FFmpeg conversion failed. Exit code: ${code}. ${errorOutput}`
        )
      );
    });
  });
}

// Upload, compress, convert, and queue a video for moderation.
router.post(
  "/upload",
  authMiddleware,
  upload.single("video"),
  async (req, res) => {
    let conn;
    let convertedPath;

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

      conn.release();
      conn = null;

      const finalFileName = `${uuidv4()}.mp4`;
      convertedPath = path.join(
        videosDirectory,
        finalFileName
      );

      await convertVideo(
        req.file.path,
        convertedPath
      );

      await fs.promises.unlink(req.file.path);

      conn = await db.getConnection();

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
          finalFileName,
          videoType || "free",
          price || null
        ]
      );

      res.status(201).json({
        message:
          "Video compressed and uploaded successfully. Awaiting moderation approval.",
        videoId: result.insertId,
        status: "pending",
        fileName: finalFileName
      });
    } catch (error) {
      console.error("Video upload/compression error:", error);

      if (req.file?.path) {
        await fs.promises.unlink(req.file.path).catch(() => {});
      }

      if (convertedPath) {
        await fs.promises.unlink(convertedPath).catch(() => {});
      }

      res.status(500).json({
        error: "Upload or video compression failed"
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
