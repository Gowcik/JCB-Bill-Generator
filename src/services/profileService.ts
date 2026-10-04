import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { UserProfile } from '../types';

/**
 * Fetch the authenticated user's profile from public.profiles
 */
export const getProfile = async (userId?: string): Promise<UserProfile | null> => {
  if (!isSupabaseConfigured) return null;

  try {
    let targetId = userId;
    if (!targetId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      targetId = user.id;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, mobile_number, created_at')
      .eq('id', targetId)
      .single();

    if (error || !data) {
      return null;
    }

    return data as UserProfile;
  } catch (err) {
    console.error('[profileService] Error fetching profile:', err);
    return null;
  }
};

/**
 * Update the authenticated user's profile in public.profiles
 */
export const updateProfile = async (
  updates: Partial<Pick<UserProfile, 'username' | 'mobile_number'>>
): Promise<{ data: UserProfile | null; error: Error | null }> => {
  if (!isSupabaseConfigured) {
    return {
      data: null,
      error: new Error('Supabase is not configured. Please check your .env file.'),
    };
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('User is not authenticated.') };
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select('id, username, mobile_number, created_at')
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as UserProfile, error: null };
  } catch (err: any) {
    return { data: null, error: new Error(err.message || 'Failed to update profile.') };
  }
};
