import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Activity, LogIn, ShieldAlert } from 'lucide-react';
import { GlassCard, Button, FormField, NoticeBanner } from '../components/UI';
import { useAuth, formatFirebaseAuthError } from '../context/AuthContext';

export default function LoginPage() {
  const { login, configError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const intendedDestination = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const errs = {};
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Please enter a valid email address.';
    }
    if (!password) {
      errs.password = 'Password is required.';
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setFieldErrors({});
    setSubmitError(null);
    setSubmitting(true);

    try {
      await login(email, password);
      navigate(intendedDestination, { replace: true });
    } catch (err) {
      setSubmitError(formatFirebaseAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div className="brand-icon" style={{ width: 42, height: 42 }}>
            <Activity size={24} />
          </div>
          <div>
            <div className="brand-title" style={{ fontSize: '1.35rem' }}>HealSmartAI</div>
            <div className="brand-subtitle">Authenticated Health Info Portal</div>
          </div>
        </div>

        <GlassCard>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.35rem' }}>
            Sign In to Your Account
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            Access your personal health profile, symptom history, or assigned clinical records.
          </p>

          {configError && (
            <NoticeBanner variant="danger" title="Firebase Setup Required">
              {configError}
            </NoticeBanner>
          )}

          {submitError && (
            <NoticeBanner variant="danger" title="Sign-In Failed">
              {submitError}
            </NoticeBanner>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <FormField
              label="Email Address *"
              id="login-email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldErrors.email}
              required
            />

            <FormField
              label="Password *"
              id="login-password"
              type="password"
              placeholder="Enter your password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password}
              required
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
              <Link to="/forgot-password" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                Forgot your password?
              </Link>
            </div>

            <Button
              type="submit"
              variant="primary"
              icon={LogIn}
              loading={submitting}
              style={{ width: '100%' }}
            >
              {submitting ? 'Signing In…' : 'Sign In'}
            </Button>
          </form>

          <div
            style={{
              marginTop: '1.25rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-subtle)',
              textAlign: 'center',
              fontSize: '0.88rem',
              color: 'var(--text-secondary)',
            }}
          >
            Don&apos;t have an account?{' '}
            <Link to="/signup" style={{ fontWeight: 600 }}>
              Create a Patient Account
            </Link>
          </div>
        </GlassCard>

        <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
          <ShieldAlert size={14} />
          <span>Educational non-diagnostic health portal · Not HIPAA-certified</span>
        </div>
      </div>
    </div>
  );
}
