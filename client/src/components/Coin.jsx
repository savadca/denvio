import { useId } from 'react';
import { TIERS, tierInfo, levelFor } from '../coins';

const COLORS = {
  diamond: ['#e6fbff', '#7fd8f7', '#6a5cff'],
  gold: ['#fff6c2', '#f5c33b', '#b77900'],
  silver: ['#ffffff', '#cfd8dc', '#7d8c96'],
  bronze: ['#ffdcbc', '#d4874a', '#7f4416'],
};

const STAR = 'M32 16.5l4.6 9.4 10.4 1.5-7.5 7.3 1.8 10.3L32 40.2l-9.3 4.8 1.8-10.3-7.5-7.3 10.4-1.5z';
const GEM = 'M21 27l5.5-8h11l5.5 8L32 44z';

export default function Coin({ tier = 'gold', size = 32, spin = false, dim = false, title }) {
  const uid = useId().replace(/:/g, '');
  const [light, mid, dark] = COLORS[tier] || COLORS.gold;
  return (
    <svg
      className={`coin ${spin ? 'coin-spin' : ''} ${dim ? 'coin-dim' : ''}`}
      width={size} height={size} viewBox="0 0 64 64"
      role="img" aria-label={title || `${tierInfo(tier).label} coin`}
    >
      <defs>
        <linearGradient id={`f${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset=".5" stopColor={mid} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <linearGradient id={`e${uid}`} x1="1" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={light} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill={`url(#e${uid})`} />
      <circle cx="32" cy="32" r="25.5" fill={`url(#f${uid})`} />
      <circle cx="32" cy="32" r="22" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1.5" strokeDasharray="2 3" />
      {tier === 'diamond' ? (
        <g fill="rgba(255,255,255,.92)" stroke={dark} strokeWidth="1.2" strokeLinejoin="round">
          <path d={GEM} />
          <path d="M21 27h22M26.5 19l5.5 8 5.5-8M32 27v17" fill="none" />
        </g>
      ) : (
        <path d={STAR} fill="rgba(255,255,255,.9)" stroke={dark} strokeWidth="1.2" strokeLinejoin="round" />
      )}
      <path className="coin-shine" d="M14 22a20 20 0 0 1 14-12" stroke="rgba(255,255,255,.85)" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

// Compact "💎2 🥇1" style row; hides tiers with zero.
export function CoinRow({ coins, size = 18, showZero = false }) {
  if (!coins) return null;
  const items = TIERS.filter((t) => showZero || coins[t.id] > 0);
  if (!items.length) return null;
  return (
    <span className="coin-row">
      {items.map((t) => (
        <span key={t.id} className={`coin-count ${coins[t.id] ? '' : 'zero'}`} title={`${coins[t.id] || 0} ${t.label}`}>
          <Coin tier={t.id} size={size} dim={!coins[t.id]} />
          {coins[t.id] > 1 && <b>×{coins[t.id]}</b>}
        </span>
      ))}
    </span>
  );
}

export function LevelBadge({ points = 0, small = false }) {
  const level = levelFor(points);
  return <span className={`level level-${level.index} ${small ? 'level-sm' : ''}`}>{level.name}</span>;
}
