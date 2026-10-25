import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, useApi } from '../api';
import { useToast } from '../auth';
import SubjectStories from '../components/SubjectStories';
import { ClockIcon, CheckIcon, XIcon } from '../components/Icons';

export function TestList() {
  const [subject, setSubject] = useState('');
  const { data, loading } = useApi(`/tests${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`);
  return (
    <div className="narrow wide">
      <h1 className="page-title">Mock tests</h1>
      <SubjectStories value={subject} onChange={setSubject} />
      {loading && !data && <div className="card skeleton" />}
      {data?.length === 0 && <div className="empty"><h3>No tests here yet</h3><p className="muted">Admins publish new subject-wise tests regularly.</p></div>}
      <div className="test-grid">
        {data?.map((t) => (
          <Link key={t.id} to={`/tests/${t.id}`} className="card test-card">
            <span className="test-subject">{t.subject}</span>
            <h3>{t.title}</h3>
            {t.description && <p className="muted small clamp">{t.description}</p>}
            <div className="test-meta">
              <span>{t.question_count} questions</span>
              <span><ClockIcon size={14} /> {t.duration_min} min</span>
              {t.best_pct !== null && <span className={`score-pill ${t.best_pct >= 50 ? 'pass' : 'fail'}`}>Best {t.best_pct}%</span>}
            </div>
          </Link>
        ))}
      </div>
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
  const [left, setLeft] = useState(0);
  const submitting = useRef(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const submit = async () => {
    if (submitting.current) return;
    submitting.current = true;
    try {
      const r = await api.post(`/tests/${id}/submit`, { answers: answersRef.current });
      navigate(`/results/${r.attempt_id}`, { replace: true });
    } catch (e) {
      submitting.current = false;
      toast(e.message, 'error');
    }
  };

  useEffect(() => {
    if (!started) return;
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [started]);

  useEffect(() => {
    if (started && left <= 0) {
      toast('Time is up — submitting your answers');
      submit();
    }
  }, [left, started]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="narrow"><div className="card skeleton" /></div>;
  if (error) return <div className="empty"><h3>{error.message}</h3></div>;

  if (!started) {
    return (
      <div className="narrow">
        <div className="card center-card">
          <span className="test-subject">{test.subject}</span>
          <h2>{test.title}</h2>
          {test.description && <p className="muted">{test.description}</p>}
          <p>{test.questions.length} questions · {test.duration_min} minutes</p>
          <button className="btn btn-primary" onClick={() => { setLeft(test.duration_min * 60); setStarted(true); }}>Start test</button>
        </div>
      </div>
    );
  }

  const answered = Object.keys(answers).length;
  const mm = String(Math.max(0, Math.floor(left / 60))).padStart(2, '0');
  const ss = String(Math.max(0, left % 60)).padStart(2, '0');

  return (
    <div className="narrow">
      <div className="test-bar">
        <span className="strong clamp">{test.title}</span>
        <span className={`timer ${left < 60 ? 'timer-low' : ''}`}><ClockIcon size={16} /> {mm}:{ss}</span>
      </div>
      <div className="progress"><span style={{ width: `${(answered / test.questions.length) * 100}%` }} /></div>
      {test.questions.map((q, i) => (
        <fieldset key={q.id} className="card question">
          <legend><span className="q-num">Q{i + 1}.</span> {q.question}</legend>
          {['a', 'b', 'c', 'd'].map((o) => (
            <label key={o} className={`option ${answers[q.id] === o ? 'option-on' : ''}`}>
              <input type="radio" name={`q${q.id}`} checked={answers[q.id] === o} onChange={() => setAnswers({ ...answers, [q.id]: o })} />
              <span className="option-key">{o.toUpperCase()}</span> {q[`opt_${o}`]}
            </label>
          ))}
        </fieldset>
      ))}
      <button
        className="btn btn-primary btn-block"
        onClick={() => (answered < test.questions.length && !confirm(`You answered ${answered} of ${test.questions.length}. Submit anyway?`) ? null : submit())}
      >
        Submit answers
      </button>
    </div>
  );
}

export function Result() {
  const { id } = useParams();
  const { data: r, error, loading } = useApi(`/attempts/${id}`);
  if (loading) return <div className="narrow"><div className="card skeleton" /></div>;
  if (error) return <div className="empty"><h3>{error.message}</h3></div>;
  const pct = r.total ? Math.round((r.score / r.total) * 100) : 0;
  return (
    <div className="narrow">
      <div className="card center-card">
        <div className="score-ring" style={{ '--pct': pct }}><span>{pct}%</span></div>
        <h2>{r.title}</h2>
        <p className="muted">{r.subject} · {r.score} of {r.total} correct</p>
        <div className="row gap">
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
            {['a', 'b', 'c', 'd'].map((o) => (
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
