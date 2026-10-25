const express = require('express');
const bcrypt = require('bcryptjs');
const { db, SUBJECTS } = require('../db');
const { publicUser, requireAuth, str } = require('../helpers');
const { avatarUpload, AVATAR_DIR, removeFile } = require('../uploads');
const { coinSummary } = require('../coins');

const router = express.Router();
const USERNAME_RE = /^[a-z0-9._]{3,24}$/i;

router.get('/subjects', (req, res) => res.json(SUBJECTS));

router.get('/auth/me', (req, res) => {
  if (!req.user) return res.json({ user: null });
  res.json({ user: { ...publicUser(req.user), points: coinSummary(req.user.id).points } });
});

router.post('/auth/register', (req, res) => {
  const username = str(req.body.username, 24);
  const password = String(req.body.password || '');
  const full_name = str(req.body.full_name, 60);
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-24 letters, numbers, dots or underscores' });
  }
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) {
    return res.status(409).json({ error: 'That username is taken' });
  }
  const { lastInsertRowid } = db
    .prepare('INSERT INTO users (username, password_hash, full_name) VALUES (?, ?, ?)')
    .run(username, bcrypt.hashSync(password, 10), full_name);
  req.session.regenerate(() => {
    req.session.userId = Number(lastInsertRowid);
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(lastInsertRowid);
    res.status(201).json({ user: publicUser(u) });
  });
});

router.post('/auth/login', (req, res) => {
  const username = str(req.body.username, 24);
  const password = String(req.body.password || '');
  const u = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!u || !bcrypt.compareSync(password, u.password_hash)) {
    return res.status(401).json({ error: 'Incorrect username or password' });
  }
  if (u.status === 'blocked') {
    return res.status(403).json({ error: 'This account has been blocked by an admin' });
  }
  req.session.regenerate(() => {
    req.session.userId = u.id;
    res.json({ user: publicUser(u) });
  });
});

router.post('/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/users/:username', requireAuth, (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE username = ?').get(req.params.username);
  if (!u) return res.status(404).json({ error: 'User not found' });
  const counts = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM notes WHERE user_id = ? AND status = 'approved') AS notes,
      (SELECT COUNT(*) FROM posts WHERE user_id = ?) AS posts,
      (SELECT COUNT(*) FROM attempts WHERE user_id = ?) AS tests,
      (SELECT COALESCE(SUM(downloads), 0) FROM notes WHERE user_id = ?) AS downloads
  `).get(u.id, u.id, u.id, u.id);
  res.json({ user: publicUser(u), counts, ...coinSummary(u.id) });
});

router.put('/me', requireAuth, avatarUpload.single('avatar'), (req, res) => {
  const u = req.user;
  let avatar = u.avatar;
  if (req.file) {
    removeFile(AVATAR_DIR, u.avatar);
    avatar = req.file.filename;
  }
  db.prepare('UPDATE users SET full_name = ?, bio = ?, college = ?, year = ?, avatar = ? WHERE id = ?').run(
    str(req.body.full_name, 60), str(req.body.bio, 300), str(req.body.college, 100), str(req.body.year, 30),
    avatar, u.id,
  );
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.id)) });
});

router.put('/me/password', requireAuth, (req, res) => {
  const { current, next } = req.body;
  if (!bcrypt.compareSync(String(current || ''), req.user.password_hash)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  if (String(next || '').length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(String(next), 10), req.user.id);
  res.json({ ok: true });
});

module.exports = router;
