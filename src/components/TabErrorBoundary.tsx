import React from 'react';

interface State {
  hasError: boolean;
  error: Error | null;
}

export class TabErrorBoundary extends React.Component<
  { children: React.ReactNode; tabName?: string },
  State
> {
  constructor(props: { children: React.ReactNode; tabName?: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[TabErrorBoundary] Crash in tab "${this.props.tabName}":`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-96 gap-4 text-center px-8">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
            <span className="text-3xl">⚠️</span>
          </div>
          <h3 className="font-headline font-black text-on-surface text-lg tracking-tight">
            {this.props.tabName ?? 'This module'} failed to load
          </h3>
          <p className="text-on-surface-variant/60 text-sm max-w-xs leading-relaxed font-medium">
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </p>
          <button
            className="mt-2 px-6 py-2 rounded-full bg-primary text-on-primary text-xs font-black uppercase tracking-widest"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
