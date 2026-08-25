const express = require("express");
const path = require("path");
const fs = require("fs");

const router = express.Router();

const db = require("../config/database");
const adminMiddleware = require("../middleware/adminMiddleware");

const uploadsRoot = path.resolve(
  process.env.UPLOADS_PATH ||
    "/home/u921816028/domains/backpackboyys.com/uploads"
);

const videosDirectory = path.join(
  uploadsRoot,
  "videos"
);

const thumbnailsDirectory = path.join(
  uploadsRoot,
  "thumbnails"
);

router.use(adminMiddleware);

function getVideoFilePath(storedPath) {
  if (!storedPath) {
    return null;
  }

  const safeFileName = path.basename(storedPath);

  return path.join(
    videosDirectory,
    safeFileName
  );
}

function getThumbnailFilePath(storedPath) {
  if (!storedPath) {
    return null;
  }

  const safeFileName = path.basename(storedPath);

  return path.join(
    thumbnailsDirectory,
    safeFileName
  );
}

async function deleteFileIfPresent(filePath) {
  if (!filePath) {
    return;
  }

  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error(
        "Uploaded file cleanup error:",
        error
      );
    }
  }
}

// Get all videos for the admin dashboard.
router.get("/videos", async (req, res) => {
  try {
    const [videos] = await db.execute(`
      SELECT
        v.*,
        u.username
      FROM videos v
      LEFT JOIN users u
        ON v.user_id = u.id
      ORDER BY v.id DESC
    `);

    res.json({
      videos
    });
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
        v.*,
        u.username
      FROM videos v
      LEFT JOIN users u
        ON v.user_id = u.id
      WHERE v.approval_status = 'pending'
      ORDER BY v.id DESC
    `);

    res.json({
      videos
    });
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
    const reason =
      req.body.reason ||
      "Rejected by administrator";

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

// Permanently delete a video and its uploaded files.
router.delete("/videos/:id", async (req, res) => {
  let conn;

  try {
    conn = await db.getConnection();

    const [videos] = await conn.execute(
      `
      SELECT
        file_path,
        thumbnail_path
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
      `
      DELETE FROM videos
      WHERE id = ?
      `,
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      await conn.rollback();

      return res.status(404).json({
        error: "Video not found"
      });
    }

    await conn.commit();

    const videoFilePath = getVideoFilePath(
      video.file_path
    );

    const thumbnailFilePath =
      getThumbnailFilePath(
        video.thumbnail_path
      );

    await deleteFileIfPresent(videoFilePath);
    await deleteFileIfPresent(
      thumbnailFilePath
    );

    res.json({
      message:
        "Video and associated files deleted successfully"
    });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (rollbackError) {
        console.error(
          "Rollback error:",
          rollbackError
        );
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
