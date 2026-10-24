import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, UserPlus, ShieldAlert } from 'lucide-react';
import { GlassCard, Button, FormField, NoticeBanner } from '../components/UI';
import { useAuth, formatFirebaseAuthError } from '../context/AuthContext';

export default function SignupPage() {
  const { signup, configError } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const errs = {};
    if (!displayName.trim() || displayName.trim().length < 2) {
      errs.displayName = 'Display name must be at least 2 characters.';
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Please enter a valid email address.';
    }
    if (!password || password.length < 6) {
      errs.password = 'Password must be at least 6 characters.';
    }
    if (password !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match.';
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setFieldErrors({});
    setSubmitError(null);
    setSubmitting(true);

    try {
      await signup(email, password, displayName);
      navigate('/', { replace: true });
    } catch (err) {
      setSubmitError(formatFirebaseAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div className="brand-icon" style={{ width: 42, height: 42 }}>
            <Activity size={24} />
          </div>
          <div>
            <div className="brand-title" style={{ fontSize: '1.35rem' }}>HealSmartAI</div>
            <div className="brand-subtitle">Patient Registration</div>
          </div>
        </div>

        <GlassCard>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.35rem' }}>
            Create Your Account
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            New accounts are provisioned with the <strong>Patient</strong> role by the backend. Self-registration as a Doctor is not permitted.
          </p>

          {configError && (
            <NoticeBanner variant="danger" title="Firebase Setup Required">
              {configError}
            </NoticeBanner>
          )}

          {submitError && (
            <NoticeBanner variant="danger" title="Registration Failed">
              {submitError}
            </NoticeBanner>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <FormField
              label="Full Name *"
              id="signup-name"
              type="text"
              placeholder="Enter your full name"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              error={fieldErrors.displayName}
              required
            />

            <FormField
              label="Email Address *"
              id="signup-email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldErrors.email}
              required
            />

            <FormField
              label="Password (6+ characters) *"
              id="signup-password"
              type="password"
              placeholder="Create a password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password}
              required
            />

            <FormField
              label="Confirm Password *"
              id="signup-confirm-password"
              type="password"
              placeholder="Repeat your password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={fieldErrors.confirmPassword}
              required
            />

            <Button
              type="submit"
              variant="primary"
              icon={UserPlus}
              loading={submitting}
              style={{ width: '100%', marginTop: '0.25rem' }}
            >
              {submitting ? 'Creating Account…' : 'Create Patient Account'}
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
            Already have an account?{' '}
            <Link to="/login" style={{ fontWeight: 600 }}>
              Sign In
            </Link>
          </div>
        </GlassCard>

        <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
          <ShieldAlert size={14} />
          <span>Educational non-diagnostic health portal · Local SQLite persistence</span>
        </div>
      </div>
    </div>
  );
}
