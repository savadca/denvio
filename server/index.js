const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const { loadUser } = require('./helpers');
const { AVATAR_DIR } = require('./uploads');

const PORT = process.env.PORT || 4000;
const DIST = path.join(__dirname, '..', 'client', 'dist');

// Persist a random session secret so logins survive restarts.
function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const file = path.join(__dirname, '..', 'data', '.session-secret');
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  return fs.readFileSync(file, 'utf8');
}

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use(session({
  name: 'denvio.sid',
  secret: sessionSecret(),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 14 },
}));
app.use(loadUser);

app.use('/uploads/avatars', express.static(AVATAR_DIR, { maxAge: '7d' }));

app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/notes'));
app.use('/api', require('./routes/community'));
app.use('/api', require('./routes/tests'));
app.use('/api', require('./routes/admin'));
app.use('/api', require('./routes/awards'));
app.use('/api', require('./routes/announcements'));
app.use('/api', require('./routes/news'));
app.use('/api', require('./routes/jobs'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the built React app in production.
if (fs.existsSync(DIST)) {
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

app.listen(PORT, () => console.log(`Denvio API running on http://localhost:${PORT}`));
