import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, useApi } from '../../api';
import { useToast } from '../../auth';
import { useSubjects } from '../../subjects';
import { TrashIcon, CheckIcon } from '../../components/Icons';

const blankQ = { question: '', opt_a: '', opt_b: '', opt_c: '', opt_d: '', correct: '', explanation: '' };

export default function TestEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const subjects = useSubjects();
  const { data: test, error, reload } = useApi(`/admin/tests/${id}`);
  const [meta, setMeta] = useState(null);
  const [q, setQ] = useState(blankQ);

  useEffect(() => {
    if (test) setMeta({ title: test.title, subject: test.subject, duration_min: test.duration_min, description: test.description });
  }, [test]);

  if (error) return <div className="empty"><h3>{error.message}</h3></div>;
  if (!test || !meta) return <div className="narrow"><div className="card skeleton" /></div>;

  const run = async (fn, msg) => {
    try {
      await fn();
      if (msg) toast(msg, 'success');
      reload();
      return true;
    } catch (e) {
      toast(e.message, 'error');
      return false;
    }
  };

  const addQuestion = async (e) => {
    e.preventDefault();
    if (await run(() => api.post(`/admin/tests/${id}/questions`, q), 'Question added')) setQ(blankQ);
  };

  const setM = (k) => (e) => setMeta({ ...meta, [k]: e.target.value });
  const setF = (k) => (e) => setQ({ ...q, [k]: e.target.value });

  return (
    <div className="narrow">
      <Link to="/admin?tab=tests" className="link-btn back">← All tests</Link>
      <form className="card form" onSubmit={(e) => { e.preventDefault(); run(() => api.put(`/admin/tests/${id}`, meta), 'Test saved'); }}>
        <div className="row gap wrap">
          <h2 className="grow">Edit test</h2>
          <label className="switch">
            <input type="checkbox" checked={!!test.published} disabled={!test.questions.length && !test.published}
              onChange={() => run(() => api.put(`/admin/tests/${id}`, { published: !test.published }), test.published ? 'Moved to drafts' : 'Published')} />
            <span className="switch-track" />
            <span className="small">{test.published ? 'Published' : 'Draft'}</span>
          </label>
        </div>
        <div className="form-grid">
          <label>Title<input value={meta.title} onChange={setM('title')} required /></label>
          <label>Subject
            <select value={meta.subject} onChange={setM('subject')}>{subjects.map((s) => <option key={s}>{s}</option>)}</select>
          </label>
          <label>Duration (min)<input type="number" min={1} max={240} value={meta.duration_min} onChange={setM('duration_min')} /></label>
        </div>
        <label>Description<input value={meta.description} onChange={setM('description')} /></label>
        <div className="row gap">
          <button className="btn btn-primary">Save details</button>
          <button type="button" className="btn btn-danger-ghost" onClick={async () => {
            if (!confirm('Delete this test and all its results?')) return;
            await api.del(`/admin/tests/${id}`);
            navigate('/admin?tab=tests');
          }}><TrashIcon size={16} /> Delete test</button>
        </div>
      </form>

      <h2 className="section-title">Questions ({test.questions.length})</h2>
      {test.questions.map((item, i) => (
        <div key={item.id} className="card question">
          <div className="row gap">
            <p className="strong grow"><span className="q-num">Q{i + 1}.</span> {item.question}</p>
            <button className="icon-btn" aria-label="Delete question" onClick={() => confirm('Delete this question?') && run(() => api.del(`/admin/questions/${item.id}`))}><TrashIcon size={18} /></button>
          </div>
          {['a', 'b', 'c', 'd'].map((o) => (
            <div key={o} className={`option ${item.correct === o ? 'option-correct' : ''}`}>
              <span className="option-key">{o.toUpperCase()}</span> {item[`opt_${o}`]}
              {item.correct === o && <CheckIcon size={18} className="push-right" />}
            </div>
          ))}
          {item.explanation && <p className="explain">{item.explanation}</p>}
        </div>
      ))}

      <form className="card form" onSubmit={addQuestion}>
        <h3>Add question</h3>
        <label>Question<textarea rows={2} value={q.question} onChange={setF('question')} required /></label>
        {['a', 'b', 'c', 'd'].map((o) => (
          <div key={o} className="option-input">
            <label className="radio-pick" title="Mark as correct">
              <input type="radio" name="correct" checked={q.correct === o} onChange={() => setQ({ ...q, correct: o })} />
              <span>{o.toUpperCase()}</span>
            </label>
            <input value={q[`opt_${o}`]} onChange={setF(`opt_${o}`)} placeholder={`Option ${o.toUpperCase()}`} required />
          </div>
        ))}
        <p className="muted small">Select the circle next to the correct answer.</p>
        <label>Explanation<textarea rows={2} value={q.explanation} onChange={setF('explanation')} placeholder="Optional — shown after submission" /></label>
        <button className="btn btn-primary" disabled={!q.correct}>Add question</button>
      </form>
    </div>
  );
}
