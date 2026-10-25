const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../helpers');

const router = express.Router();
const OPTIONS = ['a', 'b', 'c', 'd'];

router.get('/tests', requireAuth, (req, res) => {
  const params = [req.user.id];
  let where = 'WHERE t.published = 1';
  if (req.query.subject) {
    where += ' AND t.subject = ?';
    params.push(String(req.query.subject));
  }
  const rows = db.prepare(`
    SELECT t.id, t.title, t.subject, t.description, t.duration_min, t.created_at,
      (SELECT COUNT(*) FROM questions q WHERE q.test_id = t.id) AS question_count,
      (SELECT MAX(score * 100 / total) FROM attempts a WHERE a.test_id = t.id AND a.user_id = ? AND total > 0) AS best_pct
    FROM tests t ${where} ORDER BY t.created_at DESC
  `).all(...params);
  res.json(rows.filter((t) => t.question_count > 0));
});

router.get('/tests/:id', requireAuth, (req, res) => {
  const t = db.prepare('SELECT * FROM tests WHERE id = ?').get(req.params.id);
  if (!t || (!t.published && req.user.role !== 'admin')) return res.status(404).json({ error: 'Test not found' });
  // Correct answers are never sent before submission.
  const questions = db.prepare('SELECT id, question, opt_a, opt_b, opt_c, opt_d FROM questions WHERE test_id = ? ORDER BY id')
    .all(t.id);
  res.json({ id: t.id, title: t.title, subject: t.subject, description: t.description, duration_min: t.duration_min, questions });
});

router.post('/tests/:id/submit', requireAuth, (req, res) => {
  const t = db.prepare('SELECT * FROM tests WHERE id = ?').get(req.params.id);
  if (!t || (!t.published && req.user.role !== 'admin')) return res.status(404).json({ error: 'Test not found' });
  const questions = db.prepare('SELECT id, correct FROM questions WHERE test_id = ?').all(t.id);
  const given = req.body.answers || {};
  const answers = {};
  let score = 0;
  for (const q of questions) {
    const a = OPTIONS.includes(given[q.id]) ? given[q.id] : null;
    answers[q.id] = a;
    if (a === q.correct) score++;
  }
  const { lastInsertRowid } = db.prepare('INSERT INTO attempts (test_id, user_id, score, total, answers) VALUES (?, ?, ?, ?, ?)')
    .run(t.id, req.user.id, score, questions.length, JSON.stringify(answers));
  res.status(201).json({ attempt_id: Number(lastInsertRowid), score, total: questions.length });
});

router.get('/attempts/:id', requireAuth, (req, res) => {
  const a = db.prepare(`
    SELECT a.*, t.title, t.subject FROM attempts a JOIN tests t ON t.id = a.test_id WHERE a.id = ?
  `).get(req.params.id);
  if (!a || (a.user_id !== req.user.id && req.user.role !== 'admin')) return res.status(404).json({ error: 'Result not found' });
  const answers = JSON.parse(a.answers);
  const questions = db.prepare('SELECT * FROM questions WHERE test_id = ? ORDER BY id').all(a.test_id)
    .map((q) => ({ ...q, chosen: answers[q.id] ?? null }));
  res.json({
    id: a.id, test_id: a.test_id, title: a.title, subject: a.subject,
    score: a.score, total: a.total, created_at: a.created_at, questions,
  });
});

router.get('/me/attempts', requireAuth, (req, res) => {
  res.json(db.prepare(`
    SELECT a.id, a.test_id, a.score, a.total, a.created_at, t.title, t.subject
    FROM attempts a JOIN tests t ON t.id = a.test_id WHERE a.user_id = ? ORDER BY a.created_at DESC, a.id DESC LIMIT 50
  `).all(req.user.id));
});

module.exports = router;
