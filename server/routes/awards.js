const express = require('express');
const { db } = require('../db');
const { requireAuth, requireAdmin, str, numericId } = require('../helpers');
const { TIERS } = require('../coins');

const router = express.Router();
router.param('id', numericId);

const AWARD_SELECT = `
  SELECT a.id, a.tier, a.points, a.reason, a.note_id, a.post_id, a.seen, a.created_at,
    n.title AS note_title, substr(p.body, 1, 120) AS post_excerpt,
    u.id AS user_id, u.username, u.avatar, u.full_name,
    b.username AS awarded_by
  FROM awards a
  JOIN users u ON u.id = a.user_id
  LEFT JOIN users b ON b.id = a.awarded_by
  LEFT JOIN notes n ON n.id = a.note_id
  LEFT JOIN posts p ON p.id = a.post_id
`;

const shape = (a) => ({
  id: a.id, tier: a.tier, points: a.points, reason: a.reason, created_at: a.created_at,
  note: a.note_id ? { id: a.note_id, title: a.note_title } : null,
  post: a.post_id ? { id: a.post_id, excerpt: a.post_excerpt } : null,
  user: { id: a.user_id, username: a.username, avatar: a.avatar, full_name: a.full_name },
  awarded_by: a.awarded_by,
});

router.get('/leaderboard', requireAuth, async (req, res) => {
  const since = req.query.period === 'month' ? "AND a.created_at >= date_trunc('month', now())" : '';
  const rows = await db.prepare(`
    SELECT u.id, u.username, u.full_name, u.avatar, u.college, u.year,
      SUM(a.points) AS points,
      COUNT(*) FILTER (WHERE a.tier = 'diamond') AS diamond, COUNT(*) FILTER (WHERE a.tier = 'gold') AS gold,
      COUNT(*) FILTER (WHERE a.tier = 'silver') AS silver, COUNT(*) FILTER (WHERE a.tier = 'bronze') AS bronze
    FROM awards a JOIN users u ON u.id = a.user_id
    WHERE u.status = 'active' ${since}
    GROUP BY u.id ORDER BY points DESC, MAX(a.created_at) ASC LIMIT 50
  `).all();
  res.json(rows.map((r) => ({
    user: { id: r.id, username: r.username, full_name: r.full_name, avatar: r.avatar, college: r.college, year: r.year },
    points: r.points,
    coins: { diamond: r.diamond, gold: r.gold, silver: r.silver, bronze: r.bronze },
  })));
});

router.get('/users/:username/awards', requireAuth, async (req, res) => {
  const rows = await db.prepare(`${AWARD_SELECT} WHERE u.username = ? ORDER BY a.created_at DESC, a.id DESC LIMIT 100`)
    .all(req.params.username);
  res.json(rows.map(shape));
});

router.get('/me/awards/unseen', requireAuth, async (req, res) => {
  res.json((await db.prepare(`${AWARD_SELECT} WHERE a.user_id = ? AND a.seen = 0 ORDER BY a.id`).all(req.user.id)).map(shape));
});

router.post('/me/awards/seen', requireAuth, async (req, res) => {
  await db.prepare('UPDATE awards SET seen = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

// ---- Admin ----

router.get('/admin/awards', requireAdmin, async (req, res) => {
  res.json((await db.prepare(`${AWARD_SELECT} ORDER BY a.created_at DESC, a.id DESC LIMIT 100`).all()).map(shape));
});

router.post('/admin/awards', requireAdmin, async (req, res) => {
  const tier = String(req.body.tier || '');
  if (!(tier in TIERS)) return res.status(400).json({ error: 'Pick a coin: diamond, gold, silver or bronze' });

  const noteId = req.body.note_id ? Number(req.body.note_id) : null;
  const postId = req.body.post_id ? Number(req.body.post_id) : null;
  let userId = req.body.user_id ? Number(req.body.user_id) : null;
  // When awarding for a piece of content, the coin always goes to its author.
  if (noteId) {
    const n = await db.prepare('SELECT user_id FROM notes WHERE id = ?').get(noteId);
    if (!n) return res.status(404).json({ error: 'Note not found' });
    userId = n.user_id;
  } else if (postId) {
    const p = await db.prepare('SELECT user_id FROM posts WHERE id = ?').get(postId);
    if (!p) return res.status(404).json({ error: 'Post not found' });
    userId = p.user_id;
  }
  const target = userId && await db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot award coins to yourself' });

  const { lastInsertRowid } = await db.prepare(`
    INSERT INTO awards (user_id, tier, points, reason, note_id, post_id, awarded_by) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(target.id, tier, TIERS[tier], str(req.body.reason, 200), noteId, postId, req.user.id);
  res.status(201).json({ id: Number(lastInsertRowid), points: TIERS[tier] });
});

router.delete('/admin/awards/:id', requireAdmin, async (req, res) => {
  await db.prepare('DELETE FROM awards WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
