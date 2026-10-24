import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { auth, firebaseConfigError } from '../config/firebase';
import { authApi } from '../api/client';

const AuthContext = createContext(null);

export function formatFirebaseAuthError(err) {
  const code = err?.code || '';
  switch (code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please check your credentials and try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error while contacting Firebase Authentication.';
    default:
      return err?.message || 'Authentication failed. Please try again.';
  }
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null); // Backend SQLite user record (id, email, display_name, role)
  const [localDevMode, setLocalDevMode] = useState(false);
  const [loading, setLoading] = useState(!firebaseConfigError);
  const [authError, setAuthError] = useState(firebaseConfigError || null);

  const syncBackendProfile = useCallback(async () => {
    try {
      const res = await authApi.me();
      setUserProfile(res.data?.user || null);
      setLocalDevMode(Boolean(res.data?.local_dev_mode));
      return res.data?.user || null;
    } catch (err) {
      setUserProfile(null);
      throw err;
    }
  }, []);

  useEffect(() => {
    if (firebaseConfigError || !auth) {
      setLoading(false);
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          await syncBackendProfile();
        } catch (_err) {
          // Profile will retry on explicit action if needed
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [syncBackendProfile]);

  const signup = async (email, password, displayName) => {
    if (!auth) throw new Error(firebaseConfigError || 'Firebase Auth not initialized.');
    setAuthError(null);
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (displayName && displayName.trim()) {
      await updateProfile(cred.user, { displayName: displayName.trim() });
      // Force token refresh so backend receives updated name or sync via /api/auth/profile
      await cred.user.getIdToken(true);
    }
    const profile = await syncBackendProfile();
    if (displayName && displayName.trim() && profile) {
      const updated = await authApi.updateProfile({ display_name: displayName.trim() });
      setUserProfile(updated.data?.user || profile);
    }
    return cred.user;
  };

  const login = async (email, password) => {
    if (!auth) throw new Error(firebaseConfigError || 'Firebase Auth not initialized.');
    setAuthError(null);
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    await syncBackendProfile();
    return cred.user;
  };

  const logout = async () => {
    if (!auth) return;
    await signOut(auth);
    setFirebaseUser(null);
    setUserProfile(null);
  };

  const resetPassword = async (email) => {
    if (!auth) throw new Error(firebaseConfigError || 'Firebase Auth not initialized.');
    await sendPasswordResetEmail(auth, email.trim());
  };

  const approveDoctorLocalDev = async (approvalCode, targetRole = 'doctor') => {
    const res = await authApi.devApproveDoctor({
      approval_code: approvalCode,
      target_role: targetRole,
    });
    if (res.data?.user) {
      setUserProfile(res.data.user);
    }
    return res.data?.user;
  };

  // Merge Firebase user with backend-controlled role & SQLite ID
  const currentUser = firebaseUser
    ? {
        uid: firebaseUser.uid,
        email: userProfile?.email || firebaseUser.email,
        displayName:
          userProfile?.display_name ||
          firebaseUser.displayName ||
          firebaseUser.email?.split('@')[0] ||
          'User',
        role: userProfile?.role || 'patient', // Strictly backend-controlled
        sqliteId: userProfile?.id || null,
      }
    : null;

  const value = {
    currentUser,
    firebaseUser,
    userProfile,
    localDevMode,
    loading,
    configError: firebaseConfigError,
    authError,
    login,
    signup,
    logout,
    resetPassword,
    approveDoctorLocalDev,
    refreshProfile: syncBackendProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
