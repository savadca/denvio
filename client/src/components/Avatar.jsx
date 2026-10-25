import { Link } from 'react-router-dom';

export default function Avatar({ user, size = 32, ring = false, story = false, link = false }) {
  const letter = (user?.full_name || user?.username || '?').trim()[0]?.toUpperCase();
  const inner = user?.avatar
    ? <img src={`/uploads/avatars/${user.avatar}`} alt="" />
    : <span style={{ fontSize: size * 0.42 }}>{letter}</span>;
  const el = (
    <span
      className={`avatar ${ring ? 'avatar-active' : ''} ${story ? 'avatar-story' : ''}`}
      style={{ width: size, height: size }}
    >
      <span className="avatar-inner">{inner}</span>
    </span>
  );
  return link && user ? <Link to={`/u/${user.username}`} className="avatar-link">{el}</Link> : el;
}

export function UserLine({ user, sub, size = 32, badge }) {
  return (
    <div className="user-line">
      <Avatar user={user} size={size} link />
      <div className="user-line-text">
        <Link to={`/u/${user.username}`} className="username">{user.username}</Link>
        {badge}
        {sub && <div className="muted small">{sub}</div>}
      </div>
    </div>
  );
}
