const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

// Get current user profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const conn = await db.getConnection();

    const [users] = await conn.execute(`
      SELECT id, username, email, age_verified, age_verified_date, profile_picture, bio
      FROM users
      WHERE id = ?
    `, [req.user.id]);

    conn.release();

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(users[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Mark age as verified (placeholder for age verification service)
router.post('/verify-age', authMiddleware, async (req, res) => {
  try {
    const { method, verification_id } = req.body;
    
    if (!method) {
      return res.status(400).json({ error: 'Verification method required' });
    }

    const conn = await db.getConnection();

    // Update user age verification status
    await conn.execute(`
      UPDATE users
      SET age_verified = TRUE, age_verified_date = NOW()
      WHERE id = ?
    `, [req.user.id]);

    // Record verification
    await conn.execute(`
      INSERT INTO age_verifications (user_id, verification_method, verification_id, status)
      VALUES (?, ?, ?, 'verified')
    `, [req.user.id, method, verification_id || null]);

    conn.release();

    res.json({ message: 'Age verification completed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Age verification failed' });
  }
});

// Update user profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { bio, profile_picture } = req.body;
    const conn = await db.getConnection();

    await conn.execute(`
      UPDATE users
      SET bio = ?, profile_picture = ?
      WHERE id = ?
    `, [bio || null, profile_picture || null, req.user.id]);

    conn.release();

    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get user by ID (public profile)
router.get('/:id', async (req, res) => {
  try {
    const conn = await db.getConnection();

    const [users] = await conn.execute(`
      SELECT id, username, profile_picture, bio
      FROM users
      WHERE id = ?
    `, [req.params.id]);

    conn.release();

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(users[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
