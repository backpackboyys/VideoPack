const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
  body,
  validationResult
} = require("express-validator");

const db = require("../config/database");

const router = express.Router();

const AGE_GATE_COOKIE = "age_gate";
const AGE_GATE_DURATION =
  12 * 60 * 60 * 1000;

function getCookie(req, cookieName) {
  const cookieHeader = req.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";");

  for (const cookie of cookies) {
    const separatorIndex = cookie.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const name = cookie
      .slice(0, separatorIndex)
      .trim();

    const value = cookie
      .slice(separatorIndex + 1)
      .trim();

    if (name === cookieName) {
      return decodeURIComponent(value);
    }
  }

  return null;
}

function hasValidAgeGate(req) {
  const ageGateToken = getCookie(
    req,
    AGE_GATE_COOKIE
  );

  if (!ageGateToken) {
    return false;
  }

  try {
    const payload = jwt.verify(
      ageGateToken,
      process.env.JWT_SECRET
    );

    return (
      payload.purpose === "age-gate" &&
      payload.confirmed === true
    );
  } catch {
    return false;
  }
}

function requireAgeGate(req, res, next) {
  if (!hasValidAgeGate(req)) {
    return res.status(403).json({
      error:
        "Age verification is required before authentication."
    });
  }

  next();
}

function setAgeGateCookie(res) {
  const token = jwt.sign(
    {
      purpose: "age-gate",
      confirmed: true
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "12h"
    }
  );

  const isProduction =
    process.env.NODE_ENV === "production";

  const cookieParts = [
    `${AGE_GATE_COOKIE}=${encodeURIComponent(
      token
    )}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${AGE_GATE_DURATION / 1000}`
  ];

  if (isProduction) {
    cookieParts.push("Secure");
  }

  res.setHeader(
    "Set-Cookie",
    cookieParts.join("; ")
  );
}

// Public age-gate endpoint.
router.post("/age-gate", (req, res) => {
  if (req.body?.confirmed !== true) {
    return res.status(403).json({
      error:
        "You must confirm that you are at least 18 years old."
    });
  }

  setAgeGateCookie(res);

  res.json({
    message: "Age verification accepted."
  });
});

// Optional status endpoint for troubleshooting.
router.get("/age-gate/status", (req, res) => {
  res.json({
    verified: hasValidAgeGate(req)
  });
});

// Registration.
router.post(
  "/register",
  requireAgeGate,
  [
    body("username")
      .isLength({ min: 3 })
      .trim(),

    body("email")
      .isEmail()
      .normalizeEmail(),

    body("password")
      .isLength({ min: 6 })
  ],
  async (req, res) => {
    let conn;

    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({
          errors: errors.array()
        });
      }

      const {
        username,
        email,
        password
      } = req.body;

      conn = await db.getConnection();

      const [existingUsers] =
        await conn.execute(
          `
          SELECT id
          FROM users
          WHERE email = ? OR username = ?
          `,
          [email, username]
        );

      if (existingUsers.length > 0) {
        return res.status(400).json({
          error: "User already exists."
        });
      }

      const passwordHash =
        await bcrypt.hash(password, 10);

      await conn.execute(
        `
        INSERT INTO users
          (
            username,
            email,
            password_hash,
            age_verified
          )
        VALUES (?, ?, ?, 1)
        `,
        [
          username,
          email,
          passwordHash
        ]
      );

      res.status(201).json({
        message:
          "Registration successful. Please log in."
      });
    } catch (error) {
      console.error(
        "Registration error:",
        error
      );

      res.status(500).json({
        error: "Registration failed."
      });
    } finally {
      if (conn) {
        conn.release();
      }
    }
  }
);

// Login.
router.post(
  "/login",
  requireAgeGate,
  [
    body("email")
      .isEmail()
      .normalizeEmail(),

    body("password").exists()
  ],
  async (req, res) => {
    let conn;

    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({
          errors: errors.array()
        });
      }

      const {
        email,
        password
      } = req.body;

      conn = await db.getConnection();

      const [users] = await conn.execute(
        `
        SELECT
          id,
          username,
          email,
          password_hash,
          age_verified,
          role
        FROM users
        WHERE email = ?
        `,
        [email]
      );

      if (users.length === 0) {
        return res.status(401).json({
          error: "Invalid credentials."
        });
      }

      const user = users[0];

      const passwordMatches =
        await bcrypt.compare(
          password,
          user.password_hash
        );

      if (!passwordMatches) {
        return res.status(401).json({
          error: "Invalid credentials."
        });
      }

      await conn.execute(
        `
        UPDATE users
        SET age_verified = 1
        WHERE id = ?
        `,
        [user.id]
      );

      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "7d"
        }
      );

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          age_verified: 1,
          role: user.role
        }
      });
    } catch (error) {
      console.error("Login error:", error);

      res.status(500).json({
        error: "Login failed."
      });
    } finally {
      if (conn) {
        conn.release();
      }
    }
  }
);

module.exports = router;
