import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still checking

  useEffect(() => {
    api.get('/auth/me').then((d) => setUser(d.user)).catch(() => setUser(null));
    const onUnauth = () => setUser(null);
    window.addEventListener('denvio:unauth', onUnauth);
    return () => window.removeEventListener('denvio:unauth', onUnauth);
  }, []);

  const value = {
    user,
    setUser,
    refresh: () => api.get('/auth/me').then((d) => setUser(d.user)).catch(() => {}),
    login: async (username, password) => setUser((await api.post('/auth/login', { username, password })).user),
    register: async (form) => setUser((await api.post('/auth/register', form)).user),
    logout: async () => {
      await api.post('/auth/logout').catch(() => {});
      setUser(null);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);
  const show = (message, kind = 'info') => setToast({ message, kind, key: Date.now() });
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && <div key={toast.key} className={`toast toast-${toast.kind}`} role="status">{toast.message}</div>}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
