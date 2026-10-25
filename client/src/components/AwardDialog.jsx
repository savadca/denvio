import { useState } from 'react';
import { api } from '../api';
import { useToast } from '../auth';
import { TIERS, tierInfo } from '../coins';
import Modal from './Modal';
import Coin from './Coin';

const QUICK_REASONS = ['Excellent notes', 'Clear diagrams', 'Helpful answer', 'Great explanation', 'Top contributor', 'Mock test topper'];

// target: { user: {id, username}, note?: {id, title}, post?: {id} }
export default function AwardDialog({ target, onClose, onAwarded }) {
  const toast = useToast();
  const [tier, setTier] = useState('gold');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  if (!target) return null;
  const info = tierInfo(tier);

  const give = async () => {
    setBusy(true);
    try {
      await api.post('/admin/awards', {
        tier, reason,
        user_id: target.user.id, note_id: target.note?.id, post_id: target.post?.id,
      });
      toast(`${info.emoji} ${info.label} coin sent to @${target.user.username}`, 'success');
      onAwarded?.(tier);
      onClose();
    } catch (e) {
      toast(e.message, 'error');
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Award a coin" className="award-modal">
      <p className="muted center">
        To <b>@{target.user.username}</b>
        {target.note && <> for “{target.note.title}”</>}
        {target.post && <> for their discussion post</>}
      </p>
      <div className="coin-picker" role="radiogroup" aria-label="Coin type">
        {TIERS.map((t) => (
          <button
            key={t.id} type="button" role="radio" aria-checked={tier === t.id}
            className={`coin-option ${tier === t.id ? 'on' : ''}`} onClick={() => setTier(t.id)}
          >
            <Coin tier={t.id} size={54} spin={tier === t.id} />
            <span className="strong">{t.label}</span>
            <span className="muted small">+{t.points} pts</span>
          </button>
        ))}
      </div>
      <div className="chips-wrap">
        {QUICK_REASONS.map((r) => (
          <button key={r} type="button" className={`chip ${reason === r ? 'chip-on' : ''}`} onClick={() => setReason(r)}>{r}</button>
        ))}
      </div>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (shown to the student)" maxLength={200} />
      <button className={`btn btn-block btn-coin btn-coin-${tier}`} disabled={busy} onClick={give}>
        Give {info.label} coin · +{info.points}
      </button>
    </Modal>
  );
}
