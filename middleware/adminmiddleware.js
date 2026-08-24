const jwt = require("jsonwebtoken");
const db = require("../config/database");

async function adminMiddleware(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication token required"
      });
    }

    const token = authorization.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [users] = await db.execute(
      "SELECT id, username, email, role FROM users WHERE id = ?",
      [decoded.id]
    );

    if (users.length === 0) {
      return res.status(401).json({
        error: "User not found"
      });
    }

    if (users[0].role !== "admin") {
      return res.status(403).json({
        error: "Admin access required"
      });
    }

    req.user = users[0];
    next();
  } catch (error) {
    console.error("Admin authentication error:", error);

    return res.status(401).json({
      error: "Invalid or expired authentication token"
    });
  }
}

module.exports = adminMiddleware;
