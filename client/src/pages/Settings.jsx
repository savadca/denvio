import { useState } from 'react';
import { api } from '../api';
import { useAuth, useToast } from '../auth';
import Avatar from '../components/Avatar';

export default function Settings() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    full_name: user.full_name, bio: user.bio, college: user.college, year: user.year,
  });
  const [avatar, setAvatar] = useState(null);
  const [preview, setPreview] = useState(null);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const pickAvatar = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setAvatar(f);
    setPreview(URL.createObjectURL(f));
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v || ''));
    if (avatar) fd.append('avatar', avatar);
    try {
      const r = await api.put('/me', fd);
      setUser(r.user);
      setAvatar(null);
      toast('Profile saved', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    try {
      await api.put('/me/password', pw);
      setPw({ current: '', next: '' });
      toast('Password changed', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="narrow">
      <h1 className="page-title">Edit profile</h1>
      <form className="card form" onSubmit={saveProfile}>
        <div className="avatar-edit">
          {preview ? <span className="avatar" style={{ width: 56, height: 56 }}><span className="avatar-inner"><img src={preview} alt="" /></span></span> : <Avatar user={user} size={56} />}
          <div>
            <div className="strong">{user.username}</div>
            <label className="link-btn">Change photo<input type="file" accept="image/*" hidden onChange={pickAvatar} /></label>
          </div>
        </div>
        <label>Full name<input value={form.full_name} onChange={set('full_name')} maxLength={60} /></label>
        <label>Year of study
          <select value={form.year} onChange={set('year')}>
            <option value="">—</option>
            {['1st year', '2nd year', '3rd year', 'Final year', 'Intern', 'Graduate', 'Faculty'].map((y) => <option key={y}>{y}</option>)}
          </select>
        </label>
        <label>College<input value={form.college} onChange={set('college')} maxLength={100} placeholder="Your dental college" /></label>
        <label>Bio<textarea rows={3} value={form.bio} onChange={set('bio')} maxLength={300} /></label>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Submit'}</button>
      </form>

      <h2 className="section-title">Change password</h2>
      <form className="card form" onSubmit={savePassword}>
        <label>Current password<input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required /></label>
        <label>New password<input type="password" autoComplete="new-password" minLength={6} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required /></label>
        <button className="btn btn-primary">Change password</button>
      </form>
    </div>
  );
}
