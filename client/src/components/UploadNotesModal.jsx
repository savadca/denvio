import { useState } from 'react';
import { Link } from 'react-router-dom';
import { uploadPresigned } from '@vercel/blob/client';
import { api } from '../api';
import { useAuth } from '../auth';
import { useSubjects } from '../subjects';
import Modal from './Modal';
import { UploadIcon, CheckIcon } from './Icons';

const blank = (subject = '') => ({ title: '', subject, description: '', video_url: '', audio_url: '' });

export default function UploadNotesModal({ open, onClose, defaultSubject = '', onUploaded }) {
  const { user } = useAuth();
  const subjects = useSubjects();
  const [form, setForm] = useState(() => blank(defaultSubject));
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [progress, setProgress] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const reset = () => {
    setForm(blank(defaultSubject));
    setFile(null);
    setError('');
    setDone(null);
  };
  const close = () => {
    if (busy) return; // don't lose an upload in progress
    reset();
    onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      let fileFields = {};
      if (file) {
        // Send the file straight to storage, then save the note with its address.
        // Unique name per upload; the server signs exactly this path inside the user's folder.
        const safeName = file.name.replace(/[^\w.-]+/g, '_').slice(-80) || 'notes';
        const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        setProgress(0);
        const blob = await uploadPresigned(`notes/${user.id}/${unique}-${safeName}`, file, {
          access: 'public',
          handleUploadUrl: '/api/notes/upload',
          onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
        });
        fileFields = { file_url: blob.url, file_name: file.name };
      }
      const result = await api.post('/notes', { ...form, ...fileFields });
      setDone(result);
      onUploaded?.(result);
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <Modal open={open} onClose={close} title={done ? '' : 'Share notes'} className="upload-modal">
      {done ? (
        <div className="center-card upload-done">
          <span className="big-check"><CheckIcon size={40} /></span>
          <h2>{done.status === 'approved' ? 'Published!' : 'Sent for review'}</h2>
          <p className="muted">
            {done.status === 'approved'
              ? 'Your note is live for everyone.'
              : 'An admin will check your upload. Once approved it appears in the notes library. You can track it on your profile.'}
          </p>
          <div className="row gap center-row">
            <button className="btn btn-primary" onClick={() => { setForm(blank(form.subject)); setFile(null); setDone(null); }}>Upload another</button>
            <Link className="btn" to={`/u/${user.username}?tab=uploads`} onClick={close}>My uploads</Link>
          </div>
        </div>
      ) : (
        <form className="form upload-form" onSubmit={submit}>
          <label className={`dropzone ${file ? 'has-file' : ''}`}>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.ppt,.pptx,.txt"
              onChange={(e) => setFile(e.target.files[0] || null)}
              disabled={busy}
            />
            <UploadIcon size={36} />
            {file
              ? <><span className="strong">{file.name}</span><span className="muted small">{(file.size / 1024 / 1024).toFixed(2)} MB · tap to change</span></>
              : <><span className="strong">Choose notes file</span><span className="muted small">PDF, image, Word, PowerPoint or text · up to 25 MB</span></>}
          </label>
          {progress !== null && (
            <div className="upload-progress" aria-label={`Uploading ${progress}%`}><span style={{ width: `${progress}%` }} /></div>
          )}

          <label>Title<input value={form.title} onChange={set('title')} placeholder="e.g. Classification of dental caries" required maxLength={120} /></label>
          <label>Subject
            <select value={form.subject} onChange={set('subject')} required>
              <option value="">Select subject…</option>
              {subjects.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label>Description<textarea rows={2} value={form.description} onChange={set('description')} placeholder="What does this cover? Year, topic, source…" maxLength={2000} /></label>

          <details className="fieldset media-details">
            <summary>Add video or audio link (optional)</summary>
            <label>Video link<input type="url" value={form.video_url} onChange={set('video_url')} placeholder="YouTube, Vimeo, Google Drive or .mp4 link" /></label>
            <label>Audio link<input type="url" value={form.audio_url} onChange={set('audio_url')} placeholder="SoundCloud, Spotify, Drive or .mp3 link" /></label>
            <p className="muted small">Viewers see “View video / Listen audio” only after an admin verifies and enables the link.</p>
          </details>

          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? (progress !== null && progress < 100 ? `Uploading… ${progress}%` : 'Saving…') : 'Submit for review'}
          </button>
        </form>
      )}
    </Modal>
  );
}
