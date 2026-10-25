import { initials } from '../utils';
import { useSubjects } from '../subjects';

// Instagram "stories" row used as a subject filter.
export default function SubjectStories({ value, onChange }) {
  const subjects = useSubjects();
  return (
    <div className="stories" role="tablist" aria-label="Filter by subject">
      <button className={`story ${!value ? 'story-on' : ''}`} onClick={() => onChange('')} role="tab" aria-selected={!value}>
        <span className="story-ring"><span className="story-bubble">All</span></span>
        <span className="story-label">All subjects</span>
      </button>
      {subjects.map((s) => (
        <button key={s} className={`story ${value === s ? 'story-on' : ''}`} onClick={() => onChange(s)} role="tab" aria-selected={value === s} title={s}>
          <span className="story-ring"><span className="story-bubble">{initials(s)}</span></span>
          <span className="story-label">{s}</span>
        </button>
      ))}
    </div>
  );
}
