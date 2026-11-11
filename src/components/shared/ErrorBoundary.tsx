import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  returnPath?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('PayPilot UI uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.hash = this.props.returnPath || '#/';
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FDFBF7] text-[#1E293B] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-[#003C5F]/15 rounded-2xl p-8 shadow-sm text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#FAF3E7] border border-[#E8D2AC] flex items-center justify-center mx-auto text-[#874E0E]">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="font-display text-2xl text-deepBlue">
              {this.props.fallbackTitle || 'Unable to display this view'}
            </h2>
            <p className="text-[#455A6A] text-sm leading-relaxed">
              An unexpected error occurred while rendering this page.
              {this.state.error?.message && (
                <span className="block mt-2 font-mono text-xs text-[#874E0E] bg-[#FAF3E7] p-2 rounded border border-[#E8D2AC]">
                  {this.state.error.message}
                </span>
              )}
            </p>
            <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-5 py-2.5 rounded-lg bg-[#003C5F] text-[#FDFBF7] text-sm font-semibold hover:bg-[#002B45] transition-colors"
              >
                Reload page
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="px-5 py-2.5 rounded-lg border border-[#003C5F]/20 text-[#003C5F] text-sm font-semibold hover:bg-[#003C5F]/5 transition-colors"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

