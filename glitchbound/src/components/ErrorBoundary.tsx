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
