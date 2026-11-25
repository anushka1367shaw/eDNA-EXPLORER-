import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected application error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      let friendly = this.state.errorMessage;
      try {
        const parsed = JSON.parse(this.state.errorMessage) as { error?: string; operationType?: string; path?: string };
        if (parsed.error) {
          friendly = `Database operation (${parsed.operationType || 'read'} on ${parsed.path || 'resource'}) could not be completed: ${parsed.error}`;
        }
      } catch {
        // Non-JSON error message
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F4F8F5] dark:bg-[#071D17] p-6">
          <div className="max-w-lg w-full rounded-xl border border-slate-200 dark:border-[#143A2F] bg-white dark:bg-[#0B271F] p-8 shadow-sm">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="text-xl font-semibold text-[#063B2B] dark:text-white">
                Application Error Encountered
              </h2>
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{friendly}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#087A50] text-white text-sm font-medium hover:bg-[#063B2B] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
