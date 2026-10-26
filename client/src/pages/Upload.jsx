import { useState } from 'react';
import { Link } from 'react-router-dom';
import { upload } from '@vercel/blob/client';
import { api } from '../api';
import { useAuth } from '../auth';
import { useSubjects } from '../subjects';
import { UploadIcon, CheckIcon } from '../components/Icons';

const empty = { title: '', subject: '', description: '', video_url: '', audio_url: '' };

export default function Upload() {
  const { user } = useAuth();
  const subjects = useSubjects();
  const [form, setForm] = useState(empty);
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [progress, setProgress] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      let fileFields = {};
      if (file) {
        // Send the file straight to storage, then save the note with its address.
        const safeName = file.name.replace(/[^\w.-]+/g, '_').slice(-80) || 'notes';
        setProgress(0);
        const blob = await upload(`notes/${user.id}/${safeName}`, file, {
          access: 'public',
          handleUploadUrl: '/api/notes/upload',
          onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
        });
        fileFields = { file_url: blob.url, file_name: file.name };
      }
      setDone(await api.post('/notes', { ...form, ...fileFields }));
      setForm(empty);
      setFile(null);
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  if (done) {
    return (
      <div className="narrow">
        <div className="card center-card">
          <span className="big-check"><CheckIcon size={40} /></span>
          <h2>{done.status === 'approved' ? 'Published!' : 'Sent for review'}</h2>
          <p className="muted">
            {done.status === 'approved'
              ? 'Your note is live in the feed.'
              : 'An admin will check your upload. Once approved it will appear in everyone’s feed. You can track it on your profile.'}
          </p>
          <div className="row gap">
            <button className="btn btn-primary" onClick={() => setDone(null)}>Upload another</button>
            <Link className="btn" to={`/u/${user.username}?tab=uploads`}>View my uploads</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="narrow">
      <h1 className="page-title">Share notes</h1>
      <form className="card form" onSubmit={submit}>
        <label className={`dropzone ${file ? 'has-file' : ''}`}>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.ppt,.pptx,.txt"
            onChange={(e) => setFile(e.target.files[0] || null)}
          />
          <UploadIcon size={40} />
          {file
            ? <><span className="strong">{file.name}</span><span className="muted small">{(file.size / 1024 / 1024).toFixed(2)} MB · tap to change</span></>
            : <><span className="strong">Choose notes file</span><span className="muted small">PDF, image, Word, PowerPoint or text · up to 25 MB</span></>}
        </label>

        <label>Title<input value={form.title} onChange={set('title')} placeholder="e.g. Classification of dental caries" required maxLength={120} /></label>
        <label>Subject
          <select value={form.subject} onChange={set('subject')} required>
            <option value="">Select subject…</option>
            {subjects.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label>Description<textarea rows={3} value={form.description} onChange={set('description')} placeholder="What does this cover? Year, topic, source…" maxLength={2000} /></label>

        <fieldset className="fieldset">
          <legend>Optional media links</legend>
          <label>Video link<input type="url" value={form.video_url} onChange={set('video_url')} placeholder="YouTube, Vimeo, Google Drive or .mp4 link" /></label>
          <label>Audio link<input type="url" value={form.audio_url} onChange={set('audio_url')} placeholder="SoundCloud, Spotify, Drive or .mp3 link" /></label>
          <p className="muted small">Viewers only see a “View video / Listen audio” button after an admin verifies and enables the link.</p>
        </fieldset>

        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? (progress !== null && progress < 100 ? `Uploading… ${progress}%` : 'Saving…') : 'Submit for review'}</button>
      </form>
    </div>
  );
}
