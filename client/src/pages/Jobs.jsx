import { useEffect, useState } from 'react';
import { useApi } from '../api';
import { useAuth } from '../auth';
import { BriefcaseIcon, SearchIcon, PinIcon, ExternalIcon } from '../components/Icons';
import { ago, subjectHue } from '../utils';

const slug = (s) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const LINKEDIN_TYPE = { full_time: 'F', part_time: 'P', contract: 'C', internship: 'I' };

// Deep links that open the same search on the big job sites.
function marketLinks({ keyword, location, type }) {
  const loc = location || 'India';
  const li = new URLSearchParams({ keywords: keyword, location: loc });
  if (LINKEDIN_TYPE[type]) li.set('f_JT', LINKEDIN_TYPE[type]);
  return [
    { name: 'LinkedIn', cls: 'mk-linkedin', url: `https://www.linkedin.com/jobs/search/?${li}` },
    { name: 'Naukri', cls: 'mk-naukri', url: `https://www.naukri.com/${slug(keyword)}-jobs${location ? `-in-${slug(location)}` : ''}` },
    { name: 'Indeed', cls: 'mk-indeed', url: `https://in.indeed.com/jobs?${new URLSearchParams({ q: keyword, l: location })}` },
  ];
}

function JobCard({ job, meta }) {
  const cls = meta.classifications.find((c) => c.id === job.classification);
  return (
    <article className="job-card" style={{ '--h': subjectHue(job.company) }}>
      <div className="job-head">
        <span className="job-logo" aria-hidden="true">{job.company[0]?.toUpperCase()}</span>
        <div className="grow">
          <h3 className="job-title">{job.title}</h3>
          <div className="job-company">{job.company}</div>
        </div>
        <span className={`job-source ${job.source}`}>{job.source === 'live' ? 'Live' : 'Denvio'}</span>
      </div>
      <div className="job-tags">
        {job.location && <span className="job-tag"><PinIcon size={13} /> {job.location}</span>}
        {cls && <span className="job-tag job-tag-cls">{cls.label}</span>}
        <span className="job-tag">{meta.types[job.job_type]}</span>
        {job.salary && <span className="job-tag job-tag-pay">{job.salary}</span>}
      </div>
      {job.description && <p className="job-desc">{job.description}</p>}
      <div className="job-foot">
        <span className="muted small">{job.created_at ? `Posted ${ago(job.created_at)}` : ''}</span>
        {job.apply_url
          ? <a className="btn btn-primary btn-sm" href={job.apply_url} target="_blank" rel="noopener noreferrer">Apply <ExternalIcon size={14} /></a>
          : <span className="muted small">Contact the clinic directly</span>}
      </div>
    </article>
  );
}

export default function Jobs() {
  const { user } = useAuth();
  const meta = useApi('/jobs/meta');
  const [classification, setClassification] = useState('');
  const [type, setType] = useState('');
  const [source, setSource] = useState('');
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [debounced, setDebounced] = useState({ keyword: '', location: '' });

  useEffect(() => {
    const t = setTimeout(() => setDebounced({ keyword: keyword.trim(), location: location.trim() }), 400);
    return () => clearTimeout(t);
  }, [keyword, location]);

  const params = new URLSearchParams();
  if (classification) params.set('classification', classification);
  if (type) params.set('type', type);
  if (source) params.set('source', source);
  if (debounced.keyword) params.set('q', debounced.keyword);
  if (debounced.location) params.set('location', debounced.location);
  const jobs = useApi(meta.data ? `/jobs?${params}` : null);

  if (!meta.data) return <div className="home"><div className="card skeleton" /></div>;
  const m = meta.data;
  const all = [...(jobs.data?.board || []), ...(jobs.data?.live || [])];
  const searchKeyword = debounced.keyword || m.classifications.find((c) => c.id === classification)?.keyword || 'dentist';
  const links = marketLinks({ keyword: searchKeyword, location: debounced.location, type });

  return (
    <div className="home">
      <header className="page-hero page-hero-jobs">
        <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
        <span className="page-hero-icon"><BriefcaseIcon size={26} /></span>
        <div className="grow">
          <h1>Dental Jobs</h1>
          <p>Clinic openings, internships, faculty and government posts for BDS & MDS graduates.</p>
          <div className="job-search">
            <label><SearchIcon size={18} /><input placeholder="Role, skill or clinic" value={keyword} onChange={(e) => setKeyword(e.target.value)} /></label>
            <label><PinIcon size={18} /><input placeholder="City (e.g. Bengaluru)" value={location} onChange={(e) => setLocation(e.target.value)} /></label>
          </div>
        </div>
      </header>

      <div className="pills" role="tablist" aria-label="Job classification">
        <button role="tab" aria-selected={!classification} className={`pill ${!classification ? 'on' : ''}`} onClick={() => setClassification('')}>✨ All roles</button>
        {m.classifications.map((c) => (
          <button key={c.id} role="tab" aria-selected={classification === c.id} className={`pill ${classification === c.id ? 'on' : ''}`} style={{ '--h': subjectHue(c.label) }} onClick={() => setClassification(c.id)}>
            <span className="pill-dot" />{c.label}
          </button>
        ))}
      </div>

      <div className="job-filters">
        <div className="segmented" role="tablist" aria-label="Job type">
          <button className={!type ? 'on' : ''} onClick={() => setType('')}>Any type</button>
          {Object.entries(m.types).map(([id, label]) => (
            <button key={id} className={type === id ? 'on' : ''} onClick={() => setType(id)}>{label}</button>
          ))}
        </div>
        {m.live_enabled && (
          <div className="segmented" role="tablist" aria-label="Source">
            <button className={!source ? 'on' : ''} onClick={() => setSource('')}>All</button>
            <button className={source === 'board' ? 'on' : ''} onClick={() => setSource('board')}>Denvio board</button>
            <button className={source === 'live' ? 'on' : ''} onClick={() => setSource('live')}>Live market</button>
          </div>
        )}
      </div>

      <div className="market-links">
        <span className="muted small">Search “{searchKeyword}”{debounced.location && <> in {debounced.location}</>} on</span>
        {links.map((l) => (
          <a key={l.name} className={`market-link ${l.cls}`} href={l.url} target="_blank" rel="noopener noreferrer">{l.name} <ExternalIcon size={13} /></a>
        ))}
      </div>

      {!m.live_enabled && user.role === 'admin' && (
        <div className="banner banner-info">
          <b>Live market jobs are off.</b> Get a free API key at developer.adzuna.com, then start the server with
          <code> ADZUNA_APP_ID</code> and <code>ADZUNA_APP_KEY</code> set to show live dental openings here. You can also post jobs from Admin → Jobs.
        </div>
      )}
      {jobs.data?.live_error && <p className="muted small">{jobs.data.live_error}</p>}

      <div className="section-head">
        <h2>{m.classifications.find((c) => c.id === classification)?.label || 'All openings'}</h2>
        {jobs.data && <span className="count-chip">{all.length}</span>}
      </div>

      {jobs.loading && !jobs.data && <div className="job-grid">{[0, 1, 2].map((i) => <div key={i} className="card skeleton tile-skeleton" />)}</div>}
      {jobs.data && !all.length && (
        <div className="empty empty-glow">
          <span className="empty-orb"><BriefcaseIcon size={36} /></span>
          <h3>No openings match these filters</h3>
          <p className="muted">Try another role or city, or use the LinkedIn / Naukri / Indeed buttons above.</p>
        </div>
      )}
      <div className="job-grid">
        {all.map((j, i) => (
          <div key={`${j.source}-${j.id}`} className="note-in" style={{ animationDelay: `${Math.min(i, 10) * 0.04}s` }}>
            <JobCard job={j} meta={m} />
          </div>
        ))}
      </div>
    </div>
  );
}
