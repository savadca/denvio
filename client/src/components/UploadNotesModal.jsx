import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { TopicOptions } from '../subjects';
import { uploadFile, addFiles, fileSize, FILE_ACCEPT, MAX_FILE_MB } from '../upload';
import Modal from './Modal';
import { UploadIcon, CheckIcon, XIcon, FileIcon } from './Icons';

const blank = (subject = '') => ({ title: '', subject, description: '', video_url: '', audio_url: '' });

// Picked files plus a per-file title; several files become several notes that share
// the subject and description.
export function FileList({ files, setFiles, disabled, current }) {
  return (
    <ul className="file-list">
      {files.map((f, i) => (
        <li key={f.key} className={current === i ? 'uploading' : ''}>
          <FileIcon size={18} />
          <div className="grow">
            <input value={f.title} maxLength={120} required disabled={disabled} aria-label={`Title for ${f.file.name}`}
              onChange={(e) => setFiles(files.map((x) => (x.key === f.key ? { ...x, title: e.target.value } : x)))} />
            <span className="muted small">{f.file.name} · {fileSize(f.file.size)}</span>
          </div>
          {!disabled && (
            <button type="button" className="icon-btn" aria-label={`Remove ${f.file.name}`} onClick={() => setFiles(files.filter((x) => x.key !== f.key))}>
              <XIcon size={16} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function FilePicker({ files, setFiles, disabled, onError, label = 'Choose files', hint }) {
  const pick = (e) => {
    const { list, tooBig } = addFiles(files, e.target.files);
    e.target.value = ''; // allow picking the same file again after removing it
    setFiles(list);
    if (tooBig) onError?.(`${tooBig} file${tooBig > 1 ? 's are' : ' is'} over ${MAX_FILE_MB} MB and ${tooBig > 1 ? 'were' : 'was'} skipped`);
  };
  return (
    <label className={`dropzone ${files.length ? 'has-file' : ''}`}>
      <input type="file" multiple accept={FILE_ACCEPT} onChange={pick} disabled={disabled} />
      <UploadIcon size={36} />
      {files.length
        ? <><span className="strong">{files.length} file{files.length > 1 ? 's' : ''} selected</span><span className="muted small">Tap to add more</span></>
        : <><span className="strong">{label}</span><span className="muted small">{hint || `PDF, image, Word, PowerPoint or text · up to ${MAX_FILE_MB} MB each · select several at once`}</span></>}
    </label>
  );
}

// topics: 'subjects' (Notes library) or 'exams' (Exam Prep).
export default function UploadNotesModal({ open, onClose, defaultSubject = '', onUploaded, topics = 'subjects' }) {
  const { user } = useAuth();
  const [form, setForm] = useState(() => blank(defaultSubject));
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [progress, setProgress] = useState(null); // { index, percent }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const multi = files.length > 1;

  const reset = () => {
    setForm(blank(defaultSubject));
    setFiles([]);
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
    const shared = { subject: form.subject, description: form.description };
    let saved = 0;
    let status = null;
    let remaining = files;
    try {
      if (!files.length) {
        // Link-only note (video/audio, no file).
        status = (await api.post('/notes', form)).status;
        saved = 1;
      }
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setProgress({ index: i, percent: 0 });
        const url = await uploadFile(f.file, {
          folder: `notes/${user.id}`,
          handleUploadUrl: '/api/notes/upload',
          onProgress: (p) => setProgress({ index: i, percent: Math.round(p) }),
        });
        // A single file keeps the main title and any media links; several files use their own titles.
        const body = multi
          ? { ...shared, title: f.title, file_url: url, file_name: f.file.name }
          : { ...form, file_url: url, file_name: f.file.name };
        status = (await api.post('/notes', body)).status;
        saved += 1;
        remaining = files.slice(i + 1);
      }
      const result = { status, count: saved };
      setDone(result);
      onUploaded?.(result);
    } catch (err) {
      // Keep only the files that were not saved, so retrying doesn't create duplicates.
      if (saved && files.length) {
        setFiles(remaining);
        onUploaded?.({ status, count: saved });
      }
      setError(`${saved ? `${saved} of ${files.length} saved. ` : ''}${err.message || 'Upload failed'}`);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const plural = done?.count > 1;
  const buttonText = () => {
    if (!busy) return multi ? `Submit ${files.length} notes for review` : 'Submit for review';
    if (!progress) return 'Saving…';
    const prefix = multi ? `File ${progress.index + 1}/${files.length} · ` : '';
    return progress.percent < 100 ? `${prefix}Uploading… ${progress.percent}%` : `${prefix}Saving…`;
  };

  return (
    <Modal open={open} onClose={close} title={done ? '' : 'Share notes'} className="upload-modal">
      {done ? (
        <div className="center-card upload-done">
          <span className="big-check"><CheckIcon size={40} /></span>
          <h2>{done.status === 'approved' ? 'Published!' : 'Sent for review'}</h2>
          <p className="muted">
            {done.status === 'approved'
              ? `${plural ? `${done.count} notes are` : 'Your note is'} live for everyone.`
              : `An admin will check your ${plural ? `${done.count} uploads` : 'upload'}. Once approved ${plural ? 'they appear' : 'it appears'} in the notes library. You can track ${plural ? 'them' : 'it'} on your profile.`}
          </p>
          <div className="row gap center-row">
            <button className="btn btn-primary" onClick={() => { setForm(blank(form.subject)); setFiles([]); setDone(null); }}>Upload more</button>
            <Link className="btn" to={`/u/${user.username}?tab=uploads`} onClick={close}>My uploads</Link>
          </div>
        </div>
      ) : (
        <form className="form upload-form" onSubmit={submit}>
          <FilePicker files={files} setFiles={setFiles} disabled={busy} onError={setError} label="Choose notes files" />
          {multi && <FileList files={files} setFiles={setFiles} disabled={busy} current={progress?.index} />}
          {files.length === 1 && (
            <div className="file-single">
              <FileIcon size={18} /><span className="grow">{files[0].file.name} · {fileSize(files[0].file.size)}</span>
              {!busy && <button type="button" className="icon-btn" aria-label="Remove file" onClick={() => setFiles([])}><XIcon size={16} /></button>}
            </div>
          )}
          {progress && (
            <div className="upload-progress" aria-label={`Uploading ${progress.percent}%`}>
              <span style={{ width: `${((progress.index + progress.percent / 100) / Math.max(files.length, 1)) * 100}%` }} />
            </div>
          )}

          {!multi && (
            <label>Title<input value={form.title} onChange={set('title')} placeholder="e.g. Classification of dental caries" required maxLength={120} /></label>
          )}
          <label>{topics === 'exams' ? 'Exam' : 'Subject'}
            <select value={form.subject} onChange={set('subject')} required>
              <option value="">{topics === 'exams' ? 'Select exam…' : 'Select subject…'}</option>
              <TopicOptions only={topics} />
            </select>
          </label>
          <label>Description<textarea rows={2} value={form.description} onChange={set('description')} placeholder={multi ? 'Shared by all these notes — topic, source…' : 'What does this cover? Year, topic, source…'} maxLength={2000} /></label>

          {!multi && (
            <details className="fieldset media-details">
              <summary>Add video or audio link (optional)</summary>
              <label>Video link<input type="url" value={form.video_url} onChange={set('video_url')} placeholder="YouTube, Vimeo, Google Drive or .mp4 link" /></label>
              <label>Audio link<input type="url" value={form.audio_url} onChange={set('audio_url')} placeholder="SoundCloud, Spotify, Drive or .mp3 link" /></label>
              <p className="muted small">Viewers see “View video / Listen audio” only after an admin verifies and enables the link.</p>
            </details>
          )}

          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>{buttonText()}</button>
        </form>
      )}
    </Modal>
  );
}
