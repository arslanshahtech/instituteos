import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { ErrorState } from './States.js';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Details may contain user-entered data; keep the fallback local and quiet.
    void _error;
    void _info;
  }

  private reset = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return (
        <main className="fatal-error-page">
          <ErrorState
            title="The application could not load"
            description="Reload this view to continue. If the problem continues, contact support."
            onRetry={this.reset}
          />
        </main>
      );
    }

    return this.props.children;
  }
}
