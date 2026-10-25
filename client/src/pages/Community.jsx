import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, useApi } from '../api';
import { useAuth, useToast } from '../auth';
import { useSubjects } from '../subjects';
import Avatar, { UserLine } from '../components/Avatar';
import { ChatIcon, FlagIcon, TrashIcon, CoinIcon } from '../components/Icons';
import { CoinRow } from '../components/Coin';
import AwardDialog from '../components/AwardDialog';
import { timeAgo } from '../utils';

function RedlistBanner() {
  return <div className="banner">Your account is red-listed by an admin. You can read discussions but can’t post or reply right now.</div>;
}

function useReport() {
  const toast = useToast();
  return async (payload) => {
    const reason = prompt('What is wrong with this content?');
    if (!reason) return;
    try {
      await api.post('/reports', { ...payload, reason });
      toast('Thanks — admins will review this');
    } catch (e) {
      toast(e.message, 'error');
    }
  };
}

export function Community() {
  const { user } = useAuth();
  const toast = useToast();
  const subjects = useSubjects();
  const [filter, setFilter] = useState('');
  const { data, loading, reload } = useApi(`/posts${filter ? `?subject=${encodeURIComponent(filter)}` : ''}`);
  const [body, setBody] = useState('');
  const [subject, setSubject] = useState('');
  const [busy, setBusy] = useState(false);
  const [awardFor, setAwardFor] = useState(null);
  const report = useReport();

  const post = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/posts', { body, subject });
      setBody('');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="narrow">
      <h1 className="page-title">Community</h1>
      {user.redlisted ? <RedlistBanner /> : (
        <form className="card composer" onSubmit={post}>
          <Avatar user={user} size={40} />
          <div className="grow">
            <textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Ask a doubt, share a tip, start a discussion…" maxLength={3000} />
            <div className="composer-bar">
              <select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject">
                <option value="">General</option>
                {subjects.map((s) => <option key={s}>{s}</option>)}
              </select>
              <button className="btn btn-primary btn-sm" disabled={busy || !body.trim()}>Post</button>
            </div>
          </div>
        </form>
      )}

      <div className="chips-row">
        <button className={`chip ${!filter ? 'chip-on' : ''}`} onClick={() => setFilter('')}>All</button>
        {subjects.map((s) => <button key={s} className={`chip ${filter === s ? 'chip-on' : ''}`} onClick={() => setFilter(s)}>{s}</button>)}
      </div>

      {loading && !data && <div className="card skeleton" />}
      {data?.length === 0 && <div className="empty"><ChatIcon size={48} /><h3>No discussions yet</h3><p className="muted">Start the first one!</p></div>}
      {data?.map((p) => (
        <article key={p.id} className="card thread">
          <header className="post-head">
            <UserLine user={p.user} sub={`${p.subject || 'General'} · ${timeAgo(p.created_at)}`} />
            <div className="row">
              {user.role === 'admin' && p.user.id !== user.id && <button className="icon-btn award-btn" onClick={() => setAwardFor(p)} aria-label="Award a coin"><CoinIcon size={20} /></button>}
              {p.user.id !== user.id && <button className="icon-btn" onClick={() => report({ post_id: p.id })} aria-label="Report"><FlagIcon size={18} /></button>}
            </div>
          </header>
          <Link to={`/community/${p.id}`} className="thread-body pre">{p.body}</Link>
          <div className="thread-foot">
            <Link to={`/community/${p.id}`} className="row gap-sm"><ChatIcon size={18} /> {p.comment_count} {p.comment_count === 1 ? 'reply' : 'replies'}</Link>
            <CoinRow coins={p.coins} size={18} />
          </div>
        </article>
      ))}
      {awardFor && <AwardDialog target={{ user: awardFor.user, post: { id: awardFor.id } }} onClose={() => setAwardFor(null)} onAwarded={reload} />}
    </div>
  );
}

export function Thread() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const { data: p, error, loading, reload } = useApi(`/posts/${id}`);
  const [body, setBody] = useState('');
  const [awarding, setAwarding] = useState(false);
  const report = useReport();

  if (loading && !p) return <div className="narrow"><div className="card skeleton" /></div>;
  if (error) return <div className="empty"><h3>{error.message}</h3></div>;

  const canMod = (owner) => owner.id === user.id || user.role === 'admin';

  const reply = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/posts/${id}/comments`, { body });
      setBody('');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const remove = async (url, after) => {
    if (!confirm('Delete this permanently?')) return;
    try {
      await api.del(url);
      after();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="narrow">
      <button className="link-btn back" onClick={() => navigate('/community')}>← Community</button>
      <article className="card thread">
        <header className="post-head">
          <UserLine user={p.user} sub={`${p.subject || 'General'} · ${timeAgo(p.created_at)}`} />
          <div className="row">
            {user.role === 'admin' && p.user.id !== user.id && <button className="icon-btn award-btn" onClick={() => setAwarding(true)} aria-label="Award a coin"><CoinIcon size={20} /></button>}
            {p.user.id !== user.id && <button className="icon-btn" onClick={() => report({ post_id: p.id })} aria-label="Report"><FlagIcon size={18} /></button>}
            {canMod(p.user) && <button className="icon-btn" onClick={() => remove(`/posts/${p.id}`, () => navigate('/community'))} aria-label="Delete"><TrashIcon size={18} /></button>}
          </div>
        </header>
        <p className="thread-body pre">{p.body}</p>
        {Object.values(p.coins || {}).some(Boolean) && <div className="thread-coins"><CoinRow coins={p.coins} size={22} /></div>}
        {awarding && <AwardDialog target={{ user: p.user, post: { id: p.id } }} onClose={() => setAwarding(false)} onAwarded={reload} />}

        <div className="comments">
          {p.comments.length === 0 && <p className="muted small">No replies yet.</p>}
          {p.comments.map((c) => (
            <div key={c.id} className="comment">
              <Avatar user={c.user} size={32} link />
              <div className="grow">
                <p><Link to={`/u/${c.user.username}`} className="strong">{c.user.username}</Link> <span className="pre">{c.body}</span></p>
                <div className="comment-meta">
                  <span>{timeAgo(c.created_at)}</span>
                  {c.user.id !== user.id && <button onClick={() => report({ comment_id: c.id })}>Report</button>}
                  {canMod(c.user) && <button onClick={() => remove(`/comments/${c.id}`, reload)}>Delete</button>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {user.redlisted ? <RedlistBanner /> : (
          <form className="reply" onSubmit={reply}>
            <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a reply…" maxLength={1000} />
            <button className="link-btn strong" disabled={!body.trim()}>Post</button>
          </form>
        )}
      </article>
    </div>
  );
}
