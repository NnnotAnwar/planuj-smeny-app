import { Component, type ReactNode, type ErrorInfo } from 'react';

/**
 * --- ERROR BOUNDARY ---
 * Catches render-time exceptions anywhere below it (e.g. an unexpected shape that
 * makes a Zod parse throw) and shows a recoverable fallback instead of a blank
 * white screen. Without this, any thrown error unmounts the entire app.
 */

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface for debugging / future error-reporting integration.
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.assign('/');
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-dvh flex items-center justify-center bg-white dark:bg-gray-950 p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center text-2xl font-black">
            !
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-black text-gray-900 dark:text-white">Something went wrong</h1>
            <p className="text-sm text-gray-500">
              An unexpected error occurred. Reloading usually fixes it.
            </p>
          </div>
          <button
            onClick={this.handleReload}
            className="px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-emerald-500 hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/25"
          >
            Reload app
          </button>
        </div>
      </div>
    );
  }
}
