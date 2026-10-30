const { db } = require('./db');

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id, username: u.username, full_name: u.full_name, bio: u.bio,
    college: u.college, year: u.year, avatar: u.avatar, role: u.role,
    status: u.status, redlisted: !!u.redlisted, created_at: u.created_at,
  };
}

// Loads the session user fresh on every request so blocks take effect immediately.
async function loadUser(req, res, next) {
  if (req.session?.userId) {
    const u = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
    if (!u || u.status === 'blocked') {
      req.session = null;
    } else {
      req.user = u;
    }
  }
  next();
}

// Visitors can browse without an account; public routes read the viewer through this.
const GUEST = Object.freeze({ id: 0, role: 'guest' });
const viewer = (req) => req.user || GUEST;

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  next();
}

function cleanUrl(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  try {
    const u = new URL(v);
    return ['http:', 'https:'].includes(u.protocol) ? u.toString() : '';
  } catch {
    return '';
  }
}

function str(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

// router.param guard: Postgres rejects non-numeric ids, so answer 404 instead of a 500.
function numericId(req, res, next, id) {
  if (/^\d{1,9}$/.test(id)) return next();
  res.status(404).json({ error: 'Not found' });
}

module.exports = { publicUser, loadUser, viewer, requireAuth, requireAdmin, cleanUrl, str, numericId };
