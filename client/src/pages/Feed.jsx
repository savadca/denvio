import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../api';
import { useAuth } from '../auth';
import { useSubjects } from '../subjects';
import NoteCard from '../components/NoteCard';
import Avatar from '../components/Avatar';
import Coin, { LevelBadge } from '../components/Coin';
import { SearchIcon, PlusIcon, TestIcon, ChatIcon, TrophyIcon, ShieldIcon, GridIcon, ClockIcon, ToothIcon, FlagIcon, BriefcaseIcon } from '../components/Icons';
import { TIERS, levelFor, useCountUp } from '../coins';
import { timeAgo, subjectHue, greeting } from '../utils';
import { NewsCard } from './News';

function ProgressRing({ value, size = 104, stroke = 9, children }) {
  const id = useId().replace(/:/g, '');
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id={`ring${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#feda75" />
            <stop offset=".5" stopColor="#fa7e1e" />
            <stop offset="1" stopColor="#d62976" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth={stroke} />
        <circle
          className="ring-progress" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#ring${id})`}
          strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(value, 3) / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ '--c': c }}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

// Shown on the home page to visitors who haven't signed up.
function GuestHero() {
  const { promptLogin } = useAuth();
  const actions = [
    { to: '/notes', label: 'Notes', icon: GridIcon },
    { to: '/exams', label: 'Exam prep', icon: TestIcon },
    { to: '/jobs', label: 'Jobs', icon: BriefcaseIcon },
    { to: '/community', label: 'Discuss', icon: ChatIcon },
  ];
  return (
    <section className="hero">
      <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
      <div className="hero-main">
        <p className="hero-eyebrow">{greeting()} 👋</p>
        <h1 className="hero-title">Welcome to Denvio</h1>
        <p className="hero-sub">Notes, question papers, mock tests and discussions by BDS students. Browse freely — sign up to upload, download and take tests.</p>
        <div className="quick-actions">
          {actions.map(({ to, label, icon: Icon }, i) => (
            <Link key={to} to={to} className="qa" style={{ animationDelay: `${0.1 + i * 0.06}s` }}>
              <span className="qa-icon"><Icon size={20} /></span>
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </div>
      <div className="hero-side">
        <button className="btn btn-light" onClick={() => promptLogin('Join Denvio to share and download notes.')}>Sign up free</button>
      </div>
    </section>
  );
}

function Hero({ user, profile, stats }) {
  const isAdmin = user.role === 'admin';
  const points = profile?.points ?? user.points ?? 0;
  const level = levelFor(points);
  const shown = useCountUp(points);
  const first = (user.full_name || user.username).split(' ')[0];

  const actions = [
    { to: '/notes?upload=1', label: 'Upload', icon: PlusIcon },
    { to: '/tests', label: 'Mock test', icon: TestIcon },
    { to: '/jobs', label: 'Jobs', icon: BriefcaseIcon },
    isAdmin ? { to: '/admin', label: 'Review', icon: ShieldIcon } : { to: '/community', label: 'Ask', icon: ChatIcon },
  ];

  return (
    <section className="hero">
      <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
      <div className="hero-main">
        <p className="hero-eyebrow">{greeting()} 👋</p>
        <h1 className="hero-title">{first}</h1>
        <p className="hero-sub">
          {isAdmin
            ? (stats?.pending_notes ? `${stats.pending_notes} upload${stats.pending_notes > 1 ? 's' : ''} waiting for your review.` : 'Everything is reviewed. Nice work!')
            : level.next ? `${level.toNext} points to become a ${level.next.name}. Keep sharing!` : 'You reached the top level. Legend!'}
        </p>
        <div className="quick-actions">
          {actions.map(({ to, label, icon: Icon }, i) => (
            <Link key={to} to={to} className="qa" style={{ animationDelay: `${0.1 + i * 0.06}s` }}>
              <span className="qa-icon"><Icon size={20} /></span>
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </div>
      <div className="hero-side">
        {isAdmin ? (
          <Link to="/admin" className="hero-stat">
            <b>{stats?.pending_notes ?? '–'}</b>
            <span>pending reviews</span>
          </Link>
        ) : (
          <>
            <ProgressRing value={level.progress}>
              <b>{shown}</b>
              <span>points</span>
            </ProgressRing>
            <LevelBadge points={points} />
          </>
        )}
      </div>
    </section>
  );
}

function Bento({ user, profile, stats, tests, posts, leaders }) {
  const isAdmin = user?.role === 'admin';
  const next = tests?.find((t) => t.best_pct === null) || tests?.[0];
  const post = posts?.[0];
  return (
    <section className="bento">
      <Link to={next ? `/tests/${next.id}` : '/tests'} className="tile tile-test" style={{ '--h': subjectHue(next?.subject || '') }}>
        <span className="tile-icon"><TestIcon size={20} /></span>
        <span className="tile-label">Next mock test</span>
        {next ? (
          <>
            <span className="tile-title clamp">{next.title}</span>
            <span className="tile-meta"><ClockIcon size={14} /> {next.duration_min} min · {next.question_count} Qs</span>
          </>
        ) : <span className="tile-title">No tests yet</span>}
        <span className="tile-cta">{next ? 'Start →' : 'Browse →'}</span>
      </Link>

      <Link to="/leaderboard" className="tile tile-leaders">
        <span className="tile-icon"><TrophyIcon size={20} /></span>
        <span className="tile-label">Top students</span>
        {leaders?.length ? (
          <span className="mini-podium">
            {leaders.slice(0, 3).map((e, i) => (
              <span key={e.user.id} className={`mini-spot spot-${i + 1}`} title={`${e.user.username} · ${e.points} pts`}>
                <Avatar user={e.user} size={i === 0 ? 44 : 34} />
                <b>{e.points}</b>
              </span>
            ))}
          </span>
        ) : <span className="tile-title">Be the first!</span>}
      </Link>

      <Link to={post ? `/community/${post.id}` : '/community'} className="tile tile-talk">
        <span className="tile-icon"><ChatIcon size={20} /></span>
        <span className="tile-label">Latest discussion</span>
        {post ? (
          <>
            <span className="tile-quote clamp">“{post.body}”</span>
            <span className="tile-meta"><Avatar user={post.user} size={20} /> {post.user.username} · {post.comment_count} replies · {timeAgo(post.created_at)}</span>
          </>
        ) : <span className="tile-title">Start the first conversation</span>}
      </Link>

      {isAdmin ? (
        <Link to="/admin?tab=reports" className="tile tile-coins">
          <span className="tile-icon"><FlagIcon size={20} /></span>
          <span className="tile-label">Moderation</span>
          <span className="tile-stats">
            <span><b>{stats?.open_reports ?? '–'}</b> reports</span>
            <span><b>{stats?.redlisted ?? '–'}</b> red-listed</span>
            <span><b>{stats?.users ?? '–'}</b> users</span>
          </span>
        </Link>
      ) : !user ? (
        <Link to="/register" className="tile tile-coins">
          <span className="tile-icon"><Coin tier="gold" size={22} /></span>
          <span className="tile-label">Earn coins</span>
          <span className="tile-title">Sign up and share notes to earn coins and climb the leaderboard.</span>
          <span className="tile-cta">Sign up →</span>
        </Link>
      ) : (
        <Link to={`/u/${user.username}?tab=awards`} className="tile tile-coins">
          <span className="tile-icon"><Coin tier="gold" size={22} /></span>
          <span className="tile-label">My coins</span>
          <span className="tile-coin-row">
            {TIERS.map((t) => (
              <span key={t.id} className={profile?.coins?.[t.id] ? '' : 'zero'}>
                <Coin tier={t.id} size={28} dim={!profile?.coins?.[t.id]} />
                <b>{profile?.coins?.[t.id] ?? 0}</b>
              </span>
            ))}
          </span>
        </Link>
      )}
    </section>
  );
}

function readView() {
  try {
    return localStorage.getItem('denvio.view') || 'grid';
  } catch {
    return 'grid';
  }
}

export default function Feed() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const subjects = useSubjects();
  const [subject, setSubject] = useState('');
  const [query, setQuery] = useState('');
  const [q, setQ] = useState('');
  const [view, setView] = useState(readView);
  const searchRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Press "/" anywhere to jump to search.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const changeView = (v) => {
    setView(v);
    try { localStorage.setItem('denvio.view', v); } catch { /* private mode */ }
  };

  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  if (q) params.set('q', q);
  const notes = useApi(`/notes?${params}`);
  const profile = useApi(user && !isAdmin ? `/users/${user.username}` : null);
  const stats = useApi(isAdmin ? '/admin/stats' : null);
  const tests = useApi('/tests');
  const posts = useApi('/posts');
  const leaders = useApi('/leaderboard');
  const news = useApi('/news?limit=8');

  return (
    <div className="home">
      {user ? <Hero user={user} profile={profile.data} stats={stats.data} /> : <GuestHero />}
      <Bento user={user} profile={profile.data} stats={stats.data} tests={tests.data} posts={posts.data} leaders={leaders.data} />

      {news.data?.items?.length > 0 && (
        <section className="news-strip">
          <div className="section-head">
            <h2>Dental news</h2>
            <Link to="/news" className="see-all">See all →</Link>
          </div>
          <div className="news-row">
            {news.data.items.map((n) => <NewsCard key={n.id} item={n} compact />)}
          </div>
        </section>
      )}

      <div className="home-toolbar">
        <label className="glass-search">
          <SearchIcon size={18} />
          <input ref={searchRef} placeholder="Search notes, topics or people" value={query} onChange={(e) => setQuery(e.target.value)} />
          {query ? <button type="button" className="kbd" onClick={() => setQuery('')} aria-label="Clear search">✕</button> : <kbd className="kbd">/</kbd>}
        </label>
        <div className="view-toggle" role="group" aria-label="Layout">
          <button className={view === 'grid' ? 'on' : ''} onClick={() => changeView('grid')} aria-label="Grid view" aria-pressed={view === 'grid'}><GridIcon size={18} /></button>
          <button className={view === 'list' ? 'on' : ''} onClick={() => changeView('list')} aria-label="List view" aria-pressed={view === 'list'}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="4" y="4" width="16" height="7" rx="2" /><rect x="4" y="14" width="16" height="7" rx="2" /></svg>
          </button>
        </div>
      </div>

      <div className="pills" role="tablist" aria-label="Filter by subject">
        <button role="tab" aria-selected={!subject} className={`pill ${!subject ? 'on' : ''}`} onClick={() => setSubject('')}>✨ All</button>
        {subjects.map((s) => (
          <button key={s} role="tab" aria-selected={subject === s} className={`pill ${subject === s ? 'on' : ''}`} style={{ '--h': subjectHue(s) }} onClick={() => setSubject(s)}>
            <span className="pill-dot" />{s}
          </button>
        ))}
      </div>

      <div className="section-head">
        <h2>{subject || 'Fresh notes'}</h2>
        {notes.data && <span className="count-chip">{notes.data.length}</span>}
      </div>

      {notes.loading && !notes.data && <div className={`notes-${view}`}>{[0, 1, 2].map((i) => <div key={i} className="card skeleton tile-skeleton" />)}</div>}
      {notes.error && <p className="form-error">{notes.error.message}</p>}
      {notes.data?.length === 0 && (
        <div className="empty empty-glow">
          <span className="empty-orb"><ToothIcon size={40} /></span>
          <h3>{q ? `Nothing found for “${q}”` : `No notes yet${subject ? ` in ${subject}` : ''}`}</h3>
          <p className="muted">Share your notes — they appear here once an admin approves them.</p>
          <Link to="/notes?upload=1" className="btn btn-primary btn-glow">Upload notes</Link>
        </div>
      )}
      <div className={`notes-${view}`}>
        {notes.data?.map((n, i) => (
          <div key={n.id} className="note-in" style={{ animationDelay: `${Math.min(i, 8) * 0.05}s` }}>
            <NoteCard note={n} onDeleted={(id) => notes.setData((d) => d.filter((x) => x.id !== id))} />
          </div>
        ))}
      </div>
    </div>
  );
}
