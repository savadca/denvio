import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth, useToast } from '../auth';
import { timeAgo, fileKind, subjectHue } from '../utils';
import { UserLine } from './Avatar';
import MediaViewer from './MediaViewer';
import AwardDialog from './AwardDialog';
import { CoinRow } from './Coin';
import { HeartIcon, DownloadIcon, BookmarkIcon, PlayIcon, AudioIcon, TrashIcon, FileIcon, CoinIcon } from './Icons';

export function StatusBadge({ status }) {
  if (status === 'approved') return null;
  return <span className={`badge badge-${status}`}>{status === 'pending' ? 'Awaiting review' : 'Rejected'}</span>;
}

export function NotePreview({ note, compact = false }) {
  const { user } = useAuth();
  const kind = fileKind(note.file_mime);
  // Files are for signed-in users, so visitors see the title tile instead of the picture.
  if (note.has_file && kind === 'image' && user) {
    return <img className="note-image" src={`/api/notes/${note.id}/file`} alt={note.title} loading="lazy" draggable="false" />;
  }
  return (
    <div className={`note-tile ${compact ? 'note-tile-compact' : ''}`} style={{ '--h': subjectHue(note.subject) }}>
      <span className="note-tile-kind">
        {note.has_file ? <><FileIcon size={compact ? 20 : 28} /> {kind}</> : note.video_url ? <><PlayIcon size={compact ? 20 : 28} /> Video</> : <><AudioIcon size={compact ? 20 : 28} /> Audio</>}
      </span>
      <span className="note-tile-title">{note.title}</span>
      <span className="note-tile-subject">{note.subject}</span>
    </div>
  );
}

export default function NoteCard({ note: initial, onDeleted }) {
  const { user, requireLogin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [note, setNote] = useState(initial);
  const [open, setOpen] = useState(null); // 'video' | 'audio' | null
  const [awarding, setAwarding] = useState(false);
  const [burst, setBurst] = useState(0);
  const lastTap = useRef(0);
  const tapTimer = useRef(null);
  const isAdmin = user?.role === 'admin';
  const canDelete = isAdmin || user?.id === note.user.id;
  const approved = note.status === 'approved';

  const toggle = async (what) => {
    if (!requireLogin(`Sign up to ${what} notes.`)) return;
    try {
      const r = await api.post(`/notes/${note.id}/${what}`);
      setNote((n) => what === 'like'
        ? { ...n, liked: r.active, like_count: r.count }
        : { ...n, saved: r.active });
      if (what === 'save') toast(r.active ? 'Saved to your collection' : 'Removed from saved');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  // Instagram-style: double-tap the picture to like, single tap opens the note.
  const onMediaTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      clearTimeout(tapTimer.current);
      lastTap.current = 0;
      if (!approved) return;
      setBurst((b) => b + 1);
      if (!note.liked) toggle('like');
    } else {
      lastTap.current = now;
      tapTimer.current = setTimeout(() => navigate(`/notes/${note.id}`), 300);
    }
  };

  const remove = async () => {
    if (!confirm('Delete this note permanently?')) return;
    try {
      await api.del(`/notes/${note.id}`);
      toast('Note deleted');
      onDeleted?.(note.id);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <article className="card post">
      <header className="post-head">
        <UserLine user={note.user} sub={`${note.subject} · ${timeAgo(note.created_at)}`} badge={<StatusBadge status={note.status} />} />
        {canDelete && <button className="icon-btn" onClick={remove} aria-label="Delete note"><TrashIcon size={20} /></button>}
      </header>

      <div
        className="post-media" role="link" tabIndex={0} aria-label={`Open ${note.title}`}
        onClick={onMediaTap} onKeyDown={(e) => e.key === 'Enter' && navigate(`/notes/${note.id}`)}
      >
        <NotePreview note={note} />
        {burst > 0 && <HeartIcon key={burst} className="heart-burst" size={96} filled />}
        {note.coins && Object.values(note.coins).some(Boolean) && (
          <span className="media-coins"><CoinRow coins={note.coins} size={22} /></span>
        )}
      </div>

      <div className="post-actions">
        {approved && (
          <button className={`icon-btn ${note.liked ? 'liked' : ''}`} onClick={() => toggle('like')} aria-label={note.liked ? 'Unlike' : 'Like'}>
            <HeartIcon filled={note.liked} />
          </button>
        )}
        {note.has_file && (
          <a className="icon-btn" href={`/api/notes/${note.id}/file?download=1`} aria-label="Download"
            onClick={(e) => !requireLogin('Sign up for free to download notes.') && e.preventDefault()}>
            <DownloadIcon />
          </a>
        )}
        {note.video_url && (
          <button className={`icon-btn ${open === 'video' ? 'on' : ''}`} onClick={() => setOpen(open === 'video' ? null : 'video')} aria-label="View video">
            <PlayIcon />
          </button>
        )}
        {note.audio_url && (
          <button className={`icon-btn ${open === 'audio' ? 'on' : ''}`} onClick={() => setOpen(open === 'audio' ? null : 'audio')} aria-label="Listen to audio">
            <AudioIcon />
          </button>
        )}
        {isAdmin && note.user.id !== user.id && (
          <button className="icon-btn award-btn" onClick={() => setAwarding(true)} aria-label="Award a coin" title="Award a coin">
            <CoinIcon />
          </button>
        )}
        {approved && (
          <button className={`icon-btn push-right ${note.saved ? 'on' : ''}`} onClick={() => toggle('save')} aria-label={note.saved ? 'Unsave' : 'Save'}>
            <BookmarkIcon filled={note.saved} />
          </button>
        )}
      </div>

      {open && (
        <div className="post-player">
          <MediaViewer url={open === 'video' ? note.video_url : note.audio_url} kind={open} />
        </div>
      )}

      <div className="post-body">
        {approved && <div className="strong">{note.like_count} {note.like_count === 1 ? 'like' : 'likes'} · {note.downloads} downloads</div>}
        <p><Link to={`/u/${note.user.username}`} className="strong">{note.user.username}</Link> <Link to={`/notes/${note.id}`} className="strong">{note.title}</Link></p>
        {note.description && <p className="pre">{note.description}</p>}
        {(note.video_url || note.audio_url) && !open && (
          <div className="media-chips">
            {note.video_url && <button className="chip" onClick={() => setOpen('video')}><PlayIcon size={16} /> View video</button>}
            {note.audio_url && <button className="chip" onClick={() => setOpen('audio')}><AudioIcon size={16} /> Listen audio</button>}
          </div>
        )}
        {note.status !== 'approved' && note.admin_note && <p className="muted small">Admin: {note.admin_note}</p>}
        {note.status !== 'approved' && user?.id === note.user.id && (note.video_url || note.audio_url) && (
          <p className="muted small">Your video/audio links become visible to others once an admin enables them.</p>
        )}
      </div>

      {awarding && (
        <AwardDialog
          target={{ user: note.user, note: { id: note.id, title: note.title } }}
          onClose={() => setAwarding(false)}
          onAwarded={(tier) => setNote((n) => ({ ...n, coins: { ...n.coins, [tier]: (n.coins?.[tier] || 0) + 1 } }))}
        />
      )}
    </article>
  );
}
