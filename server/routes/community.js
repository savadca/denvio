const express = require('express');
const { db } = require('../db');
const { requireAuth, str, numericId } = require('../helpers');
const { countTiers } = require('../coins');

const router = express.Router();
router.param('id', numericId);

const author = (r) => ({ id: r.user_id, username: r.username, avatar: r.avatar, full_name: r.full_name });

// Red-listed users can still read discussions, but cannot post until an admin clears them.
function canWrite(req, res, next) {
  if (req.user.redlisted) {
    return res.status(403).json({ error: 'Your account is red-listed. Posting is disabled until an admin reviews it.' });
  }
  next();
}

router.get('/posts', requireAuth, async (req, res) => {
  const params = [];
  let where = '';
  if (req.query.subject) {
    where = 'WHERE p.subject = ?';
    params.push(String(req.query.subject));
  }
  const rows = await db.prepare(`
    SELECT p.*, u.username, u.avatar, u.full_name,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
      (SELECT string_agg(a.tier, ',') FROM awards a WHERE a.post_id = p.id) AS award_tiers
    FROM posts p JOIN users u ON u.id = p.user_id
    ${where} ORDER BY p.created_at DESC, p.id DESC LIMIT 100
  `).all(...params);
  res.json(rows.map((r) => ({
    id: r.id, subject: r.subject, body: r.body, created_at: r.created_at,
    comment_count: r.comment_count, coins: countTiers(r.award_tiers), user: author(r),
  })));
});

router.post('/posts', requireAuth, canWrite, async (req, res) => {
  const body = str(req.body.body, 3000);
  if (!body) return res.status(400).json({ error: 'Write something first' });
  const { lastInsertRowid } = await db.prepare('INSERT INTO posts (user_id, subject, body) VALUES (?, ?, ?)')
    .run(req.user.id, str(req.body.subject, 80), body);
  res.status(201).json({ id: Number(lastInsertRowid) });
});

router.get('/posts/:id', requireAuth, async (req, res) => {
  const p = await db.prepare(`
    SELECT p.*, u.username, u.avatar, u.full_name,
      (SELECT string_agg(a.tier, ',') FROM awards a WHERE a.post_id = p.id) AS award_tiers
    FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = ?
  `).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Discussion not found' });
  const comments = await db.prepare(`
    SELECT c.*, u.username, u.avatar, u.full_name FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.post_id = ? ORDER BY c.created_at, c.id
  `).all(p.id);
  res.json({
    id: p.id, subject: p.subject, body: p.body, created_at: p.created_at, user: author(p), coins: countTiers(p.award_tiers),
    comments: comments.map((c) => ({ id: c.id, body: c.body, created_at: c.created_at, user: author(c) })),
  });
});

router.post('/posts/:id/comments', requireAuth, canWrite, async (req, res) => {
  const body = str(req.body.body, 1000);
  if (!body) return res.status(400).json({ error: 'Comment cannot be empty' });
  if (!await db.prepare('SELECT 1 FROM posts WHERE id = ?').get(req.params.id)) {
    return res.status(404).json({ error: 'Discussion not found' });
  }
  await db.prepare('INSERT INTO comments (post_id, user_id, body) VALUES (?, ?, ?)').run(req.params.id, req.user.id, body);
  res.status(201).json({ ok: true });
});

function deleteOwned(table) {
  return async (req, res) => {
    const row = await db.prepare(`SELECT user_id FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (row.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not allowed' });
    await db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(req.params.id);
    res.json({ ok: true });
  };
}

router.delete('/posts/:id', requireAuth, deleteOwned('posts'));
router.delete('/comments/:id', requireAuth, deleteOwned('comments'));

router.post('/reports', requireAuth, async (req, res) => {
  const reason = str(req.body.reason, 500);
  if (!reason) return res.status(400).json({ error: 'Tell us what is wrong' });
  const id = (v) => (v ? Number(v) : null);
  let target = id(req.body.target_user_id);
  const postId = id(req.body.post_id);
  const commentId = id(req.body.comment_id);
  if (!target && postId) target = (await db.prepare('SELECT user_id FROM posts WHERE id = ?').get(postId))?.user_id ?? null;
  if (!target && commentId) target = (await db.prepare('SELECT user_id FROM comments WHERE id = ?').get(commentId))?.user_id ?? null;
  if (!target) return res.status(400).json({ error: 'Nothing to report' });
  await db.prepare('INSERT INTO reports (reporter_id, target_user_id, post_id, comment_id, reason) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.id, target, postId, commentId, reason);
  res.status(201).json({ ok: true });
});

module.exports = router;
