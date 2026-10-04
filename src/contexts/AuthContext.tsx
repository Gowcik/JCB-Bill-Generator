import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { 
  signInWithPassword,
  registerWithPassword,
  sendPasswordResetEmail,
  sendPasswordResetByMobile,
  isValidIndianMobile,
  updateUserPassword,
  getUserProfile, 
  signOutUser,
  type SignUpInput
} from '../services/authService';
import { getOwnerDetails } from '../services/ownerDetailsService';
import { clearBillCache } from '../services/billService';
import type { UserProfile, OwnerDetails } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  ownerDetails: OwnerDetails | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  isSupabaseConfigured: boolean;
  isRecoveryMode: boolean;
  signIn: (phone: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (input: SignUpInput) => Promise<{ error: Error | null; needsConfirmation: boolean }>;
  sendPasswordReset: (identifier: string) => Promise<{ error: Error | null; maskedEmail?: string }>;
  resetPassword: (password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshOwnerDetails: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [ownerDetails, setOwnerDetails] = useState<OwnerDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  // Load user profile
  const loadProfile = useCallback(async (userId: string) => {
    try {
      const prof = await getUserProfile(userId);
      setProfile(prof);
    } catch (err) {
      console.error('[Auth] Failed to load user profile:', err);
    }
  }, []);

  // Load owner details from PostgreSQL
  const loadOwnerDetails = useCallback(async () => {
    try {
      const details = await getOwnerDetails();
      setOwnerDetails(details);
    } catch (err) {
      console.error('[Auth] Failed to load owner details:', err);
    }
  }, []);

  // Initialize session and auth state listener
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    let lastLoadedUserId: string | null = null;

    const fetchUserData = (userId: string) => {
      if (lastLoadedUserId === userId) return;
      lastLoadedUserId = userId;
      loadProfile(userId);
      loadOwnerDetails();
    };

    // 1. Get initial session (non-blocking, fast startup)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
    }).catch(() => {
      if (isMounted) setLoading(false);
    });

    // 2. Listen for auth state changes (SIGNED_IN, SIGNED_OUT, PASSWORD_RECOVERY, TOKEN_REFRESHED)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!isMounted) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);

        if (event === 'PASSWORD_RECOVERY') {
          setIsRecoveryMode(true);
        } else if (event === 'SIGNED_OUT') {
          setIsRecoveryMode(false);
          lastLoadedUserId = null;
          setProfile(null);
          setOwnerDetails(null);
          clearBillCache();
        }

        if (newSession?.user) {
          fetchUserData(newSession.user.id);
        } else {
          setProfile(null);
          setOwnerDetails(null);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile, loadOwnerDetails]);

  // Handle Login with Mobile + Password
  const handleSignIn = async (phone: string, password: string) => {
    const res = await signInWithPassword({ phone, password });
    if (res.error) {
      return { error: res.error };
    }
    if (res.data?.session && res.data?.user) {
      setUser(res.data.user);
      setSession(res.data.session);
      await Promise.all([
        loadProfile(res.data.user.id),
        loadOwnerDetails(),
      ]);
      return { error: null };
    }
    return { error: new Error('Unable to establish an authenticated session. Please verify your credentials.') };
  };

  // Handle Register with Mobile + Email + Password
  const handleSignUp = async (input: SignUpInput): Promise<{ error: Error | null; needsConfirmation: boolean }> => {
    const res = await registerWithPassword(input);
    if (res.error) {
      return { error: res.error, needsConfirmation: false };
    }
    if (res.data?.session && res.data?.user) {
      setUser(res.data.user);
      setSession(res.data.session);
      await Promise.all([
        loadProfile(res.data.user.id),
        loadOwnerDetails(),
      ]);
      return { error: null, needsConfirmation: false };
    }

    // User was created, but email/phone confirmation is required by Supabase
    // Do NOT set active user/session in AuthContext
    setUser(null);
    setSession(null);
    return { error: null, needsConfirmation: true };
  };

  // Send Password Reset Link to Email or by Mobile Number
  const handleSendPasswordReset = async (identifier: string) => {
    if (isValidIndianMobile(identifier)) {
      const res = await sendPasswordResetByMobile(identifier);
      return { error: res.error, maskedEmail: res.data?.maskedEmail };
    }
    const res = await sendPasswordResetEmail(identifier);
    return { error: res.error, maskedEmail: res.data?.maskedEmail };
  };

  // Update Password (Recovery session)
  const handleResetPassword = async (newPassword: string) => {
    const res = await updateUserPassword(newPassword);
    if (!res.error) {
      setIsRecoveryMode(false);
    }
    return { error: res.error };
  };

  // Sign out
  const handleSignOut = async () => {
    setLoading(true);
    clearBillCache();
    await signOutUser();
    setUser(null);
    setSession(null);
    setProfile(null);
    setOwnerDetails(null);
    setIsRecoveryMode(false);
    setLoading(false);
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await loadProfile(user.id);
    }
  };

  const refreshOwnerDetails = async () => {
    await loadOwnerDetails();
  };

  const value: AuthContextType = {
    user,
    profile,
    ownerDetails,
    session,
    loading,
    isAuthenticated: Boolean(session && user),
    isSupabaseConfigured,
    isRecoveryMode,
    signIn: handleSignIn,
    signUp: handleSignUp,
    sendPasswordReset: handleSendPasswordReset,
    resetPassword: handleResetPassword,
    signOut: handleSignOut,
    refreshProfile,
    refreshOwnerDetails,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
