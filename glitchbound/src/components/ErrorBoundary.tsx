import { Component, type ErrorInfo, type ReactNode } from 'react';

/** Contains a crash to one part of the page (a game, a section) so the rest of the site keeps working. */
export class ErrorBoundary extends Component<{ fallback: (reset: () => void) => ReactNode; onError?: (e: Error) => void; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[GlitchBound] contained error', error, info.componentStack);
    this.props.onError?.(error);
  }

  reset = (): void => this.setState({ failed: false });

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback(this.reset) : this.props.children;
  }
}

/** Whether this browser refuses the site's storage (the getter throws, or a write does). */
export function storageBlocked(): boolean {
  try {
    const ls = window.localStorage;
    ls.setItem('glitchbound.probe', '1');
    ls.removeItem('glitchbound.probe');
    return false;
  } catch {
    return true;
  }
}

/** What shows instead of a white page when the whole app crashes (see Root in App.tsx). */
export function CrashNotice() {
  const blocked = storageBlocked();
  return (
    <main id="main" className="wrap info-page" role="alert">
      <h1 className="info-title">Something glitched.</h1>
      <p className="info-lead">{blocked ? 'Your browser is blocking storage for this site, so nothing will be saved. Allow site data for GlitchBound and reload.' : 'The arcade hit an unexpected error.'}</p>
      <div className="nf-actions">
        <button className="btn btn-primary" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    </main>
  );
}
