import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { OwnerDetails, OwnerDetailsInput } from '../types';
import {
  getStoredUpiQr,
  setStoredUpiQr,
  removeStoredUpiQr,
  getStoredUpiDisplayName,
  setStoredUpiDisplayName,
  getStoredShowUpiQr,
  setStoredShowUpiQr,
} from './upiService';
import {
  getStoredSignature,
  setStoredSignature,
  removeStoredSignature,
  getStoredShowSignature,
  setStoredShowSignature,
} from './signatureService';

/**
 * Helper to strip a missing column identified by PostgREST error message
 */
const stripMissingColumn = (payload: any, errorMsg: string): boolean => {
  if (!errorMsg || !payload) return false;
  const m1 = errorMsg.match(/Could not find the '([^']+)' column/i);
  if (m1 && m1[1] && m1[1] in payload) {
    delete payload[m1[1]];
    return true;
  }
  const m2 = errorMsg.match(/column "([^"]+)"/i);
  if (m2 && m2[1] && m2[1] in payload) {
    delete payload[m2[1]];
    return true;
  }
  if (errorMsg.includes('signature') && 'signature' in payload) {
    delete payload.signature;
    return true;
  }
  if (errorMsg.includes('show_signature') && 'show_signature' in payload) {
    delete payload.show_signature;
    return true;
  }
  return false;
};

/**
 * Fetch the authenticated user's owner details record from public.owner_details
 */
export const getOwnerDetails = async (): Promise<OwnerDetails | null> => {
  if (!isSupabaseConfigured) return null;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('owner_details')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.warn('[ownerDetailsService] Error fetching owner details:', error.message);
      return null;
    }

    if (!data) return null;

    const owner = data as OwnerDetails;
    // Enrich with stored local UPI data if not in PostgreSQL or empty
    if (!owner.upi_display_name) {
      owner.upi_display_name = getStoredUpiDisplayName(user.id);
    }

    // QR Code Resolution & Sync:
    if (owner.upi_qr_code) {
      // Successfully retrieved from database: sync to local storage cache
      setStoredUpiQr(owner.upi_qr_code, user.id);
    } else if (owner.upi_qr_code === null || owner.upi_qr_code === '') {
      // Explicitly null in database means owner deleted or has no QR
      owner.upi_qr_code = null;
      removeStoredUpiQr(user.id);
      removeStoredUpiQr();
    } else {
      // Column undefined in DB select: fallback to local cache
      owner.upi_qr_code = getStoredUpiQr(user.id) || null;
    }

    if (owner.show_upi_qr === undefined || owner.show_upi_qr === null) {
      owner.show_upi_qr = getStoredShowUpiQr(user.id);
    }
    if (owner.signature === undefined || owner.signature === null) {
      owner.signature = getStoredSignature(user.id);
    }
    if (owner.show_signature === undefined || owner.show_signature === null) {
      owner.show_signature = getStoredShowSignature(user.id);
    }

    return owner;
  } catch (err) {
    console.error('[ownerDetailsService] Unexpected error fetching owner details:', err);
    return null;
  }
};

/**
 * Create a new owner details record in public.owner_details
 */
export const createOwnerDetails = async (
  input: OwnerDetailsInput
): Promise<{ data: OwnerDetails | null; error: Error | null }> => {
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

    // Persist to local storage cache
    if (input.upi_qr_code) {
      setStoredUpiQr(input.upi_qr_code, user.id);
    } else {
      removeStoredUpiQr(user.id);
      removeStoredUpiQr();
    }

    if (input.upi_display_name) {
      setStoredUpiDisplayName(input.upi_display_name, user.id);
    }

    if (input.show_upi_qr !== undefined && input.show_upi_qr !== null) {
      setStoredShowUpiQr(input.show_upi_qr, user.id);
    }

    if (input.signature) {
      setStoredSignature(input.signature, user.id);
    } else if (input.signature === null) {
      removeStoredSignature(user.id);
    }

    if (input.show_signature !== undefined && input.show_signature !== null) {
      setStoredShowSignature(input.show_signature, user.id);
    }

    const payload: any = {
      user_id: user.id,
      business_name: input.business_name ?? null,
      owner_name: input.owner_name ?? null,
      mobile_number: input.mobile_number ?? null,
      address: input.address ?? null,
      jcb_model: input.jcb_model ?? null,
      registration_number: input.registration_number ?? null,
      hourly_rate: input.hourly_rate ?? null,
      upi_id: input.upi_id ?? null,
      upi_display_name: input.upi_display_name ?? null,
      upi_qr_code: input.upi_qr_code !== undefined ? (input.upi_qr_code || null) : null,
      show_upi_qr: input.show_upi_qr ?? true,
      gst_number: input.gst_number ?? null,
    };

    let result = await supabase
      .from('owner_details')
      .insert(payload)
      .select()
      .single();

    let attempts = 0;
    while (result.error && attempts < 3) {
      attempts++;
      const stripped = stripMissingColumn(payload, result.error.message);
      if (stripped) {
        result = await supabase
          .from('owner_details')
          .insert(payload)
          .select()
          .single();
      } else {
        break;
      }
    }

    if (result.error) {
      return { data: null, error: new Error(result.error.message) };
    }

    const saved = result.data as OwnerDetails;
    saved.upi_display_name = saved.upi_display_name || getStoredUpiDisplayName(user.id);
    saved.upi_qr_code = result.data?.upi_qr_code !== undefined ? result.data.upi_qr_code : (input.upi_qr_code || null);
    if (saved.upi_qr_code) {
      setStoredUpiQr(saved.upi_qr_code, user.id);
    }
    if (saved.show_upi_qr === undefined || saved.show_upi_qr === null) {
      saved.show_upi_qr = getStoredShowUpiQr(user.id);
    }
    saved.signature = saved.signature || getStoredSignature(user.id);
    saved.show_signature = saved.show_signature !== undefined ? saved.show_signature : getStoredShowSignature(user.id);

    return { data: saved, error: null };
  } catch (err: any) {
    return { data: null, error: new Error(err.message || 'Failed to create owner details.') };
  }
};

/**
 * Update the authenticated user's owner details record
 */
export const updateOwnerDetails = async (
  input: OwnerDetailsInput
): Promise<{ data: OwnerDetails | null; error: Error | null }> => {
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

    // Persist to local storage cache
    if (input.upi_qr_code) {
      setStoredUpiQr(input.upi_qr_code, user.id);
    } else {
      removeStoredUpiQr(user.id);
      removeStoredUpiQr();
    }

    if (input.upi_display_name) {
      setStoredUpiDisplayName(input.upi_display_name, user.id);
    }

    if (input.show_upi_qr !== undefined && input.show_upi_qr !== null) {
      setStoredShowUpiQr(input.show_upi_qr, user.id);
    }

    if (input.signature) {
      setStoredSignature(input.signature, user.id);
    } else if (input.signature === null) {
      removeStoredSignature(user.id);
    }

    if (input.show_signature !== undefined && input.show_signature !== null) {
      setStoredShowSignature(input.show_signature, user.id);
    }

    const payload: any = {
      business_name: input.business_name ?? null,
      owner_name: input.owner_name ?? null,
      mobile_number: input.mobile_number ?? null,
      address: input.address ?? null,
      jcb_model: input.jcb_model ?? null,
      registration_number: input.registration_number ?? null,
      hourly_rate: input.hourly_rate ?? null,
      upi_id: input.upi_id ?? null,
      upi_display_name: input.upi_display_name ?? null,
      upi_qr_code: input.upi_qr_code !== undefined ? (input.upi_qr_code || null) : null,
      show_upi_qr: input.show_upi_qr ?? true,
      gst_number: input.gst_number ?? null,
    };

    let result = await supabase
      .from('owner_details')
      .update(payload)
      .eq('user_id', user.id)
      .select()
      .single();

    let attempts = 0;
    while (result.error && attempts < 3) {
      attempts++;
      const stripped = stripMissingColumn(payload, result.error.message);
      if (stripped) {
        result = await supabase
          .from('owner_details')
          .update(payload)
          .eq('user_id', user.id)
          .select()
          .single();
      } else {
        break;
      }
    }

    if (result.error) {
      return { data: null, error: new Error(result.error.message) };
    }

    const saved = result.data as OwnerDetails;
    saved.upi_display_name = saved.upi_display_name || getStoredUpiDisplayName(user.id);
    saved.upi_qr_code = result.data?.upi_qr_code !== undefined ? result.data.upi_qr_code : (input.upi_qr_code || null);
    if (saved.upi_qr_code) {
      setStoredUpiQr(saved.upi_qr_code, user.id);
    }
    if (saved.show_upi_qr === undefined || saved.show_upi_qr === null) {
      saved.show_upi_qr = getStoredShowUpiQr(user.id);
    }
    saved.signature = saved.signature || getStoredSignature(user.id);
    saved.show_signature = saved.show_signature !== undefined ? saved.show_signature : getStoredShowSignature(user.id);

    return { data: saved, error: null };
  } catch (err: any) {
    return { data: null, error: new Error(err.message || 'Failed to update owner details.') };
  }
};

/**
 * Save or update owner details for the current authenticated user (Upsert)
 */
export const upsertOwnerDetails = async (
  input: OwnerDetailsInput
): Promise<{ data: OwnerDetails | null; error: Error | null }> => {
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

    // Persist to local storage cache
    if (input.upi_qr_code) {
      setStoredUpiQr(input.upi_qr_code, user.id);
    } else {
      removeStoredUpiQr(user.id);
      removeStoredUpiQr();
    }

    if (input.upi_display_name) {
      setStoredUpiDisplayName(input.upi_display_name, user.id);
    }

    if (input.show_upi_qr !== undefined && input.show_upi_qr !== null) {
      setStoredShowUpiQr(input.show_upi_qr, user.id);
    }

    if (input.signature) {
      setStoredSignature(input.signature, user.id);
    } else if (input.signature === null) {
      removeStoredSignature(user.id);
    }

    if (input.show_signature !== undefined && input.show_signature !== null) {
      setStoredShowSignature(input.show_signature, user.id);
    }

    const payload: any = {
      user_id: user.id,
      business_name: input.business_name ?? null,
      owner_name: input.owner_name ?? null,
      mobile_number: input.mobile_number ?? null,
      address: input.address ?? null,
      jcb_model: input.jcb_model ?? null,
      registration_number: input.registration_number ?? null,
      hourly_rate: input.hourly_rate ?? null,
      upi_id: input.upi_id ?? null,
      upi_display_name: input.upi_display_name ?? null,
      upi_qr_code: input.upi_qr_code !== undefined ? (input.upi_qr_code || null) : null,
      show_upi_qr: input.show_upi_qr ?? true,
      gst_number: input.gst_number ?? null,
    };

    let result = await supabase
      .from('owner_details')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single();

    let attempts = 0;
    while (result.error && attempts < 3) {
      attempts++;
      const stripped = stripMissingColumn(payload, result.error.message);
      if (stripped) {
        result = await supabase
          .from('owner_details')
          .upsert(payload, { onConflict: 'user_id' })
          .select()
          .single();
      } else {
        break;
      }
    }

    if (result.error) {
      return { data: null, error: new Error(result.error.message) };
    }

    const saved = result.data as OwnerDetails;
    saved.upi_display_name = saved.upi_display_name || getStoredUpiDisplayName(user.id);
    saved.upi_qr_code = result.data?.upi_qr_code !== undefined ? result.data.upi_qr_code : (input.upi_qr_code || null);
    if (saved.upi_qr_code) {
      setStoredUpiQr(saved.upi_qr_code, user.id);
    }
    if (saved.show_upi_qr === undefined || saved.show_upi_qr === null) {
      saved.show_upi_qr = getStoredShowUpiQr(user.id);
    }
    saved.signature = saved.signature || getStoredSignature(user.id);
    saved.show_signature = saved.show_signature !== undefined ? saved.show_signature : getStoredShowSignature(user.id);

    return { data: saved, error: null };
  } catch (err: any) {
    return { data: null, error: new Error(err.message || 'Failed to save owner details.') };
  }
};
