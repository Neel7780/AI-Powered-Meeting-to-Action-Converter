import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

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
    console.error("[ActionPulse] Uncaught error caught by ErrorBoundary:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const isConfigError =
        this.state.error?.message.toLowerCase().includes("supabase") ||
        this.state.error?.message.toLowerCase().includes("env");

      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#0a0a0c] border border-white/10 rounded-xl p-6 sm:p-8 shadow-2xl text-center">
            <div className="mx-auto size-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-5">
              <AlertTriangle className="size-6" />
            </div>

            <h1 className="text-xl font-semibold text-white tracking-tight">
              Application Error
            </h1>

            <p className="mt-3 text-sm text-neutral-400 leading-relaxed">
              {isConfigError
                ? "The application encountered a configuration issue. Please ensure your environment variables are configured in Vercel project settings."
                : "An unexpected error occurred while rendering the page."}
            </p>

            {this.state.error?.message && (
              <div className="mt-4 p-3 bg-neutral-900 border border-neutral-800 rounded text-left overflow-auto max-h-32 text-xs font-mono text-neutral-400">
                {this.state.error.message}
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-white text-black text-sm font-medium hover:bg-neutral-200 transition-colors"
              >
                <RefreshCw className="size-4" />
                Reload Page
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md border border-white/10 bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 transition-colors"
              >
                <Home className="size-4" />
                Go to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
