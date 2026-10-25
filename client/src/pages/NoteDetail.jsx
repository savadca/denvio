import { useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../api';
import NoteCard from '../components/NoteCard';
import { fileKind } from '../utils';

export default function NoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: note, error, loading } = useApi(`/notes/${id}`);

  if (loading) return <div className="narrow"><div className="card skeleton" /></div>;
  if (error) return <div className="narrow"><div className="empty"><h3>{error.message}</h3></div></div>;

  const kind = fileKind(note.file_mime);
  return (
    <div className="narrow">
      <button className="link-btn back" onClick={() => navigate(-1)}>← Back</button>
      <NoteCard note={note} onDeleted={() => navigate('/')} />
      {note.has_file && kind === 'PDF' && (
        <div className="card pdf-view">
          <iframe src={`/api/notes/${note.id}/file`} title={note.title} />
        </div>
      )}
      {note.has_file && kind !== 'image' && kind !== 'PDF' && (
        <p className="muted center small">Preview isn’t available for {kind} files — use the download button.</p>
      )}
    </div>
  );
}
