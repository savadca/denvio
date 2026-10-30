import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, useApi } from '../api';
import { useAuth, useToast } from '../auth';
import { TopicOptions } from '../subjects';
import Modal from '../components/Modal';
import { MegaphoneIcon, PlusIcon, SearchIcon, ExternalIcon, TrashIcon } from '../components/Icons';
import { REGIONS, NOTICE_CATEGORIES, OFFICIAL_SOURCES, regionInfo, deadlineStatus, formatDate, ago } from '../utils';

const blank = (defaults = {}) => ({
  title: '', body: '', region: 'india', category: 'exam', exam: '', source: '', exam_date: '', deadline: '', link_url: '', ...defaults,
});

function AddNotificationModal({ defaults, onClose, onAdded }) {
  const toast = useToast();
  const [form, setForm] = useState(() => blank(defaults));
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/admin/notifications', form);
      toast('Notification published', 'success');
      onAdded();
      onClose();
    } catch (err) {
      toast(err.message, 'error');
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Add notification" className="upload-modal">
      <form className="form upload-form" onSubmit={save}>
        <label>Title<input value={form.title} onChange={set('title')} required maxLength={160} placeholder="e.g. NEET MDS 2027 registration opens" autoFocus /></label>
        <div className="form-grid">
          <label>Country / region
            <select value={form.region} onChange={set('region')}>{REGIONS.map((r) => <option key={r.id} value={r.id}>{r.flag} {r.label}</option>)}</select>
          </label>
          <label>Type
            <select value={form.category} onChange={set('category')}>{NOTICE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}</select>
          </label>
        </div>
        <div className="form-grid">
          <label>Exam (optional)
            <select value={form.exam} onChange={set('exam')}><option value="">—</option><TopicOptions only="exams" /></select>
          </label>
          <label>Issued by<input value={form.source} onChange={set('source')} maxLength={80} placeholder="NBEMS, AIIMS, GDC…" /></label>
        </div>
        <div className="form-grid">
          <label>Last date to apply<input type="date" value={form.deadline} onChange={set('deadline')} /></label>
          <label>Exam / event date<input type="date" value={form.exam_date} onChange={set('exam_date')} /></label>
        </div>
        <label>Details<textarea rows={3} value={form.body} onChange={set('body')} maxLength={1500} placeholder="Eligibility, fee, important points…" /></label>
        <label>Official notice link<input type="url" value={form.link_url} onChange={set('link_url')} placeholder="https://natboard.edu.in/…" /></label>
        <p className="muted small">Always link the official source so students can verify the details.</p>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Publishing…' : 'Publish notification'}</button>
      </form>
    </Modal>
  );
}

function NotificationCard({ n, isAdmin, onChanged, index }) {
  const toast = useToast();
  const region = regionInfo(n.region);
  const cat = NOTICE_CATEGORIES.find((c) => c.id === n.category) || NOTICE_CATEGORIES[5];
  const status = deadlineStatus(n.deadline);
  const isNew = Date.now() - new Date(n.created_at).getTime() < 3 * 86400000;
  const remove = async () => {
    if (!confirm('Delete this notification?')) return;
    try {
      await api.del(`/admin/notifications/${n.id}`);
      toast('Deleted');
      onChanged();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  return (
    <article className={`notice ${status?.tone === 'closed' ? 'notice-closed' : ''}`} style={{ animationDelay: `${Math.min(index, 10) * 0.04}s` }}>
      <div className="notice-flag" aria-hidden="true">{region.flag}</div>
      <div className="notice-main">
        <div className="notice-tags">
          <span className="notice-cat">{cat.emoji} {cat.label}</span>
          {n.exam && <span className="notice-exam">{n.exam}</span>}
          {isNew && <span className="notice-new">NEW</span>}
        </div>
        <h3 className="notice-title">{n.title}</h3>
        <div className="notice-meta">{region.label}{n.source && <> · {n.source}</>} · posted {ago(n.created_at)}</div>
        {n.body && <p className="notice-body pre">{n.body}</p>}
        {(n.deadline || n.exam_date) && (
          <div className="notice-dates">
            {n.deadline && (
              <span className={`notice-date tone-${status.tone}`}>
                <b>Last date</b> {formatDate(n.deadline)} · {status.text}
              </span>
            )}
            {n.exam_date && <span className="notice-date"><b>Exam / event</b> {formatDate(n.exam_date)}</span>}
          </div>
        )}
        <div className="notice-actions">
          {n.link_url && <a className="btn btn-sm btn-primary" href={n.link_url} target="_blank" rel="noopener noreferrer">Official notice <ExternalIcon size={14} /></a>}
          {isAdmin && <button className="icon-btn push-right" onClick={remove} aria-label="Delete notification"><TrashIcon size={18} /></button>}
        </div>
      </div>
    </article>
  );
}

// Reused on the Exam Prep page (filtered to one exam).
export function NotificationList({ region = '', category = '', exam = '', q = '', refreshKey = 0, emptyText = 'No notifications yet' }) {
  const { user } = useAuth();
  const params = new URLSearchParams();
  if (region) params.set('region', region);
  if (category) params.set('category', category);
  if (exam) params.set('exam', exam);
  if (q) params.set('q', q);
  const list = useApi(`/notifications?${params}&r=${refreshKey}`);
  if (list.loading && !list.data) return <div className="card skeleton tile-skeleton" />;
  if (!list.data?.length) {
    return (
      <div className="empty empty-glow">
        <span className="empty-orb"><MegaphoneIcon size={34} /></span>
        <h3>{emptyText}</h3>
        <p className="muted">Check the official sources below for the latest notices.</p>
      </div>
    );
  }
  return (
    <div className="notice-list">
      {list.data.map((n, i) => <NotificationCard key={n.id} n={n} index={i} isAdmin={user?.role === 'admin'} onChanged={list.reload} />)}
    </div>
  );
}

export function OfficialSources({ regions }) {
  const shown = (regions || Object.keys(OFFICIAL_SOURCES)).filter((r) => OFFICIAL_SOURCES[r]);
  return (
    <section className="sources">
      <div className="section-head"><h2>Official sources</h2></div>
      <div className="sources-grid">
        {shown.map((r) => (
          <div key={r} className="source-group">
            <div className="source-region">{regionInfo(r).flag} {regionInfo(r).label}</div>
            {OFFICIAL_SOURCES[r].map((s) => (
              <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="source-link">{s.name} <ExternalIcon size={13} /></a>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Notifications() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [region, setRegion] = useState('');
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setQ(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="home">
      <header className="page-hero page-hero-notices">
        <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
        <span className="page-hero-icon"><MegaphoneIcon size={26} /></span>
        <div className="grow">
          <h1>Notifications</h1>
          <p>Exam dates, registrations, counselling, results and council notices — India and the main countries BDS graduates move to.</p>
        </div>
        {isAdmin && <button className="btn btn-light hero-upload" onClick={() => setAdding(true)}><PlusIcon size={18} /> Add notification</button>}
      </header>

      <div className="pills" role="tablist" aria-label="Country">
        <button role="tab" aria-selected={!region} className={`pill ${!region ? 'on' : ''}`} onClick={() => setRegion('')}>🌐 All countries</button>
        {REGIONS.filter((r) => r.id !== 'other').map((r) => (
          <button key={r.id} role="tab" aria-selected={region === r.id} className={`pill ${region === r.id ? 'on' : ''}`} onClick={() => setRegion(r.id)}>{r.flag} {r.label}</button>
        ))}
      </div>
      <div className="home-toolbar">
        <label className="glass-search">
          <SearchIcon size={18} />
          <input placeholder="Search notifications" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <select className="notice-filter" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Type">
          <option value="">All types</option>
          {NOTICE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
        </select>
      </div>

      <NotificationList region={region} category={category} q={q} refreshKey={refreshKey}
        emptyText={region ? `No notifications for ${regionInfo(region).label} yet` : 'No notifications yet'} />
      <OfficialSources regions={region ? [region] : undefined} />

      {isAdmin && createPortal(
        <button className="fab" onClick={() => setAdding(true)} aria-label="Add notification" title="Add notification"><PlusIcon size={26} /></button>,
        document.body,
      )}
      {adding && <AddNotificationModal defaults={region ? { region } : {}} onClose={() => setAdding(false)} onAdded={() => setRefreshKey((k) => k + 1)} />}
    </div>
  );
}

export { AddNotificationModal };
