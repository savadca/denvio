const express = require('express');
const { db } = require('../db');
const { requireAuth, requireAdmin, str, numericId } = require('../helpers');
const { presignedUpload, NOTE_TYPES, NOTE_MAX_BYTES, isBlobUrl, blobInfo, removeBlob } = require('../storage');

// Previous year question papers. Only admins create exam categories and upload papers;
// everyone signed in can browse them by exam → year → subject.
const router = express.Router();
router.param('id', numericId);

const MIN_YEAR = 1990;
const maxYear = () => new Date().getFullYear() + 1;
const MAX_FILES = 20;

function cleanYear(value) {
  const y = Number(value);
  return Number.isInteger(y) && y >= MIN_YEAR && y <= maxYear() ? y : null;
}

const EXAM_SELECT = `
  SELECT e.*, COUNT(p.id) AS paper_count, COUNT(DISTINCT p.year) AS year_count, MAX(p.year) AS latest_year
  FROM paper_exams e LEFT JOIN papers p ON p.exam_id = e.id
`;

router.get('/papers/exams', requireAuth, async (req, res) => {
  res.json(await db.prepare(`${EXAM_SELECT} GROUP BY e.id ORDER BY e.name`).all());
});

// One exam with all its papers; the browser groups them by year and subject.
router.get('/papers/exams/:id', requireAuth, async (req, res) => {
  const exam = await db.prepare(`${EXAM_SELECT} WHERE e.id = ? GROUP BY e.id`).get(req.params.id);
  if (!exam) return res.status(404).json({ error: 'Exam not found' });
  const papers = await db.prepare(`
    SELECT id, year, subject, title, file_name, file_mime, downloads, created_at
    FROM papers WHERE exam_id = ? ORDER BY year DESC, subject, title, id
  `).all(exam.id);
  res.json({ ...exam, papers });
});

router.get('/papers/:id/file', requireAuth, async (req, res) => {
  const p = await db.prepare('SELECT * FROM papers WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'File not found' });
  if (req.query.download === '1') {
    await db.prepare('UPDATE papers SET downloads = downloads + 1 WHERE id = ?').run(p.id);
    return res.redirect(302, `${p.file_path}?download=1`);
  }
  res.redirect(302, p.file_path);
});

// ---- Admin: exam categories ----

function examFields(body) {
  return { name: str(body.name, 80), description: str(body.description, 300), emoji: str(body.emoji, 8) };
}

router.post('/admin/paper-exams', requireAdmin, async (req, res) => {
  const f = examFields(req.body);
  if (!f.name) return res.status(400).json({ error: 'Exam name is required' });
  const taken = await db.prepare('SELECT 1 FROM paper_exams WHERE lower(name) = lower(?)').get(f.name);
  if (taken) return res.status(400).json({ error: 'An exam with this name already exists' });
  const { lastInsertRowid } = await db.prepare('INSERT INTO paper_exams (name, description, emoji, created_by) VALUES (?, ?, ?, ?)')
    .run(f.name, f.description, f.emoji, req.user.id);
  res.status(201).json({ id: Number(lastInsertRowid) });
});

router.put('/admin/paper-exams/:id', requireAdmin, async (req, res) => {
  const f = examFields(req.body);
  if (!f.name) return res.status(400).json({ error: 'Exam name is required' });
  const taken = await db.prepare('SELECT 1 FROM paper_exams WHERE lower(name) = lower(?) AND id <> ?').get(f.name, req.params.id);
  if (taken) return res.status(400).json({ error: 'An exam with this name already exists' });
  const { changes } = await db.prepare('UPDATE paper_exams SET name = ?, description = ?, emoji = ? WHERE id = ?')
    .run(f.name, f.description, f.emoji, req.params.id);
  if (!changes) return res.status(404).json({ error: 'Exam not found' });
  res.json({ ok: true });
});

router.delete('/admin/paper-exams/:id', requireAdmin, async (req, res) => {
  const files = await db.prepare('SELECT file_path FROM papers WHERE exam_id = ?').all(req.params.id);
  await db.prepare('DELETE FROM paper_exams WHERE id = ?').run(req.params.id);
  await Promise.all(files.map((f) => removeBlob(f.file_path)));
  res.json({ ok: true });
});

// ---- Admin: papers ----

router.post('/papers/upload', presignedUpload({
  allowPath: (req, pathname) => req.user.role === 'admin' && new RegExp(`^papers/${req.user.id}/[\\w.-]{1,160}$`).test(pathname),
  types: NOTE_TYPES,
  maxBytes: NOTE_MAX_BYTES,
}));

// Saves one or more already-uploaded files as papers for the same exam, year and subject.
router.post('/admin/papers', requireAdmin, async (req, res) => {
  const exam = await db.prepare('SELECT id FROM paper_exams WHERE id = ?').get(Number(req.body.exam_id) || 0);
  if (!exam) return res.status(400).json({ error: 'Choose an exam' });
  const year = cleanYear(req.body.year);
  if (!year) return res.status(400).json({ error: `Enter a year between ${MIN_YEAR} and ${maxYear()}` });
  const subject = str(req.body.subject, 80);
  if (!subject) return res.status(400).json({ error: 'Subject is required' });
  const files = Array.isArray(req.body.files) ? req.body.files : [];
  if (!files.length) return res.status(400).json({ error: 'Attach at least one file' });
  if (files.length > MAX_FILES) return res.status(400).json({ error: `Up to ${MAX_FILES} files at a time` });

  // Only accept files this admin uploaded to our Blob store, and trust Blob's own metadata.
  const checked = await Promise.all(files.map(async (f) => {
    const url = String(f?.file_url || '');
    const info = isBlobUrl(url) && new URL(url).pathname.startsWith(`/papers/${req.user.id}/`) ? await blobInfo(url) : null;
    if (!info || !NOTE_TYPES.includes(info.contentType) || info.size > NOTE_MAX_BYTES) return null;
    const name = str(f.file_name, 200) || info.pathname.split('/').pop();
    return { url: info.url, mime: info.contentType, name, title: str(f.title, 120) || name.replace(/\.[^.]+$/, '') };
  }));
  if (checked.some((f) => !f)) return res.status(400).json({ error: 'An uploaded file could not be verified. Please upload it again.' });

  for (const f of checked) {
    await db.prepare(`
      INSERT INTO papers (exam_id, year, subject, title, file_path, file_name, file_mime, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(exam.id, year, subject, f.title, f.url, f.name, f.mime, req.user.id);
  }
  res.status(201).json({ count: checked.length });
});

router.delete('/admin/papers/:id', requireAdmin, async (req, res) => {
  const p = await db.prepare('SELECT * FROM papers WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Paper not found' });
  await db.prepare('DELETE FROM papers WHERE id = ?').run(p.id);
  await removeBlob(p.file_path);
  res.json({ ok: true });
});

module.exports = router;
