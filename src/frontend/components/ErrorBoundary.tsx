import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches unhandled render errors so the app shows a recovery screen
 * instead of a completely blank white page.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught render error:', error, info);
  }

  handleReload = () => {
    // Clear the error and let React re-render; a full reload is the safest recovery.
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-1 min-h-0 flex-col items-center justify-center bg-surface-page px-5 text-center">
          <div className="mb-4 text-5xl">⚠️</div>
          <h2 className="mb-2 text-[17px] font-extrabold text-ink">Something went wrong</h2>
          <p className="mb-5 text-[13px] leading-[1.6] text-ink-muted">
            A display error occurred. Your session data is safe — tap below to reload.
          </p>
          <button
            onClick={this.handleReload}
            className="flex items-center justify-center gap-2 rounded-2xl border-0 bg-gradient-red px-6 py-3 text-[14px] font-bold text-white shadow-glow-red cursor-pointer"
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
