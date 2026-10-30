import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, useApi } from '../api';
import { useAuth, useToast } from '../auth';
import Avatar from '../components/Avatar';
import { NotePreview, StatusBadge } from '../components/NoteCard';
import { GridIcon, BookmarkIcon, ClockIcon, TestIcon, FlagIcon, TrophyIcon, CoinIcon, TrashIcon } from '../components/Icons';
import Coin, { LevelBadge } from '../components/Coin';
import AwardDialog from '../components/AwardDialog';
import { TIERS, tierInfo, levelFor, useCountUp } from '../coins';
import { timeAgo } from '../utils';

function NoteGrid({ url, showStatus, emptyText }) {
  const { data, loading } = useApi(url);
  if (loading && !data) return <div className="grid">{[0, 1, 2].map((i) => <div key={i} className="grid-cell skeleton" />)}</div>;
  if (!data?.length) return <div className="empty"><p className="muted">{emptyText}</p></div>;
  return (
    <div className="grid">
      {data.map((n) => (
        <Link key={n.id} to={`/notes/${n.id}`} className="grid-cell">
          <NotePreview note={n} compact />
          {showStatus && <span className="grid-badge"><StatusBadge status={n.status} /></span>}
          <span className="grid-hover">♥ {n.like_count} · ⬇ {n.downloads}</span>
        </Link>
      ))}
    </div>
  );
}

function CoinShelf({ points, coins }) {
  const level = levelFor(points);
  const shown = useCountUp(points);
  return (
    <section className="coin-shelf">
      <div className="shelf-top">
        <div>
          <div className="shelf-points"><b>{shown.toLocaleString()}</b> points</div>
          <LevelBadge points={points} />
        </div>
        <div className="shelf-coins">
          {TIERS.map((t) => (
            <div key={t.id} className={`shelf-coin ${coins[t.id] ? '' : 'zero'}`} title={`${t.label}: ${coins[t.id]}`}>
              <Coin tier={t.id} size={40} dim={!coins[t.id]} />
              <span>{coins[t.id]}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="level-bar" aria-label={`Level progress ${level.progress}%`}>
        <span style={{ width: `${level.progress}%` }} />
      </div>
      <div className="muted small">
        {level.next ? <>{level.toNext} pts to <b>{level.next.name}</b></> : <>Top level reached — legend! 🏆</>}
      </div>
    </section>
  );
}

function AwardList({ username, isAdmin, onChange }) {
  const toast = useToast();
  const { data, loading, reload } = useApi(`/users/${username}/awards`);
  const revoke = async (a) => {
    if (!confirm(`Take back this ${tierInfo(a.tier).label} coin?`)) return;
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
  if (!data?.length) {
    return <div className="empty"><Coin tier="bronze" size={64} spin /><p className="muted">No coins yet. Admins award coins for great notes and helpful answers.</p></div>;
  }
  return (
    <div className="list award-list">
      {data.map((a, i) => (
        <div key={a.id} className="list-row award-row" style={{ animationDelay: `${i * 0.05}s` }}>
          <Coin tier={a.tier} size={44} />
          <span className="grow">
            <span className="strong">{tierInfo(a.tier).label} coin</span> <span className={`pts pts-${a.tier}`}>+{a.points}</span>
            {a.reason && <span className="block">{a.reason}</span>}
            <span className="muted small block">
              {a.note && <>for <Link to={`/notes/${a.note.id}`} className="strong">{a.note.title}</Link> · </>}
              {a.post && <>for <Link to={`/community/${a.post.id}`} className="strong">a discussion</Link> · </>}
              {timeAgo(a.created_at)}{a.awarded_by && <> · by @{a.awarded_by}</>}
            </span>
          </span>
          {isAdmin && <button className="icon-btn" onClick={() => revoke(a)} aria-label="Revoke coin"><TrashIcon size={18} /></button>}
        </div>
      ))}
    </div>
  );
}

function Results() {
  const { data } = useApi('/me/attempts');
  if (!data?.length) return <div className="empty"><p className="muted">No mock tests taken yet.</p><Link to="/tests" className="btn btn-primary">Take a test</Link></div>;
  return (
    <div className="list">
      {data.map((a) => {
        const pct = a.total ? Math.round((a.score / a.total) * 100) : 0;
        return (
          <Link key={a.id} to={`/results/${a.id}`} className="list-row">
            <span className={`score-pill ${pct >= 50 ? 'pass' : 'fail'}`}>{pct}%</span>
            <span className="grow"><span className="strong">{a.title}</span><span className="muted small block">{a.subject} · {a.score}/{a.total} · {timeAgo(a.created_at)}</span></span>
          </Link>
        );
      })}
    </div>
  );
}

export default function Profile() {
  const { username } = useParams();
  const { user: me, requireLogin } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { data, error, loading, reload } = useApi(`/users/${username}`);
  const [reporting, setReporting] = useState(false);
  const [awarding, setAwarding] = useState(false);

  if (loading && !data) return <div className="profile"><div className="card skeleton" /></div>;
  if (error) return <div className="empty"><h3>{error.message}</h3></div>;

  const { user, counts, coins, points } = data;
  const isMe = me?.id === user.id;
  const isAdmin = me?.role === 'admin';
  const tabs = [
    { id: 'notes', label: 'Notes', icon: GridIcon },
    ...(isMe ? [
      { id: 'uploads', label: 'My uploads', icon: ClockIcon },
      { id: 'saved', label: 'Saved', icon: BookmarkIcon },
      { id: 'results', label: 'Results', icon: TestIcon },
    ] : []),
    { id: 'awards', label: 'Coins', icon: TrophyIcon },
  ];
  const tab = tabs.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'notes';

  const report = async () => {
    if (!requireLogin(`Sign up to report @${user.username}.`)) return;
    const reason = prompt(`Why are you reporting @${user.username}?`);
    if (!reason) return;
    setReporting(true);
    try {
      await api.post('/reports', { target_user_id: user.id, reason });
      toast('Report sent to admins');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setReporting(false);
    }
  };

  return (
    <div className="profile">
      <header className="profile-head">
        <Avatar user={user} size={150} story />
        <div className="profile-info">
          <div className="profile-row">
            <h1 className="profile-name">{user.username}</h1>
            {user.role === 'admin' && <span className="badge badge-admin">Admin</span>}
            {isMe
              ? <Link to="/settings" className="btn btn-soft">Edit profile</Link>
              : (
                <div className="row gap-sm">
                  {isAdmin && <button className="btn btn-coin btn-coin-gold" onClick={() => setAwarding(true)}><CoinIcon size={16} /> Give coin</button>}
                  <button className="btn btn-soft" onClick={report} disabled={reporting}><FlagIcon size={16} /> Report</button>
                </div>
              )}
          </div>
          <ul className="profile-stats">
            <li><b>{counts.notes}</b> <span>notes</span></li>
            <li><b>{counts.posts}</b> <span>posts</span></li>
            <li><b>{counts.tests}</b> <span>tests</span></li>
            <li><b>{counts.downloads}</b> <span>downloads</span></li>
          </ul>
          <div className="profile-bio">
            {user.full_name && <div className="strong">{user.full_name}</div>}
            {(user.college || user.year) && <div className="muted">{[user.year, user.college].filter(Boolean).join(' · ')}</div>}
            {user.bio && <p className="pre">{user.bio}</p>}
            {isMe && user.redlisted && <p className="badge badge-rejected">Your account is red-listed — community posting is paused.</p>}
          </div>
        </div>
      </header>

      {user.role !== 'admin' && <CoinShelf points={points} coins={coins} />}

      <nav className="profile-tabs">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setParams(id === 'notes' ? {} : { tab: id })} aria-label={label}>
            <Icon size={14} /> <span className="tab-label">{label}</span>
          </button>
        ))}
      </nav>

      {tab === 'notes' && <NoteGrid url={`/notes?user=${encodeURIComponent(user.username)}`} emptyText="No approved notes yet." key={`n-${user.id}-${isMe}`} />}
      {tab === 'uploads' && <NoteGrid url={`/notes?user=${encodeURIComponent(user.username)}&all=1`} showStatus emptyText="You haven’t uploaded anything yet." />}
      {tab === 'saved' && <NoteGrid url="/notes?saved=1" emptyText="Notes you save will show up here." />}
      {tab === 'results' && <Results />}
      {tab === 'awards' && <AwardList key={points} username={user.username} isAdmin={isAdmin} onChange={reload} />}
      {awarding && <AwardDialog target={{ user }} onClose={() => setAwarding(false)} onAwarded={reload} />}
    </div>
  );
}
