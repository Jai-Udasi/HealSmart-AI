import React from 'react';
import { Link } from 'react-router-dom';
import {
  Stethoscope,
  Users,
  LayoutDashboard,
  ShieldCheck,
  Database,
  ArrowRight,
} from 'lucide-react';
import { GlassCard, NoticeBanner, LoadingState, ErrorState } from '../components/UI';
import { healthApi } from '../api/client';
import { useApiQuery } from '../hooks/useApi';

export default function HomePage() {
  const { data: health, loading, error, refetch } = useApiQuery(() => healthApi.check(), []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">HealSmartAI Healthcare Information Portal</h1>
          <p className="page-description">
            Educational symptom guidance, fictional demo patient records, and clinical dashboard overview.
          </p>
        </div>
      </div>

      <NoticeBanner variant="info" title="Non-Diagnostic Educational Demonstration (Local Only)">
        HealSmartAI uses a deterministic keyword rule engine (not OpenAI or an LLM) to provide general health education and self-care tips. Authentication and role-based authorization are not implemented—use strictly fictional demo patient records on localhost only.
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
            Submit common symptoms to receive deterministic, rule-based educational information, self-care guidance, and emergency red-flag alerts.
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
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Demo Patient Records</h2>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.1rem' }}>
            Browse, create, update, and manage fictional demonstration patient profiles stored in the local SQLite database.
          </p>
          <Link to="/patients" className="btn btn-teal">
            <span>View Patient Records</span>
            <ArrowRight size={15} />
          </Link>
        </GlassCard>

        <GlassCard interactive>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div className="brand-icon" style={{ width: 36, height: 36 }}>
              <LayoutDashboard size={18} />
            </div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Doctor Dashboard</h2>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.1rem' }}>
            Monitor live SQLite aggregate statistics, recent symptom check activity, and fictional clinician notes.
          </p>
          <Link to="/dashboard" className="btn btn-secondary">
            <span>Open Dashboard</span>
            <ArrowRight size={15} />
          </Link>
        </GlassCard>
      </div>

      {/* Live Backend & Proxy Status Verification */}
      <h2 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.75rem' }}>
        System & API Proxy Status
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
