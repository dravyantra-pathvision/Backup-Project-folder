// routes/notificationRoutes.js
const router = require('express').Router();
const { pool } = require('../config/dbconfig');

// GET /api/notifications — returns the user's notifications
router.get('/', async (req, res) => {
  const uid = req.user?.uid;
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = await pool.query(
      `SELECT id, uid, type, title, message, is_read, created_at
       FROM notifications
       WHERE uid = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [uid]
    );
    res.json(result.rows);
  } catch (e) {
    console.error('Error fetching notifications:', e.message);
    res.json([]); // return empty array instead of error to not break the app
  }
});

// PUT /api/notifications/:id/read — mark notification as read
router.put('/:id/read', async (req, res) => {
  const uid = req.user?.uid;
  const { id } = req.params;
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  try {
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND uid = $2',
      [id, uid]
    );
    res.json({ success: true });
  } catch (e) {
    console.error('Error marking notification read:', e.message);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// PUT /api/notifications/read-all — mark all as read
router.put('/read-all', async (req, res) => {
  const uid = req.user?.uid;
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  try {
    await pool.query('UPDATE notifications SET is_read = true WHERE uid = $1', [uid]);
    res.json({ success: true });
  } catch (e) {
    console.error('Error marking all notifications read:', e.message);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

module.exports = router;
