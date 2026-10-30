const express = require('express');
const { db } = require('../db');
const { requireAdmin, cleanUrl, str, numericId } = require('../helpers');

const router = express.Router();
router.param('id', numericId);

// Job classifications for dental graduates; `keywords` drive live searches and auto-tagging.
const CLASSIFICATIONS = [
  { id: 'general', label: 'General Dentist', keywords: ['dentist', 'dental surgeon', 'associate dentist'] },
  { id: 'intern', label: 'Internship / Fresher', keywords: ['dental intern', 'junior dentist', 'bds fresher'] },
  { id: 'ortho', label: 'Orthodontist', keywords: ['orthodontist'] },
  { id: 'endo', label: 'Endodontist', keywords: ['endodontist'] },
  { id: 'perio', label: 'Periodontist', keywords: ['periodontist'] },
  { id: 'prostho', label: 'Prosthodontist / Implantologist', keywords: ['prosthodontist', 'implantologist'] },
  { id: 'oms', label: 'Oral & Maxillofacial Surgeon', keywords: ['maxillofacial', 'oral surgeon'] },
  { id: 'pedo', label: 'Pediatric Dentist', keywords: ['pedodontist', 'pediatric dentist', 'paediatric dentist'] },
  { id: 'academic', label: 'Faculty / Lecturer', keywords: ['dental lecturer', 'dental professor', 'dental faculty'] },
  { id: 'government', label: 'Government / Dental Officer', keywords: ['dental officer', 'government dental'] },
  { id: 'research', label: 'Clinical Research / Pharma', keywords: ['dental research', 'clinical research dental'] },
  { id: 'assistant', label: 'Dental Assistant / Hygienist', keywords: ['dental assistant', 'dental hygienist'] },
];
const JOB_TYPES = { full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', internship: 'Internship' };
const byId = Object.fromEntries(CLASSIFICATIONS.map((c) => [c.id, c]));

function classify(text) {
  const t = text.toLowerCase();
  // Most specific classification wins; "general" is the fallback.
  const hit = CLASSIFICATIONS.find((c) => c.id !== 'general' && c.keywords.some((k) => t.includes(k)));
  return hit ? hit.id : 'general';
}

// ---- Live market jobs (Adzuna API; needs a free key) ----
const ADZUNA_ID = process.env.ADZUNA_APP_ID;
const ADZUNA_KEY = process.env.ADZUNA_APP_KEY;
const ADZUNA_COUNTRY = process.env.ADZUNA_COUNTRY || 'in';
const liveCache = new Map();

async function liveJobs({ classification, type, q, location }) {
  if (!ADZUNA_ID || !ADZUNA_KEY) return { enabled: false, items: [] };
  const words = q ? [q] : (byId[classification]?.keywords || ['dentist', 'dental']);
  const params = new URLSearchParams({
    app_id: ADZUNA_ID, app_key: ADZUNA_KEY, results_per_page: '30', what_or: words.join(' '), 'content-type': 'application/json',
  });
  if (q) { params.delete('what_or'); params.set('what', `${q} dental`); }
  if (location) params.set('where', location);
  if (type && type !== 'internship' && JOB_TYPES[type]) params.set(type, '1');
  if (type === 'internship') params.set('what_and', 'intern');
  const key = params.toString();
  const hit = liveCache.get(key);
  if (hit && Date.now() - hit.at < 30 * 60 * 1000) return hit.data;

  try {
    const r = await fetch(`https://api.adzuna.com/v1/api/jobs/${ADZUNA_COUNTRY}/search/1?${params}`, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const json = await r.json();
    const items = (json.results || []).map((j) => {
      const text = `${j.title} ${j.description || ''}`;
      return {
        id: `live:${j.id}`, source: 'live', title: j.title?.replace(/<[^>]+>/g, '') || 'Untitled',
        company: j.company?.display_name || 'Company not listed', location: j.location?.display_name || '',
        classification: classify(text),
        job_type: /intern/i.test(text) ? 'internship' : j.contract_time === 'part_time' ? 'part_time' : j.contract_type === 'contract' ? 'contract' : 'full_time',
        salary: j.salary_min ? `₹${Math.round(j.salary_min).toLocaleString('en-IN')}${j.salary_max && j.salary_max !== j.salary_min ? ` – ₹${Math.round(j.salary_max).toLocaleString('en-IN')}` : ''}` : '',
        description: (j.description || '').replace(/<[^>]+>/g, '').slice(0, 300),
        apply_url: j.redirect_url, created_at: j.created,
      };
    }).filter((j) => !classification || j.classification === classification);
    const data = { enabled: true, items };
    liveCache.set(key, { at: Date.now(), data });
    return data;
  } catch (e) {
    return { enabled: true, items: [], error: 'Live job search is unavailable right now' };
  }
}

router.get('/jobs/meta', async (req, res) => {
  res.json({
    classifications: CLASSIFICATIONS.map(({ id, label, keywords }) => ({ id, label, keyword: keywords[0] })),
    types: JOB_TYPES,
    live_enabled: !!(ADZUNA_ID && ADZUNA_KEY),
  });
});

router.get('/jobs', async (req, res) => {
  const filters = {
    classification: byId[req.query.classification] ? req.query.classification : '',
    type: JOB_TYPES[req.query.type] ? req.query.type : '',
    q: str(req.query.q, 80),
    location: str(req.query.location, 80),
  };
  const where = ['active = 1'];
  const params = [];
  if (filters.classification) { where.push('classification = ?'); params.push(filters.classification); }
  if (filters.type) { where.push('job_type = ?'); params.push(filters.type); }
  if (filters.location) { where.push('location ILIKE ?'); params.push(`%${filters.location}%`); }
  if (filters.q) { where.push('(title ILIKE ? OR company ILIKE ? OR description ILIKE ?)'); params.push(...Array(3).fill(`%${filters.q}%`)); }
  const board = (await db.prepare(`SELECT * FROM jobs WHERE ${where.join(' AND ')} ORDER BY created_at DESC, id DESC LIMIT 100`)
    .all(...params)).map((j) => ({ ...j, source: 'board' }));
  const live = req.query.source === 'board' ? { enabled: !!ADZUNA_ID, items: [] } : await liveJobs(filters);
  res.json({ board: req.query.source === 'live' ? [] : board, live: live.items, live_enabled: live.enabled, live_error: live.error || null });
});

// ---- Admin job board ----

router.get('/admin/jobs', requireAdmin, async (req, res) => {
  res.json(await db.prepare('SELECT * FROM jobs ORDER BY created_at DESC, id DESC LIMIT 200').all());
});

router.post('/admin/jobs', requireAdmin, async (req, res) => {
  const title = str(req.body.title, 120);
  const company = str(req.body.company, 120);
  if (!title || !company) return res.status(400).json({ error: 'Title and clinic/company are required' });
  if (!byId[req.body.classification]) return res.status(400).json({ error: 'Choose a classification' });
  const applyUrl = cleanUrl(req.body.apply_url);
  if (req.body.apply_url && !applyUrl) return res.status(400).json({ error: 'Apply link must start with http:// or https://' });
  const { lastInsertRowid } = await db.prepare(`
    INSERT INTO jobs (title, company, location, classification, job_type, salary, description, apply_url, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title, company, str(req.body.location, 120), req.body.classification,
    JOB_TYPES[req.body.job_type] ? req.body.job_type : 'full_time', str(req.body.salary, 60),
    str(req.body.description, 2000), applyUrl, req.user.id,
  );
  res.status(201).json({ id: Number(lastInsertRowid) });
});

router.put('/admin/jobs/:id', requireAdmin, async (req, res) => {
  await db.prepare('UPDATE jobs SET active = ? WHERE id = ?').run(req.body.active ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

router.delete('/admin/jobs/:id', requireAdmin, async (req, res) => {
  await db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
