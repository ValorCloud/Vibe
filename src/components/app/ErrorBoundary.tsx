import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { logger } from '../../utils/logger';

interface Props {
  children: ReactNode;
  /** Optional label shown in the fallback header (for scoped boundaries). */
  label?: string;
  /**
   * Optional custom fallback UI. When provided, replaces the default
   * monospace error screen entirely. Use for non-critical zones where
   * a full-page reload prompt would be disproportionate.
   */
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, errorInfo: null };

  /**
   * getDerivedStateFromError ensures the error state is committed during the
   * render phase itself, so React never attempts to re-render the crashing
   * subtree before switching to the fallback UI.
   * Note: `override` is omitted here — @types/react does not declare this
   * static method on the Component base class, causing TS4113.
   */
  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    logger.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  override render() {
    const { error, errorInfo } = this.state;
    const { label, fallback } = this.props;
    if (!error) return this.props.children;

    // Custom fallback: use as-is (caller is responsible for dismiss/recovery UX).
    if (fallback !== undefined) return fallback;

    const isDev = import.meta.env.DEV;

    return (
      <div
        role="alert"
        aria-live="assertive"
        style={{
          fontFamily: 'monospace',
          padding: '2rem',
          background: '#0a0a0a',
          color: '#f87171',
          minHeight: label ? undefined : '100dvh',
          boxSizing: 'border-box',
          overflowY: 'auto',
        }}
      >
        <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          ⚠ {label ? `${label} error` : 'Application error'}
        </div>
        <div style={{ color: '#fca5a5', marginBottom: '1rem' }}>
          {error.message}
        </div>
        {isDev && errorInfo && (
          <pre
            style={{
              fontSize: '0.72rem',
              color: '#6b7280',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              background: '#111',
              padding: '1rem',
              borderRadius: '6px',
              maxHeight: '60dvh',
              overflowY: 'auto',
            }}
          >
            {error.stack}
            {'\n\nComponent stack:'}
            {errorInfo.componentStack}
          </pre>
        )}
        <button
          aria-label="Reload application"
          onClick={() => window.location.reload()}
          style={{
            marginTop: '1.5rem',
            padding: '0.5rem 1.5rem',
            background: '#1d4ed8',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}
