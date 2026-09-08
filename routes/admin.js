const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");

const router = express.Router();
const db = require("../config/database");
const adminMiddleware = require("../middleware/adminMiddleware");

const uploadsRoot = path.resolve(
  process.env.UPLOADS_PATH ||
    "/home/u921816028/domains/backpackboyys.com/uploads"
);
const videosDirectory = path.join(uploadsRoot, "videos");
const thumbnailsDirectory = path.join(uploadsRoot, "thumbnails");

router.use(adminMiddleware);

function getVideoFilePath(storedPath) {
  return storedPath ? path.join(videosDirectory, path.basename(storedPath)) : null;
}

function getThumbnailFilePath(storedPath) {
  return storedPath ? path.join(thumbnailsDirectory, path.basename(storedPath)) : null;
}

async function deleteFileIfPresent(filePath) {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") console.error("Uploaded file cleanup error:", error);
  }
}

function getUserId(req) {
  const userId = Number(req.user?.id);
  return Number.isInteger(userId) ? userId : null;
}

function validRole(role) {
  return role === "user" || role === "admin";
}

function validEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    age_verified: user.age_verified,
    created_at: user.created_at,
    updated_at: user.updated_at,
    deleted_at: user.deleted_at,
    active: user.deleted_at === null
  };
}

async function getUserById(userId) {
  const [rows] = await db.execute(
    `SELECT id, username, email, password_hash, role, age_verified,
            created_at, updated_at, deleted_at
     FROM users WHERE id = ? LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function isLastActiveAdmin(userId) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS count FROM users
     WHERE role = 'admin' AND deleted_at IS NULL AND id <> ?`,
    [userId]
  );
  return Number(rows[0].count) === 0;
}

// Video management
router.get("/videos", async (req, res) => {
  try {
    const [videos] = await db.execute(`
      SELECT v.*, u.username
      FROM videos v
      LEFT JOIN users u ON v.user_id = u.id
      ORDER BY v.id DESC
    `);
    res.json({ videos });
  } catch (error) {
    console.error("Admin videos error:", error);
    res.status(500).json({ error: "Failed to load videos" });
  }
});

router.get("/videos/pending", async (req, res) => {
  try {
    const [videos] = await db.execute(`
      SELECT v.*, u.username
      FROM videos v
      LEFT JOIN users u ON v.user_id = u.id
      WHERE v.approval_status = 'pending'
      ORDER BY v.id DESC
    `);
    res.json({ videos });
  } catch (error) {
    console.error("Pending videos error:", error);
    res.status(500).json({ error: "Failed to load pending videos" });
  }
});

// Update editable video details without changing moderation state unless requested.
router.patch("/videos/:id", async (req, res) => {
  try {
    const videoId = Number(req.params.id);
    if (!Number.isInteger(videoId) || videoId < 1) {
      return res.status(400).json({ error: "Invalid video ID" });
    }

    const [existingRows] = await db.execute(
      "SELECT * FROM videos WHERE id = ? LIMIT 1",
      [videoId]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ error: "Video not found" });
    }

    const updates = [];
    const values = [];

    if (req.body.title !== undefined) {
      const title = String(req.body.title).trim();
      if (!title) return res.status(400).json({ error: "Title is required" });
      if (title.length > 255) return res.status(400).json({ error: "Title must be 255 characters or fewer" });
      updates.push("title = ?");
      values.push(title);
    }

    if (req.body.description !== undefined) {
      const description = req.body.description === null ? null : String(req.body.description);
      updates.push("description = ?");
      values.push(description);
    }

    if (req.body.thumbnail_path !== undefined) {
      const thumbnailPath = req.body.thumbnail_path === null ? null : String(req.body.thumbnail_path).trim();
      updates.push("thumbnail_path = ?");
      values.push(thumbnailPath || null);
    }

    if (req.body.duration !== undefined) {
      const duration = req.body.duration === null || req.body.duration === "" ? null : Number(req.body.duration);
      if (duration !== null && (!Number.isInteger(duration) || duration < 0)) {
        return res.status(400).json({ error: "Duration must be a non-negative whole number" });
      }
      updates.push("duration = ?");
      values.push(duration);
    }

    if (req.body.file_size !== undefined) {
      const fileSize = req.body.file_size === null || req.body.file_size === "" ? null : Number(req.body.file_size);
      if (fileSize !== null || (fileSize !== null && (!Number.isInteger(fileSize) || fileSize < 0))) {
        return res.status(400).json({ error: "File size must be a non-negative whole number" });
      }
      updates.push("file_size = ?");
      values.push(fileSize);
    }

    if (req.body.video_type !== undefined) {
      const videoType = String(req.body.video_type);
      if (!["free", "premium", "pay-per-view"].includes(videoType)) {
        return res.status(400).json({ error: "Invalid video type" });
      }
      updates.push("video_type = ?");
      values.push(videoType);
    }

    if (req.body.price !== undefined) {
      const price = req.body.price === null || req.body.price === "" ? null : Number(req.body.price);
      if (price !== null && (!Number.isFinite(price) || price < 0)) {
        return res.status(400).json({ error: "Price must be a non-negative number" });
      }
      updates.push("price = ?");
      values.push(price);
    }

    if (req.body.is_public !== undefined) {
      updates.push("is_public = ?");
      values.push(req.body.is_public ? 1 : 0);
    }

    if (req.body.approval_status !== undefined) {
      const approvalStatus = String(req.body.approval_status);
      if (!["pending", "approved", "rejected"].includes(approvalStatus)) {
        return res.status(400).json({ error: "Invalid approval status" });
      }
      updates.push("approval_status = ?");
      values.push(approvalStatus);

      if (req.body.is_approved === undefined) {
        updates.push("is_approved = ?");
        values.push(approvalStatus === "approved" ? 1 : 0);
      }
    }

    if (req.body.is_approved !== undefined) {
      updates.push("is_approved = ?");
      values.push(req.body.is_approved ? 1 : 0);
    }

    if (req.body.rejection_reason !== undefined) {
      const rejectionReason = req.body.rejection_reason === null ? null : String(req.body.rejection_reason);
      updates.push("rejection_reason = ?");
      values.push(rejectionReason);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No editable video fields were provided" });
    }

    values.push(videoId);
    await db.execute(
      `UPDATE videos SET ${updates.join(", ")} WHERE id = ?`,
      values
    );

    const [updatedRows] = await db.execute(
      `SELECT v.*, u.username
       FROM videos v
       LEFT JOIN users u ON v.user_id = u.id
       WHERE v.id = ?
       LIMIT 1`,
      [videoId]
    );

    res.json({
      message: "Video details updated successfully",
      video: updatedRows[0]
    });
  } catch (error) {
    console.error("Edit video error:", error);
    res.status(500).json({ error: "Failed to update video details" });
  }
});

router.patch("/videos/:id/approve", async (req, res) => {
  try {
    const [result] = await db.execute(
      `UPDATE videos SET approval_status = 'approved', is_approved = 1 WHERE id = ?`,
      [req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "Video not found" });
    res.json({ message: "Video approved successfully" });
  } catch (error) {
    console.error("Approve video error:", error);
    res.status(500).json({ error: "Failed to approve video" });
  }
});

router.patch("/videos/:id/reject", async (req, res) => {
  try {
    const reason = req.body.reason || "Rejected by administrator";
    const [result] = await db.execute(
      `UPDATE videos SET approval_status = 'rejected', is_approved = 0, rejection_reason = ? WHERE id = ?`,
      [reason, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "Video not found" });
    res.json({ message: "Video rejected successfully" });
  } catch (error) {
    console.error("Reject video error:", error);
    res.status(500).json({ error: "Failed to reject video" });
  }
});

router.delete("/videos/:id", async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();
    const [videos] = await conn.execute(
      "SELECT file_path, thumbnail_path FROM videos WHERE id = ?",
      [req.params.id]
    );
    if (videos.length === 0) return res.status(404).json({ error: "Video not found" });

    await conn.beginTransaction();
    const [result] = await conn.execute("DELETE FROM videos WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Video not found" });
    }
    await conn.commit();

    await deleteFileIfPresent(getVideoFilePath(videos[0].file_path));
    await deleteFileIfPresent(getThumbnailFilePath(videos[0].thumbnail_path));
    res.json({ message: "Video and associated files deleted successfully" });
  } catch (error) {
    if (conn) await conn.rollback().catch(() => {});
    console.error("Delete video error:", error);
    res.status(500).json({ error: "Failed to delete video" });
  } finally {
    if (conn) conn.release();
  }
});

// User management
router.get("/users", async (req, res) => {
  try {
    const [users] = await db.execute(`
      SELECT id, username, email, role, age_verified, created_at, updated_at, deleted_at
      FROM users ORDER BY id DESC
    `);
    res.json({ users: users.map(publicUser) });
  } catch (error) {
    console.error("Admin users error:", error);
    res.status(500).json({ error: "Failed to load users" });
  }
});

router.post("/users", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const role = req.body.role || "user";
    const ageVerified = req.body.age_verified ? 1 : 0;

    if (username.length < 2) return res.status(400).json({ error: "Username must be at least 2 characters" });
    if (!validEmail(email)) return res.status(400).json({ error: "A valid email is required" });
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
    if (!validRole(role)) return res.status(400).json({ error: "Invalid user role" });

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await db.execute(
      `INSERT INTO users (username, email, password_hash, role, age_verified) VALUES (?, ?, ?, ?, ?)`,
      [username, email, passwordHash, role, ageVerified]
    );
    const createdUser = await getUserById(result.insertId);
    res.status(201).json({ user: publicUser(createdUser) });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "That username or email already exists" });
    console.error("Create admin user error:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

router.patch("/users/:id", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const currentUserId = getUserId(req);
    const existingUser = await getUserById(userId);
    if (!existingUser) return res.status(404).json({ error: "User not found" });

    const updates = [];
    const values = [];

    if (req.body.username !== undefined) {
      const username = String(req.body.username).trim();
      if (username.length < 2) return res.status(400).json({ error: "Username must be at least 2 characters" });
      updates.push("username = ?"); values.push(username);
    }
    if (req.body.email !== undefined) {
      const email = String(req.body.email).trim().toLowerCase();
      if (!validEmail(email)) return res.status(400).json({ error: "A valid email is required" });
      updates.push("email = ?"); values.push(email);
    }
    if (req.body.role !== undefined) {
      if (!validRole(req.body.role)) return res.status(400).json({ error: "Invalid user role" });
      if (currentUserId === userId && req.body.role !== "admin") return res.status(400).json({ error: "You cannot remove your own admin role" });
      if (existingUser.role === "admin" && req.body.role !== "admin" && await isLastActiveAdmin(userId)) return res.status(400).json({ error: "The last active admin cannot be demoted" });
      updates.push("role = ?"); values.push(req.body.role);
    }
    if (req.body.age_verified !== undefined) { updates.push("age_verified = ?"); values.push(req.body.age_verified ? 1 : 0); }
    if (req.body.password !== undefined) {
      const password = String(req.body.password);
      if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
      updates.push("password_hash = ?"); values.push(await bcrypt.hash(password, 10));
    }
    if (req.body.active !== undefined) {
      const active = Boolean(req.body.active);
      if (!active && currentUserId === userId) return res.status(400).json({ error: "You cannot deactivate your own account" });
      if (!active && existingUser.role === "admin" && existingUser.deleted_at === null && await isLastActiveAdmin(userId)) return res.status(400).json({ error: "The last active admin cannot be deactivated" });
      updates.push("deleted_at = ?"); values.push(active ? null : new Date());
    }
    if (updates.length === 0) return res.status(400).json({ error: "No changes were provided" });

    values.push(userId);
    await db.execute(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, values);
    const updatedUser = await getUserById(userId);
    res.json({ user: publicUser(updatedUser) });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "That username or email already exists" });
    console.error("Update admin user error:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const currentUserId = getUserId(req);
    const existingUser = await getUserById(userId);
    if (!existingUser) return res.status(404).json({ error: "User not found" });
    if (currentUserId === userId) return res.status(400).json({ error: "You cannot delete your own account" });
    if (existingUser.role === "admin" && existingUser.deleted_at === null && await isLastActiveAdmin(userId)) return res.status(400).json({ error: "The last active admin cannot be deleted" });
    await db.execute("DELETE FROM users WHERE id = ?", [userId]);
    res.json({ message: "User permanently deleted" });
  } catch (error) {
    console.error("Delete admin user error:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

module.exports = router;
