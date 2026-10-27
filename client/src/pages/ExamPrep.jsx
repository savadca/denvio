import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useApi } from '../api';
import { useAuth } from '../auth';
import { useExams } from '../subjects';
import UploadNotesModal from '../components/UploadNotesModal';
import { NotesGrid } from './Notes';
import { TestCard } from './Tests';
import { NotificationList, OfficialSources, AddNotificationModal } from './Notifications';
import { GradIcon, PlusIcon, ChevronLeftIcon, BookIcon, TestIcon, MegaphoneIcon } from '../components/Icons';
import { subjectHue, subjectEmoji, EXAM_INFO, EXAM_REGION } from '../utils';

const INDIA = ['NEET MDS', 'INI-CET (AIIMS)'];

function ExamCard({ exam, notes, onOpen, index }) {
  return (
    <button className="exam-card" style={{ '--h': subjectHue(exam), animationDelay: `${index * 0.04}s` }} onClick={() => onOpen(exam)}>
      <span className="exam-emoji" aria-hidden="true">{subjectEmoji(exam)}</span>
      <span className="exam-text">
        <span className="exam-name">{exam}</span>
        <span className="exam-info">{EXAM_INFO[exam]}</span>
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

export default function ExamPrep() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const exams = useExams();
  const [params, setParams] = useSearchParams();
  const exam = params.get('exam') || '';
  const tab = ['notes', 'tests', 'notices'].includes(params.get('tab')) ? params.get('tab') : 'notes';
  const [uploading, setUploading] = useState(false);
  const [addingNotice, setAddingNotice] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const stats = useApi(`/notes/subjects?r=${refreshKey}`);

  const go = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next);
  };

  if (!exam) {
    const total = exams.reduce((sum, e) => sum + (stats.data?.[e]?.count || 0), 0);
    const groups = [
      { title: '🇮🇳 India — PG entrance', items: exams.filter((e) => INDIA.includes(e)) },
      { title: '🌍 Abroad — licensing exams', items: exams.filter((e) => !INDIA.includes(e)) },
    ];
    return (
      <div className="home">
        <header className="page-hero page-hero-exams">
          <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
          <span className="page-hero-icon"><GradIcon size={26} /></span>
          <div className="grow">
            <h1>Exam Prep</h1>
            <p>Notes, mock tests and official notifications for NEET MDS, INI-CET and dental licensing exams abroad. {total} {total === 1 ? 'note' : 'notes'} shared so far.</p>
          </div>
        </header>
        {groups.map((g) => (
          <section key={g.title}>
            <div className="section-head"><h2>{g.title}</h2></div>
            <div className="exam-grid">
              {g.items.map((e, i) => <ExamCard key={e} exam={e} notes={stats.data?.[e]?.count || 0} onOpen={(x) => go({ exam: x, tab: '' })} index={i} />)}
            </div>
          </section>
        ))}
      </div>
    );
  }

  const tabs = [
    { id: 'notes', label: 'Notes', icon: BookIcon },
    { id: 'tests', label: 'Mock tests', icon: TestIcon },
    { id: 'notices', label: 'Notifications', icon: MegaphoneIcon },
  ];
  const fabAction = tab === 'notes' ? () => setUploading(true) : tab === 'notices' && isAdmin ? () => setAddingNotice(true) : null;

  return (
    <div className="home">
      <header className="subject-hero" style={{ '--h': subjectHue(exam) }}>
        <button className="subject-back" onClick={() => go({ exam: '', tab: '' })}><ChevronLeftIcon size={18} /> All exams</button>
        <div className="subject-hero-row">
          <span className="subject-badge subject-badge-lg" aria-hidden="true">{subjectEmoji(exam)}</span>
          <div className="grow">
            <h1>{exam}</h1>
            <p>{EXAM_INFO[exam]} · {stats.data?.[exam]?.count || 0} {stats.data?.[exam]?.count === 1 ? 'note' : 'notes'}</p>
          </div>
          {tab === 'notes' && <button className="btn btn-light" onClick={() => setUploading(true)}><PlusIcon size={18} /> Upload</button>}
        </div>
      </header>

      <nav className="tabs exam-tabs">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => go({ tab: id === 'notes' ? '' : id })}><Icon size={16} /> {label}</button>
        ))}
      </nav>

      {tab === 'notes' && (
        <NotesGrid key={`${exam}-${refreshKey}`} url={`/notes?subject=${encodeURIComponent(exam)}&r=${refreshKey}`} emptyText={`No ${exam} notes yet`} onUpload={() => setUploading(true)} />
      )}
      {tab === 'tests' && <ExamTests exam={exam} />}
      {tab === 'notices' && (
        <>
          <NotificationList exam={exam} refreshKey={refreshKey} emptyText={`No ${exam} notifications yet`} />
          <OfficialSources regions={[EXAM_REGION[exam]]} />
        </>
      )}

      {fabAction && createPortal(
        <button className="fab" onClick={fabAction} aria-label={tab === 'notes' ? 'Upload notes' : 'Add notification'}><PlusIcon size={26} /></button>,
        document.body,
      )}
      {uploading && (
        <UploadNotesModal open topics="exams" defaultSubject={exam} onClose={() => setUploading(false)}
          onUploaded={(r) => r.status === 'approved' && setRefreshKey((k) => k + 1)} />
      )}
      {addingNotice && (
        <AddNotificationModal defaults={{ exam, region: EXAM_REGION[exam] || 'india' }} onClose={() => setAddingNotice(false)} onAdded={() => setRefreshKey((k) => k + 1)} />
      )}
    </div>
  );
}
