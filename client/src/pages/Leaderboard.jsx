import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../api';
import { useAuth } from '../auth';
import { TIERS, useCountUp } from '../coins';
import Avatar from '../components/Avatar';
import Coin, { CoinRow, LevelBadge } from '../components/Coin';
import { CrownIcon, TrophyIcon } from '../components/Icons';

function Points({ value }) {
  return <>{useCountUp(value).toLocaleString()}</>;
}

function PodiumSpot({ entry, place }) {
  if (!entry) return <div className={`podium-spot place-${place} empty-spot`} />;
  return (
    <Link to={`/u/${entry.user.username}`} className={`podium-spot place-${place}`} style={{ animationDelay: `${(3 - place) * 0.12}s` }}>
      {place === 1 && <CrownIcon className="crown" size={30} filled />}
      <Avatar user={entry.user} size={place === 1 ? 84 : 64} story />
      <span className="strong podium-name">{entry.user.username}</span>
      <LevelBadge points={entry.points} small />
      <span className="podium-points"><Points value={entry.points} /> pts</span>
      <div className="podium-block"><span>{place}</span></div>
    </Link>
  );
}

export default function Leaderboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState('all');
  const { data, loading } = useApi(`/leaderboard?period=${period}`);
  const myIndex = data ? data.findIndex((e) => e.user.id === user.id) : -1;

  return (
    <div className="narrow">
      <div className="row gap leader-head">
        <h1 className="page-title grow"><TrophyIcon size={22} /> Leaderboard</h1>
        <div className="segmented" role="tablist">
          <button className={period === 'all' ? 'on' : ''} onClick={() => setPeriod('all')} role="tab" aria-selected={period === 'all'}>All time</button>
          <button className={period === 'month' ? 'on' : ''} onClick={() => setPeriod('month')} role="tab" aria-selected={period === 'month'}>This month</button>
        </div>
      </div>

      <div className="card coin-legend">
        {TIERS.map((t) => (
          <span key={t.id}><Coin tier={t.id} size={26} /> <b>{t.label}</b> <span className="muted">{t.points}</span></span>
        ))}
      </div>

      {loading && !data && <div className="card skeleton" />}
      {data?.length === 0 && (
        <div className="empty">
          <Coin tier="gold" size={72} spin />
          <h3>No coins yet{period === 'month' ? ' this month' : ''}</h3>
          <p className="muted">Share great notes and helpful answers — admins award coins for quality content.</p>
        </div>
      )}

      {data?.length > 0 && (
        <>
          <div className="podium" key={period}>
            <PodiumSpot entry={data[1]} place={2} />
            <PodiumSpot entry={data[0]} place={1} />
            <PodiumSpot entry={data[2]} place={3} />
          </div>

          {myIndex >= 0 && (
            <div className="card my-rank">
              <span className="rank-num">#{myIndex + 1}</span>
              <span className="grow">Your rank · <b>{data[myIndex].points} pts</b></span>
              <LevelBadge points={data[myIndex].points} />
            </div>
          )}

          <div className="card list">
            {data.slice(3).map((e, i) => (
              <Link key={e.user.id} to={`/u/${e.user.username}`} className={`list-row leader-row ${e.user.id === user.id ? 'me' : ''}`} style={{ animationDelay: `${i * 0.04}s` }}>
                <span className="rank-num">{i + 4}</span>
                <Avatar user={e.user} size={40} />
                <span className="grow">
                  <span className="strong">{e.user.username}</span> <LevelBadge points={e.points} small />
                  <span className="block"><CoinRow coins={e.coins} size={16} /></span>
                </span>
                <span className="strong">{e.points}<span className="muted small"> pts</span></span>
              </Link>
            ))}
            {data.length <= 3 && <p className="muted small pad center">Earn coins to join the list!</p>}
          </div>
        </>
      )}
    </div>
  );
}
