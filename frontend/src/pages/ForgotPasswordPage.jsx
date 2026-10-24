import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Mail, ArrowLeft } from 'lucide-react';
import { GlassCard, Button, FormField, NoticeBanner } from '../components/UI';
import { useAuth, formatFirebaseAuthError } from '../context/AuthContext';

export default function ForgotPasswordPage() {
  const { resetPassword, configError } = useAuth();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    setEmailError(null);
    setSubmitError(null);
    setSentSuccess(false);
    setSubmitting(true);

    try {
      await resetPassword(email);
      setSentSuccess(true);
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
            <div className="brand-subtitle">Password Recovery</div>
          </div>
        </div>

        <GlassCard>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.35rem' }}>
            Reset Your Password
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            Enter the email address associated with your account and we&apos;ll send a Firebase password reset link.
          </p>

          {configError && (
            <NoticeBanner variant="danger" title="Firebase Setup Required">
              {configError}
            </NoticeBanner>
          )}

          {submitError && (
            <NoticeBanner variant="danger" title="Reset Request Failed">
              {submitError}
            </NoticeBanner>
          )}

          {sentSuccess && (
            <NoticeBanner variant="success" title="Password Reset Email Sent">
              If an account exists for <strong>{email}</strong>, a password reset link has been dispatched. Check your inbox (and spam folder).
            </NoticeBanner>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <FormField
              label="Email Address *"
              id="reset-email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={emailError}
              required
            />

            <Button
              type="submit"
              variant="primary"
              icon={Mail}
              loading={submitting}
              style={{ width: '100%' }}
            >
              {submitting ? 'Sending Reset Link…' : 'Send Reset Email'}
            </Button>
          </form>

          <div
            style={{
              marginTop: '1.25rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-subtle)',
              textAlign: 'center',
              fontSize: '0.88rem',
            }}
          >
            <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
              <ArrowLeft size={15} />
              <span>Back to Sign In</span>
            </Link>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
