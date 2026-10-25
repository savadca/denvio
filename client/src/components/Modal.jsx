import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { XIcon } from './Icons';

export default function Modal({ open, onClose, title, children, className = '' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title}>
        {title && (
          <header className="modal-head">
            <h2>{title}</h2>
            {onClose && <button className="icon-btn" onClick={onClose} aria-label="Close"><XIcon size={20} /></button>}
          </header>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}

const CONFETTI_COLORS = ['#feda75', '#fa7e1e', '#d62976', '#962fbf', '#4f5bd5', '#7fd8f7', '#22a06b'];

export function Confetti({ count = 60 }) {
  // Random layout computed once so re-renders don't reshuffle the pieces.
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => ({
    left: `${Math.random() * 100}%`,
    background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    animationDelay: `${Math.random() * 0.6}s`,
    animationDuration: `${1.8 + Math.random() * 1.6}s`,
    width: `${6 + Math.random() * 6}px`,
    height: `${8 + Math.random() * 8}px`,
  })), [count]);
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((style, i) => <i key={i} style={style} />)}
    </div>
  );
}
