import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { api, useApi } from '../api';
import { useAuth, useToast } from '../auth';
import { refreshExams } from '../subjects';
import UploadNotesModal from '../components/UploadNotesModal';
import { NotesGrid } from './Notes';
import { TestCard } from './Tests';
import { NotificationList, OfficialSources, AddNotificationModal } from './Notifications';
import ExamPapers, { ExamFormModal, EXAM_KINDS } from './ExamPapers';
import { GradIcon, PlusIcon, ChevronLeftIcon, BookIcon, TestIcon, MegaphoneIcon, PaperIcon, SettingsIcon, TrashIcon } from '../components/Icons';
import { subjectHue, subjectEmoji } from '../utils';

const examEmoji = (exam) => exam.emoji || subjectEmoji(exam.name);

function ExamCard({ exam, notes, onOpen, index }) {
  const info = [exam.description, exam.paper_count ? `${exam.paper_count} ${exam.paper_count === 1 ? 'paper' : 'papers'}` : ''].filter(Boolean).join(' · ');
  return (
    <button className="exam-card" style={{ '--h': subjectHue(exam.name), animationDelay: `${Math.min(index, 18) * 0.04}s` }} onClick={() => onOpen(exam.name)}>
      <span className="exam-emoji" aria-hidden="true">{examEmoji(exam)}</span>
      <span className="exam-text">
        <span className="exam-name">{exam.name}</span>
        <span className="exam-info">{info}</span>
        {exam.predicted_count > 0 && <span className="predicted-badge">🔮 Predicted paper available</span>}
      </span>
      <span className="exam-count"><b>{notes}</b>{notes === 1 ? 'note' : 'notes'}</span>
    </button>
  );
}

function ExamTests({ exam }) {
  const { data, loading } = useApi(`/tests?subject=${encodeURIComponent(exam)}`);
  if (loading && !data) return <div className="card skeleton tile-skeleton" />;
  if (!data?.length) {
    return (
      <div className="empty empty-glow">
        <span className="empty-orb"><TestIcon size={34} /></span>
        <h3>No {exam} mock tests yet</h3>
        <p className="muted">Admins add exam-pattern tests regularly — check back soon.</p>
      </div>
    );
  }
  return <div className="test-grid">{data.map((t, i) => <TestCard key={t.id} test={t} index={i} />)}</div>;
}

const TABS = [
  { id: 'notes', label: 'Notes', icon: BookIcon },
  { id: 'papers', label: 'Question papers', icon: PaperIcon },
  { id: 'tests', label: 'Mock tests', icon: TestIcon },
  { id: 'notices', label: 'Notifications', icon: MegaphoneIcon },
];

export default function ExamPrep() {
  const { user, requireLogin } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === 'admin';
  const [params, setParams] = useSearchParams();
  const examName = params.get('exam') || '';
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'notes';
  const [uploading, setUploadingRaw] = useState(false);
  const setUploading = (on) => (!on || requireLogin('Sign up for free to share your notes.')) && setUploadingRaw(on);
  const [addingNotice, setAddingNotice] = useState(false);
  const [examForm, setExamForm] = useState(null); // { exam?, defaultKind? }
  const [refreshKey, setRefreshKey] = useState(0);
  const stats = useApi(`/notes/subjects?r=${refreshKey}`);
  const details = useApi(`/exams/details?r=${refreshKey}`);
  const exams = details.data || [];

  const go = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next);
  };
  const open = (name) => go({ exam: name, tab: '', cy: '', year: '' });
  const examFormModal = examForm && (
    <ExamFormModal exam={examForm.exam} defaultKind={examForm.defaultKind} onClose={() => setExamForm(null)}
      onSaved={(name) => { setExamForm(null); setRefreshKey((k) => k + 1); open(name); }} />
  );

  if (!examName) {
    const total = exams.reduce((sum, e) => sum + (stats.data?.[e.name]?.count || 0), 0);
    const groups = EXAM_KINDS.map((k) => ({ ...k, items: exams.filter((e) => e.kind === k.id) }))
      .filter((g) => g.items.length || (isAdmin && g.id === 'university'));
    return (
      <div className="home">
        <header className="page-hero page-hero-exams">
          <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
          <span className="page-hero-icon"><GradIcon size={26} /></span>
          <div className="grow">
            <h1>Exam Prep</h1>
            <p>Notes, previous year question papers, mock tests and official notifications for NEET MDS, INI-CET, university exams and dental licensing exams abroad. {total} {total === 1 ? 'note' : 'notes'} shared so far.</p>
          </div>
          {isAdmin && <button className="btn btn-light" onClick={() => setExamForm({})}><PlusIcon size={18} /> Add exam</button>}
        </header>
        {details.loading && !details.data && <div className="exam-grid">{[0, 1, 2].map((i) => <div key={i} className="card skeleton tile-skeleton" />)}</div>}
        {details.error && <p className="form-error">{details.error.message}</p>}
        {groups.map((g) => (
          <section key={g.id}>
            <div className="section-head">
              <h2>{g.label}</h2>
              {isAdmin && <button className="btn btn-sm push-right" onClick={() => setExamForm({ defaultKind: g.id })}><PlusIcon size={14} /> Add</button>}
            </div>
            {g.items.length ? (
              <div className="exam-grid">
                {g.items.map((e, i) => <ExamCard key={e.id} exam={e} notes={stats.data?.[e.name]?.count || 0} onOpen={open} index={i} />)}
              </div>
            ) : <p className="muted exam-group-empty">No university exams yet. Add one (e.g. KUHS BDS) to upload year-wise question papers.</p>}
          </section>
        ))}
        {examFormModal}
      </div>
    );
  }

  const exam = exams.find((e) => e.name === examName);
  if (!exam) {
    if (details.loading || !details.data) return <div className="card skeleton tile-skeleton" />;
    return (
      <div className="empty">
        <h3>Exam not found</h3>
        <button className="btn" onClick={() => go({ exam: '', tab: '', cy: '', year: '' })}><ChevronLeftIcon size={18} /> All exams</button>
      </div>
    );
  }

  const deleteExam = async () => {
    if (!confirm(`Delete ${exam.name} and its ${exam.paper_count + exam.predicted_count} question papers? Notes and mock tests filed under it are kept but no longer shown here.`)) return;
    try {
      await api.del(`/admin/exams/${exam.id}`);
      refreshExams();
      toast('Exam deleted');
      setRefreshKey((k) => k + 1);
      go({ exam: '', tab: '', cy: '', year: '' });
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  const fabAction = tab === 'notes' ? () => setUploading(true) : tab === 'notices' && isAdmin ? () => setAddingNotice(true) : null;
  const notes = stats.data?.[exam.name]?.count || 0;

  return (
    <div className="home">
      <header className="subject-hero" style={{ '--h': subjectHue(exam.name) }}>
        <button className="subject-back" onClick={() => go({ exam: '', tab: '', cy: '', year: '' })}><ChevronLeftIcon size={18} /> All exams</button>
        <div className="subject-hero-row">
          <span className="subject-badge subject-badge-lg" aria-hidden="true">{examEmoji(exam)}</span>
          <div className="grow">
            <h1>{exam.name}</h1>
            <p>{exam.description ? `${exam.description} · ` : ''}{notes} {notes === 1 ? 'note' : 'notes'} · {exam.paper_count} {exam.paper_count === 1 ? 'paper' : 'papers'}</p>
          </div>
          <div className="row gap">
            {tab === 'notes' && <button className="btn btn-light" onClick={() => setUploading(true)}><PlusIcon size={18} /> Upload</button>}
            {isAdmin && <button className="btn btn-light" aria-label="Edit exam" onClick={() => setExamForm({ exam })}><SettingsIcon size={18} /></button>}
            {isAdmin && <button className="btn btn-light" aria-label="Delete exam" onClick={deleteExam}><TrashIcon size={18} /></button>}
          </div>
        </div>
        {exam.predicted_count > 0 && tab !== 'papers' && (
          <button className="predicted-chip" onClick={() => go({ tab: 'papers' })}>🔮 {exam.predicted_count} predicted {exam.predicted_count === 1 ? 'paper' : 'papers'} available — view</button>
        )}
      </header>

      <nav className="tabs exam-tabs">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => go({ tab: id === 'notes' ? '' : id })}>
            <Icon size={16} /> {label}
            {id === 'papers' && exam.predicted_count > 0 && <span className="tab-dot" aria-label="Predicted papers available" />}
          </button>
        ))}
      </nav>

      {tab === 'notes' && (
        <NotesGrid key={`${exam.name}-${refreshKey}`} url={`/notes?subject=${encodeURIComponent(exam.name)}&r=${refreshKey}`} emptyText={`No ${exam.name} notes yet`} onUpload={() => setUploading(true)} />
      )}
      {tab === 'papers' && (
        <ExamPapers key={exam.id} exam={exam} cy={params.get('cy') || ''} year={Number(params.get('year')) || null} isAdmin={isAdmin}
          go={go} onChange={() => setRefreshKey((k) => k + 1)} />
      )}
      {tab === 'tests' && <ExamTests exam={exam.name} />}
      {tab === 'notices' && (
        <>
          <NotificationList exam={exam.name} refreshKey={refreshKey} emptyText={`No ${exam.name} notifications yet`} />
          <OfficialSources regions={[exam.region]} />
        </>
      )}

      {fabAction && createPortal(
        <button className="fab" onClick={fabAction} aria-label={tab === 'notes' ? 'Upload notes' : 'Add notification'}><PlusIcon size={26} /></button>,
        document.body,
      )}
      {uploading && (
        <UploadNotesModal open topics="exams" defaultSubject={exam.name} onClose={() => setUploading(false)}
          onUploaded={(r) => r.status === 'approved' && setRefreshKey((k) => k + 1)} />
      )}
      {addingNotice && (
        <AddNotificationModal defaults={{ exam: exam.name, region: exam.region }} onClose={() => setAddingNotice(false)} onAdded={() => setRefreshKey((k) => k + 1)} />
      )}
      {examFormModal}
    </div>
  );
}
