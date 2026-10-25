import { useEffect, useState } from 'react';
import { useApi } from '../api';
import { NewsIcon, SearchIcon, ExternalIcon } from '../components/Icons';
import { timeAgo, ago, subjectHue } from '../utils';

export const NEWS_CATEGORIES = [
  { id: '', label: 'All', emoji: '✨' },
  { id: 'research', label: 'Research', emoji: '🔬' },
  { id: 'health', label: 'Oral health', emoji: '🦷' },
  { id: 'practice', label: 'Practice & industry', emoji: '🏥' },
];

export function NewsCard({ item, featured = false, compact = false }) {
  const hue = subjectHue(item.source);
  return (
    <a
      className={`news-card ${featured ? 'news-featured' : ''} ${compact ? 'news-compact' : ''}`}
      href={item.link} target="_blank" rel="noopener noreferrer" style={{ '--h': hue }}
    >
      <div className="news-cover">
        {item.image
          ? <img src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
          : <span className="news-cover-mark" aria-hidden="true">{item.source[0]}</span>}
        <span className="news-source">{item.source}</span>
      </div>
      <div className="news-body">
        <span className="news-meta">{NEWS_CATEGORIES.find((c) => c.id === item.category)?.label} · {item.date ? timeAgo(item.date) : 'recent'}</span>
        <h3 className="news-title">{item.title}</h3>
        {!compact && item.summary && <p className="news-summary">{item.summary}</p>}
        {!compact && <span className="news-read">Read on {item.source} <ExternalIcon size={14} /></span>}
      </div>
    </a>
  );
}

export default function News() {
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (q) params.set('q', q);
  const { data, loading, error } = useApi(`/news?${params}`);
  const items = data?.items || [];
  const [first, ...rest] = items;

  return (
    <div className="home">
      <header className="page-hero page-hero-news">
        <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
        <span className="page-hero-icon"><NewsIcon size={26} /></span>
        <div>
          <h1>Dental News</h1>
          <p>Fresh research, oral-health and practice stories from trusted sources.{data && <> Updated {ago(data.updated_at)}.</>}</p>
        </div>
      </header>

      <div className="home-toolbar">
        <label className="glass-search">
          <SearchIcon size={18} />
          <input placeholder="Search headlines" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>
      <div className="pills" role="tablist" aria-label="News category">
        {NEWS_CATEGORIES.map((c) => (
          <button key={c.id} role="tab" aria-selected={category === c.id} className={`pill ${category === c.id ? 'on' : ''}`} onClick={() => setCategory(c.id)}>
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {loading && !data && <div className="news-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="card skeleton tile-skeleton" />)}</div>}
      {error && <p className="form-error">{error.message}</p>}
      {data && !items.length && (
        <div className="empty empty-glow">
          <span className="empty-orb"><NewsIcon size={36} /></span>
          <h3>No stories found</h3>
          <p className="muted">{data.unavailable?.length ? 'News sources could not be reached right now — try again later.' : 'Try another category or search.'}</p>
        </div>
      )}
      {first && <NewsCard item={first} featured />}
      <div className="news-grid">
        {rest.map((n, i) => (
          <div key={n.id} className="note-in" style={{ animationDelay: `${Math.min(i, 10) * 0.04}s` }}><NewsCard item={n} /></div>
        ))}
      </div>
      {data && (
        <p className="muted small center news-credit">
          Headlines from {data.sources.map((s) => s.name).join(', ')}. Tap a story to read it on the publisher’s site.
          {data.unavailable?.length > 0 && <> ({data.unavailable.join(', ')} unavailable right now.)</>}
        </p>
      )}
    </div>
  );
}
