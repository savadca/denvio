import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, useApi } from '../api';
import { useAuth, useToast } from '../auth';
import { useSubjects, useExams, TopicOptions } from '../subjects';
import Modal from '../components/Modal';
import { ClockIcon, CheckIcon, XIcon, PlusIcon, TestIcon, ChevronLeftIcon, ChevronRightIcon, GridIcon } from '../components/Icons';
import { subjectHue, subjectEmoji } from '../utils';

const OPTIONS = ['a', 'b', 'c', 'd'];

function CreateTestModal({ onClose }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ title: '', subject: '', duration_min: 15, description: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { id } = await api.post('/admin/tests', form);
      toast('Test created — now add the questions', 'success');
      navigate(`/admin/tests/${id}`);
    } catch (err) {
      toast(err.message, 'error');
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="New mock test" className="upload-modal">
      <form className="form upload-form" onSubmit={create}>
        <label>Test title<input value={form.title} onChange={set('title')} required maxLength={120} placeholder="e.g. NEET MDS — Prosthodontics Set 1" autoFocus /></label>
        <label>Subject / exam
          <select value={form.subject} onChange={set('subject')} required>
            <option value="">Select…</option>
            <TopicOptions />
          </select>
        </label>
        <label>Time limit (minutes)<input type="number" min={1} max={240} value={form.duration_min} onChange={set('duration_min')} /></label>
        <label>Description (optional)<input value={form.description} onChange={set('description')} maxLength={500} placeholder="Topics covered, difficulty…" /></label>
        <p className="muted small">Next you’ll add each question with four options and mark the correct answer. Students see the test once you publish it.</p>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creating…' : 'Create & add questions'}</button>
      </form>
    </Modal>
  );
}

export function TestList() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const subjects = useSubjects();
  const exams = useExams();
  const [topic, setTopic] = useState('');
  const [creating, setCreating] = useState(false);
  const { data, loading } = useApi(`/tests${topic ? `?subject=${encodeURIComponent(topic)}` : ''}`);

  return (
    <div className="home">
      <header className="page-hero page-hero-tests">
        <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
        <span className="page-hero-icon"><TestIcon size={26} /></span>
        <div className="grow">
          <h1>Mock tests</h1>
          <p>Timed MCQ practice for BDS subjects, NEET MDS, INI-CET and international exams. One question at a time, score at the end.</p>
        </div>
        {isAdmin && <button className="btn btn-light hero-upload" onClick={() => setCreating(true)}><PlusIcon size={18} /> New mock test</button>}
      </header>

      <div className="pills" role="tablist" aria-label="Filter tests">
        <button role="tab" aria-selected={!topic} className={`pill ${!topic ? 'on' : ''}`} onClick={() => setTopic('')}>✨ All</button>
        {[...exams, ...subjects].map((s) => (
          <button key={s} role="tab" aria-selected={topic === s} className={`pill ${topic === s ? 'on' : ''}`} style={{ '--h': subjectHue(s) }} onClick={() => setTopic(s)}>
            <span aria-hidden="true">{subjectEmoji(s)}</span> {s}
          </button>
        ))}
      </div>

      {loading && !data && <div className="test-grid">{[0, 1, 2].map((i) => <div key={i} className="card skeleton tile-skeleton" />)}</div>}
      {data?.length === 0 && (
        <div className="empty empty-glow">
          <span className="empty-orb"><TestIcon size={36} /></span>
          <h3>No mock tests {topic ? `for ${topic} ` : ''}yet</h3>
          {isAdmin
            ? <><p className="muted">Create the first one — add questions with four options and mark the correct answer.</p>
                <button className="btn btn-primary btn-glow" onClick={() => setCreating(true)}><PlusIcon size={18} /> New mock test</button></>
            : <p className="muted">Admins publish new tests regularly — check back soon.</p>}
        </div>
      )}
      <div className="test-grid">
        {data?.map((t, i) => (
          <Link key={t.id} to={`/tests/${t.id}`} className="card test-card note-in" style={{ '--h': subjectHue(t.subject), animationDelay: `${Math.min(i, 8) * 0.04}s` }}>
            <span className="test-topic"><span aria-hidden="true">{subjectEmoji(t.subject)}</span> {t.subject}</span>
            <h3>{t.title}</h3>
            {t.description && <p className="muted small clamp">{t.description}</p>}
            <div className="test-meta">
              <span>{t.question_count} questions</span>
              <span><ClockIcon size={14} /> {t.duration_min} min</span>
              {t.best_pct !== null && <span className={`score-pill ${t.best_pct >= 50 ? 'pass' : 'fail'}`}>Best {t.best_pct}%</span>}
            </div>
            <span className="test-go">{t.best_pct !== null ? 'Retake →' : 'Start →'}</span>
          </Link>
        ))}
      </div>

      {isAdmin && createPortal(
        <button className="fab" onClick={() => setCreating(true)} aria-label="New mock test" title="New mock test"><PlusIcon size={26} /></button>,
        document.body,
      )}
      {creating && <CreateTestModal onClose={() => setCreating(false)} />}
    </div>
  );
}

export function TakeTest() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: test, error, loading } = useApi(`/tests/${id}`);
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [showMap, setShowMap] = useState(false);
  const [left, setLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const submitted = useRef(false);
  const answersRef = useRef(answers);
  // Update the ref synchronously (state updaters run later, at render time) so a
  // "Finish" tapped right after choosing still includes that answer.
  const choose = (qid, option) => {
    const next = { ...answersRef.current, [qid]: option };
    answersRef.current = next;
    setAnswers(next);
  };

  const submit = async () => {
    if (submitted.current) return;
    submitted.current = true;
    setSubmitting(true);
    try {
      const r = await api.post(`/tests/${id}/submit`, { answers: answersRef.current });
      navigate(`/results/${r.attempt_id}`, { replace: true });
    } catch (e) {
      submitted.current = false;
      setSubmitting(false);
      toast(e.message, 'error');
    }
  };

  useEffect(() => {
    if (!started) return undefined;
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [started]);

  useEffect(() => {
    if (started && left <= 0) {
      toast('Time is up — submitting your answers');
      submit();
    }
  }, [left, started]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard: A–D or 1–4 to answer, ←/→ to move between questions.
  useEffect(() => {
    if (!started || !test) return undefined;
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      const q = test.questions[current];
      const k = e.key.toLowerCase();
      const idx = OPTIONS.indexOf(k) >= 0 ? OPTIONS.indexOf(k) : ['1', '2', '3', '4'].indexOf(k);
      if (idx >= 0) choose(q.id, OPTIONS[idx]);
      if (e.key === 'ArrowRight') setCurrent((c) => Math.min(c + 1, test.questions.length - 1));
      if (e.key === 'ArrowLeft') setCurrent((c) => Math.max(c - 1, 0));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [started, test, current]);

  if (loading) return <div className="narrow"><div className="card skeleton" /></div>;
  if (error) return <div className="empty"><h3>{error.message}</h3></div>;

  const total = test.questions.length;
  if (!started) {
    return (
      <div className="narrow">
        <div className="card center-card test-intro" style={{ '--h': subjectHue(test.subject) }}>
          <span className="test-intro-emoji" aria-hidden="true">{subjectEmoji(test.subject)}</span>
          <span className="test-topic">{test.subject}</span>
          <h2>{test.title}</h2>
          {test.description && <p className="muted">{test.description}</p>}
          <div className="intro-stats">
            <span><b>{total}</b> questions</span>
            <span><b>{test.duration_min}</b> minutes</span>
            <span><b>1</b> mark each</span>
          </div>
          <p className="muted small">Questions appear one at a time. You can go back and change answers before finishing. Your score is shown at the end.</p>
          {total === 0
            ? <p className="form-error">This test has no questions yet.</p>
            : <button className="btn btn-primary btn-glow" onClick={() => { setLeft(test.duration_min * 60); setStarted(true); }}>Start test</button>}
        </div>
      </div>
    );
  }

  const q = test.questions[current];
  const answered = Object.keys(answers).length;
  const isLast = current === total - 1;
  const mm = String(Math.max(0, Math.floor(left / 60))).padStart(2, '0');
  const ss = String(Math.max(0, left % 60)).padStart(2, '0');
  const finish = () => {
    const missing = total - answered;
    if (missing > 0 && !confirm(`${missing} question${missing > 1 ? 's are' : ' is'} unanswered. Finish and see your score anyway?`)) return;
    submit();
  };

  return (
    <div className="narrow quiz">
      <div className="test-bar">
        <span className="strong clamp">{test.title}</span>
        <button className="btn btn-sm quiz-map-btn" onClick={() => setShowMap((v) => !v)} aria-expanded={showMap}><GridIcon size={14} /> {answered}/{total}</button>
        <span className={`timer ${left < 60 ? 'timer-low' : ''}`}><ClockIcon size={16} /> {mm}:{ss}</span>
      </div>
      <div className="progress"><span style={{ width: `${((current + 1) / total) * 100}%` }} /></div>

      {showMap && (
        <div className="quiz-map" role="navigation" aria-label="Questions">
          {test.questions.map((item, i) => (
            <button key={item.id} className={`${answers[item.id] ? 'done' : ''} ${i === current ? 'here' : ''}`} onClick={() => { setCurrent(i); setShowMap(false); }}>{i + 1}</button>
          ))}
        </div>
      )}

      <div className="card question quiz-card" key={q.id}>
        <div className="quiz-count">Question {current + 1} of {total}</div>
        <p className="quiz-question">{q.question}</p>
        <div className="quiz-options" role="radiogroup" aria-label={`Question ${current + 1}`}>
          {OPTIONS.map((o) => (
            <button
              key={o} type="button" role="radio" aria-checked={answers[q.id] === o}
              className={`option ${answers[q.id] === o ? 'option-on' : ''}`}
              onClick={() => choose(q.id, o)}
            >
              <span className="option-key">{o.toUpperCase()}</span> <span className="grow">{q[`opt_${o}`]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="quiz-nav">
        <button className="btn" onClick={() => setCurrent((c) => c - 1)} disabled={current === 0}><ChevronLeftIcon size={18} /> Previous</button>
        {isLast
          ? <button className="btn btn-primary" onClick={finish} disabled={submitting}>{submitting ? 'Scoring…' : 'Finish & see score'}</button>
          : <button className="btn btn-primary" onClick={() => setCurrent((c) => c + 1)}>{answers[q.id] ? 'Next' : 'Skip'} <ChevronRightIcon size={18} /></button>}
      </div>
      {!isLast && answered === total && (
        <button className="link-btn quiz-finish-early" onClick={finish}>All answered — finish now</button>
      )}
    </div>
  );
}

function verdict(pct) {
  if (pct >= 80) return { emoji: '🏆', text: 'Excellent!' };
  if (pct >= 60) return { emoji: '🎉', text: 'Good job!' };
  if (pct >= 40) return { emoji: '💪', text: 'Nearly there' };
  return { emoji: '📚', text: 'Keep practising' };
}

export function Result() {
  const { id } = useParams();
  const { data: r, error, loading } = useApi(`/attempts/${id}`);
  if (loading) return <div className="narrow"><div className="card skeleton" /></div>;
  if (error) return <div className="empty"><h3>{error.message}</h3></div>;
  const pct = r.total ? Math.round((r.score / r.total) * 100) : 0;
  const skipped = r.questions.filter((q) => !q.chosen).length;
  const wrong = r.total - r.score - skipped;
  const v = verdict(pct);
  return (
    <div className="narrow">
      <div className="card center-card result-card">
        <span className="result-emoji" aria-hidden="true">{v.emoji}</span>
        <div className="score-ring" style={{ '--pct': pct }}><span>{pct}%</span></div>
        <h2>{v.text}</h2>
        <p className="muted">{r.title} · {r.subject}</p>
        <div className="result-stats">
          <span className="rs-right"><b>{r.score}</b> correct</span>
          <span className="rs-wrong"><b>{wrong}</b> wrong</span>
          <span className="rs-skip"><b>{skipped}</b> skipped</span>
        </div>
        <div className="row gap center-row">
          <Link className="btn btn-primary" to={`/tests/${r.test_id}`}>Retake</Link>
          <Link className="btn" to="/tests">All tests</Link>
        </div>
      </div>
      <h2 className="section-title">Review answers</h2>
      {r.questions.map((q, i) => {
        const right = q.chosen === q.correct;
        return (
          <div key={q.id} className={`card question ${right ? 'q-right' : 'q-wrong'}`}>
            <p className="strong"><span className="q-num">Q{i + 1}.</span> {q.question}</p>
            {OPTIONS.map((o) => (
              <div key={o} className={`option ${o === q.correct ? 'option-correct' : ''} ${o === q.chosen && !right ? 'option-wrong' : ''}`}>
                <span className="option-key">{o.toUpperCase()}</span> {q[`opt_${o}`]}
                {o === q.correct && <CheckIcon size={18} className="push-right" />}
                {o === q.chosen && !right && <XIcon size={18} className="push-right" />}
              </div>
            ))}
            {!q.chosen && <p className="muted small">Not answered</p>}
            {q.explanation && <p className="explain"><b>Explanation:</b> {q.explanation}</p>}
          </div>
        );
      })}
    </div>
  );
}
