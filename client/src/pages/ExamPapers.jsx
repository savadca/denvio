import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, useApi } from '../api';
import { useAuth, useToast } from '../auth';
import { useSubjects, refreshExams } from '../subjects';
import { uploadFile } from '../upload';
import Modal from '../components/Modal';
import { FilePicker, FileList } from '../components/UploadNotesModal';
import { PaperIcon, PlusIcon, DownloadIcon, ExternalIcon, TrashIcon, FileIcon } from '../components/Icons';
import { fileKind, REGIONS } from '../utils';

const thisYear = new Date().getFullYear();
const YEARS = Array.from({ length: thisYear + 2 - 1990 }, (_, i) => thisYear + 1 - i);
const UPCOMING_YEARS = [0, 1, 2, 3].map((i) => thisYear + i); // for predicted papers
const isNew = (date) => Date.now() - new Date(date).getTime() < 14 * 24 * 60 * 60 * 1000;
export const COURSE_YEARS = ['First year', 'Second year', 'Third year', 'Final year'];
export const EXAM_KINDS = [
  { id: 'india', label: '🇮🇳 India — PG entrance' },
  { id: 'abroad', label: '🌍 Abroad — licensing exams' },
  { id: 'university', label: '🎓 University exams' },
  { id: 'other', label: '📚 Other exams' },
];
const OTHER = '__other';

// A dropdown with an "Other (type it)" choice that reveals a text box.
function SelectOrType({ label, value, onChange, options, placeholder, disabled, maxLength = 80 }) {
  const [typing, setTyping] = useState(() => !!value && !options.includes(value));
  return (
    <label>{label}
      <select value={typing ? OTHER : value} required={!typing} disabled={disabled}
        onChange={(e) => {
          const other = e.target.value === OTHER;
          setTyping(other);
          onChange(other ? '' : e.target.value);
        }}>
        <option value="">Select…</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
        <option value={OTHER}>Other (type it)</option>
      </select>
      {typing && <input value={value} onChange={(e) => onChange(e.target.value)} required maxLength={maxLength} placeholder={placeholder} disabled={disabled} autoFocus />}
    </label>
  );
}

// ---------- Admin modals ----------

export function ExamFormModal({ exam, defaultKind = 'india', onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: exam?.name || '', kind: exam?.kind || defaultKind, region: exam?.region || 'india',
    emoji: exam?.emoji || '', description: exam?.description || '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = exam ? await api.put(`/admin/exams/${exam.id}`, form) : await api.post('/admin/exams', form);
      refreshExams();
      toast(exam ? 'Exam updated' : 'Exam added', 'success');
      onSaved(r.name);
    } catch (err) {
      toast(err.message, 'error');
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={exam ? 'Edit exam' : 'Add exam'} className="upload-modal">
      <form className="form upload-form" onSubmit={save}>
        <label>Type of exam
          <select value={form.kind} onChange={set('kind')}>
            {EXAM_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </label>
        <div className="form-grid">
          <label>Exam name<input value={form.name} onChange={set('name')} required maxLength={80} autoFocus
            placeholder={form.kind === 'university' ? 'e.g. KUHS BDS, RGUHS BDS' : 'e.g. NEET MDS'} /></label>
          <label>Emoji (optional)<input value={form.emoji} onChange={set('emoji')} maxLength={8} placeholder="📝" /></label>
        </div>
        <label>Short description (optional)<input value={form.description} onChange={set('description')} maxLength={300} placeholder="Conducting body, country, pattern…" /></label>
        <label>Region for official notifications
          <select value={form.region} onChange={set('region')}>
            {REGIONS.map((r) => <option key={r.id} value={r.id}>{r.flag} {r.label}</option>)}
          </select>
        </label>
        {form.kind === 'university' && <p className="muted small">University exams get course years (First, Second, Third, Final year) before calendar years.</p>}
        {exam && exam.name !== form.name.trim() && form.name.trim() && <p className="muted small">Notes, mock tests and notifications filed under “{exam.name}” move to the new name.</p>}
        <button className="btn btn-primary btn-block" disabled={busy || !form.name.trim()}>{busy ? 'Saving…' : exam ? 'Save changes' : 'Add exam'}</button>
      </form>
    </Modal>
  );
}

function AddPapersModal({ exam, defaults, courseYears, subjects, onClose, onAdded }) {
  const { user } = useAuth();
  const toast = useToast();
  const university = exam.kind === 'university';
  const [courseYear, setCourseYear] = useState(defaults.course_year || '');
  const [year, setYear] = useState(String(defaults.year || ''));
  const [subject, setSubject] = useState(defaults.subject || '');
  const [predicted, setPredicted] = useState(!!defaults.predicted);
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
      const r = await api.post('/admin/papers', { exam_id: exam.id, course_year: courseYear, year, subject, predicted, files: uploaded });
      toast(`${r.count} ${predicted ? 'predicted ' : ''}paper${r.count > 1 ? 's' : ''} added`, 'success');
      onAdded({ course_year: courseYear.trim(), year: Number(year), predicted });
    } catch (err) {
      setError(err.message || 'Upload failed');
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <Modal open onClose={() => !busy && onClose()} title={`Add ${predicted ? 'predicted' : 'question'} papers · ${exam.name}`} className="upload-modal">
      <form className="form upload-form" onSubmit={submit}>
        <div className="type-picker" role="radiogroup" aria-label="Kind of paper">
          <button type="button" role="radio" aria-checked={!predicted} className={`type-chip ${!predicted ? 'on' : ''}`} disabled={busy}
            onClick={() => { setPredicted(false); setYear(''); }}>📄 Previous year paper</button>
          <button type="button" role="radio" aria-checked={predicted} className={`type-chip type-chip-predicted ${predicted ? 'on' : ''}`} disabled={busy}
            onClick={() => { setPredicted(true); setYear(String(thisYear)); }}>🔮 Predicted paper</button>
        </div>
        <div className="form-grid">
          {university && (
            <SelectOrType label="Course year" value={courseYear} onChange={setCourseYear} options={courseYears} placeholder="e.g. Internship, Part 1" disabled={busy} maxLength={40} />
          )}
          <label>{predicted ? 'Predicted for exam year' : 'Year of exam'}
            <select value={year} onChange={(e) => setYear(e.target.value)} required disabled={busy}>
              <option value="">Select year…</option>
              {(predicted ? UPCOMING_YEARS : YEARS).map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
        </div>
        <SelectOrType label="Subject" value={subject} onChange={setSubject} options={subjects} placeholder="Type the subject or paper name" disabled={busy} />
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

function PaperRow({ paper, isAdmin, onDelete, sub }) {
  const { requireLogin } = useAuth();
  const file = `/api/papers/${paper.id}/file`;
  // Papers are listed for everyone; opening or downloading one needs an account.
  const gate = (e) => !requireLogin('Sign up for free to view and download question papers.') && e.preventDefault();
  return (
    <div className="list-row paper-row">
      <span className="paper-kind">{fileKind(paper.file_mime)}</span>
      <div className="grow">
        <a className="strong" href={file} target="_blank" rel="noreferrer" onClick={gate}>{paper.title}</a>
        <div className="muted small">
          {sub ? `${sub} · ` : ''}{paper.downloads} {paper.downloads === 1 ? 'download' : 'downloads'}
          {paper.predicted && isNew(paper.created_at) && <span className="badge badge-new">New</span>}
        </div>
      </div>
      <a className="icon-btn" href={file} target="_blank" rel="noreferrer" onClick={gate} aria-label={`Open ${paper.title}`}><ExternalIcon size={18} /></a>
      <a className="icon-btn" href={`${file}?download=1`} onClick={gate} aria-label={`Download ${paper.title}`}><DownloadIcon size={18} /></a>
      {isAdmin && <button className="icon-btn" aria-label={`Delete ${paper.title}`} onClick={() => onDelete(paper)}><TrashIcon size={18} /></button>}
    </div>
  );
}

// Highlighted area at the top of the tab for papers predicted for upcoming exams.
function PredictedPapers({ papers, university, isAdmin, onDelete, onAdd }) {
  if (!papers.length) {
    return (
      <button className="card predicted-empty" onClick={onAdd}>
        <span aria-hidden="true">🔮</span>
        <span className="grow"><b>Predicted papers</b><span className="muted small">Upload expected questions for an upcoming exam. They are highlighted for students.</span></span>
        <PlusIcon size={18} />
      </button>
    );
  }
  const years = [...new Set(papers.map((p) => p.year))].sort((a, b) => a - b);
  return (
    <section className="predicted" aria-label="Predicted question papers">
      <div className="predicted-head">
        <span className="predicted-orb" aria-hidden="true">🔮</span>
        <div className="grow">
          <h2>Predicted question papers</h2>
          <p>Expected questions for the {years.join(', ')} exam{years.length > 1 ? 's' : ''} · {papers.length} {papers.length === 1 ? 'paper' : 'papers'}</p>
        </div>
        {isAdmin && <button className="btn btn-light btn-sm" onClick={onAdd}><PlusIcon size={14} /> Add</button>}
      </div>
      <div className="card list">
        {papers.map((p) => (
          <PaperRow key={p.id} paper={p} isAdmin={isAdmin} onDelete={onDelete}
            sub={[p.subject, university && p.course_year, `for ${p.year}`].filter(Boolean).join(' · ')} />
        ))}
      </div>
    </section>
  );
}

function Pills({ label, items, current, onPick, addLabel, onAdd }) {
  return (
    <div className="pills" role="tablist" aria-label={label}>
      {items.map((x) => (
        <button key={x} role="tab" aria-selected={x === current} className={`pill ${x === current ? 'on' : ''}`} onClick={() => onPick(x)}>{x}</button>
      ))}
      {onAdd && <button className="pill pill-add" onClick={onAdd}><PlusIcon size={14} /> {addLabel}</button>}
    </div>
  );
}

// The "Question papers" tab of an exam. University exams: course year → year → subject;
// other exams: year → subject. `cy` / `year` come from the URL.
export default function ExamPapers({ exam, cy, year, go, isAdmin, onChange }) {
  const toast = useToast();
  const bdsSubjects = useSubjects();
  const { data, error, reload } = useApi(`/exams/${exam.id}/papers`);
  const [adding, setAdding] = useState(null); // defaults for AddPapersModal
  const university = exam.kind === 'university';
  const all = data || [];
  const papers = all.filter((p) => !p.predicted);
  const predicted = all.filter((p) => p.predicted);

  const courseYears = useMemo(() => {
    const custom = papers.map((p) => p.course_year).filter((c) => c && !COURSE_YEARS.includes(c));
    return [...COURSE_YEARS, ...new Set(custom)];
  }, [papers]);
  const examSubjects = useMemo(() => [...new Set(all.map((p) => p.subject))].sort(), [all]);

  if (error) return <p className="form-error">{error.message}</p>;
  if (!data) return <div className="card skeleton tile-skeleton" />;

  // Course year: the one in the URL, else the first that has papers.
  const currentCy = university ? (courseYears.includes(cy) ? cy : courseYears.find((c) => papers.some((p) => p.course_year === c)) || courseYears[0]) : '';
  const inCy = university ? papers.filter((p) => p.course_year === currentCy) : papers;
  const years = [...new Set(inCy.map((p) => p.year))].sort((a, b) => b - a);
  const currentYear = years.includes(year) ? year : years[0];
  const bySubject = {};
  inCy.filter((p) => p.year === currentYear).forEach((p) => (bySubject[p.subject] ||= []).push(p));

  const add = (extra = {}) => setAdding({ course_year: currentCy, year: currentYear, ...extra });
  const deletePaper = async (p) => {
    if (!confirm(`Delete “${p.title}”?`)) return;
    try {
      await api.del(`/admin/papers/${p.id}`);
      toast('Paper deleted');
      reload();
      onChange?.();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <>
      {(predicted.length > 0 || isAdmin) && (
        <PredictedPapers papers={predicted} university={university} isAdmin={isAdmin} onDelete={deletePaper}
          onAdd={() => setAdding({ predicted: true, course_year: currentCy })} />
      )}
      {university && (
        <Pills label="Course year" items={courseYears} current={currentCy} onPick={(c) => go({ cy: c, year: '' })}
          addLabel="Other" onAdd={isAdmin ? () => add({ course_year: '', year: '' }) : null} />
      )}
      {(years.length > 0 || isAdmin) && (
        <Pills label="Year" items={years} current={currentYear} onPick={(y) => go({ year: String(y) })}
          addLabel="Add year" onAdd={isAdmin ? () => add({ year: '' }) : null} />
      )}

      {!currentYear ? (
        <div className="empty empty-glow">
          <span className="empty-orb"><PaperIcon size={34} /></span>
          <h3>No {university ? `${currentCy} ` : ''}question papers yet</h3>
          <p className="muted">{isAdmin ? 'Pick a year and upload subject-wise papers.' : 'Admins are adding previous year papers — check back soon.'}</p>
          {isAdmin && <button className="btn btn-primary btn-glow" onClick={() => add()}><PlusIcon size={18} /> Add papers</button>}
        </div>
      ) : (
        Object.entries(bySubject).map(([subject, list]) => (
          <section key={subject} className="paper-subject">
            <div className="section-head">
              <h2><FileIcon size={18} /> {subject}</h2>
              <span className="muted small">{list.length} {list.length === 1 ? 'paper' : 'papers'}</span>
              {isAdmin && <button className="btn btn-sm push-right" onClick={() => add({ subject })}><PlusIcon size={14} /> Add</button>}
            </div>
            <div className="card list">
              {list.map((p) => <PaperRow key={p.id} paper={p} isAdmin={isAdmin} onDelete={deletePaper} />)}
            </div>
          </section>
        ))
      )}

      {isAdmin && createPortal(
        <button className="fab" onClick={() => add()} aria-label="Add question papers"><PlusIcon size={26} /></button>,
        document.body,
      )}
      {adding && (
        <AddPapersModal exam={exam} defaults={adding} courseYears={courseYears}
          subjects={[...new Set(['Full paper', ...examSubjects, ...bdsSubjects])]}
          onClose={() => setAdding(null)}
          onAdded={(r) => {
            setAdding(null);
            if (!r.predicted) go({ cy: r.course_year, year: String(r.year) });
            reload();
            onChange?.();
          }} />
      )}
    </>
  );
}
