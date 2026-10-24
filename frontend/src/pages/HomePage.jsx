import React from 'react';
import { Link } from 'react-router-dom';
import {
  Stethoscope,
  Users,
  LayoutDashboard,
  ShieldCheck,
  Database,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { GlassCard, NoticeBanner, LoadingState, ErrorState } from '../components/UI';
import { healthApi } from '../api/client';
import { useApiQuery } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';

export default function HomePage() {
  const { currentUser } = useAuth();
  const { data: health, loading, error, refetch } = useApiQuery(() => healthApi.check(), []);
  const isDoctor = currentUser?.role === 'doctor';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">HealSmartAI Healthcare Information Portal</h1>
          <p className="page-description">
            Welcome, <strong>{currentUser?.displayName || currentUser?.email}</strong> · Account Role:{' '}
            <span
              className={`badge ${isDoctor ? 'badge-teal' : 'badge-info'}`}
              style={{ textTransform: 'uppercase', marginLeft: '0.25rem' }}
            >
              {currentUser?.role || 'patient'}
            </span>
          </p>
        </div>
      </div>

      <NoticeBanner variant="info" title="Non-Diagnostic Educational Health Portal (Firebase Auth & SQLite RBAC)">
        HealSmartAI uses a deterministic rule engine (not OpenAI or an LLM) to provide general health education and self-care guidance. All API endpoints verify Firebase ID tokens through the official Firebase Admin SDK and enforce strict patient ownership and doctor assignment rules in SQLite.
      </NoticeBanner>

      {/* Feature Navigation Cards */}
      <div className="grid-cards" style={{ marginBottom: '1.5rem' }}>
        <GlassCard interactive>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div className="brand-icon" style={{ width: 36, height: 36 }}>
              <Stethoscope size={18} />
            </div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Symptom Checker</h2>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.1rem' }}>
            Enter symptoms, duration, and severity to receive rule-based educational health information, self-care guidance, and emergency red-flag alerts.
          </p>
          <Link to="/symptoms" className="btn btn-primary">
            <span>Open Symptom Checker</span>
            <ArrowRight size={15} />
          </Link>
        </GlassCard>

        <GlassCard interactive>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div className="brand-icon" style={{ width: 36, height: 36 }}>
              <Users size={18} />
            </div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              {isDoctor ? 'Assigned Patients' : 'My Health Profile'}
            </h2>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.1rem' }}>
            {isDoctor
              ? 'Access health profiles, symptom check histories, and clinical notes for patients who have explicitly assigned you.'
              : 'Create and update your personal health profile, manage assigned doctors, and review clinician notes.'}
          </p>
          <Link to="/patients" className="btn btn-teal">
            <span>{isDoctor ? 'View Assigned Patients' : 'Manage Health Profile'}</span>
            <ArrowRight size={15} />
          </Link>
        </GlassCard>

        {isDoctor ? (
          <GlassCard interactive>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div className="brand-icon" style={{ width: 36, height: 36 }}>
                <LayoutDashboard size={18} />
              </div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Doctor Dashboard</h2>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.1rem' }}>
              Monitor live SQLite aggregate statistics, recent symptom check evaluations, and clinical notes for your assigned patients.
            </p>
            <Link to="/dashboard" className="btn btn-secondary">
              <span>Open Dashboard</span>
              <ArrowRight size={15} />
            </Link>
          </GlassCard>
        ) : (
          <GlassCard>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div
                className="brand-icon"
                style={{ width: 36, height: 36, background: 'var(--surface-muted)', color: 'var(--text-muted)' }}
              >
                <Lock size={18} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Doctor Dashboard
                </h2>
                <span className="badge badge-warning" style={{ fontSize: '0.68rem' }}>
                  Doctor Role Required
                </span>
              </div>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Clinical dashboard statistics and clinician note authoring are restricted to verified <strong>doctor</strong> accounts.
            </p>
          </GlassCard>
        )}
      </div>

      {/* Live Backend & Proxy Status Verification */}
      <h2 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.75rem' }}>
        System &amp; API Proxy Status
      </h2>
      {loading ? (
        <LoadingState label="Verifying Vite /api proxy connection to Express backend…" />
      ) : error ? (
        <ErrorState
          title="Backend API Unreachable"
          message={error.message}
          onRetry={refetch}
        />
      ) : (
        <GlassCard>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <ShieldCheck size={20} color="var(--success)" />
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Service Status</div>
                <div style={{ fontWeight: 600, fontSize: '0.925rem' }}>
                  {health?.service} ({health?.status?.toUpperCase()})
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Database size={20} color="var(--primary)" />
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>SQLite Engine</div>
                <div style={{ fontWeight: 600, fontSize: '0.925rem' }}>
                  v{health?.database?.sqlite_version} ({health?.database?.status}) · {health?.database?.latency_ms}ms
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Environment</div>
              <div style={{ fontWeight: 600, fontSize: '0.925rem' }}>{health?.environment}</div>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
