const path = require('path');
const express = require('express');
const { db, SUBJECTS } = require('../db');
const { requireAuth, cleanUrl, str } = require('../helpers');
const { noteUpload, NOTES_DIR, removeFile } = require('../uploads');
const { countTiers } = require('../coins');

const router = express.Router();

const NOTE_SELECT = `
  SELECT n.*, u.username, u.avatar AS user_avatar, u.full_name AS user_full_name,
    (SELECT COUNT(*) FROM likes l WHERE l.note_id = n.id) AS like_count,
    EXISTS(SELECT 1 FROM likes l WHERE l.note_id = n.id AND l.user_id = ?) AS liked,
    EXISTS(SELECT 1 FROM saves s WHERE s.note_id = n.id AND s.user_id = ?) AS saved,
    (SELECT GROUP_CONCAT(a.tier) FROM awards a WHERE a.note_id = n.id) AS award_tiers
  FROM notes n JOIN users u ON u.id = n.user_id
`;

// Video/audio links are only revealed once an admin has enabled them,
// except to the uploader and admins who need to see what was submitted.
function serialize(n, viewer) {
  const privileged = viewer.role === 'admin' || viewer.id === n.user_id;
  return {
    id: n.id, title: n.title, subject: n.subject, description: n.description,
    has_file: !!n.file_path, file_name: n.file_name, file_mime: n.file_mime,
    video_url: n.video_enabled || privileged ? n.video_url : '',
    audio_url: n.audio_enabled || privileged ? n.audio_url : '',
    video_enabled: !!n.video_enabled, audio_enabled: !!n.audio_enabled,
    status: n.status, admin_note: privileged ? n.admin_note : '',
    downloads: n.downloads, created_at: n.created_at,
    like_count: n.like_count, liked: !!n.liked, saved: !!n.saved, coins: countTiers(n.award_tiers),
    user: { id: n.user_id, username: n.username, avatar: n.user_avatar, full_name: n.user_full_name },
  };
}

function canView(n, viewer) {
  return n.status === 'approved' || viewer.role === 'admin' || viewer.id === n.user_id;
}

router.get('/notes', requireAuth, (req, res) => {
  const me = req.user;
  const where = [];
  const params = [me.id, me.id];
  if (req.query.user) {
    const owner = db.prepare('SELECT id FROM users WHERE username = ?').get(String(req.query.user));
    if (!owner) return res.json([]);
    where.push('n.user_id = ?');
    params.push(owner.id);
    // ?all=1 lets uploaders (and admins) see pending/rejected items too.
    const seeAll = req.query.all === '1' && (owner.id === me.id || me.role === 'admin');
    if (!seeAll) where.push("n.status = 'approved'");
  } else {
    where.push("n.status = 'approved'");
  }
  if (req.query.saved === '1') {
    where.push('EXISTS(SELECT 1 FROM saves s WHERE s.note_id = n.id AND s.user_id = ?)');
    params.push(me.id);
  }
  if (req.query.subject) {
    where.push('n.subject = ?');
    params.push(String(req.query.subject));
  }
  if (req.query.q) {
    where.push('(n.title LIKE ? OR n.description LIKE ? OR u.username LIKE ?)');
    const q = `%${String(req.query.q)}%`;
    params.push(q, q, q);
  }
  const rows = db.prepare(`${NOTE_SELECT} WHERE ${where.join(' AND ')} ORDER BY n.created_at DESC, n.id DESC LIMIT 100`)
    .all(...params);
  res.json(rows.map((n) => serialize(n, me)));
});

router.get('/notes/:id', requireAuth, (req, res) => {
  const n = db.prepare(`${NOTE_SELECT} WHERE n.id = ?`).get(req.user.id, req.user.id, req.params.id);
  if (!n || !canView(n, req.user)) return res.status(404).json({ error: 'Note not found' });
  res.json(serialize(n, req.user));
});

router.post('/notes', requireAuth, noteUpload.single('file'), (req, res) => {
  const title = str(req.body.title, 120);
  const subject = str(req.body.subject, 80);
  const video_url = cleanUrl(req.body.video_url);
  const audio_url = cleanUrl(req.body.audio_url);
  const fail = (msg) => {
    if (req.file) removeFile(NOTES_DIR, req.file.filename);
    res.status(400).json({ error: msg });
  };
  if (!title) return fail('Title is required');
  if (!SUBJECTS.includes(subject)) return fail('Choose a subject');
  if (!req.file && !video_url && !audio_url) return fail('Attach a file or add a video/audio link');
  if (req.body.video_url && !video_url) return fail('Video link must start with http:// or https://');
  if (req.body.audio_url && !audio_url) return fail('Audio link must start with http:// or https://');

  // Admin uploads skip the review queue.
  const isAdmin = req.user.role === 'admin';
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO notes (user_id, title, subject, description, file_path, file_name, file_mime,
      video_url, audio_url, video_enabled, audio_enabled, status, reviewed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.user.id, title, subject, str(req.body.description, 2000),
    req.file?.filename || '', req.file ? str(req.file.originalname, 200) : '', req.file?.mimetype || '',
    video_url, audio_url, isAdmin && video_url ? 1 : 0, isAdmin && audio_url ? 1 : 0,
    isAdmin ? 'approved' : 'pending', isAdmin ? new Date().toISOString() : null,
  );
  res.status(201).json({ id: Number(lastInsertRowid), status: isAdmin ? 'approved' : 'pending' });
});

router.post('/notes/:id/like', requireAuth, (req, res) => toggle('likes', req, res));
router.post('/notes/:id/save', requireAuth, (req, res) => toggle('saves', req, res));

function toggle(table, req, res) {
  const n = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  if (!n || n.status !== 'approved') return res.status(404).json({ error: 'Note not found' });
  const exists = db.prepare(`SELECT 1 FROM ${table} WHERE user_id = ? AND note_id = ?`).get(req.user.id, n.id);
  if (exists) db.prepare(`DELETE FROM ${table} WHERE user_id = ? AND note_id = ?`).run(req.user.id, n.id);
  else db.prepare(`INSERT INTO ${table} (user_id, note_id) VALUES (?, ?)`).run(req.user.id, n.id);
  const { c } = db.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE note_id = ?`).get(n.id);
  res.json({ active: !exists, count: c });
}

router.get('/notes/:id/file', requireAuth, (req, res) => {
  const n = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  if (!n || !n.file_path || !canView(n, req.user)) return res.status(404).json({ error: 'File not found' });
  const filePath = path.join(NOTES_DIR, path.basename(n.file_path));
  if (req.query.download === '1') {
    db.prepare('UPDATE notes SET downloads = downloads + 1 WHERE id = ?').run(n.id);
    return res.download(filePath, n.file_name || path.basename(n.file_path));
  }
  res.type(n.file_mime).sendFile(filePath);
});

router.delete('/notes/:id', requireAuth, (req, res) => {
  const n = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  if (!n) return res.status(404).json({ error: 'Note not found' });
  if (n.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not allowed' });
  removeFile(NOTES_DIR, n.file_path);
  db.prepare('DELETE FROM notes WHERE id = ?').run(n.id);
  res.json({ ok: true });
});

module.exports = router;
