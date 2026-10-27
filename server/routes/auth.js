const express = require('express');
const bcrypt = require('bcryptjs');
const { db, SUBJECTS, EXAMS } = require('../db');
const { publicUser, requireAuth, str } = require('../helpers');
const { avatarUpload, saveAvatar, removeBlob } = require('../storage');
const { coinSummary } = require('../coins');

const router = express.Router();
const USERNAME_RE = /^[a-z0-9._]{3,24}$/i;

router.get('/subjects', (req, res) => res.json(SUBJECTS));
router.get('/exams', (req, res) => res.json(EXAMS));

router.get('/auth/me', async (req, res) => {
  if (!req.user) return res.json({ user: null });
  res.json({ user: { ...publicUser(req.user), points: (await coinSummary(req.user.id)).points } });
});

router.post('/auth/register', async (req, res) => {
  const username = str(req.body.username, 24);
  const password = String(req.body.password || '');
  const full_name = str(req.body.full_name, 60);
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-24 letters, numbers, dots or underscores' });
  }
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (await db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) {
    return res.status(409).json({ error: 'That username is taken' });
  }
  const { lastInsertRowid } = await db
    .prepare('INSERT INTO users (username, password_hash, full_name) VALUES (?, ?, ?)')
    .run(username, bcrypt.hashSync(password, 10), full_name);
  req.session = { userId: Number(lastInsertRowid) };
  const u = await db.prepare('SELECT * FROM users WHERE id = ?').get(lastInsertRowid);
  res.status(201).json({ user: publicUser(u) });
});

router.post('/auth/login', async (req, res) => {
  const username = str(req.body.username, 24);
  const password = String(req.body.password || '');
  const u = await db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!u || !bcrypt.compareSync(password, u.password_hash)) {
    return res.status(401).json({ error: 'Incorrect username or password' });
  }
  if (u.status === 'blocked') {
    return res.status(403).json({ error: 'This account has been blocked by an admin' });
  }
  req.session = { userId: u.id };
  res.json({ user: publicUser(u) });
});

router.post('/auth/logout', async (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

router.get('/users/:username', requireAuth, async (req, res) => {
  const u = await db.prepare('SELECT * FROM users WHERE username = ?').get(req.params.username);
  if (!u) return res.status(404).json({ error: 'User not found' });
  const counts = await db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM notes WHERE user_id = ? AND status = 'approved') AS notes,
      (SELECT COUNT(*) FROM posts WHERE user_id = ?) AS posts,
      (SELECT COUNT(*) FROM attempts WHERE user_id = ?) AS tests,
      (SELECT COALESCE(SUM(downloads), 0) FROM notes WHERE user_id = ?) AS downloads
  `).get(u.id, u.id, u.id, u.id);
  res.json({ user: publicUser(u), counts, ...(await coinSummary(u.id)) });
});

router.put('/me', requireAuth, avatarUpload.single('avatar'), async (req, res) => {
  const u = req.user;
  let avatar = u.avatar;
  if (req.file) {
    avatar = await saveAvatar(u.id, req.file);
    await removeBlob(u.avatar);
  }
  await db.prepare('UPDATE users SET full_name = ?, bio = ?, college = ?, year = ?, avatar = ? WHERE id = ?').run(
    str(req.body.full_name, 60), str(req.body.bio, 300), str(req.body.college, 100), str(req.body.year, 30),
    avatar, u.id,
  );
  res.json({ user: publicUser(await db.prepare('SELECT * FROM users WHERE id = ?').get(u.id)) });
});

router.put('/me/password', requireAuth, async (req, res) => {
  const { current, next } = req.body;
  if (!bcrypt.compareSync(String(current || ''), req.user.password_hash)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  if (String(next || '').length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(String(next), 10), req.user.id);
  res.json({ ok: true });
});

module.exports = router;
