const express = require("express");
const router = express.Router();

const db = require("../config/database");
const adminMiddleware = require("../middleware/adminMiddleware");

// Every route in this file requires an authenticated admin
router.use(adminMiddleware);

// Get videos waiting for approval
router.get("/videos/pending", async (req, res) => {
  try {
    const [videos] = await db.execute(
      `SELECT *
       FROM videos
       WHERE approval_status = 'pending'
       ORDER BY id DESC`
    );

    res.json({ videos });
  } catch (error) {
    console.error("Pending videos error:", error);
    res.status(500).json({ error: "Failed to load pending videos" });
  }
});

// Approve a video
router.patch("/videos/:id/approve", async (req, res) => {
  try {
    const [result] = await db.execute(
      `UPDATE videos
       SET approval_status = 'approved',
           is_approved = 1
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

// Reject a video
router.patch("/videos/:id/reject", async (req, res) => {
  try {
    const reason = req.body.reason || null;

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

// Delete a video
router.delete("/videos/:id", async (req, res) => {
  try {
    const [result] = await db.execute(
      "DELETE FROM videos WHERE id = ?",
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Video not found" });
    }

    res.json({ message: "Video deleted successfully" });
  } catch (error) {
    console.error("Delete video error:", error);
    res.status(500).json({ error: "Failed to delete video" });
  }
});

module.exports = router;
