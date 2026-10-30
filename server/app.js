const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cookieSession = require('cookie-session');
const { ready } = require('./db');
const { loadUser } = require('./helpers');

const DIST = path.join(__dirname, '..', 'client', 'dist');
const ON_VERCEL = !!process.env.VERCEL;

function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (ON_VERCEL) throw new Error('SESSION_SECRET is not set. Add it in Vercel → Settings → Environment Variables.');
  // Local development: keep a random secret on disk so logins survive restarts.
  const dir = path.join(__dirname, '..', 'data');
  const file = path.join(dir, '.session-secret');
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  return fs.readFileSync(file, 'utf8');
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Vercel and most hosts terminate HTTPS in front of the app
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  next();
});
app.use(express.json({ limit: '1mb' }));
// The session is a signed cookie holding just the user id, so it works across serverless instances.
app.use(cookieSession({
  name: 'denvio',
  keys: [sessionSecret()],
  httpOnly: true,
  sameSite: 'lax',
  secure: ON_VERCEL || process.env.NODE_ENV === 'production',
  maxAge: 1000 * 60 * 60 * 24 * 14,
}));
app.use(async (req, res, next) => {
  await ready();
  next();
});
app.use(loadUser);

app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/notes'));
app.use('/api', require('./routes/community'));
app.use('/api', require('./routes/tests'));
app.use('/api', require('./routes/admin'));
app.use('/api', require('./routes/awards'));
app.use('/api', require('./routes/announcements'));
app.use('/api', require('./routes/news'));
app.use('/api', require('./routes/jobs'));
app.use('/api', require('./routes/exams'));
app.use('/api', require('./routes/errors'));
app.use('/api', require('./routes/notifications'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// When running as a normal server (npm start), also serve the built React app.
if (!ON_VERCEL && fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(DIST, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File is too large' });
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

module.exports = app;
