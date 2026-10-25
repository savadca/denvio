import { useState } from 'react';
import { api, useApi } from '../../api';
import { useToast } from '../../auth';
import { AnnouncementCard, ANNOUNCEMENT_TYPES } from '../../components/AnnouncementBar';
import { TrashIcon } from '../../components/Icons';
import { ago } from '../../utils';

const blankAnn = { title: '', body: '', type: 'info', emoji: '', link_url: '', link_label: '', expires_at: '' };

export function Announcements() {
  const toast = useToast();
  const { data, reload } = useApi('/admin/announcements');
  const [form, setForm] = useState(blankAnn);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const publish = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/admin/announcements', form);
      setForm(blankAnn);
      toast('Announcement is live for everyone', 'success');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
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

  return (
    <>
      <form className="card form" onSubmit={publish}>
        <h3>New announcement</h3>
        <div className="type-picker" role="radiogroup" aria-label="Style">
          {Object.entries(ANNOUNCEMENT_TYPES).map(([id, t]) => (
            <button type="button" key={id} role="radio" aria-checked={form.type === id} className={`type-chip ann-${id} ${form.type === id ? 'on' : ''}`} onClick={() => setForm({ ...form, type: id })}>
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
        <div className="form-grid">
          <label>Title<input value={form.title} onChange={set('title')} required maxLength={120} placeholder="e.g. NEET MDS registration is open" /></label>
          <label>Emoji (optional)<input value={form.emoji} onChange={set('emoji')} maxLength={8} placeholder={ANNOUNCEMENT_TYPES[form.type].emoji} /></label>
        </div>
        <label>Message<textarea rows={2} value={form.body} onChange={set('body')} maxLength={500} placeholder="Short details students should know" /></label>
        <div className="form-grid">
          <label>Button link (optional)<input type="url" value={form.link_url} onChange={set('link_url')} placeholder="https://…" /></label>
          <label>Button text<input value={form.link_label} onChange={set('link_label')} maxLength={40} placeholder="Apply now" /></label>
          <label>Show until (optional)<input type="date" value={form.expires_at} onChange={set('expires_at')} /></label>
        </div>
        <div className="preview-label muted small">Live preview</div>
        <AnnouncementCard item={form} />
        <button className="btn btn-primary" disabled={busy || !form.title.trim()}>{busy ? 'Publishing…' : 'Publish announcement'}</button>
      </form>

      <div className="card list">
        {data?.length === 0 && <p className="muted pad">No announcements yet.</p>}
        {data?.map((a) => (
          <div key={a.id} className="user-row">
            <span className={`ann-dot ann-${a.type}`} aria-hidden="true">{a.emoji || ANNOUNCEMENT_TYPES[a.type]?.emoji}</span>
            <div className="grow">
              <div className="strong">{a.title}</div>
              <div className="muted small">
                {ANNOUNCEMENT_TYPES[a.type]?.label} · {ago(a.created_at)}
                {a.expires_at && <> · until {a.expires_at}</>}
                {!a.live && a.active ? <> · <b>expired</b></> : null}
              </div>
            </div>
            <div className="user-actions">
              <label className="switch">
                <input type="checkbox" checked={!!a.active} onChange={() => run(() => api.put(`/admin/announcements/${a.id}`, { active: !a.active }), a.active ? 'Hidden' : 'Shown')} />
                <span className="switch-track" />
                <span className="small">{a.active ? 'Showing' : 'Hidden'}</span>
              </label>
              <button className="icon-btn" aria-label="Delete announcement" onClick={() => confirm('Delete this announcement?') && run(() => api.del(`/admin/announcements/${a.id}`), 'Deleted')}><TrashIcon size={18} /></button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

const blankJob = { title: '', company: '', location: '', classification: '', job_type: 'full_time', salary: '', apply_url: '', description: '' };

export function JobBoard() {
  const toast = useToast();
  const meta = useApi('/jobs/meta');
  const { data, reload } = useApi('/admin/jobs');
  const [form, setForm] = useState(blankJob);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const m = meta.data;

  const post = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/jobs', form);
      setForm(blankJob);
      toast('Job posted', 'success');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
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

  return (
    <>
      {m && !m.live_enabled && (
        <div className="banner banner-info">
          Live market jobs are off. Add a free Adzuna key (<code>ADZUNA_APP_ID</code>, <code>ADZUNA_APP_KEY</code>) to also show live openings.
          LinkedIn does not offer a public jobs feed — paste a LinkedIn job link as the apply link below instead.
        </div>
      )}
      <form className="card form" onSubmit={post}>
        <h3>Post a job</h3>
        <div className="form-grid">
          <label>Job title<input value={form.title} onChange={set('title')} required placeholder="Associate Dentist" /></label>
          <label>Clinic / company<input value={form.company} onChange={set('company')} required /></label>
          <label>City<input value={form.location} onChange={set('location')} placeholder="Bengaluru" /></label>
        </div>
        <div className="form-grid">
          <label>Classification
            <select value={form.classification} onChange={set('classification')} required>
              <option value="">Select…</option>
              {m?.classifications.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label>Type
            <select value={form.job_type} onChange={set('job_type')}>
              {m && Object.entries(m.types).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <label>Salary (optional)<input value={form.salary} onChange={set('salary')} placeholder="₹40,000–60,000 / month" /></label>
        </div>
        <label>Apply link (LinkedIn, Naukri, clinic site…)<input type="url" value={form.apply_url} onChange={set('apply_url')} placeholder="https://www.linkedin.com/jobs/view/…" /></label>
        <label>Description<textarea rows={3} value={form.description} onChange={set('description')} /></label>
        <button className="btn btn-primary">Post job</button>
      </form>
      <div className="card list">
        {data?.length === 0 && <p className="muted pad">No jobs posted yet.</p>}
        {data?.map((j) => (
          <div key={j.id} className="user-row">
            <div className="grow">
              <div className="strong">{j.title} · {j.company}</div>
              <div className="muted small">
                {m?.classifications.find((c) => c.id === j.classification)?.label} · {m?.types[j.job_type]}{j.location && <> · {j.location}</>} · {ago(j.created_at)}
              </div>
            </div>
            <div className="user-actions">
              <label className="switch">
                <input type="checkbox" checked={!!j.active} onChange={() => run(() => api.put(`/admin/jobs/${j.id}`, { active: !j.active }), j.active ? 'Job hidden' : 'Job visible')} />
                <span className="switch-track" />
                <span className="small">{j.active ? 'Open' : 'Closed'}</span>
              </label>
              <button className="icon-btn" aria-label="Delete job" onClick={() => confirm('Delete this job?') && run(() => api.del(`/admin/jobs/${j.id}`), 'Job deleted')}><TrashIcon size={18} /></button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
