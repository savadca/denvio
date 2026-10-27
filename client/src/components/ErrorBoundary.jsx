import { Component } from 'react';
import { reportError } from '../errorReporter';

// DOM errors like these come from browser extensions or Chrome's auto-translate
// rewriting the page under React; a single reload fixes them.
const DOM_MUTATION = /removeChild|insertBefore|not a child of this node|Failed to execute '.*' on 'Node'/i;
const RELOAD_KEY = 'denvio.autoReloadedAt';

function reloadedRecently() {
  try {
    return Date.now() - Number(sessionStorage.getItem(RELOAD_KEY) || 0) < 30000;
  } catch {
    return true;
  }
}

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Denvio crashed:', error);
    reportError('crash', error, { componentStack: info?.componentStack });
    if (DOM_MUTATION.test(String(error?.message)) && !reloadedRecently()) {
      try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())); } catch { /* storage blocked */ }
      window.location.reload();
    }
  }

  componentDidUpdate(prev) {
    // Navigating elsewhere clears a page-level error.
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash">
        <div className="crash-card">
          <span className="crash-emoji" aria-hidden="true">🦷</span>
          <h2>Something went wrong</h2>
          <p className="muted">This page hit an error. Reloading usually fixes it.</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button>
          <details className="crash-details">
            <summary>Error details</summary>
            <code>{String(this.state.error?.message || this.state.error)}</code>
          </details>
        </div>
      </div>
    );
  }
}
