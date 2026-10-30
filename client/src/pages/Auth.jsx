import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth';
import { Logo } from '../components/Layout';
import { ToothIcon } from '../components/Icons';

export default function Auth({ mode }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Only follow same-site paths after logging in.
  const next = /^\/(?!\/)/.test(params.get('next') || '') ? params.get('next') : '/';
  const keep = params.get('next') ? `?next=${encodeURIComponent(next)}` : '';
  const [form, setForm] = useState({ username: '', password: '', full_name: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isLogin = mode === 'login';
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isLogin) await login(form.username, form.password);
      else await register(form);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-hero" aria-hidden="true">
        <div className="phone">
          <div className="phone-screen">
            <ToothIcon size={64} />
            <p>Notes, videos, mock tests and discussions — made by BDS students, for BDS students.</p>
          </div>
        </div>
      </div>
      <div className="auth-col">
        <form className="auth-card" onSubmit={submit}>
          <Logo className="logo-lg" />
          {!isLogin && <p className="auth-tag">Sign up to share notes and study with your batch.</p>}
          <input placeholder="Username" autoComplete="username" value={form.username} onChange={set('username')} required autoFocus />
          {!isLogin && <input placeholder="Full name" autoComplete="name" value={form.full_name} onChange={set('full_name')} />}
          <input type="password" placeholder="Password" autoComplete={isLogin ? 'current-password' : 'new-password'} value={form.password} onChange={set('password')} required />
          <button className="btn btn-primary btn-block" disabled={busy || !form.username || !form.password}>
            {busy ? 'Please wait…' : isLogin ? 'Log in' : 'Sign up'}
          </button>
          {error && <p className="form-error" role="alert">{error}</p>}
        </form>
        <div className="auth-card auth-switch">
          {isLogin
            ? <>Don&apos;t have an account? <Link to={`/register${keep}`}>Sign up</Link></>
            : <>Have an account? <Link to={`/login${keep}`}>Log in</Link></>}
        </div>
        <Link to={next} className="auth-browse">← Continue browsing without an account</Link>
      </div>
    </div>
  );
}
