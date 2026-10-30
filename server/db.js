const { Pool, types } = require('pg');
const bcrypt = require('bcryptjs');

// COUNT()/SUM() come back as bigint/numeric strings by default; numbers are what the app expects.
types.setTypeParser(20, (v) => parseInt(v, 10));
types.setTypeParser(1700, (v) => parseFloat(v));
// Keep DATE columns as plain 'YYYY-MM-DD' strings.
types.setTypeParser(1082, (v) => v);

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Add a Neon Postgres database in Vercel → Storage, or set it in .env.local.');
}

const pool = new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 10000,
  ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? false : { rejectUnauthorized: false },
});

// Small adapter so route code reads like the old SQLite version:
//   await db.prepare('SELECT ... WHERE id = ?').get(id)
// `?` placeholders become $1, $2… and INSERTs return the new row's id as lastInsertRowid.
function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

const db = {
  prepare(sql) {
    const text = toPg(sql);
    const isInsert = /^\s*INSERT\b/i.test(text) && !/\bRETURNING\b/i.test(text);
    return {
      get: async (...params) => (await pool.query(text, params)).rows[0],
      all: async (...params) => (await pool.query(text, params)).rows,
      run: async (...params) => {
        const r = await pool.query(isInsert ? `${text} RETURNING *` : text, params);
        return { changes: r.rowCount, lastInsertRowid: r.rows[0]?.id };
      },
    };
  },
  query: (text, params) => pool.query(text, params),
};

const SCHEMA = `
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username CITEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  college TEXT DEFAULT '',
  year TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'active',
  redlisted INTEGER NOT NULL DEFAULT 0,
  redlist_reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT DEFAULT '',
  file_path TEXT DEFAULT '',
  file_name TEXT DEFAULT '',
  file_mime TEXT DEFAULT '',
  video_url TEXT DEFAULT '',
  audio_url TEXT DEFAULT '',
  video_enabled INTEGER NOT NULL DEFAULT 0,
  audio_enabled INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT DEFAULT '',
  downloads INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS likes (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, note_id)
);

CREATE TABLE IF NOT EXISTS saves (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, note_id)
);

CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT DEFAULT '',
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tests (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT DEFAULT '',
  duration_min INTEGER NOT NULL DEFAULT 15,
  published INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  opt_a TEXT NOT NULL,
  opt_b TEXT NOT NULL,
  opt_c TEXT NOT NULL,
  opt_d TEXT NOT NULL,
  correct TEXT NOT NULL,
  explanation TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS awards (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL,
  points INTEGER NOT NULL,
  reason TEXT DEFAULT '',
  note_id INTEGER REFERENCES notes(id) ON DELETE SET NULL,
  post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL,
  awarded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  seen INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  type TEXT NOT NULL DEFAULT 'info',
  emoji TEXT DEFAULT '',
  link_url TEXT DEFAULT '',
  link_label TEXT DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  expires_at DATE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT DEFAULT '',
  classification TEXT NOT NULL,
  job_type TEXT NOT NULL DEFAULT 'full_time',
  salary TEXT DEFAULT '',
  description TEXT DEFAULT '',
  apply_url TEXT DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attempts (
  id SERIAL PRIMARY KEY,
  test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  answers TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exam_notifications (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  region TEXT NOT NULL DEFAULT 'india',      -- india | uk | australia | canada | usa | gulf | other
  category TEXT NOT NULL DEFAULT 'exam',     -- exam | admission | result | recruitment | regulatory | other
  exam TEXT DEFAULT '',                      -- optional: one of EXAMS
  source TEXT DEFAULT '',                    -- e.g. NBEMS, AIIMS, GDC
  exam_date DATE,
  deadline DATE,                             -- last date to apply / register
  link_url TEXT DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_errors (
  id SERIAL PRIMARY KEY,
  fingerprint TEXT NOT NULL UNIQUE,           -- same error on the same page is merged
  message TEXT NOT NULL,
  stack TEXT DEFAULT '',
  component_stack TEXT DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'crash',         -- crash | error | rejection
  path TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  username TEXT DEFAULT '',
  count INTEGER NOT NULL DEFAULT 1,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Exam Prep sections. Admins can add more; the built-in ones are seeded on first run.
CREATE TABLE IF NOT EXISTS exams (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'india',        -- india | abroad | university | other
  region TEXT NOT NULL DEFAULT 'india',      -- for the Notifications tab's official sources
  description TEXT DEFAULT '',
  emoji TEXT DEFAULT '',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Previous year question papers: exam → (course year, for university exams) → calendar year → subject.
CREATE TABLE IF NOT EXISTS papers (
  id SERIAL PRIMARY KEY,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  course_year TEXT NOT NULL DEFAULT '',      -- e.g. First year; only used by university exams
  predicted INTEGER NOT NULL DEFAULT 0,      -- 1 = predicted paper for an upcoming exam; year = that exam's year
  year INTEGER NOT NULL,
  subject TEXT NOT NULL,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT DEFAULT '',
  file_mime TEXT DEFAULT '',
  downloads INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS papers_exam_year ON papers (exam_id, year DESC);
CREATE INDEX IF NOT EXISTS notes_status_created ON notes (status, created_at DESC);
CREATE INDEX IF NOT EXISTS awards_user ON awards (user_id);
CREATE INDEX IF NOT EXISTS comments_post ON comments (post_id);
`;

const DEFAULT_EXAMS = [
  ['NEET MDS', 'india', 'india', 'MDS entrance · India', '🎯'],
  ['INI-CET (AIIMS)', 'india', 'india', 'AIIMS, PGIMER, JIPMER · India', '🏛️'],
  ['ORE – UK', 'abroad', 'uk', 'Overseas Registration Exam', '🇬🇧'],
  ['ADC – Australia', 'abroad', 'australia', 'Australian Dental Council', '🇦🇺'],
  ['NDEB – Canada', 'abroad', 'canada', 'AFK · ACJ · NDECC', '🇨🇦'],
  ['INBDE – USA', 'abroad', 'usa', 'Integrated National Board', '🇺🇸'],
  ['Gulf – DHA / MOH', 'abroad', 'gulf', 'Dubai · UAE · Saudi · Qatar', '🇦🇪'],
];

async function init() {
  await pool.query(SCHEMA);
  // Seed the built-in exams only into an empty table, so ones an admin deleted stay deleted.
  const exams = await pool.query('SELECT 1 FROM exams LIMIT 1');
  if (!exams.rows.length) {
    for (const [name, kind, region, description, emoji] of DEFAULT_EXAMS) {
      await pool.query(
        'INSERT INTO exams (name, kind, region, description, emoji) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (name) DO NOTHING',
        [name, kind, region, description, emoji],
      );
    }
  }
  // Upgrade from the first question-papers version, which kept its own `paper_exams` table:
  // move those exams into `exams` and point their papers at them. The lock keeps two
  // cold-starting instances from running this at the same time.
  await pool.query(`
    ALTER TABLE papers ADD COLUMN IF NOT EXISTS course_year TEXT NOT NULL DEFAULT '';
    ALTER TABLE papers ADD COLUMN IF NOT EXISTS predicted INTEGER NOT NULL DEFAULT 0;
    DO $$ BEGIN
      PERFORM pg_advisory_xact_lock(727001);
      IF to_regclass('public.paper_exams') IS NOT NULL THEN
        INSERT INTO exams (name, kind, description, emoji, created_by, created_at)
          SELECT name, 'other', description, emoji, created_by, created_at FROM paper_exams
          ON CONFLICT (name) DO NOTHING;
        ALTER TABLE papers DROP CONSTRAINT IF EXISTS papers_exam_id_fkey;
        UPDATE papers p SET exam_id = e.id FROM paper_exams pe JOIN exams e ON e.name = pe.name WHERE p.exam_id = pe.id;
        ALTER TABLE papers ADD CONSTRAINT papers_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE;
        DROP TABLE paper_exams;
      END IF;
    END $$;
  `);
  // Seed the first admin account so the app is usable right away.
  const { rows } = await pool.query("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1");
  if (!rows.length) {
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    await pool.query(
      "INSERT INTO users (username, password_hash, full_name, role) VALUES ('admin', $1, 'Denvio Admin', 'admin') ON CONFLICT (username) DO NOTHING",
      [bcrypt.hashSync(password, 10)],
    );
    console.log('Created admin account -> username: admin (password from ADMIN_PASSWORD, default admin123)');
  }
}

// Serverless functions start cold; run the schema once per instance and share the promise.
let readyPromise = null;
function ready() {
  readyPromise = readyPromise || init().catch((e) => {
    readyPromise = null;
    throw e;
  });
  return readyPromise;
}

const SUBJECTS = [
  'General Anatomy', 'General Physiology', 'Biochemistry', 'Dental Anatomy & Histology',
  'Dental Materials', 'General Pathology', 'Microbiology', 'Pharmacology',
  'General Medicine', 'General Surgery', 'Oral Pathology', 'Oral Medicine & Radiology',
  'Oral & Maxillofacial Surgery', 'Prosthodontics', 'Conservative Dentistry & Endodontics',
  'Orthodontics', 'Periodontics', 'Pedodontics', 'Public Health Dentistry',
];

// Exam-prep sections live in the `exams` table; notes and mock tests can be filed under
// an exam's name just like a subject.
const isExam = async (value) => !!value && !!(await db.prepare('SELECT 1 FROM exams WHERE name = ?').get(value));
const isTopic = async (value) => SUBJECTS.includes(value) || isExam(value);

module.exports = { db, ready, SUBJECTS, isExam, isTopic };
