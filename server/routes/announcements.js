const express = require('express');
const { db } = require('../db');
const { requireAdmin, cleanUrl, str, numericId } = require('../helpers');

const router = express.Router();
router.param('id', numericId);
const TYPES = ['info', 'success', 'warning', 'urgent', 'event'];

const LIVE = "active = 1 AND (expires_at IS NULL OR expires_at >= current_date)";

router.get('/announcements', async (req, res) => {
  res.json(await db.prepare(`SELECT * FROM announcements WHERE ${LIVE} ORDER BY id DESC LIMIT 10`).all());
});

router.get('/admin/announcements', requireAdmin, async (req, res) => {
  res.json(await db.prepare(`SELECT *, (${LIVE}) AS live FROM announcements ORDER BY id DESC LIMIT 100`).all());
});

function fields(body) {
  const title = str(body.title, 120);
  if (!title) return { error: 'Title is required' };
  const expires = str(body.expires_at, 10);
  if (expires && !/^\d{4}-\d{2}-\d{2}$/.test(expires)) return { error: 'Expiry must be a date' };
  const link = cleanUrl(body.link_url);
  if (body.link_url && !link) return { error: 'Link must start with http:// or https://' };
  return {
    title, body: str(body.body, 500), type: TYPES.includes(body.type) ? body.type : 'info',
    emoji: str(body.emoji, 8), link_url: link, link_label: str(body.link_label, 40), expires_at: expires || null,
  };
}

router.post('/admin/announcements', requireAdmin, async (req, res) => {
  const f = fields(req.body);
  if (f.error) return res.status(400).json(f);
  const { lastInsertRowid } = await db.prepare(`
    INSERT INTO announcements (title, body, type, emoji, link_url, link_label, expires_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(f.title, f.body, f.type, f.emoji, f.link_url, f.link_label, f.expires_at, req.user.id);
  res.status(201).json({ id: Number(lastInsertRowid) });
});

router.put('/admin/announcements/:id', requireAdmin, async (req, res) => {
  const a = await db.prepare('SELECT * FROM announcements WHERE id = ?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'Announcement not found' });
  await db.prepare('UPDATE announcements SET active = ? WHERE id = ?').run(req.body.active ? 1 : 0, a.id);
  res.json({ ok: true });
});

router.delete('/admin/announcements/:id', requireAdmin, async (req, res) => {
  await db.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
