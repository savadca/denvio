// Sends browser crashes to the server (Admin → Errors, and Vercel → Logs "client-error").
const sent = new Set();
const NOISE = /ResizeObserver loop|^Script error\.?$|Load failed|NetworkError when attempting to fetch/i;

export function reportError(kind, error, extra = {}) {
  try {
    const message = String(error?.message || error || 'Unknown error').slice(0, 500);
    if (NOISE.test(message)) return;
    const key = `${kind}|${message}|${location.pathname}`;
    if (sent.has(key)) return; // once per page load is enough
    sent.add(key);
    fetch('/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      keepalive: true,
      body: JSON.stringify({
        kind,
        message,
        stack: String(error?.stack || '').slice(0, 4000),
        component_stack: String(extra.componentStack || '').slice(0, 3000),
        path: location.pathname + location.search,
      }),
    }).catch(() => {});
  } catch {
    // Reporting must never break the app.
  }
}

export function installGlobalErrorReporting() {
  window.addEventListener('error', (e) => {
    if (e.error || e.message) reportError('error', e.error || e.message);
  });
  window.addEventListener('unhandledrejection', (e) => reportError('rejection', e.reason));
}
