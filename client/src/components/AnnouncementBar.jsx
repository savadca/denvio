import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { BellIcon, ChevronUpIcon, ChevronLeftIcon, ChevronRightIcon, ExternalIcon } from './Icons';

export const ANNOUNCEMENT_TYPES = {
  info: { label: 'Notice', emoji: '💡' },
  success: { label: 'Good news', emoji: '🎉' },
  warning: { label: 'Heads up', emoji: '⚠️' },
  urgent: { label: 'Urgent', emoji: '🚨' },
  event: { label: 'Event', emoji: '📅' },
};
const ROTATE_MS = 7000;
const STORE_KEY = 'denvio.announcements.minimizedAt';

function readStore() {
  try {
    return Number(localStorage.getItem(STORE_KEY)) || 0;
  } catch {
    return 0;
  }
}
function writeStore(value) {
  try {
    if (value) localStorage.setItem(STORE_KEY, String(value));
    else localStorage.removeItem(STORE_KEY);
  } catch { /* storage blocked */ }
}

// Presentational card; also used by the admin composer as a live preview.
export function AnnouncementCard({ item, index = 0, total = 1, onMinimize, onPrev, onNext, onDot, rotating = false }) {
  const meta = ANNOUNCEMENT_TYPES[item.type] || ANNOUNCEMENT_TYPES.info;
  return (
    <div className={`ann ann-${item.type || 'info'}`} role="region" aria-label="Announcements" aria-live="polite">
      <div className="ann-content" key={item.id ?? 'preview'}>
        <span className="ann-icon" aria-hidden="true">{item.emoji || meta.emoji}</span>
        <div className="ann-text">
          <span className="ann-kicker">{meta.label}{total > 1 && <> · {index + 1}/{total}</>}</span>
          <b className="ann-title">{item.title || 'Your announcement title'}</b>
          {item.body && <span className="ann-body">{item.body}</span>}
        </div>
        {item.link_url && (
          <a className="ann-link" href={item.link_url} target="_blank" rel="noopener noreferrer">
            {item.link_label || 'Open'} <ExternalIcon size={14} />
          </a>
        )}
      </div>
      <div className="ann-controls">
        {total > 1 && (
          <>
            <button className="ann-btn" onClick={onPrev} aria-label="Previous announcement"><ChevronLeftIcon size={16} /></button>
            <span className="ann-dots">
              {Array.from({ length: total }, (_, i) => (
                <button key={i} className={i === index ? 'on' : ''} onClick={() => onDot(i)} aria-label={`Announcement ${i + 1}`} />
              ))}
            </span>
            <button className="ann-btn" onClick={onNext} aria-label="Next announcement"><ChevronRightIcon size={16} /></button>
          </>
        )}
        {onMinimize && <button className="ann-btn ann-min" onClick={onMinimize} aria-label="Minimize announcements" title="Minimize"><ChevronUpIcon size={18} /></button>}
      </div>
      {rotating && <span className="ann-progress" key={`p${index}`} style={{ animationDuration: `${ROTATE_MS}ms` }} />}
    </div>
  );
}

export default function AnnouncementBar() {
  const [items, setItems] = useState([]);
  const [index, setIndex] = useState(0);
  const [minimized, setMinimized] = useState(false);
  const [paused, setPaused] = useState(false);

  const load = useCallback(() => {
    api.get('/announcements').then((list) => {
      setItems(list);
      setIndex((i) => (i < list.length ? i : 0));
      // Stay minimized only if nothing newer arrived since the user minimized.
      const newest = list[0]?.id || 0;
      setMinimized(newest > 0 && readStore() >= newest);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 120000);
    return () => clearInterval(t);
  }, [load]);

  const rotating = items.length > 1 && !paused && !minimized;
  useEffect(() => {
    if (!rotating) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % items.length), ROTATE_MS);
    return () => clearTimeout(t);
  }, [rotating, index, items.length]);

  if (!items.length) return null;

  if (minimized) {
    return (
      <button className="ann-bell" onClick={() => { writeStore(0); setMinimized(false); }} aria-label={`Show ${items.length} announcements`}>
        <BellIcon size={22} />
        <span className="ann-bell-count">{items.length}</span>
      </button>
    );
  }

  const go = (d) => setIndex((i) => (i + d + items.length) % items.length);
  return (
    <div className="ann-wrap" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <AnnouncementCard
        item={items[index]} index={index} total={items.length} rotating={rotating}
        onPrev={() => go(-1)} onNext={() => go(1)} onDot={setIndex}
        onMinimize={() => { writeStore(items[0].id); setMinimized(true); }}
      />
    </div>
  );
}
