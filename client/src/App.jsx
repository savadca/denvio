import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import Layout, { Logo } from './components/Layout';
import Auth from './pages/Auth';
import Feed from './pages/Feed';
import Upload from './pages/Upload';
import NoteDetail from './pages/NoteDetail';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Leaderboard from './pages/Leaderboard';
import News from './pages/News';
import Jobs from './pages/Jobs';
import { TestList, TakeTest, Result } from './pages/Tests';
import { Community, Thread } from './pages/Community';
import Admin from './pages/admin/Admin';
import TestEditor from './pages/admin/TestEditor';

export default function App() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  useEffect(() => window.scrollTo(0, 0), [pathname]);

  if (user === undefined) {
    return <div className="splash"><Logo className="logo-lg" /></div>;
  }

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
        <Route path="/upload" element={<Upload />} />
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
        {isAdmin && <Route path="/admin" element={<Admin />} />}
        {isAdmin && <Route path="/admin/tests/:id" element={<TestEditor />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
