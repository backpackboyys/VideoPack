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
const AGE_GATE_MAX_AGE = 12 * 60 * 60 * 1000;

function getCookie(req, name) {
  const cookies = req.headers.cookie
    ? req.headers.cookie.split(";")
    : [];

  const cookie = cookies.find((item) =>
    item.trim().startsWith(`${name}=`)
  );

  return cookie
    ? decodeURIComponent(
        cookie.trim().substring(name.length + 1)
      )
    : null;
}

function hasValidAgeGate(req) {
  const token = getCookie(req, AGE_GATE_COOKIE);

  if (!token) {
    return false;
  }

  try {
    const payload = jwt.verify(
      token,
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
      error: "Age verification is required first"
    });
  }

  next();
}

// Age gate must be completed before authentication.
router.post("/age-gate", (req, res) => {
  const { confirmed } = req.body;

  if (confirmed !== true) {
    return res.status(403).json({
      error: "Age verification was not accepted"
    });
  }

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

  res.cookie(AGE_GATE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: AGE_GATE_MAX_AGE,
    path: "/"
  });

  res.json({
    message: "Age verification accepted"
  });
});

// Register.
router.post(
  "/register",
  requireAgeGate,
  [
    body("username").isLength({ min: 3 }).trim(),
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 })
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

      const [existingUser] = await conn.execute(
        `
        SELECT id
        FROM users
        WHERE email = ? OR username = ?
        `,
        [email, username]
      );

      if (existingUser.length > 0) {
        return res.status(400).json({
          error: "User already exists"
        });
      }

      const hashedPassword = await bcrypt.hash(
        password,
        10
      );

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
          hashedPassword
        ]
      );

      res.status(201).json({
        message:
          "User registered successfully. Please log in."
      });
    } catch (error) {
      console.error("Registration error:", error);

      res.status(500).json({
        error: "Registration failed"
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
    body("email").isEmail().normalizeEmail(),
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
          error: "Invalid credentials"
        });
      }

      const user = users[0];

      const passwordMatch =
        await bcrypt.compare(
          password,
          user.password_hash
        );

      if (!passwordMatch) {
        return res.status(401).json({
          error: "Invalid credentials"
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
        error: "Login failed"
      });
    } finally {
      if (conn) {
        conn.release();
      }
    }
  }
);

module.exports = router;
