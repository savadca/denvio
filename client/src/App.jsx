import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import Layout, { Logo } from './components/Layout';
import Auth from './pages/Auth';
import Feed from './pages/Feed';
import Notes from './pages/Notes';
import NoteDetail from './pages/NoteDetail';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Leaderboard from './pages/Leaderboard';
import News from './pages/News';
import Jobs from './pages/Jobs';
import ExamPrep from './pages/ExamPrep';
import Papers from './pages/Papers';
import Notifications from './pages/Notifications';
import { TestList, TakeTest, Result } from './pages/Tests';
import { Community, Thread } from './pages/Community';
import Admin from './pages/admin/Admin';
import TestEditor from './pages/admin/TestEditor';

// Shown while we check the login; after a few seconds explain the wait (cold start).
function Splash() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 3500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="splash">
      <Logo className="logo-lg" />
      <span className="spinner" aria-label="Loading" />
      <p className={`splash-note ${slow ? 'show' : ''}`}>Waking up the server… the first load can take a few seconds.</p>
    </div>
  );
}

export default function App() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  // Braces matter: newer Chrome returns a Promise from scrollTo, and an effect's
  // return value is treated as its cleanup function ("n is not a function").
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  if (user === undefined) return <Splash />;

  if (!user) {
    return (
      <Routes>
        <Route path="/register" element={<Auth mode="register" />} />
        <Route path="*" element={<Auth mode="login" />} />
      </Routes>
    );
  }

  const isAdmin = user.role === 'admin';
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Feed />} />
        <Route path="/notes" element={<Notes />} />
        <Route path="/upload" element={<Navigate to="/notes?upload=1" replace />} />
        <Route path="/notes/:id" element={<NoteDetail />} />
        <Route path="/u/:username" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/tests" element={<TestList />} />
        <Route path="/tests/:id" element={<TakeTest />} />
        <Route path="/results/:id" element={<Result />} />
        <Route path="/community" element={<Community />} />
        <Route path="/community/:id" element={<Thread />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/news" element={<News />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/exams" element={<ExamPrep />} />
        <Route path="/papers" element={<Papers />} />
        <Route path="/notifications" element={<Notifications />} />
        {isAdmin && <Route path="/admin" element={<Admin />} />}
        {isAdmin && <Route path="/admin/tests/:id" element={<TestEditor />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
