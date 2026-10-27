const express = require('express');
const { db, EXAMS } = require('../db');
const { requireAuth, requireAdmin, cleanUrl, str, numericId } = require('../helpers');

const router = express.Router();
router.param('id', numericId);

const REGIONS = ['india', 'uk', 'australia', 'canada', 'usa', 'gulf', 'other'];
const CATEGORIES = ['exam', 'admission', 'result', 'recruitment', 'regulatory', 'other'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Official exam / council notifications for India and the main international destinations.
// Open deadlines come first (soonest first), then everything else by newest.
router.get('/notifications', requireAuth, async (req, res) => {
  const where = ['active = 1'];
  const params = [];
  if (REGIONS.includes(req.query.region)) { where.push('region = ?'); params.push(req.query.region); }
  if (CATEGORIES.includes(req.query.category)) { where.push('category = ?'); params.push(req.query.category); }
  if (EXAMS.includes(req.query.exam)) { where.push('exam = ?'); params.push(req.query.exam); }
  if (req.query.q) {
    where.push('(title ILIKE ? OR body ILIKE ? OR source ILIKE ?)');
    params.push(...Array(3).fill(`%${str(req.query.q, 80)}%`));
  }
  res.json(await db.prepare(`
    SELECT * FROM exam_notifications WHERE ${where.join(' AND ')}
    ORDER BY (deadline IS NOT NULL AND deadline >= current_date) DESC,
      CASE WHEN deadline >= current_date THEN deadline END ASC,
      created_at DESC
    LIMIT 200
  `).all(...params));
});

function fields(body) {
  const title = str(body.title, 160);
  if (!title) return { error: 'Title is required' };
  const dates = {};
  for (const k of ['exam_date', 'deadline']) {
    const v = str(body[k], 10);
    if (v && !DATE_RE.test(v)) return { error: 'Dates must be valid dates' };
    dates[k] = v || null;
  }
  const link = cleanUrl(body.link_url);
  if (body.link_url && !link) return { error: 'Link must start with http:// or https://' };
  return {
    title,
    body: str(body.body, 1500),
    region: REGIONS.includes(body.region) ? body.region : 'india',
    category: CATEGORIES.includes(body.category) ? body.category : 'exam',
    exam: EXAMS.includes(body.exam) ? body.exam : '',
    source: str(body.source, 80),
    link_url: link,
    ...dates,
  };
}

router.post('/admin/notifications', requireAdmin, async (req, res) => {
  const f = fields(req.body);
  if (f.error) return res.status(400).json(f);
  const { lastInsertRowid } = await db.prepare(`
    INSERT INTO exam_notifications (title, body, region, category, exam, source, exam_date, deadline, link_url, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(f.title, f.body, f.region, f.category, f.exam, f.source, f.exam_date, f.deadline, f.link_url, req.user.id);
  res.status(201).json({ id: Number(lastInsertRowid) });
});

router.put('/admin/notifications/:id', requireAdmin, async (req, res) => {
  await db.prepare('UPDATE exam_notifications SET active = ? WHERE id = ?').run(req.body.active ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

router.delete('/admin/notifications/:id', requireAdmin, async (req, res) => {
  await db.prepare('DELETE FROM exam_notifications WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
