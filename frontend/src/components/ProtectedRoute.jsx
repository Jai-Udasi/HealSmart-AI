import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoadingState, NoticeBanner, GlassCard } from './UI';

/**
 * Protects routes that require authentication and optionally specific backend-verified roles.
 */
export function ProtectedRoute({ children, allowedRoles = null }) {
  const { currentUser, loading, configError } = useAuth();
  const location = useLocation();

  if (configError) {
    return (
      <div style={{ maxWidth: 640, margin: '3rem auto', padding: '0 1rem' }}>
        <NoticeBanner variant="danger" title="Firebase Configuration Error">
          {configError}
        </NoticeBanner>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 520, margin: '3rem auto', padding: '0 1rem' }}>
        <LoadingState label="Restoring authenticated session…" />
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    if (!allowedRoles.includes(currentUser.role)) {
      return <Navigate to="/access-denied" state={{ requiredRoles: allowedRoles, attemptedPath: location.pathname }} replace />;
    }
  }

  return children;
}

/**
 * Redirects already-authenticated users away from /login or /signup
 * to their intended destination or home.
 */
export function PublicOnlyRoute({ children }) {
  const { currentUser, loading, configError } = useAuth();
  const location = useLocation();

  if (configError) {
    return (
      <div style={{ maxWidth: 640, margin: '3rem auto', padding: '0 1rem' }}>
        <NoticeBanner variant="danger" title="Firebase Configuration Error">
          {configError}
        </NoticeBanner>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 520, margin: '3rem auto', padding: '0 1rem' }}>
        <LoadingState label="Checking authentication state…" />
      </div>
    );
  }

  if (currentUser) {
    const destination = location.state?.from?.pathname || '/';
    return <Navigate to={destination} replace />;
  }

  return children;
}

export default ProtectedRoute;
