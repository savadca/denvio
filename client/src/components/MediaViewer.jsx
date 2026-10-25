import { mediaEmbed } from '../utils';

// Renders an embedded player for a video/audio link. Only mounted after the user clicks "view",
// so nothing loads from third-party sites until then.
export default function MediaViewer({ url, kind = 'video' }) {
  const m = mediaEmbed(url, kind);
  if (!m) return <p className="muted small">This link could not be opened.</p>;
  if (m.type === 'iframe') {
    return (
      <div className={`media-frame ${m.short ? 'media-short' : ''}`}>
        <iframe
          src={m.src}
          title={`${kind} player`}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }
  if (m.type === 'video') return <video className="media-native" src={m.src} controls playsInline />;
  if (m.type === 'audio') return <audio className="media-audio" src={m.src} controls />;
  return (
    <a className="media-link" href={m.src} target="_blank" rel="noopener noreferrer">
      Open {kind} in a new tab ↗
      <span className="muted small">{new URL(m.src).hostname}</span>
    </a>
  );
}
