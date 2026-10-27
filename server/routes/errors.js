const crypto = require('crypto');
const express = require('express');
const { db } = require('../db');
const { requireAdmin, str, numericId } = require('../helpers');

const router = express.Router();
router.param('id', numericId);
const KEEP = 300;

// Browsers report crashes here. No login required (crashes can happen before login),
// so everything is size-limited and repeated reports are merged into one row.
router.post('/client-errors', async (req, res) => {
  const message = str(req.body.message, 500) || 'Unknown error';
  const kind = ['crash', 'error', 'rejection'].includes(req.body.kind) ? req.body.kind : 'error';
  const path = str(req.body.path, 300);
  const stack = str(req.body.stack, 4000);
  const componentStack = str(req.body.component_stack, 3000);
  const userAgent = str(req.get('user-agent'), 400);
  const username = req.user?.username || '';
  const fingerprint = crypto.createHash('sha1').update(`${kind}|${message}|${path.split('?')[0]}`).digest('hex');

  // Also goes to Vercel → Logs (search "client-error").
  console.error('[client-error]', JSON.stringify({ kind, message, path, username, userAgent, stack: stack.slice(0, 800) }));

  await db.prepare(`
    INSERT INTO client_errors (fingerprint, message, stack, component_stack, kind, path, user_agent, username)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (fingerprint) DO UPDATE SET
      count = client_errors.count + 1, last_seen = now(), stack = EXCLUDED.stack,
      component_stack = EXCLUDED.component_stack, user_agent = EXCLUDED.user_agent, username = EXCLUDED.username
  `).run(fingerprint, message, stack, componentStack, kind, path, userAgent, username);
  await db.prepare(`DELETE FROM client_errors WHERE id NOT IN (SELECT id FROM client_errors ORDER BY last_seen DESC LIMIT ${KEEP})`).run();
  res.status(204).end();
});

router.get('/admin/client-errors', requireAdmin, async (req, res) => {
  res.json(await db.prepare('SELECT * FROM client_errors ORDER BY last_seen DESC LIMIT 100').all());
});

router.delete('/admin/client-errors/:id', requireAdmin, async (req, res) => {
  await db.prepare('DELETE FROM client_errors WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.delete('/admin/client-errors', requireAdmin, async (req, res) => {
  await db.prepare('DELETE FROM client_errors').run();
  res.json({ ok: true });
});

module.exports = router;
