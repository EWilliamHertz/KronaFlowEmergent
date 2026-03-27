import { Component } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('❌ Error caught by boundary:', error);
    console.error('Error info:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-sm p-8 max-w-md text-center space-y-4">
            <AlertCircle size={40} className="text-[#EF4444] mx-auto" />
            <div>
              <h1 className="text-white font-bold text-lg mb-2">Oops! Something went wrong</h1>
              <p className="text-[#A3A3A3] text-sm mb-4">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
              <details className="text-left bg-[#0A0A0A] p-3 rounded-sm text-xs text-[#6B6B6B] mb-4 max-h-32 overflow-y-auto">
                <summary className="cursor-pointer font-mono text-[#4FC3C3]">Details</summary>
                <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[10px]">
                  {this.state.error?.stack}
                </pre>
              </details>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#4FC3C3] text-[#0A0A0A] font-bold rounded-sm hover:bg-[#3AA8A8] transition-all"
            >
              <RefreshCw size={14} />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
