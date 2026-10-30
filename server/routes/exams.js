const express = require('express');
const { db } = require('../db');
const { requireAuth, requireAdmin, str, numericId } = require('../helpers');
const { presignedUpload, NOTE_TYPES, NOTE_MAX_BYTES, isBlobUrl, blobInfo, removeBlob } = require('../storage');

// Exam Prep sections and their previous year question papers. Only admins add exams and
// upload papers; everyone signed in can browse exam → (course year) → year → subject.
const router = express.Router();
router.param('id', numericId);

const KINDS = ['india', 'abroad', 'university', 'other'];
const REGIONS = ['india', 'uk', 'australia', 'canada', 'usa', 'gulf', 'other'];
const MIN_YEAR = 1990;
// Predicted papers are for upcoming exams, so they may be a few years ahead.
const maxYear = (predicted) => new Date().getFullYear() + (predicted ? 3 : 1);
const MAX_FILES = 20;

function cleanYear(value, predicted) {
  const y = Number(value);
  return Number.isInteger(y) && y >= MIN_YEAR && y <= maxYear(predicted) ? y : null;
}

// Exam names, for subject/exam dropdowns.
router.get('/exams', async (req, res) => {
  res.json((await db.prepare('SELECT name FROM exams ORDER BY id').all()).map((e) => e.name));
});

router.get('/exams/details', async (req, res) => {
  res.json(await db.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM papers p WHERE p.exam_id = e.id AND p.predicted = 0) AS paper_count,
      (SELECT COUNT(*) FROM papers p WHERE p.exam_id = e.id AND p.predicted = 1) AS predicted_count
    FROM exams e ORDER BY e.id
  `).all());
});

// All papers of one exam; the browser groups them by course year, year and subject.
router.get('/exams/:id/papers', async (req, res) => {
  res.json(await db.prepare(`
    SELECT id, course_year, year, subject, title, file_name, file_mime, downloads, created_at, predicted = 1 AS predicted
    FROM papers WHERE exam_id = ? ORDER BY year DESC, subject, title, id
  `).all(req.params.id));
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

// ---- Admin: exams ----

function examFields(body) {
  const name = str(body.name, 80);
  if (!name) return { error: 'Exam name is required' };
  const kind = KINDS.includes(body.kind) ? body.kind : 'other';
  return {
    name, kind,
    region: REGIONS.includes(body.region) ? body.region : kind === 'abroad' ? 'other' : 'india',
    description: str(body.description, 300),
    emoji: str(body.emoji, 8),
  };
}

async function nameTaken(name, exceptId = 0) {
  return !!(await db.prepare('SELECT 1 FROM exams WHERE lower(name) = lower(?) AND id <> ?').get(name, exceptId));
}

router.post('/admin/exams', requireAdmin, async (req, res) => {
  const f = examFields(req.body);
  if (f.error) return res.status(400).json(f);
  if (await nameTaken(f.name)) return res.status(400).json({ error: 'An exam with this name already exists' });
  const { lastInsertRowid } = await db.prepare('INSERT INTO exams (name, kind, region, description, emoji, created_by) VALUES (?, ?, ?, ?, ?, ?)')
    .run(f.name, f.kind, f.region, f.description, f.emoji, req.user.id);
  res.status(201).json({ id: Number(lastInsertRowid), name: f.name });
});

router.put('/admin/exams/:id', requireAdmin, async (req, res) => {
  const exam = await db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.id);
  if (!exam) return res.status(404).json({ error: 'Exam not found' });
  const f = examFields(req.body);
  if (f.error) return res.status(400).json(f);
  if (await nameTaken(f.name, exam.id)) return res.status(400).json({ error: 'An exam with this name already exists' });
  await db.prepare('UPDATE exams SET name = ?, kind = ?, region = ?, description = ?, emoji = ? WHERE id = ?')
    .run(f.name, f.kind, f.region, f.description, f.emoji, exam.id);
  // Notes, tests and notifications point at the exam by name, so carry them over on a rename.
  if (f.name !== exam.name) {
    await db.prepare('UPDATE notes SET subject = ? WHERE subject = ?').run(f.name, exam.name);
    await db.prepare('UPDATE tests SET subject = ? WHERE subject = ?').run(f.name, exam.name);
    await db.prepare('UPDATE exam_notifications SET exam = ? WHERE exam = ?').run(f.name, exam.name);
  }
  res.json({ ok: true, name: f.name });
});

// Deletes the exam and its question papers. Notes and tests filed under it are kept
// (admins can still find them in Admin → Approved / Tests) but no longer listed in Exam Prep.
router.delete('/admin/exams/:id', requireAdmin, async (req, res) => {
  const files = await db.prepare('SELECT file_path FROM papers WHERE exam_id = ?').all(req.params.id);
  await db.prepare('DELETE FROM exams WHERE id = ?').run(req.params.id);
  await Promise.all(files.map((f) => removeBlob(f.file_path)));
  res.json({ ok: true });
});

// ---- Admin: papers ----

router.post('/papers/upload', presignedUpload({
  allowPath: (req, pathname) => req.user.role === 'admin' && new RegExp(`^papers/${req.user.id}/[\\w.-]{1,160}$`).test(pathname),
  types: NOTE_TYPES,
  maxBytes: NOTE_MAX_BYTES,
}));

// Saves one or more already-uploaded files as papers for the same exam, course year, year and subject.
router.post('/admin/papers', requireAdmin, async (req, res) => {
  const exam = await db.prepare('SELECT id, kind FROM exams WHERE id = ?').get(Number(req.body.exam_id) || 0);
  if (!exam) return res.status(400).json({ error: 'Choose an exam' });
  const courseYear = exam.kind === 'university' ? str(req.body.course_year, 40) : '';
  if (exam.kind === 'university' && !courseYear) return res.status(400).json({ error: 'Choose the course year (e.g. First year)' });
  const predicted = req.body.predicted ? 1 : 0;
  const year = cleanYear(req.body.year, predicted);
  if (!year) return res.status(400).json({ error: `Choose a year between ${MIN_YEAR} and ${maxYear(predicted)}` });
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
      INSERT INTO papers (exam_id, course_year, year, subject, title, file_path, file_name, file_mime, predicted, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(exam.id, courseYear, year, subject, f.title, f.url, f.name, f.mime, predicted, req.user.id);
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
