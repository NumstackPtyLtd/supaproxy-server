import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** When this key changes, the error state resets (e.g. pass the active section/tab) */
  resetKey?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  prevResetKey?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    // Reset error state when resetKey changes
    if (props.resetKey !== undefined && props.resetKey !== state.prevResetKey) {
      return { hasError: false, error: null, prevResetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error: Error) {
    console.error('React error boundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="py-8 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
          <p>Something went wrong. Try refreshing the page.</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-2 px-3 py-1 text-xs rounded-sm transition-colors"
            style={{ border: '1px solid var(--border-color)', color: 'var(--body)' }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
