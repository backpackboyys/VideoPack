const express = require("express");
const path = require("path");
const fs = require("fs");

const router = express.Router();

const db = require("../config/database");
const adminMiddleware = require("../middleware/adminMiddleware");

// Every route in this file requires an authenticated administrator.
router.use(adminMiddleware);

// Get all videos for the admin dashboard.
router.get("/videos", async (req, res) => {
  try {
    const [videos] = await db.execute(`
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
        v.is_approved,
        v.created_at,
        u.username
      FROM videos v
      JOIN users u ON v.user_id = u.id
      ORDER BY v.id DESC
    `);

    res.json({ videos });
  } catch (error) {
    console.error("Admin videos error:", error);
    res.status(500).json({
      error: "Failed to load videos"
    });
  }
});

// Get videos waiting for approval.
router.get("/videos/pending", async (req, res) => {
  try {
    const [videos] = await db.execute(`
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
        v.is_approved,
        v.created_at,
        u.username
      FROM videos v
      JOIN users u ON v.user_id = u.id
      WHERE v.approval_status = 'pending'
      ORDER BY v.id DESC
    `);

    res.json({ videos });
  } catch (error) {
    console.error("Pending videos error:", error);
    res.status(500).json({
      error: "Failed to load pending videos"
    });
  }
});

// Approve a video.
router.patch("/videos/:id/approve", async (req, res) => {
  try {
    const [result] = await db.execute(
      `
      UPDATE videos
      SET approval_status = 'approved',
          is_approved = 1
      WHERE id = ?
      `,
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: "Video not found"
      });
    }

    res.json({
      message: "Video approved successfully"
    });
  } catch (error) {
    console.error("Approve video error:", error);
    res.status(500).json({
      error: "Failed to approve video"
    });
  }
});

// Reject a video.
router.patch("/videos/:id/reject", async (req, res) => {
  try {
    const reason = req.body.reason || null;

    const [result] = await db.execute(
      `
      UPDATE videos
      SET approval_status = 'rejected',
          is_approved = 0,
          rejection_reason = ?
      WHERE id = ?
      `,
      [reason, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: "Video not found"
      });
    }

    res.json({
      message: "Video rejected successfully"
    });
  } catch (error) {
    console.error("Reject video error:", error);
    res.status(500).json({
      error: "Failed to reject video"
    });
  }
});

// Permanently delete a video and its stored files.
router.delete("/videos/:id", async (req, res) => {
  let conn;

  try {
    conn = await db.getConnection();

    const [videos] = await conn.execute(
      `
      SELECT file_path, thumbnail_path
      FROM videos
      WHERE id = ?
      `,
      [req.params.id]
    );

    if (videos.length === 0) {
      return res.status(404).json({
        error: "Video not found"
      });
    }

    const video = videos[0];

    await conn.beginTransaction();

    const [result] = await conn.execute(
      "DELETE FROM videos WHERE id = ?",
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      await conn.rollback();

      return res.status(404).json({
        error: "Video not found"
      });
    }

    await conn.commit();

    // Delete the uploaded video file.
    if (video.file_path) {
      const videoFileName = path.basename(video.file_path);
      const videoFilePath = path.join(
        __dirname,
        "..",
        "uploads",
        "videos",
        videoFileName
      );

      try {
        await fs.promises.unlink(videoFilePath);
      } catch (fileError) {
        console.error("Video file cleanup error:", fileError);
      }
    }

    // Delete the thumbnail file if one exists.
    if (video.thumbnail_path) {
      const thumbnailFileName = path.basename(video.thumbnail_path);
      const thumbnailFilePath = path.join(
        __dirname,
        "..",
        "uploads",
        "thumbnails",
        thumbnailFileName
      );

      try {
        await fs.promises.unlink(thumbnailFilePath);
      } catch (fileError) {
        console.error("Thumbnail cleanup error:", fileError);
      }
    }

    res.json({
      message: "Video and associated files deleted successfully"
    });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (rollbackError) {
        console.error("Rollback error:", rollbackError);
      }
    }

    console.error("Delete video error:", error);

    res.status(500).json({
      error: "Failed to delete video"
    });
  } finally {
    if (conn) {
      conn.release();
    }
  }
});

module.exports = router;
