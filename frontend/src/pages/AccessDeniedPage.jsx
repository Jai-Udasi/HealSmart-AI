import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldAlert, Home } from 'lucide-react';
import { GlassCard } from '../components/UI';
import { useAuth } from '../context/AuthContext';

export default function AccessDeniedPage() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const requiredRoles = location.state?.requiredRoles || ['doctor'];
  const attemptedPath = location.state?.attemptedPath || '/dashboard';

  return (
    <GlassCard style={{ textAlign: 'center', padding: '2.75rem 1.5rem', maxWidth: 560, margin: '2rem auto' }}>
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'var(--danger-bg)',
          color: 'var(--danger)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1rem',
        }}
      >
        <ShieldAlert size={28} />
      </div>

      <h1 className="page-title" style={{ marginBottom: '0.5rem' }}>
        403 — Access Denied
      </h1>
      <p className="page-description" style={{ marginBottom: '1rem' }}>
        Your account (<strong>{currentUser?.email}</strong>) is provisioned with the{' '}
        <span className="badge badge-info" style={{ textTransform: 'uppercase' }}>
          {currentUser?.role || 'patient'}
        </span>{' '}
        role, which does not have permission to access <code>{attemptedPath}</code>.
      </p>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Required role: <strong>{requiredRoles.join(' or ').toUpperCase()}</strong>. Role assignments are strictly enforced by the Express + SQLite backend.
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Link to="/" className="btn btn-primary">
          <Home size={16} />
          <span>Return to Portal Home</span>
        </Link>
        <Link to="/patients" className="btn btn-secondary">
          My Patient Records
        </Link>
      </div>
    </GlassCard>
  );
}
