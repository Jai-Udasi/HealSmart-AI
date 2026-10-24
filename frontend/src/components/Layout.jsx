import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
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
  LogOut,
  UserCheck,
  KeyRound,
} from 'lucide-react';
import { healthApi } from '../api/client';
import { useApiQuery } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { Button, FormField, NoticeBanner } from './UI';

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [devModalOpen, setDevModalOpen] = useState(false);
  const [approvalCode, setApprovalCode] = useState('');
  const [devRoleTarget, setDevRoleTarget] = useState('doctor');
  const [devError, setDevError] = useState(null);
  const [devSubmitting, setDevSubmitting] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, localDevMode, logout, approveDoctorLocalDev } = useAuth();
  const isDoctor = currentUser?.role === 'doctor';

  const { data: health, loading: healthLoading, error: healthError } = useApiQuery(
    () => healthApi.check(),
    []
  );

  const closeMobileMenu = () => setMobileOpen(false);

  const navItems = [
    { to: '/', label: 'Home', icon: Home, end: true },
    { to: '/symptoms', label: 'Symptom Checker', icon: Stethoscope },
    {
      to: '/patients',
      label: isDoctor ? 'Assigned Patients' : 'My Health Profile',
      icon: Users,
    },
    ...(isDoctor
      ? [{ to: '/dashboard', label: 'Doctor Dashboard', icon: LayoutDashboard }]
      : []),
  ];

  const handleLogout = async () => {
    closeMobileMenu();
    await logout();
    navigate('/login', { replace: true });
  };

  const handleDevApproveSubmit = async (e) => {
    e.preventDefault();
    if (devSubmitting) return;
    if (!approvalCode.trim()) {
      setDevError('Please enter the backend LOCAL_DOCTOR_APPROVAL_CODE.');
      return;
    }
    setDevError(null);
    setDevSubmitting(true);
    try {
      await approveDoctorLocalDev(approvalCode.trim(), devRoleTarget);
      setDevModalOpen(false);
      setApprovalCode('');
    } catch (err) {
      setDevError(err.message || 'Failed to verify local development approval code.');
    } finally {
      setDevSubmitting(false);
    }
  };

  // Derive active page title for topbar
  const currentPageLabel = (() => {
    if (location.pathname === '/') return 'Overview & Health Portal';
    if (location.pathname.startsWith('/symptoms')) return 'Educational Symptom Checker';
    if (location.pathname.startsWith('/patients/')) return 'Patient Health Record';
    if (location.pathname.startsWith('/patients')) {
      return isDoctor ? 'Assigned Patients Directory' : 'My Health Profile & Care Team';
    }
    if (location.pathname.startsWith('/dashboard')) return 'Doctor Clinical Dashboard';
    if (location.pathname.startsWith('/access-denied')) return 'Access Restricted';
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
          {navItems.map(({ to, label, icon: Icon, end }) => (
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

        {/* Signed-In User & Logout Footer */}
        <div className="sidebar-footer">
          {currentUser && (
            <div
              style={{
                paddingBottom: '0.75rem',
                marginBottom: '0.75rem',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.4rem',
                  marginBottom: '0.35rem',
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {currentUser.displayName || 'Authenticated User'}
                </span>
                <span
                  className={`badge ${isDoctor ? 'badge-teal' : 'badge-info'}`}
                  style={{ textTransform: 'uppercase', fontSize: '0.68rem' }}
                >
                  {currentUser.role || 'patient'}
                </span>
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginBottom: '0.6rem',
                }}
                title={currentUser.email}
              >
                {currentUser.email}
              </div>

              {localDevMode && (
                <button
                  type="button"
                  onClick={() => {
                    setDevRoleTarget(isDoctor ? 'patient' : 'doctor');
                    setDevError(null);
                    setDevModalOpen(true);
                  }}
                  className="btn btn-secondary"
                  style={{
                    width: '100%',
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.76rem',
                    justifyContent: 'center',
                    marginBottom: '0.45rem',
                  }}
                >
                  <KeyRound size={13} />
                  <span>{isDoctor ? 'Switch Role (Local Dev)' : 'Doctor Approval (Local Dev)'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleLogout}
                className="btn btn-secondary"
                style={{
                  width: '100%',
                  padding: '0.4rem 0.65rem',
                  fontSize: '0.8rem',
                  justifyContent: 'center',
                }}
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '0.25rem',
            }}
          >
            <ShieldAlert size={14} color="var(--teal)" />
            <span>Educational Guidance Only</span>
          </div>
          <p>
            Non-diagnostic rule-based health portal. Protected by Firebase Auth &amp; SQLite RBAC.
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

            {currentUser && (
              <span
                className={`badge ${isDoctor ? 'badge-teal' : 'badge-info'}`}
                title={`Signed in as ${currentUser.email} (${currentUser.role})`}
              >
                <UserCheck size={13} />
                {isDoctor ? 'Doctor Role' : 'Patient Role'}
              </span>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="main-content">
          <Outlet />
        </main>
      </div>

      {/* Controlled Local-Dev Doctor Role Approval Modal */}
      {devModalOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dev-approve-modal-title"
        >
          <div className="modal-content" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2 id="dev-approve-modal-title" style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                Controlled Doctor Role Approval (Local Dev)
              </h2>
              <button
                type="button"
                onClick={() => setDevModalOpen(false)}
                aria-label="Close modal"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Public self-registration as a doctor is prohibited. In local development mode, enter the backend{' '}
              <code>LOCAL_DOCTOR_APPROVAL_CODE</code> from <code>backend/.env</code> to verify and update your account role.
            </p>

            {devError && (
              <NoticeBanner variant="danger" title="Verification Failed">
                {devError}
              </NoticeBanner>
            )}

            <form onSubmit={handleDevApproveSubmit} noValidate>
              <FormField
                label="Target Role"
                id="dev-target-role"
                as="select"
                value={devRoleTarget}
                onChange={(e) => setDevRoleTarget(e.target.value)}
              >
                <option value="doctor">Doctor (Clinical Dashboard &amp; Notes Access)</option>
                <option value="patient">Patient (Standard Account)</option>
              </FormField>

              <FormField
                label="Backend Approval Passcode *"
                id="dev-approval-code"
                type="password"
                placeholder="Enter LOCAL_DOCTOR_APPROVAL_CODE"
                value={approvalCode}
                onChange={(e) => setApprovalCode(e.target.value)}
                required
              />

              <div className="modal-footer">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setDevModalOpen(false)}
                  disabled={devSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={devSubmitting}>
                  Verify &amp; Apply Role
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
