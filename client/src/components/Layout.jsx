import { useState } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import Avatar from './Avatar';
import Celebration from './Celebration';
import AnnouncementBar from './AnnouncementBar';
import Modal from './Modal';
import ErrorBoundary from './ErrorBoundary';
import {
  HomeIcon, TestIcon, BookIcon, ChatIcon, ShieldIcon, LogoutIcon, SettingsIcon, ToothIcon, TrophyIcon,
  NewsIcon, BriefcaseIcon, MenuIcon, GradIcon, MegaphoneIcon, UserIcon,
} from './Icons';

export function Logo({ className = '' }) {
  return <span className={`logo ${className}`}>Denvio</span>;
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = user?.role === 'admin';
  const next = encodeURIComponent(pathname);

  // `dock` items appear in the phone's bottom dock; the rest live in the "More" sheet.
  const items = [
    { to: '/', label: 'Home', icon: HomeIcon, end: true, dock: true },
    { to: '/notes', label: 'Notes', icon: BookIcon, dock: true },
    { to: '/exams', label: 'Exam Prep', icon: GradIcon, dock: true },
    { to: '/tests', label: 'Mock Tests', icon: TestIcon, dock: true },
    { to: '/jobs', label: 'Jobs', icon: BriefcaseIcon, dock: true },
    { to: '/notifications', label: 'Notifications', icon: MegaphoneIcon },
    { to: '/community', label: 'Community', icon: ChatIcon },
    { to: '/news', label: 'Dental News', icon: NewsIcon },
    { to: '/leaderboard', label: 'Leaderboard', icon: TrophyIcon },
    ...(isAdmin ? [{ to: '/admin', label: 'Admin', icon: ShieldIcon, dock: true }] : []),
  ];

  const onLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/" className="sidebar-logo"><Logo /><span className="logo-mark"><ToothIcon size={24} /></span></Link>
        <nav>
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="nav-item">
              {({ isActive }) => (<><Icon filled={false} strokeWidth={isActive ? 2.6 : 2} /><span className="nav-label">{label}</span></>)}
            </NavLink>
          ))}
          {user && (
            <NavLink to={`/u/${user.username}`} className="nav-item">
              {({ isActive }) => (<><Avatar user={user} size={26} ring={isActive} /><span className="nav-label">Profile</span></>)}
            </NavLink>
          )}
        </nav>
        <div className="sidebar-bottom">
          {user ? (
            <>
              <NavLink to="/settings" className="nav-item"><SettingsIcon /><span className="nav-label">Settings</span></NavLink>
              <button className="nav-item" onClick={onLogout}><LogoutIcon /><span className="nav-label">Log out</span></button>
            </>
          ) : (
            <>
              <div className="sidebar-guest">
                <p className="muted small">Sign up free to upload, download and take tests.</p>
                <Link to={`/register?next=${next}`} className="btn btn-primary btn-block">Sign up</Link>
                <Link to={`/login?next=${next}`} className="btn btn-block">Log in</Link>
              </div>
              <Link to={`/login?next=${next}`} className="nav-item sidebar-guest-icon" aria-label="Log in or sign up"><UserIcon /></Link>
            </>
          )}
        </div>
      </aside>

      <header className="topbar">
        <Link to="/"><Logo /></Link>
        <div className="topbar-actions">
          <Link to="/notifications" aria-label="Notifications"><MegaphoneIcon /></Link>
          {user ? (
            <Link to="/leaderboard" aria-label="Leaderboard" className="topbar-points">
              <TrophyIcon />{!isAdmin && <span>{user.points || 0}</span>}
            </Link>
          ) : <Link to={`/login?next=${next}`} className="btn btn-sm btn-primary topbar-login">Log in</Link>}
          <button onClick={() => setMenuOpen(true)} aria-label="More" className="topbar-menu"><MenuIcon /></button>
        </div>
      </header>

      <main className="main">
        <AnnouncementBar />
        <div className="page" key={pathname}><ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary></div>
      </main>
      {user && <Celebration />}

      <nav className="bottombar">
        {items.filter((i) => i.dock).map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} aria-label={label}>
            {({ isActive }) => <Icon strokeWidth={isActive ? 2.6 : 2} />}
          </NavLink>
        ))}
        {user ? (
          <NavLink to={`/u/${user.username}`} aria-label="Profile">
            {({ isActive }) => <Avatar user={user} size={26} ring={isActive} />}
          </NavLink>
        ) : <NavLink to={`/login?next=${next}`} aria-label="Log in or sign up"><UserIcon /></NavLink>}
      </nav>

      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title="More" className="more-sheet">
        <div className="more-grid">
          {[...items.filter((i) => !i.dock), ...(user ? [{ to: '/settings', label: 'Settings', icon: SettingsIcon }] : [])].map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className="more-item" onClick={() => setMenuOpen(false)}>
              <span className="more-icon"><Icon size={22} /></span>
              <span>{label}</span>
            </Link>
          ))}
        </div>
        {user
          ? <button className="btn btn-block btn-danger-ghost" onClick={onLogout}><LogoutIcon size={18} /> Log out</button>
          : (
            <div className="row gap">
              <Link to={`/register?next=${next}`} className="btn btn-primary grow" onClick={() => setMenuOpen(false)}>Sign up</Link>
              <Link to={`/login?next=${next}`} className="btn grow" onClick={() => setMenuOpen(false)}>Log in</Link>
            </div>
          )}
      </Modal>
    </div>
  );
}
