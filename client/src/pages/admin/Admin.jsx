import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, useApi } from '../../api';
import { useAuth, useToast } from '../../auth';
import { useSubjects } from '../../subjects';
import Avatar, { UserLine } from '../../components/Avatar';
import MediaViewer from '../../components/MediaViewer';
import { NotePreview } from '../../components/NoteCard';
import { PlayIcon, AudioIcon, FileIcon, CheckIcon, XIcon, TrashIcon, SearchIcon, CoinIcon } from '../../components/Icons';
import Coin from '../../components/Coin';
import AwardDialog from '../../components/AwardDialog';
import { tierInfo } from '../../coins';
import { Announcements, JobBoard, ClientErrors } from './AdminExtras';
import { timeAgo, fileKind } from '../../utils';

// ---------- Note review ----------

function MediaCheck({ kind, url, setUrl, enabled, setEnabled }) {
  const [preview, setPreview] = useState(false);
  const Icon = kind === 'video' ? PlayIcon : AudioIcon;
  return (
    <div className="media-check">
      <div className="media-check-head">
        <Icon size={18} /> <span className="strong">{kind === 'video' ? 'Video' : 'Audio'} reference</span>
        <label className="switch push-right">
          <input type="checkbox" checked={enabled} disabled={!url} onChange={(e) => setEnabled(e.target.checked)} />
          <span className="switch-track" />
          <span className="small">{enabled ? 'Enabled' : 'Disabled'}</span>
        </label>
      </div>
      <div className="row gap">
        <input className="grow" type="url" value={url} onChange={(e) => { setUrl(e.target.value); setPreview(false); }} placeholder={`No ${kind} link`} />
        {url && <button type="button" className="btn btn-sm" onClick={() => setPreview(!preview)}>{preview ? 'Hide' : 'Preview'}</button>}
      </div>
      {preview && url && <MediaViewer url={url} kind={kind} />}
    </div>
  );
}

function ReviewCard({ note, onDone }) {
  const toast = useToast();
  const [videoUrl, setVideoUrl] = useState(note.video_url);
  const [audioUrl, setAudioUrl] = useState(note.audio_url);
  const [videoOn, setVideoOn] = useState(note.status === 'pending' ? !!note.video_url : note.video_enabled);
  const [audioOn, setAudioOn] = useState(note.status === 'pending' ? !!note.audio_url : note.audio_enabled);
  const [adminNote, setAdminNote] = useState(note.admin_note || '');
  const [busy, setBusy] = useState(false);
  const [awarding, setAwarding] = useState(false);
  const pending = note.status === 'pending';

  const act = async (fn, msg) => {
    setBusy(true);
    try {
      await fn();
      toast(msg, 'success');
      onDone(note.id);
    } catch (e) {
      toast(e.message, 'error');
      setBusy(false);
    }
  };

  const approve = () => act(() => api.put(`/admin/notes/${note.id}/approve`, {
    video_url: videoUrl, audio_url: audioUrl, video_enabled: videoOn, audio_enabled: audioOn, admin_note: adminNote,
  }), pending ? 'Approved — now visible in the feed' : 'Saved');
  const discard = () => confirm('Discard this upload? The file will be deleted.') &&
    act(() => api.put(`/admin/notes/${note.id}/reject`, { admin_note: adminNote }), 'Upload discarded');
  const remove = () => confirm('Delete this note permanently?') && act(() => api.del(`/notes/${note.id}`), 'Note deleted');

  return (
    <article className="card review">
      <header className="post-head">
        <UserLine
          user={note.user}
          sub={`${note.subject} · uploaded ${timeAgo(note.created_at)}`}
          badge={note.user.redlisted && <span className="badge badge-rejected">Red-listed</span>}
        />
      </header>
      <div className="review-body">
        <div className="review-preview"><NotePreview note={note} compact /></div>
        <div className="grow">
          <h3>{note.title}</h3>
          {note.description && <p className="pre muted">{note.description}</p>}
          {note.has_file
            ? <a className="chip" href={`/api/notes/${note.id}/file`} target="_blank" rel="noopener noreferrer"><FileIcon size={16} /> <span className="chip-text">Open {fileKind(note.file_mime)} · {note.file_name}</span></a>
            : <p className="muted small">No file attached</p>}
        </div>
      </div>
      <MediaCheck kind="video" url={videoUrl} setUrl={setVideoUrl} enabled={videoOn && !!videoUrl} setEnabled={setVideoOn} />
      <MediaCheck kind="audio" url={audioUrl} setUrl={setAudioUrl} enabled={audioOn && !!audioUrl} setEnabled={setAudioOn} />
      <input value={adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder="Note to uploader (optional, shown if discarded)" />
      <div className="review-actions">
        <button className="btn btn-coin btn-coin-gold" disabled={busy} onClick={() => setAwarding(true)}><CoinIcon size={18} /> Award coin</button>
        {pending ? (
          <>
            <button className="btn btn-danger" disabled={busy} onClick={discard}><XIcon size={18} /> Discard</button>
            <button className="btn btn-primary" disabled={busy} onClick={approve}><CheckIcon size={18} /> Approve</button>
          </>
        ) : (
          <>
            <button className="btn btn-danger" disabled={busy} onClick={remove}><TrashIcon size={18} /> Delete</button>
            <button className="btn btn-primary" disabled={busy} onClick={approve}>Save media settings</button>
          </>
        )}
      </div>
      {awarding && <AwardDialog target={{ user: note.user, note: { id: note.id, title: note.title } }} onClose={() => setAwarding(false)} />}
    </article>
  );
}

function NotesQueue({ status, onChange }) {
  const { data, loading, setData } = useApi(`/admin/notes?status=${status}`);
  const done = (id) => {
    if (status === 'pending') setData((d) => d.filter((n) => n.id !== id));
    onChange();
  };
  if (loading && !data) return <div className="card skeleton" />;
  if (!data?.length) {
    return <div className="empty"><CheckIcon size={48} /><h3>{status === 'pending' ? 'All caught up' : 'Nothing here'}</h3><p className="muted">{status === 'pending' ? 'No uploads are waiting for review.' : 'No approved notes yet.'}</p></div>;
  }
  return data.map((n) => <ReviewCard key={n.id} note={n} onDone={done} />);
}

// ---------- Users & red list ----------

function Users({ filter, onChange }) {
  const { user: me } = useAuth();
  const toast = useToast();
  const [awardTo, setAwardTo] = useState(null);
  const [q, setQ] = useState('');
  const params = new URLSearchParams();
  if (filter) params.set('filter', filter);
  if (q) params.set('q', q);
  const { data, loading, reload } = useApi(`/admin/users?${params}`);

  const update = async (u, body, msg) => {
    try {
      await api.put(`/admin/users/${u.id}`, body);
      toast(msg, 'success');
      reload();
      onChange();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const redlist = (u) => {
    const reason = prompt(`Reason for red-listing @${u.username}?`, u.redlist_reason || '');
    if (reason !== null) update(u, { redlisted: true, redlist_reason: reason }, `@${u.username} red-listed`);
  };
  const remove = async (u) => {
    if (!confirm(`Remove @${u.username} and ALL their notes, posts and results? This cannot be undone.`)) return;
    try {
      await api.del(`/admin/users/${u.id}`);
      toast(`@${u.username} removed`, 'success');
      reload();
      onChange();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <>
      <label className="search">
        <SearchIcon size={18} />
        <input placeholder="Search users" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {loading && !data && <div className="card skeleton" />}
      {data?.length === 0 && <div className="empty"><p className="muted">{filter === 'redlist' ? 'Nobody is red-listed.' : 'No users found.'}</p></div>}
      <div className="card list">
        {data?.map((u) => (
          <div key={u.id} className={`user-row ${u.redlisted ? 'user-red' : ''}`}>
            <Avatar user={u} size={44} link />
            <div className="grow">
              <div className="row gap-sm wrap">
                <Link to={`/u/${u.username}`} className="strong">{u.username}</Link>
                {u.role === 'admin' && <span className="badge badge-admin">Admin</span>}
                {u.redlisted && <span className="badge badge-rejected">Red list</span>}
                {u.status === 'blocked' && <span className="badge badge-blocked">Blocked</span>}
                {u.open_reports > 0 && <span className="badge badge-pending">{u.open_reports} reports</span>}
              </div>
              <div className="muted small">{u.full_name || '—'} · {u.note_count} uploads · joined {timeAgo(u.created_at)}</div>
              {u.redlisted && u.redlist_reason && <div className="small red-reason">Reason: {u.redlist_reason}</div>}
            </div>
            {u.id === me.id ? <span className="muted small">This is you</span> : <div className="user-actions">
              <button className="btn btn-sm btn-coin btn-coin-gold" onClick={() => setAwardTo(u)}><CoinIcon size={16} /> Give coin</button>
              {u.redlisted
                ? <button className="btn btn-sm" onClick={() => update(u, { redlisted: false }, 'Removed from red list')}>Clear red list</button>
                : <button className="btn btn-sm btn-warn" onClick={() => redlist(u)}>Red list</button>}
              {u.status === 'blocked'
                ? <button className="btn btn-sm" onClick={() => update(u, { status: 'active' }, 'User unblocked')}>Unblock</button>
                : <button className="btn btn-sm btn-danger" onClick={() => update(u, { status: 'blocked' }, 'User blocked')}>Block</button>}
              <button className="btn btn-sm" onClick={() => update(u, { role: u.role === 'admin' ? 'user' : 'admin' }, 'Role updated')}>
                {u.role === 'admin' ? 'Revoke admin' : 'Make admin'}
              </button>
              <button className="btn btn-sm btn-danger-ghost" onClick={() => remove(u)}><TrashIcon size={16} /> Remove</button>
            </div>}
          </div>
        ))}
      </div>
      {awardTo && <AwardDialog target={{ user: awardTo }} onClose={() => setAwardTo(null)} onAwarded={onChange} />}
    </>
  );
}

// ---------- Coins ----------

function Coins({ onChange }) {
  const toast = useToast();
  const { data, loading, reload } = useApi('/admin/awards');
  const revoke = async (a) => {
    if (!confirm(`Take back this ${tierInfo(a.tier).label} coin from @${a.user.username}?`)) return;
    try {
      await api.del(`/admin/awards/${a.id}`);
      toast('Coin revoked');
      reload();
      onChange();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  if (loading && !data) return <div className="card skeleton" />;
  return (
    <>
      <p className="muted small">Award coins from any note card, discussion, profile or the Users tab. Recent awards:</p>
      {!data?.length && <div className="empty"><Coin tier="gold" size={64} spin /><p className="muted">No coins awarded yet.</p></div>}
      <div className="card list">
        {data?.map((a) => (
          <div key={a.id} className="user-row">
            <Coin tier={a.tier} size={40} />
            <div className="grow">
              <div><Link to={`/u/${a.user.username}`} className="strong">@{a.user.username}</Link> got <b>{tierInfo(a.tier).label}</b> <span className={`pts pts-${a.tier}`}>+{a.points}</span></div>
              <div className="muted small">
                {a.reason || 'No reason'}
                {a.note && <> · <Link to={`/notes/${a.note.id}`}>{a.note.title}</Link></>}
                {a.post && <> · <Link to={`/community/${a.post.id}`}>discussion</Link></>}
                {' · '}{timeAgo(a.created_at)}{a.awarded_by && <> · by @{a.awarded_by}</>}
              </div>
            </div>
            <button className="btn btn-sm btn-danger-ghost" onClick={() => revoke(a)}>Revoke</button>
          </div>
        ))}
      </div>
    </>
  );
}

// ---------- Reports ----------

function Reports({ onChange }) {
  const toast = useToast();
  const { data, loading, reload } = useApi('/admin/reports');
  const run = async (fn, msg) => {
    try {
      await fn();
      toast(msg, 'success');
      reload();
      onChange();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  if (loading && !data) return <div className="card skeleton" />;
  if (!data?.length) return <div className="empty"><CheckIcon size={48} /><h3>No open reports</h3></div>;
  return data.map((r) => (
    <article key={r.id} className="card report">
      <p className="small muted">@{r.reporter} reported <Link to={`/u/${r.target}`} className="strong">@{r.target}</Link> · {timeAgo(r.created_at)}</p>
      <p><b>Reason:</b> {r.reason}</p>
      {r.post_body && <blockquote className="pre">{r.post_body}</blockquote>}
      {r.comment_body && <blockquote className="pre">{r.comment_body}</blockquote>}
      {r.post_id && <Link to={`/community/${r.post_id}`} className="small">Open discussion →</Link>}
      <div className="review-actions">
        {!r.target_redlisted && <button className="btn btn-sm btn-warn" onClick={() => run(() => api.put(`/admin/users/${r.target_user_id}`, { redlisted: true, redlist_reason: r.reason }), 'User red-listed')}>Red list user</button>}
        {r.target_status !== 'blocked' && <button className="btn btn-sm btn-danger" onClick={() => confirm(`Block @${r.target}?`) && run(() => api.put(`/admin/users/${r.target_user_id}`, { status: 'blocked' }), 'User blocked')}>Block user</button>}
        {r.comment_id && <button className="btn btn-sm" onClick={() => run(() => api.del(`/comments/${r.comment_id}`), 'Comment deleted')}>Delete comment</button>}
        {r.post_id && !r.comment_id && <button className="btn btn-sm" onClick={() => run(() => api.del(`/posts/${r.post_id}`), 'Post deleted')}>Delete post</button>}
        <button className="btn btn-sm btn-primary" onClick={() => run(() => api.put(`/admin/reports/${r.id}/resolve`), 'Report resolved')}>Resolve</button>
      </div>
    </article>
  ));
}

// ---------- Tests ----------

function Tests() {
  const toast = useToast();
  const subjects = useSubjects();
  const { data, reload } = useApi('/admin/tests');
  const [form, setForm] = useState({ title: '', subject: '', duration_min: 15, description: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/tests', form);
      setForm({ title: '', subject: '', duration_min: 15, description: '' });
      toast('Test created — add questions, then publish', 'success');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  const publish = async (t) => {
    try {
      await api.put(`/admin/tests/${t.id}`, { published: !t.published });
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <>
      <form className="card form" onSubmit={create}>
        <h3>New mock test</h3>
        <div className="form-grid">
          <label>Title<input value={form.title} onChange={set('title')} required placeholder="e.g. Periodontics — Unit 1" /></label>
          <label>Subject
            <select value={form.subject} onChange={set('subject')} required>
              <option value="">Select…</option>
              {subjects.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label>Duration (minutes)<input type="number" min={1} max={240} value={form.duration_min} onChange={set('duration_min')} /></label>
        </div>
        <label>Description<input value={form.description} onChange={set('description')} placeholder="Optional" /></label>
        <button className="btn btn-primary">Create test</button>
      </form>
      <div className="card list">
        {data?.length === 0 && <p className="muted pad">No tests yet.</p>}
        {data?.map((t) => (
          <div key={t.id} className="user-row">
            <div className="grow">
              <Link to={`/admin/tests/${t.id}`} className="strong">{t.title}</Link>
              <div className="muted small">{t.subject} · {t.question_count} questions · {t.attempt_count} attempts · {t.duration_min} min</div>
            </div>
            <div className="user-actions">
              <label className="switch">
                <input type="checkbox" checked={!!t.published} onChange={() => publish(t)} disabled={!t.question_count && !t.published} />
                <span className="switch-track" />
                <span className="small">{t.published ? 'Published' : 'Draft'}</span>
              </label>
              <Link to={`/admin/tests/${t.id}`} className="btn btn-sm">Edit questions</Link>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ---------- Page ----------

export default function Admin() {
  const [params, setParams] = useSearchParams();
  const stats = useApi('/admin/stats');
  const s = stats.data || {};
  const tabs = [
    { id: 'review', label: 'Review uploads', count: s.pending_notes },
    { id: 'approved', label: 'Approved notes', count: s.approved_notes },
    { id: 'users', label: 'Users', count: s.users },
    { id: 'redlist', label: 'Red list', count: s.redlisted, alert: true },
    { id: 'reports', label: 'Reports', count: s.open_reports, alert: true },
    { id: 'tests', label: 'Mock tests', count: s.tests },
    { id: 'coins', label: 'Coins', count: s.awards },
    { id: 'announce', label: 'Announcements' },
    { id: 'jobs', label: 'Jobs' },
    { id: 'errors', label: 'Errors', count: s.client_errors, alert: true },
  ];
  const tab = tabs.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'review';
  const refresh = stats.reload;

  return (
    <div className="narrow wide">
      <h1 className="page-title">Admin</h1>
      <div className="stat-row">
        <div className="stat"><b>{s.pending_notes ?? '–'}</b><span>pending</span></div>
        <div className="stat"><b>{s.users ?? '–'}</b><span>users</span></div>
        <div className="stat"><b>{s.redlisted ?? '–'}</b><span>red-listed</span></div>
        <div className="stat"><b>{s.blocked ?? '–'}</b><span>blocked</span></div>
        <div className="stat"><b>{s.open_reports ?? '–'}</b><span>reports</span></div>
      </div>
      <nav className="tabs">
        {tabs.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setParams({ tab: t.id })}>
            {t.label}
            {t.count > 0 && <span className={`count ${t.alert ? 'count-alert' : ''}`}>{t.count}</span>}
          </button>
        ))}
      </nav>
      {tab === 'review' && <NotesQueue status="pending" onChange={refresh} key="pending" />}
      {tab === 'approved' && <NotesQueue status="approved" onChange={refresh} key="approved" />}
      {tab === 'users' && <Users onChange={refresh} key="users" />}
      {tab === 'redlist' && <Users filter="redlist" onChange={refresh} key="redlist" />}
      {tab === 'reports' && <Reports onChange={refresh} />}
      {tab === 'tests' && <Tests />}
      {tab === 'coins' && <Coins onChange={refresh} />}
      {tab === 'announce' && <Announcements />}
      {tab === 'jobs' && <JobBoard />}
      {tab === 'errors' && <ClientErrors onChange={refresh} />}
    </div>
  );
}
