import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * GlassCard — Reusable glassmorphism card container.
 */
export function GlassCard({ children, className = '', interactive = false, style = {} }) {
  return (
    <div
      className={`glass-card ${interactive ? 'glass-card-interactive' : ''} ${className}`.trim()}
      style={style}
    >
      {children}
    </div>
  );
}

/**
 * Button — Accessible button component with loading state support.
 */
export function Button({
  children,
  variant = 'primary',
  type = 'button',
  loading = false,
  disabled = false,
  icon: Icon = null,
  onClick,
  className = '',
  ...rest
}) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} ${className}`.trim()}
      disabled={disabled || loading}
      onClick={onClick}
      {...rest}
    >
      {loading ? (
        <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} aria-hidden="true" />
      ) : (
        Icon && <Icon size={16} aria-hidden="true" />
      )}
      <span>{children}</span>
    </button>
  );
}

/**
 * FormField — Reusable labeled form input, select, or textarea with error display.
 */
export function FormField({
  label,
  id,
  as = 'input',
  error = null,
  children,
  ...rest
}) {
  const Component = as;
  const controlClass =
    as === 'select'
      ? 'form-select'
      : as === 'textarea'
      ? 'form-textarea'
      : 'form-input';

  return (
    <div className="form-group">
      {label && (
        <label htmlFor={id} className="form-label">
          {label}
        </label>
      )}
      <Component id={id} className={controlClass} {...rest}>
        {children}
      </Component>
      {error && (
        <span className="form-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

/**
 * LoadingState — Reusable centered loading indicator.
 */
export function LoadingState({ label = 'Loading data from local API…' }) {
  return (
    <GlassCard style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '1.5rem' }}>
      <div className="spinner" role="status" aria-label="Loading" />
      <span style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', fontWeight: 500 }}>
        {label}
      </span>
    </GlassCard>
  );
}

/**
 * ErrorState — Reusable error display with optional retry button.
 */
export function ErrorState({ title = 'Unable to load data', message, onRetry }) {
  return (
    <div className="alert-banner alert-danger" role="alert" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <AlertCircle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontWeight: 600 }}>{title}</div>
          {message && <div style={{ marginTop: '0.2rem' }}>{message}</div>}
        </div>
      </div>
      {onRetry && (
        <Button variant="secondary" icon={RefreshCw} onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

/**
 * NoticeBanner — Reusable notification / medical disclaimer banner.
 */
export function NoticeBanner({ variant = 'info', title, children }) {
  const iconMap = {
    info: Info,
    warning: AlertTriangle,
    danger: AlertCircle,
    success: CheckCircle2,
  };
  const Icon = iconMap[variant] || Info;

  return (
    <div className={`alert-banner alert-${variant}`} role="region" aria-label={title || 'Notice'}>
      <Icon size={18} style={{ flexShrink: 0, marginTop: 2 }} />
      <div>
        {title && <strong style={{ display: 'block', marginBottom: '0.15rem' }}>{title}</strong>}
        <div>{children}</div>
      </div>
    </div>
  );
}
