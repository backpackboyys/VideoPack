const db = require("../config/database");
const { authMiddleware } = require("./authMiddleware");

const adminMiddleware = [
  authMiddleware,
  async (req, res, next) => {
    try {
      const [users] = await db.execute(
        "SELECT id, role FROM users WHERE id = ?",
        [req.user.id]
      );

      if (users.length === 0 || users[0].role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      req.user.role = users[0].role;
      next();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Authorization check failed" });
    }
  }
];

module.exports = adminMiddleware;
