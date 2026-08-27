const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");

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
  if (!storedPath) return null;
  return path.join(videosDirectory, path.basename(storedPath));
}

function getThumbnailFilePath(storedPath) {
  if (!storedPath) return null;
  return path.join(thumbnailsDirectory, path.basename(storedPath));
}

async function deleteFileIfPresent(filePath) {
  if (!filePath) return;

  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Uploaded file cleanup error:", error);
    }
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
  return typeof email === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
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
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [userId]
  );

  return rows[0] || null;
}

async function isLastActiveAdmin(userId) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS count
     FROM users
     WHERE role = 'admin'
       AND deleted_at IS NULL
       AND id <> ?`,
    [userId]
  );

  return Number(rows[0].count) === 0;
}

// Get all videos for the admin dashboard.
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

// Get videos waiting for approval.
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

// Approve a video.
router.patch("/videos/:id/approve", async (req, res) => {
  try {
    const [result] = await db.execute(
      `UPDATE videos
       SET approval_status = 'approved', is_approved = 1
       WHERE id = ?`,
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Video not found" });
    }

    res.json({ message: "Video approved successfully" });
  } catch (error) {
    console.error("Approve video error:", error);
    res.status(500).json({ error: "Failed to approve video" });
  }
});

// Reject a video.
router.patch("/videos/:id/reject", async (req, res) => {
  try {
    const reason = req.body.reason || "Rejected by administrator";

    const [result] = await db.execute(
      `UPDATE videos
       SET approval_status = 'rejected',
           is_approved = 0,
           rejection_reason = ?
       WHERE id = ?`,
      [reason, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Video not found" });
    }

    res.json({ message: "Video rejected successfully" });
  } catch (error) {
    console.error("Reject video error:", error);
    res.status(500).json({ error: "Failed to reject video" });
  }
});

// Permanently delete a video and its uploaded files.
router.delete("/videos/:id", async (req, res) => {
  let conn;

  try {
    conn = await db.getConnection();

    const [videos] = await conn.execute(
      `SELECT file_path, thumbnail_path FROM videos WHERE id = ?`,
      [req.params.id]
    );

    if (videos.length === 0) {
      return res.status(404).json({ error: "Video not found" });
    }

    await conn.beginTransaction();

    const [result] = await conn.execute(
      `DELETE FROM videos WHERE id = ?`,
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Video not found" });
    }

    await conn.commit();

    await deleteFileIfPresent(getVideoFilePath(videos[0].file_path));
    await deleteFileIfPresent(getThumbnailFilePath(videos[0].thumbnail_path));

    res.json({ message: "Video and associated files deleted successfully" });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (rollbackError) {
        console.error("Rollback error:", rollbackError);
      }
    }

    console.error("Delete video error:", error);
    res.status(500).json({ error: "Failed to delete video" });
  } finally {
    if (conn) conn.release();
  }
});

// Get all user accounts. Password hashes are never returned.
router.get("/users", async (req, res) => {
  try {
    const [users] = await db.execute(
      `SELECT id, username, email, role, age_verified,
              created_at, updated_at, deleted_at
       FROM users
       ORDER BY id DESC`
    );

    res.json({ users: users.map(publicUser) });
  } catch (error) {
    console.error("Admin users error:", error);
    res.status(500).json({ error: "Failed to load users" });
  }
});

// Create a user account.
router.post("/users", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const role = req.body.role || "user";
    const ageVerified = req.body.age_verified ? 1 : 0;

    if (username.length < 2) {
      return res.status(400).json({ error: "Username must be at least 2 characters" });
    }

    if (!validEmail(email)) {
      return res.status(400).json({ error: "A valid email is required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    if (!validRole(role)) {
      return res.status(400).json({ error: "Invalid user role" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [result] = await db.execute(
      `INSERT INTO users
       (username, email, password_hash, role, age_verified)
       VALUES (?, ?, ?, ?, ?)`,
      [username, email, passwordHash, role, ageVerified]
    );

    const createdUser = await getUserById(result.insertId);
    res.status(201).json({ user: publicUser(createdUser) });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "That username or email already exists" });
    }

    console.error("Create admin user error:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// Update account details, role, password, or active status.
router.patch("/users/:id", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const currentUserId = getUserId(req);
    const existingUser = await getUserById(userId);

    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const updates = [];
    const values = [];

    if (req.body.username !== undefined) {
      const username = String(req.body.username).trim();
      if (username.length < 2) {
        return res.status(400).json({ error: "Username must be at least 2 characters" });
      }
      updates.push("username = ?");
      values.push(username);
    }

    if (req.body.email !== undefined) {
      const email = String(req.body.email).trim().toLowerCase();
      if (!validEmail(email)) {
        return res.status(400).json({ error: "A valid email is required" });
      }
      updates.push("email = ?");
      values.push(email);
    }

    if (req.body.role !== undefined) {
      const role = req.body.role;
      if (!validRole(role)) {
        return res.status(400).json({ error: "Invalid user role" });
      }

      if (currentUserId === userId && role !== "admin") {
        return res.status(400).json({ error: "You cannot remove your own admin role" });
      }

      if (existingUser.role === "admin" && role !== "admin" && await isLastActiveAdmin(userId)) {
        return res.status(400).json({ error: "The last active admin cannot be demoted" });
      }

      updates.push("role = ?");
      values.push(role);
    }

    if (req.body.age_verified !== undefined) {
      updates.push("age_verified = ?");
      values.push(req.body.age_verified ? 1 : 0);
    }

    if (req.body.password !== undefined) {
      const password = String(req.body.password);
      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }
      updates.push("password_hash = ?");
      values.push(await bcrypt.hash(password, 12));
    }

    if (req.body.active !== undefined) {
      const active = Boolean(req.body.active);

      if (!active && currentUserId === userId) {
        return res.status(400).json({ error: "You cannot deactivate your own account" });
      }

      if (!active && existingUser.role === "admin" && existingUser.deleted_at === null && await isLastActiveAdmin(userId)) {
        return res.status(400).json({ error: "The last active admin cannot be deactivated" });
      }

      updates.push("deleted_at = ?");
      values.push(active ? null : new Date());
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No changes were provided" });
    }

    values.push(userId);

    await db.execute(
      `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
      values
    );

    const updatedUser = await getUserById(userId);
    res.json({ user: publicUser(updatedUser) });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "That username or email already exists" });
    }

    console.error("Update admin user error:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// Permanently delete an account. Deactivation is preferred for normal use.
router.delete("/users/:id", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const currentUserId = getUserId(req);
    const existingUser = await getUserById(userId);

    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (currentUserId === userId) {
      return res.status(400).json({ error: "You cannot delete your own account" });
    }

    if (existingUser.role === "admin" && existingUser.deleted_at === null && await isLastActiveAdmin(userId)) {
      return res.status(400).json({ error: "The last active admin cannot be deleted" });
    }

    await db.execute(`DELETE FROM users WHERE id = ?`, [userId]);
    res.json({ message: "User permanently deleted" });
  } catch (error) {
    console.error("Delete admin user error:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

module.exports = router;
