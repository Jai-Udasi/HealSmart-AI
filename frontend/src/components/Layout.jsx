import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Activity,
  Home,
  Stethoscope,
  Users,
  LayoutDashboard,
  Menu,
  X,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { healthApi } from '../api/client';
import { useApiQuery } from '../hooks/useApi';

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/symptoms', label: 'Symptom Checker', icon: Stethoscope },
  { to: '/patients', label: 'Patient Records', icon: Users },
  { to: '/dashboard', label: 'Doctor Dashboard', icon: LayoutDashboard },
];

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { data: health, loading: healthLoading, error: healthError } = useApiQuery(
    () => healthApi.check(),
    []
  );

  const closeMobileMenu = () => setMobileOpen(false);

  // Derive active page title for topbar
  const currentPageLabel = (() => {
    if (location.pathname === '/') return 'Overview & Portal Home';
    if (location.pathname.startsWith('/symptoms')) return 'Rule-Based Symptom Checker';
    if (location.pathname.startsWith('/patients/')) return 'Demo Patient Detail Record';
    if (location.pathname.startsWith('/patients')) return 'Demo Patient Records';
    if (location.pathname.startsWith('/dashboard')) return 'Doctor Dashboard (Demo)';
    return 'HealSmartAI Portal';
  })();

  return (
    <div className="app-shell">
      {/* Mobile Backdrop */}
      <div
        className={`sidebar-backdrop ${mobileOpen ? 'open' : ''}`}
        onClick={closeMobileMenu}
        aria-hidden="true"
      />

      {/* Sidebar Navigation */}
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`} aria-label="Primary Navigation">
        <div className="sidebar-brand">
          <div className="brand-icon" aria-hidden="true">
            <Activity size={22} />
          </div>
          <div>
            <div className="brand-title">HealSmartAI</div>
            <div className="brand-subtitle">Health Info Portal</div>
          </div>
          <button
            type="button"
            className="mobile-menu-btn"
            style={{ marginLeft: 'auto' }}
            onClick={closeMobileMenu}
            aria-label="Close navigation menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Navigation</div>
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={closeMobileMenu}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
            <ShieldAlert size={14} color="var(--teal)" />
            <span>Non-Diagnostic Local Demo</span>
          </div>
          <p>
            Rule-based educational output only. Fictional patient data; no authentication or RBAC implemented.
          </p>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="main-wrapper">
        {/* Top Navigation Bar */}
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu size={20} />
            </button>
            <span style={{ fontWeight: 600, fontSize: '0.975rem', color: 'var(--text-primary)' }}>
              {currentPageLabel}
            </span>
          </div>

          <div className="topbar-right">
            {healthLoading ? (
              <span className="badge badge-info">Checking API…</span>
            ) : healthError ? (
              <span className="badge badge-danger" title={healthError.message}>
                <AlertCircle size={13} />
                API Offline
              </span>
            ) : (
              <span
                className="badge badge-success"
                title={`SQLite ${health?.database?.sqlite_version || ''} · Latency ${health?.database?.latency_ms ?? 0}ms`}
              >
                <CheckCircle2 size={13} />
                API Connected
              </span>
            )}
            <span className="badge badge-teal">Local Demo Mode</span>
          </div>
        </header>

        {/* Page Content */}
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
