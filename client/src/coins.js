import { useEffect, useRef, useState } from 'react';

export const TIERS = [
  { id: 'diamond', label: 'Diamond', points: 100, emoji: '💎' },
  { id: 'gold', label: 'Gold', points: 50, emoji: '🥇' },
  { id: 'silver', label: 'Silver', points: 25, emoji: '🥈' },
  { id: 'bronze', label: 'Bronze', points: 10, emoji: '🥉' },
];
export const tierInfo = (id) => TIERS.find((t) => t.id === id) || TIERS[3];

export const LEVELS = [
  { name: 'Fresher', min: 0 },
  { name: 'Scholar', min: 50 },
  { name: 'Resident', min: 150 },
  { name: 'Specialist', min: 400 },
  { name: 'Professor', min: 1000 },
];

export function levelFor(points = 0) {
  let i = 0;
  while (i + 1 < LEVELS.length && points >= LEVELS[i + 1].min) i++;
  const level = LEVELS[i];
  const next = LEVELS[i + 1] || null;
  const progress = next ? Math.round(((points - level.min) / (next.min - level.min)) * 100) : 100;
  return { ...level, index: i, next, progress, toNext: next ? next.min - points : 0 };
}

export const totalCoins = (coins = {}) => TIERS.reduce((sum, t) => sum + (coins[t.id] || 0), 0);

// Animates a number from its previous value to `value`.
export function useCountUp(value = 0, duration = 900) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const begin = from.current;
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(begin + (value - begin) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return shown;
}
