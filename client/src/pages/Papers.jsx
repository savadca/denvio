import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { api, useApi } from '../api';
import { useAuth, useToast } from '../auth';
import { useSubjects } from '../subjects';
import { uploadFile } from '../upload';
import Modal from '../components/Modal';
import { FilePicker, FileList } from '../components/UploadNotesModal';
import { PaperIcon, PlusIcon, ChevronLeftIcon, DownloadIcon, ExternalIcon, TrashIcon, SettingsIcon, FileIcon } from '../components/Icons';
import { subjectHue, fileKind } from '../utils';

const thisYear = new Date().getFullYear();

// ---------- Admin modals ----------

function ExamFormModal({ exam, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: exam?.name || '', emoji: exam?.emoji || '', description: exam?.description || '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = exam ? await api.put(`/admin/paper-exams/${exam.id}`, form) : await api.post('/admin/paper-exams', form);
      toast(exam ? 'Exam updated' : 'Exam added', 'success');
      onSaved(r.id || exam.id);
    } catch (err) {
      toast(err.message, 'error');
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={exam ? 'Edit exam' : 'New exam category'} className="upload-modal">
      <form className="form upload-form" onSubmit={save}>
        <div className="form-grid">
          <label>Exam name<input value={form.name} onChange={set('name')} required maxLength={80} placeholder="e.g. NEET MDS, KUHS BDS Final Year" autoFocus /></label>
          <label>Emoji (optional)<input value={form.emoji} onChange={set('emoji')} maxLength={8} placeholder="📝" /></label>
        </div>
        <label>Description (optional)<textarea rows={2} value={form.description} onChange={set('description')} maxLength={300} placeholder="Conducting body, pattern, number of questions…" /></label>
        <button className="btn btn-primary btn-block" disabled={busy || !form.name.trim()}>{busy ? 'Saving…' : exam ? 'Save changes' : 'Add exam'}</button>
      </form>
    </Modal>
  );
}

function AddPapersModal({ exam, defaults, subjects, onClose, onAdded }) {
  const { user } = useAuth();
  const toast = useToast();
  const [year, setYear] = useState(defaults.year || thisYear);
  const [subject, setSubject] = useState(defaults.subject || '');
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null); // { index, percent }

  const submit = async (e) => {
    e.preventDefault();
    if (!files.length) return setError('Choose at least one file');
    setError('');
    setBusy(true);
    try {
      // Upload every file first, then save them together so a failed upload saves nothing.
      const uploaded = [];
      for (let i = 0; i < files.length; i++) {
        setProgress({ index: i, percent: 0 });
        const url = await uploadFile(files[i].file, {
          folder: `papers/${user.id}`,
          handleUploadUrl: '/api/papers/upload',
          onProgress: (p) => setProgress({ index: i, percent: Math.round(p) }),
        });
        uploaded.push({ file_url: url, file_name: files[i].file.name, title: files[i].title });
      }
      setProgress(null);
      const r = await api.post('/admin/papers', { exam_id: exam.id, year, subject, files: uploaded });
      toast(`${r.count} paper${r.count > 1 ? 's' : ''} added to ${year} · ${subject}`, 'success');
      onAdded({ year: Number(year), subject });
    } catch (err) {
      setError(err.message || 'Upload failed');
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <Modal open onClose={() => !busy && onClose()} title={`Add papers · ${exam.name}`} className="upload-modal">
      <form className="form upload-form" onSubmit={submit}>
        <div className="form-grid">
          <label>Year<input type="number" min={1990} max={thisYear + 1} value={year} onChange={(e) => setYear(e.target.value)} required disabled={busy} /></label>
          <label>Subject
            <input list="paper-subjects" value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={80} disabled={busy} placeholder="e.g. Oral Pathology, Full paper" />
            <datalist id="paper-subjects">{subjects.map((s) => <option key={s} value={s} />)}</datalist>
          </label>
        </div>
        <FilePicker files={files} setFiles={setFiles} disabled={busy} onError={setError} label="Choose question paper files"
          hint="PDF or images (scans) · up to 25 MB each · select several at once" />
        {files.length > 0 && <FileList files={files} setFiles={setFiles} disabled={busy} current={progress?.index} />}
        {progress && (
          <div className="upload-progress" aria-label={`Uploading ${progress.percent}%`}>
            <span style={{ width: `${((progress.index + progress.percent / 100) / files.length) * 100}%` }} />
          </div>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy
            ? progress ? `File ${progress.index + 1}/${files.length} · Uploading… ${progress.percent}%` : 'Saving…'
            : files.length ? `Add ${files.length} paper${files.length === 1 ? '' : 's'}` : 'Add papers'}
        </button>
      </form>
    </Modal>
  );
}

// ---------- Browsing ----------

function ExamCard({ exam, onOpen, index }) {
  return (
    <button className="exam-card" style={{ '--h': subjectHue(exam.name), animationDelay: `${Math.min(index, 18) * 0.04}s` }} onClick={() => onOpen(exam.id)}>
      <span className="exam-emoji" aria-hidden="true">{exam.emoji || '📝'}</span>
      <span className="exam-text">
        <span className="exam-name">{exam.name}</span>
        <span className="exam-info">
          {exam.year_count ? `${exam.year_count} ${exam.year_count === 1 ? 'year' : 'years'} · latest ${exam.latest_year}` : exam.description || 'No papers yet'}
        </span>
      </span>
      <span className="exam-count"><b>{exam.paper_count}</b>{exam.paper_count === 1 ? 'paper' : 'papers'}</span>
    </button>
  );
}

function PaperRow({ paper, isAdmin, onDelete }) {
  const file = `/api/papers/${paper.id}/file`;
  return (
    <div className="list-row paper-row">
      <span className="paper-kind">{fileKind(paper.file_mime)}</span>
      <div className="grow">
        <a className="strong" href={file} target="_blank" rel="noreferrer">{paper.title}</a>
        <div className="muted small">{paper.downloads} {paper.downloads === 1 ? 'download' : 'downloads'}</div>
      </div>
      <a className="icon-btn" href={file} target="_blank" rel="noreferrer" aria-label={`Open ${paper.title}`}><ExternalIcon size={18} /></a>
      <a className="icon-btn" href={`${file}?download=1`} aria-label={`Download ${paper.title}`}><DownloadIcon size={18} /></a>
      {isAdmin && <button className="icon-btn" aria-label={`Delete ${paper.title}`} onClick={() => onDelete(paper)}><TrashIcon size={18} /></button>}
    </div>
  );
}

function ExamView({ examId, year, go, isAdmin }) {
  const toast = useToast();
  const bdsSubjects = useSubjects();
  const { data: exam, error, reload } = useApi(`/papers/exams/${examId}`);
  const [extraYears, setExtraYears] = useState([]); // years an admin added that have no papers yet
  const [adding, setAdding] = useState(null); // defaults for AddPapersModal
  const [editing, setEditing] = useState(false);

  const years = useMemo(() => {
    const set = new Set([...(exam?.papers || []).map((p) => p.year), ...extraYears]);
    return [...set].sort((a, b) => b - a);
  }, [exam, extraYears]);
  const examSubjects = useMemo(() => [...new Set((exam?.papers || []).map((p) => p.subject))], [exam]);

  if (error) return <p className="form-error">{error.message}</p>;
  if (!exam) return <div className="card skeleton tile-skeleton" />;

  const current = years.includes(year) ? year : years[0];
  const bySubject = {};
  exam.papers.filter((p) => p.year === current).forEach((p) => (bySubject[p.subject] ||= []).push(p));

  const addYear = () => {
    const y = Number(prompt(`Add a year (1990–${thisYear + 1})`, String(thisYear)));
    if (!Number.isInteger(y) || y < 1990 || y > thisYear + 1) return;
    setExtraYears((list) => (list.includes(y) ? list : [...list, y]));
    go({ year: String(y) });
  };
  const run = async (fn, msg) => {
    try {
      await fn();
      toast(msg);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  const deletePaper = (p) => confirm(`Delete “${p.title}”?`) && run(() => api.del(`/admin/papers/${p.id}`), 'Paper deleted');
  const deleteExam = async () => {
    if (!confirm(`Delete ${exam.name} and all ${exam.paper_count} of its papers? This cannot be undone.`)) return;
    try {
      await api.del(`/admin/paper-exams/${exam.id}`);
      toast('Exam deleted');
      go({ exam: '', year: '' });
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="home">
      <header className="subject-hero" style={{ '--h': subjectHue(exam.name) }}>
        <button className="subject-back" onClick={() => go({ exam: '', year: '' })}><ChevronLeftIcon size={18} /> All exams</button>
        <div className="subject-hero-row">
          <span className="subject-badge subject-badge-lg" aria-hidden="true">{exam.emoji || '📝'}</span>
          <div className="grow">
            <h1>{exam.name}</h1>
            <p>{exam.description ? `${exam.description} · ` : ''}{exam.paper_count} {exam.paper_count === 1 ? 'paper' : 'papers'}</p>
          </div>
          {isAdmin && (
            <div className="row gap">
              <button className="btn btn-light" onClick={() => setAdding({ year: current })}><PlusIcon size={18} /> Add papers</button>
              <button className="btn btn-light" aria-label="Edit exam" onClick={() => setEditing(true)}><SettingsIcon size={18} /></button>
              <button className="btn btn-light" aria-label="Delete exam" onClick={deleteExam}><TrashIcon size={18} /></button>
            </div>
          )}
        </div>
      </header>

      {(years.length > 0 || isAdmin) && (
        <div className="pills" role="tablist" aria-label="Year">
          {years.map((y) => (
            <button key={y} role="tab" aria-selected={y === current} className={`pill ${y === current ? 'on' : ''}`} onClick={() => go({ year: String(y) })}>{y}</button>
          ))}
          {isAdmin && <button className="pill" onClick={addYear}><PlusIcon size={14} /> Add year</button>}
        </div>
      )}

      {!current ? (
        <div className="empty empty-glow">
          <span className="empty-orb"><PaperIcon size={34} /></span>
          <h3>No question papers yet</h3>
          <p className="muted">{isAdmin ? 'Add a year, then upload subject-wise papers.' : 'Admins are adding previous year papers — check back soon.'}</p>
          {isAdmin && <button className="btn btn-primary btn-glow" onClick={() => setAdding({})}><PlusIcon size={18} /> Add papers</button>}
        </div>
      ) : (
        <>
          {Object.keys(bySubject).length === 0 && (
            <div className="empty">
              <h3>No papers for {current} yet</h3>
              {isAdmin && <button className="btn btn-primary" onClick={() => setAdding({ year: current })}><PlusIcon size={18} /> Add {current} papers</button>}
            </div>
          )}
          {Object.entries(bySubject).map(([subject, papers]) => (
            <section key={subject} className="paper-subject">
              <div className="section-head">
                <h2><FileIcon size={18} /> {subject}</h2>
                <span className="muted small">{papers.length} {papers.length === 1 ? 'paper' : 'papers'}</span>
                {isAdmin && <button className="btn btn-sm push-right" onClick={() => setAdding({ year: current, subject })}><PlusIcon size={14} /> Add</button>}
              </div>
              <div className="card list">
                {papers.map((p) => <PaperRow key={p.id} paper={p} isAdmin={isAdmin} onDelete={deletePaper} />)}
              </div>
            </section>
          ))}
        </>
      )}

      {isAdmin && createPortal(
        <button className="fab" onClick={() => setAdding({ year: current })} aria-label="Add papers"><PlusIcon size={26} /></button>,
        document.body,
      )}
      {adding && (
        <AddPapersModal exam={exam} defaults={adding} subjects={[...new Set([...examSubjects, 'Full paper', ...bdsSubjects])]}
          onClose={() => setAdding(null)}
          onAdded={({ year: y }) => { setAdding(null); go({ year: String(y) }); reload(); }} />
      )}
      {editing && <ExamFormModal exam={exam} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />}
    </div>
  );
}

export default function Papers() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const [params, setParams] = useSearchParams();
  const examId = /^\d+$/.test(params.get('exam') || '') ? params.get('exam') : '';
  const year = Number(params.get('year')) || null;
  const [creating, setCreating] = useState(false);
  const exams = useApi(examId ? null : '/papers/exams');

  const go = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next);
  };

  if (examId) return <ExamView key={examId} examId={examId} year={year} go={go} isAdmin={isAdmin} />;

  const total = (exams.data || []).reduce((sum, e) => sum + e.paper_count, 0);
  return (
    <div className="home">
      <header className="page-hero page-hero-papers">
        <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
        <span className="page-hero-icon"><PaperIcon size={26} /></span>
        <div className="grow">
          <h1>Question Papers</h1>
          <p>Previous year question papers, exam by exam, year by year and subject-wise. {total} {total === 1 ? 'paper' : 'papers'} so far.</p>
        </div>
        {isAdmin && <button className="btn btn-light" onClick={() => setCreating(true)}><PlusIcon size={18} /> Add exam</button>}
      </header>

      {exams.loading && !exams.data && <div className="exam-grid">{[0, 1, 2].map((i) => <div key={i} className="card skeleton tile-skeleton" />)}</div>}
      {exams.error && <p className="form-error">{exams.error.message}</p>}
      {exams.data?.length === 0 && (
        <div className="empty empty-glow">
          <span className="empty-orb"><PaperIcon size={34} /></span>
          <h3>No exams added yet</h3>
          <p className="muted">{isAdmin ? 'Create an exam category to start adding previous year papers.' : 'Question papers will appear here soon.'}</p>
          {isAdmin && <button className="btn btn-primary btn-glow" onClick={() => setCreating(true)}><PlusIcon size={18} /> Add exam</button>}
        </div>
      )}
      {exams.data?.length > 0 && (
        <div className="exam-grid">
          {exams.data.map((e, i) => <ExamCard key={e.id} exam={e} index={i} onOpen={(id) => go({ exam: String(id), year: '' })} />)}
        </div>
      )}

      {isAdmin && createPortal(
        <button className="fab" onClick={() => setCreating(true)} aria-label="Add exam"><PlusIcon size={26} /></button>,
        document.body,
      )}
      {creating && (
        <ExamFormModal onClose={() => setCreating(false)} onSaved={(id) => { setCreating(false); go({ exam: String(id), year: '' }); }} />
      )}
    </div>
  );
}
