import React, { ReactNode, Component, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
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
    console.error('Error Boundary caught:', error);
    console.error('Error Info:', errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background p-4">
          <div className="max-w-md space-y-4 text-center">
            <h1 className="text-3xl font-bold text-foreground">Error</h1>
            <p className="text-sm text-muted-foreground">
              Something went wrong. Please check the browser console for details.
            </p>
            <div className="max-h-48 overflow-auto rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-left">
              <p className="text-xs font-mono text-destructive">
                {this.state.error?.message}
              </p>
              <p className="mt-2 text-xs font-mono text-muted-foreground">
                {this.state.error?.stack}
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}





