import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { UserProfile } from '../types';

export interface AuthResponse<T = any> {
  data: T | null;
  error: Error | null;
}

/**
 * Validates and formats a 10-digit Indian phone number to E.164 standard (+91XXXXXXXXXX)
 */
export const formatToE164 = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  if (phone.startsWith('+91')) {
    return `+91${digits.slice(-10)}`;
  }
  return `+91${digits.slice(-10)}`;
};

/**
 * Validates whether the given string is a valid 10-digit Indian mobile number
 */
export const isValidIndianMobile = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return /^[6-9]\d{9}$/.test(digits);
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return /^[6-9]\d{9}$/.test(digits.slice(2));
  }
  return false;
};

/**
 * Validates email address format
 */
export const isValidEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

export interface SignUpInput {
  username: string;
  phone: string;
  email: string;
  password: string;
}

export interface SignUpResult {
  user: any;
  session: any;
  needsConfirmation: boolean;
}

/**
 * Resolves registered email address for a given mobile number using SECURITY DEFINER RPC
 */
export const resolveEmailByMobile = async (phone: string): Promise<string | null> => {
  if (!isSupabaseConfigured) return null;
  try {
    const cleanPhone = phone.trim();
    const { data, error } = await supabase.rpc('resolve_login_email', {
      phone_input: cleanPhone,
    });

    if (error) {
      console.warn('[Auth] resolve_login_email RPC warning:', error.message);
      return null;
    }

    return (data as string) || null;
  } catch (err) {
    console.warn('[Auth] Exception resolving login email:', err);
    return null;
  }
};

/**
 * Register a new user with Mobile Number, Email, and Password.
 * Supabase Auth handles email + password under the hood.
 */
export const registerWithPassword = async (
  input: SignUpInput
): Promise<AuthResponse<SignUpResult>> => {
  if (!isSupabaseConfigured) {
    return {
      data: null,
      error: new Error('Supabase is not configured. Please check your environment variables.'),
    };
  }

  const username = input.username?.trim();
  if (!username) {
    return { data: null, error: new Error('Please enter your full name / username.') };
  }

  if (!isValidIndianMobile(input.phone)) {
    return { data: null, error: new Error('Please enter a valid 10-digit Indian mobile number.') };
  }

  const email = input.email?.trim().toLowerCase();
  if (!isValidEmail(email)) {
    return { data: null, error: new Error('Please enter a valid email address.') };
  }

  if (!input.password || input.password.length < 8) {
    return { data: null, error: new Error('Password must be at least 8 characters long.') };
  }

  const normalizedPhone = formatToE164(input.phone);

  try {
    // 1. Check if mobile number is already registered to avoid orphaned accounts
    const existingEmail = await resolveEmailByMobile(normalizedPhone);
    if (existingEmail) {
      return {
        data: null,
        error: new Error('An account with this mobile number already exists. Please login.'),
      };
    }

    // 2. Create Supabase Auth account using Email + Password (Phone provider is disabled)
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: input.password,
      options: {
        data: {
          username,
          mobile_number: normalizedPhone,
          email,
        },
      },
    });

    if (error) {
      if (
        error.message.includes('already registered') ||
        error.message.includes('already exists') ||
        error.message.includes('User already registered')
      ) {
        return {
          data: null,
          error: new Error('An account with this mobile number or email already exists. Please login.'),
        };
      }
      return { data: null, error: new Error(error.message) };
    }

    const hasActiveSession = Boolean(data?.session && data.session.access_token);

    if (hasActiveSession && data?.user) {
      await saveUserProfile(data.user.id, username, normalizedPhone, email);
      return {
        data: {
          user: data.user,
          session: data.session,
          needsConfirmation: false,
        },
        error: null,
      };
    }

    // User was created, but email confirmation is required by Supabase
    // No active session exists
    return {
      data: {
        user: data?.user ?? null,
        session: null,
        needsConfirmation: true,
      },
      error: null,
    };
  } catch (err: any) {
    return {
      data: null,
      error: new Error(err.message || 'Registration failed. Please check your connection and try again.'),
    };
  }
};

export interface SignInInput {
  phone: string;
  password: string;
}

/**
 * Sign in using Mobile Number and Password.
 * Resolves the user's email securely from the mobile number,
 * then signs in with Supabase Email + Password.
 */
export const signInWithPassword = async (
  input: SignInInput
): Promise<AuthResponse<{ user: any; session: any }>> => {
  if (!isSupabaseConfigured) {
    return {
      data: null,
      error: new Error('Supabase is not configured. Please check your environment variables.'),
    };
  }

  if (!isValidIndianMobile(input.phone)) {
    return { data: null, error: new Error('Please enter a valid 10-digit Indian mobile number.') };
  }

  if (!input.password) {
    return { data: null, error: new Error('Please enter your password.') };
  }

  try {
    // 1. Resolve registered email from mobile number
    const resolvedEmail = await resolveEmailByMobile(input.phone);
    if (!resolvedEmail) {
      return {
        data: null,
        error: new Error('No account found for this mobile number.'),
      };
    }

    // 2. Sign in with Supabase Auth using the resolved email & password
    const { data, error } = await supabase.auth.signInWithPassword({
      email: resolvedEmail,
      password: input.password,
    });

    if (error) {
      if (
        error.message.includes('Invalid login credentials') ||
        error.message.includes('invalid_grant')
      ) {
        return {
          data: null,
          error: new Error('Incorrect mobile number or password.'),
        };
      }
      if (error.message.includes('not found') || error.message.includes('User not found')) {
        return {
          data: null,
          error: new Error('No account found for this mobile number.'),
        };
      }
      if (error.message.includes('Email not confirmed') || error.message.includes('email_not_confirmed')) {
        return {
          data: null,
          error: new Error('Email confirmation required. Please verify your email before logging in.'),
        };
      }
      return { data: null, error: new Error(error.message) };
    }

    return { data: { user: data.user, session: data.session }, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: new Error(err.message || 'Unable to sign in right now. Please try again.'),
    };
  }
};

/**
 * Send password reset link to user's registered email given their mobile number.
 */
export const sendPasswordResetByMobile = async (
  phone: string
): Promise<AuthResponse<{ email: string; maskedEmail: string }>> => {
  if (!isSupabaseConfigured) {
    return {
      data: null,
      error: new Error('Supabase is not configured. Please check your environment variables.'),
    };
  }

  if (!isValidIndianMobile(phone)) {
    return {
      data: null,
      error: new Error('Please enter a valid 10-digit Indian mobile number.'),
    };
  }

  try {
    const resolvedEmail = await resolveEmailByMobile(phone);
    if (!resolvedEmail) {
      return {
        data: null,
        error: new Error('No account found for this mobile number.'),
      };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(resolvedEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    // Mask the email for user privacy (e.g., g***s@gmail.com)
    const [userPart, domainPart] = resolvedEmail.split('@');
    const maskedUser =
      userPart.length > 2
        ? `${userPart[0]}***${userPart[userPart.length - 1]}`
        : `${userPart[0]}***`;
    const maskedEmail = `${maskedUser}@${domainPart}`;

    return {
      data: { email: resolvedEmail, maskedEmail },
      error: null,
    };
  } catch (err: any) {
    return {
      data: null,
      error: new Error(err.message || 'Failed to send password reset email. Please try again.'),
    };
  }
};

/**
 * Send password reset link directly to an email address
 */
export const sendPasswordResetEmail = async (
  email: string
): Promise<AuthResponse<{ email: string; maskedEmail: string }>> => {
  if (!isSupabaseConfigured) {
    return {
      data: null,
      error: new Error('Supabase is not configured. Please check your environment variables.'),
    };
  }

  const normalizedEmail = email?.trim().toLowerCase();
  if (!isValidEmail(normalizedEmail)) {
    return { data: null, error: new Error('Please enter a valid email address.') };
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const [userPart, domainPart] = normalizedEmail.split('@');
    const maskedUser =
      userPart.length > 2
        ? `${userPart[0]}***${userPart[userPart.length - 1]}`
        : `${userPart[0]}***`;
    const maskedEmail = `${maskedUser}@${domainPart}`;

    return {
      data: { email: normalizedEmail, maskedEmail },
      error: null,
    };
  } catch (err: any) {
    return {
      data: null,
      error: new Error(err.message || 'Failed to send password reset email. Please try again.'),
    };
  }
};

/**
 * Update authenticated user's password (e.g. from reset password link)
 */
export const updateUserPassword = async (
  newPassword: string
): Promise<AuthResponse> => {
  if (!isSupabaseConfigured) {
    return {
      data: null,
      error: new Error('Supabase is not configured. Please check your environment variables.'),
    };
  }

  if (!newPassword || newPassword.length < 8) {
    return { data: null, error: new Error('Password must be at least 8 characters long.') };
  }

  try {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: new Error(err.message || 'Failed to update password. Please try again.'),
    };
  }
};

/**
 * Fetch user profile from the profiles table
 */
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  if (!isSupabaseConfigured || !userId) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, mobile_number, created_at')
      .eq('id', userId)
      .maybeSingle();

    if (data) {
      return data as UserProfile;
    }

    if (error) {
      console.warn('[Supabase] Warning fetching profile:', error.message);
    }

    // Fallback: check session user metadata
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user && authData.user.id === userId) {
      const meta = authData.user.user_metadata || {};
      const profileFallback: UserProfile = {
        id: userId,
        username: meta.username || 'User',
        mobile_number: meta.mobile_number || '',
        created_at: authData.user.created_at,
      };
      // Self-heal profiles row asynchronously
      saveUserProfile(userId, profileFallback.username, profileFallback.mobile_number);
      return profileFallback;
    }

    return null;
  } catch {
    return null;
  }
};

/**
 * Save or update user profile in Supabase
 */
export const saveUserProfile = async (
  userId: string,
  username: string,
  rawPhone: string,
  _email?: string
): Promise<UserProfile | null> => {
  if (!isSupabaseConfigured || !userId) return null;

  const phone = formatToE164(rawPhone);
  const profileData: Record<string, any> = {
    id: userId,
    username: username.trim(),
    mobile_number: phone,
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('profiles')
      .upsert(profileData, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.warn('[Supabase] Failed to upsert profile record:', error.message);
      return profileData as UserProfile;
    }

    return data as UserProfile;
  } catch {
    return profileData as UserProfile;
  }
};

/**
 * Sign out current user
 */
export const signOutUser = async (): Promise<void> => {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.error('[Supabase] Error during sign out:', err);
  }
};
