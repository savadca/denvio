import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { TIERS, tierInfo, levelFor } from '../coins';
import Modal, { Confetti } from './Modal';
import Coin from './Coin';

// Polls for coins the student hasn't seen yet and celebrates them.
export default function Celebration() {
  const { user, refresh } = useAuth();
  const [awards, setAwards] = useState([]);

  useEffect(() => {
    if (user.role === 'admin') return;
    const check = () => api.get('/me/awards/unseen').then((a) => {
      if (!a.length) return;
      setAwards(a);
      refresh(); // pull the new points total
    }).catch(() => {});
    check();
    const t = setInterval(check, 60000);
    return () => clearInterval(t);
  }, [user.id, user.role]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!awards.length) return null;

  const best = TIERS.find((t) => awards.some((a) => a.tier === t.id)).id;
  const gained = awards.reduce((s, a) => s + a.points, 0);
  const total = user.points || 0; // already includes these awards once refresh() lands
  const before = levelFor(Math.max(0, total - gained));
  const after = levelFor(total);

  const close = async () => {
    setAwards([]);
    await api.post('/me/awards/seen').catch(() => {});
    refresh();
  };

  return (
    <Modal open onClose={close} className="celebrate">
      <Confetti />
      <div className="celebrate-coin"><Coin tier={best} size={120} spin /></div>
      <h2>{awards.length === 1 ? `You earned a ${tierInfo(best).label} coin!` : `You earned ${awards.length} coins!`}</h2>
      <p className="celebrate-points">+{gained} points</p>
      {after.index > before.index && <p className="level-up">Level up! You are now a <b>{after.name}</b> 🎉</p>}
      <ul className="celebrate-list">
        {awards.map((a) => (
          <li key={a.id}>
            <Coin tier={a.tier} size={28} />
            <span className="grow">
              <b>{tierInfo(a.tier).label}</b>{a.reason && <> — {a.reason}</>}
              {a.note && <span className="muted small block">for “{a.note.title}”</span>}
            </span>
          </li>
        ))}
      </ul>
      <div className="row gap center-row">
        <Link to={`/u/${user.username}?tab=awards`} className="btn" onClick={close}>See my coins</Link>
        <button className="btn btn-primary" onClick={close}>Awesome!</button>
      </div>
    </Modal>
  );
}
