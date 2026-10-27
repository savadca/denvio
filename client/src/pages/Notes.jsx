import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useApi } from '../api';
import { useSubjects } from '../subjects';
import NoteCard from '../components/NoteCard';
import UploadNotesModal from '../components/UploadNotesModal';
import { BookIcon, PlusIcon, SearchIcon, ChevronLeftIcon, ToothIcon } from '../components/Icons';
import { subjectHue, subjectEmoji, timeAgo } from '../utils';

function SubjectCard({ subject, stats, onOpen, index }) {
  const count = stats?.count || 0;
  return (
    <button
      className={`subject-card ${count ? '' : 'subject-empty'}`}
      style={{ '--h': subjectHue(subject), animationDelay: `${Math.min(index, 18) * 0.03}s` }}
      onClick={() => onOpen(subject)}
    >
      <span className="subject-badge" aria-hidden="true">{subjectEmoji(subject)}</span>
      <span className="subject-name">{subject}</span>
      <span className="subject-meta">
        <b>{count}</b> {count === 1 ? 'note' : 'notes'}
        {stats?.latest && <> · new {timeAgo(stats.latest)}</>}
      </span>
    </button>
  );
}

function NotesGrid({ url, emptyText, onUpload }) {
  const notes = useApi(url);
  if (notes.loading && !notes.data) return <div className="notes-grid">{[0, 1, 2].map((i) => <div key={i} className="card skeleton tile-skeleton" />)}</div>;
  if (notes.error) return <p className="form-error">{notes.error.message}</p>;
  if (!notes.data?.length) {
    return (
      <div className="empty empty-glow">
        <span className="empty-orb"><ToothIcon size={40} /></span>
        <h3>{emptyText}</h3>
        <p className="muted">Be the first to share — notes appear here once an admin approves them.</p>
        <button className="btn btn-primary btn-glow" onClick={onUpload}><PlusIcon size={18} /> Upload notes</button>
      </div>
    );
  }
  return (
    <div className="notes-grid">
      {notes.data.map((n, i) => (
        <div key={n.id} className="note-in" style={{ animationDelay: `${Math.min(i, 8) * 0.05}s` }}>
          <NoteCard note={n} onDeleted={(id) => notes.setData((d) => d.filter((x) => x.id !== id))} />
        </div>
      ))}
    </div>
  );
}

export default function Notes() {
  const subjects = useSubjects();
  const [params, setParams] = useSearchParams();
  const subject = params.get('subject') || '';
  const uploadOpen = params.get('upload') === '1';
  const [query, setQuery] = useState('');
  const [q, setQ] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const stats = useApi(`/notes/subjects?r=${refreshKey}`);

  useEffect(() => {
    const t = setTimeout(() => setQ(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);
  useEffect(() => setQuery(''), [subject]);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: isUploadToggle(changes) });
  };
  const openSubject = (s) => update({ subject: s });
  const openUpload = () => update({ upload: '1' });
  const total = Object.values(stats.data || {}).reduce((sum, s) => sum + s.count, 0);
  const visibleSubjects = q && !subject ? subjects.filter((s) => s.toLowerCase().includes(q.toLowerCase())) : subjects;

  const listUrl = (() => {
    const p = new URLSearchParams();
    if (subject) p.set('subject', subject);
    if (q) p.set('q', q);
    return `/notes?${p}&r=${refreshKey}`;
  })();

  return (
    <div className="home notes-library">
      {subject ? (
        <header className="subject-hero" style={{ '--h': subjectHue(subject) }}>
          <button className="subject-back" onClick={() => update({ subject: '' })}><ChevronLeftIcon size={18} /> All subjects</button>
          <div className="subject-hero-row">
            <span className="subject-badge subject-badge-lg" aria-hidden="true">{subjectEmoji(subject)}</span>
            <div className="grow">
              <h1>{subject}</h1>
              <p>{stats.data?.[subject]?.count || 0} approved notes</p>
            </div>
            <button className="btn btn-light" onClick={openUpload}><PlusIcon size={18} /> Upload</button>
          </div>
        </header>
      ) : (
        <header className="page-hero page-hero-notes">
          <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
          <span className="page-hero-icon"><BookIcon size={26} /></span>
          <div className="grow">
            <h1>Notes library</h1>
            <p>{total} approved notes across {subjects.length} BDS subjects. Pick a subject or search everything.</p>
          </div>
          <button className="btn btn-light hero-upload" onClick={openUpload}><PlusIcon size={18} /> Upload notes</button>
        </header>
      )}

      <div className="home-toolbar">
        <label className="glass-search">
          <SearchIcon size={18} />
          <input
            placeholder={subject ? `Search ${subject} notes` : 'Search all notes or find a subject'}
            value={query} onChange={(e) => setQuery(e.target.value)}
          />
          {query && <button type="button" className="kbd" onClick={() => setQuery('')} aria-label="Clear search">✕</button>}
        </label>
      </div>

      {subject ? (
        <NotesGrid key={listUrl} url={listUrl} emptyText={q ? `Nothing found for “${q}”` : `No ${subject} notes yet`} onUpload={openUpload} />
      ) : (
        <>
          {visibleSubjects.length > 0 && (
            <>
              <div className="section-head"><h2>Subjects</h2><span className="count-chip">{visibleSubjects.length}</span></div>
              <div className="subject-grid">
                {visibleSubjects.map((s, i) => <SubjectCard key={s} subject={s} stats={stats.data?.[s]} onOpen={openSubject} index={i} />)}
              </div>
            </>
          )}
          {q && (
            <>
              <div className="section-head"><h2>Notes matching “{q}”</h2></div>
              <NotesGrid key={listUrl} url={listUrl} emptyText={`No notes match “${q}”`} onUpload={openUpload} />
            </>
          )}
        </>
      )}

      {/* Portal: the page's fade-in transform would otherwise make the fixed button jump. */}
      {createPortal(
        <button className="fab" onClick={openUpload} aria-label="Upload notes" title="Upload notes"><PlusIcon size={26} /></button>,
        document.body,
      )}

      {uploadOpen && (
        <UploadNotesModal
          open
          defaultSubject={subject}
          onClose={() => update({ upload: '' })}
          onUploaded={(r) => r.status === 'approved' && setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}

// Opening/closing the upload modal shouldn't add browser-history entries.
function isUploadToggle(changes) {
  return Object.keys(changes).length === 1 && 'upload' in changes;
}
