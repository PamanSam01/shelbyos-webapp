import React from 'react';
import { debugError } from '../utils/logger';

interface Props {
  children: React.ReactNode;
}
interface State {
  hasError: boolean;
  errorMessage: string;
}

/**
 * ErrorBoundary — catches React render crashes and displays a safe fallback
 * instead of a blank / white screen. Also exposes a Reload button.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    const msg = error instanceof Error ? error.message : String(error);
    return { hasError: true, errorMessage: msg };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    debugError('[ShelbyOS] Uncaught render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '20px',
            fontFamily: 'Tahoma, Segoe UI, Arial, sans-serif',
            background: '#ece9d8',
            border: '3px solid #003c74',
            borderRadius: '6px',
            margin: '50px auto',
            maxWidth: '460px',
            boxShadow: '2px 4px 12px rgba(0,0,0,0.4)',
          }}
        >
          <div
            style={{
              background: 'linear-gradient(180deg,#4a88d8 0%,#0a246a 100%)',
              color: '#fff',
              padding: '6px 10px',
              fontWeight: 'bold',
              borderRadius: '3px 3px 0 0',
              marginBottom: '14px',
            }}
          >
            ⚠️ Shelby OS — Application Error
          </div>
          <p style={{ margin: '0 0 10px', color: '#000' }}>
            An unexpected error occurred. This is likely a temporary network or
            rendering issue.
          </p>
          {this.state.errorMessage && (
            <pre
              style={{
                background: '#fff',
                border: '1px solid #7a96b8',
                padding: '8px',
                fontSize: '11px',
                color: '#555',
                overflowX: 'auto',
                marginBottom: '12px',
              }}
            >
              {this.state.errorMessage}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'linear-gradient(180deg,#f5f3ea,#dbd8c8)',
              border: '2px solid',
              borderColor: '#fff #7a96b8 #7a96b8 #fff',
              padding: '5px 20px',
              cursor: 'pointer',
              fontFamily: 'Tahoma',
              fontSize: '13px',
            }}
          >
            🔄 Reload Shelby OS
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
