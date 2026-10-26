const express = require('express');
const { db, SUBJECTS } = require('../db');
const { requireAdmin, publicUser, cleanUrl, str, numericId } = require('../helpers');
const { removeBlob } = require('../storage');

const router = express.Router();
router.param('id', numericId);
router.use('/admin', requireAdmin);

const flag = (v) => (v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0);

router.get('/admin/stats', async (req, res) => {
  res.json(await db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM notes WHERE status = 'pending') AS pending_notes,
      (SELECT COUNT(*) FROM notes WHERE status = 'approved') AS approved_notes,
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM users WHERE redlisted = 1) AS redlisted,
      (SELECT COUNT(*) FROM users WHERE status = 'blocked') AS blocked,
      (SELECT COUNT(*) FROM reports WHERE status = 'open') AS open_reports,
      (SELECT COUNT(*) FROM tests) AS tests,
      (SELECT COUNT(*) FROM awards) AS awards
  `).get());
});

// ---- Note review ----

router.get('/admin/notes', async (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  const rows = await db.prepare(`
    SELECT n.*, u.username, u.avatar AS user_avatar, u.redlisted AS user_redlisted
    FROM notes n JOIN users u ON u.id = n.user_id
    WHERE n.status = ? ORDER BY n.created_at ${status === 'pending' ? 'ASC' : 'DESC'} LIMIT 200
  `).all(status);
  res.json(rows.map((n) => ({
    id: n.id, title: n.title, subject: n.subject, description: n.description,
    has_file: !!n.file_path, file_name: n.file_name, file_mime: n.file_mime,
    video_url: n.video_url, audio_url: n.audio_url,
    video_enabled: !!n.video_enabled, audio_enabled: !!n.audio_enabled,
    status: n.status, admin_note: n.admin_note, created_at: n.created_at, reviewed_at: n.reviewed_at,
    user: { id: n.user_id, username: n.username, avatar: n.user_avatar, redlisted: !!n.user_redlisted },
  })));
});

router.put('/admin/notes/:id/approve', async (req, res) => {
  const n = await db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  if (!n) return res.status(404).json({ error: 'Note not found' });
  const video_url = req.body.video_url !== undefined ? cleanUrl(req.body.video_url) : n.video_url;
  const audio_url = req.body.audio_url !== undefined ? cleanUrl(req.body.audio_url) : n.audio_url;
  await db.prepare(`
    UPDATE notes SET status = 'approved', video_url = ?, audio_url = ?, video_enabled = ?, audio_enabled = ?,
      admin_note = ?, reviewed_at = now() WHERE id = ?
  `).run(
    video_url, audio_url,
    video_url ? flag(req.body.video_enabled) : 0, audio_url ? flag(req.body.audio_enabled) : 0,
    str(req.body.admin_note, 500), n.id,
  );
  res.json({ ok: true });
});

// Discard: keep the record so the uploader sees why, but delete the stored file.
router.put('/admin/notes/:id/reject', async (req, res) => {
  const n = await db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  if (!n) return res.status(404).json({ error: 'Note not found' });
  await removeBlob(n.file_path);
  await db.prepare(`
    UPDATE notes SET status = 'rejected', file_path = '', video_enabled = 0, audio_enabled = 0,
      admin_note = ?, reviewed_at = now() WHERE id = ?
  `).run(str(req.body.admin_note, 500) || 'Discarded by admin', n.id);
  res.json({ ok: true });
});

// ---- Users & red list ----

router.get('/admin/users', async (req, res) => {
  const where = [];
  const params = [];
  if (req.query.filter === 'redlist') where.push('redlisted = 1');
  if (req.query.filter === 'blocked') where.push("status = 'blocked'");
  if (req.query.q) {
    where.push('(username ILIKE ? OR full_name ILIKE ?)');
    params.push(`%${req.query.q}%`, `%${req.query.q}%`);
  }
  const rows = await db.prepare(`
    SELECT u.*,
      (SELECT COUNT(*) FROM reports r WHERE r.target_user_id = u.id AND r.status = 'open') AS open_reports,
      (SELECT COUNT(*) FROM notes n WHERE n.user_id = u.id) AS note_count
    FROM users u ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY u.redlisted DESC, open_reports DESC, u.created_at DESC LIMIT 300
  `).all(...params);
  res.json(rows.map((u) => ({
    ...publicUser(u), redlist_reason: u.redlist_reason, open_reports: u.open_reports, note_count: u.note_count,
  })));
});

router.put('/admin/users/:id', async (req, res) => {
  const u = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  if (u.id === req.user.id) return res.status(400).json({ error: 'You cannot change your own account here' });
  const redlisted = req.body.redlisted !== undefined ? flag(req.body.redlisted) : u.redlisted;
  const reason = req.body.redlist_reason !== undefined ? str(req.body.redlist_reason, 300) : u.redlist_reason;
  const status = ['active', 'blocked'].includes(req.body.status) ? req.body.status : u.status;
  const role = ['user', 'admin'].includes(req.body.role) ? req.body.role : u.role;
  await db.prepare('UPDATE users SET redlisted = ?, redlist_reason = ?, status = ?, role = ? WHERE id = ?')
    .run(redlisted, redlisted ? reason : '', status, role, u.id);
  res.json({ ok: true });
});

router.delete('/admin/users/:id', async (req, res) => {
  const u = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  if (u.id === req.user.id) return res.status(400).json({ error: 'You cannot remove yourself' });
  const files = await db.prepare('SELECT file_path FROM notes WHERE user_id = ?').all(u.id);
  await Promise.all([...files.map((n) => removeBlob(n.file_path)), removeBlob(u.avatar)]);
  await db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
  res.json({ ok: true });
});

// ---- Reports ----

router.get('/admin/reports', async (req, res) => {
  const status = req.query.status === 'resolved' ? 'resolved' : 'open';
  res.json(await db.prepare(`
    SELECT r.*, rep.username AS reporter, tgt.username AS target, tgt.redlisted AS target_redlisted,
      tgt.status AS target_status, p.body AS post_body, c.body AS comment_body
    FROM reports r
    JOIN users rep ON rep.id = r.reporter_id
    LEFT JOIN users tgt ON tgt.id = r.target_user_id
    LEFT JOIN posts p ON p.id = r.post_id
    LEFT JOIN comments c ON c.id = r.comment_id
    WHERE r.status = ? ORDER BY r.created_at DESC LIMIT 200
  `).all(status));
});

router.put('/admin/reports/:id/resolve', async (req, res) => {
  await db.prepare("UPDATE reports SET status = 'resolved' WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ---- Mock tests ----

router.get('/admin/tests', async (req, res) => {
  res.json(await db.prepare(`
    SELECT t.*, (SELECT COUNT(*) FROM questions q WHERE q.test_id = t.id) AS question_count,
      (SELECT COUNT(*) FROM attempts a WHERE a.test_id = t.id) AS attempt_count
    FROM tests t ORDER BY t.created_at DESC
  `).all());
});

function testFields(body) {
  const title = str(body.title, 120);
  const subject = str(body.subject, 80);
  if (!title) return { error: 'Title is required' };
  if (!SUBJECTS.includes(subject)) return { error: 'Choose a subject' };
  const duration = Math.min(Math.max(parseInt(body.duration_min, 10) || 15, 1), 240);
  return { title, subject, description: str(body.description, 500), duration };
}

router.post('/admin/tests', async (req, res) => {
  const f = testFields(req.body);
  if (f.error) return res.status(400).json(f);
  const { lastInsertRowid } = await db.prepare(
    'INSERT INTO tests (title, subject, description, duration_min, created_by) VALUES (?, ?, ?, ?, ?)',
  ).run(f.title, f.subject, f.description, f.duration, req.user.id);
  res.status(201).json({ id: Number(lastInsertRowid) });
});

router.get('/admin/tests/:id', async (req, res) => {
  const t = await db.prepare('SELECT * FROM tests WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Test not found' });
  t.questions = await db.prepare('SELECT * FROM questions WHERE test_id = ? ORDER BY id').all(t.id);
  res.json(t);
});

router.put('/admin/tests/:id', async (req, res) => {
  const t = await db.prepare('SELECT * FROM tests WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Test not found' });
  const f = testFields({ ...t, ...req.body });
  if (f.error) return res.status(400).json(f);
  const published = req.body.published !== undefined ? flag(req.body.published) : t.published;
  await db.prepare('UPDATE tests SET title = ?, subject = ?, description = ?, duration_min = ?, published = ? WHERE id = ?')
    .run(f.title, f.subject, f.description, f.duration, published, t.id);
  res.json({ ok: true });
});

router.delete('/admin/tests/:id', async (req, res) => {
  await db.prepare('DELETE FROM tests WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/admin/tests/:id/questions', async (req, res) => {
  if (!await db.prepare('SELECT 1 FROM tests WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Test not found' });
  const q = {
    question: str(req.body.question, 1000),
    a: str(req.body.opt_a, 300), b: str(req.body.opt_b, 300), c: str(req.body.opt_c, 300), d: str(req.body.opt_d, 300),
  };
  if (!q.question || !q.a || !q.b || !q.c || !q.d) return res.status(400).json({ error: 'Fill in the question and all four options' });
  if (!['a', 'b', 'c', 'd'].includes(req.body.correct)) return res.status(400).json({ error: 'Pick the correct option' });
  await db.prepare(`
    INSERT INTO questions (test_id, question, opt_a, opt_b, opt_c, opt_d, correct, explanation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, q.question, q.a, q.b, q.c, q.d, req.body.correct, str(req.body.explanation, 1000));
  res.status(201).json({ ok: true });
});

router.delete('/admin/questions/:id', async (req, res) => {
  await db.prepare('DELETE FROM questions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
