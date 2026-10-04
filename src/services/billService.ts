import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { DbBill, CreateBillInput } from '../types';
import { formatToE164, isValidIndianMobile } from './authService';

// Lightweight, user-scoped in-memory cache for fast navigation and instant tab switching
interface BillCache {
  userId: string;
  bills: DbBill[];
  timestamp: number;
}

let billCache: BillCache | null = null;
let inFlightBillsPromise: Promise<DbBill[]> | null = null;

/**
 * Get current in-memory cached bills synchronously (null if not yet loaded)
 */
export const getCachedBills = (): DbBill[] | null => {
  return billCache ? billCache.bills : null;
};

/**
 * Invalidate or clear in-memory cache (e.g. on logout)
 */
export const clearBillCache = (): void => {
  billCache = null;
  inFlightBillsPromise = null;
};

/**
 * Fast helper to obtain the authenticated user ID from active session
 * Avoids redundant network round-trips to /auth/v1/user
 */
export const getAuthenticatedUserId = async (): Promise<string | null> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      return session.user.id;
    }
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch {
    return null;
  }
};

/**
 * Fetch all bills for the authenticated user from public.bills
 * Reuses in-memory cache when available for instant page navigation
 */
export const getBills = async (forceRefresh: boolean = false): Promise<DbBill[]> => {
  if (!isSupabaseConfigured) return [];

  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return [];

    // 1. If valid in-memory cache exists and not forcing a refresh, return immediately (0ms)
    if (!forceRefresh && billCache && billCache.userId === userId) {
      return billCache.bills;
    }

    // 2. Reuse in-flight query if one is already running
    if (inFlightBillsPromise) {
      return await inFlightBillsPromise;
    }

    // 3. Fetch from Supabase
    inFlightBillsPromise = (async () => {
      try {
        const { data, error } = await supabase
          .from('bills')
          .select('*')
          .eq('user_id', userId)
          .order('bill_date', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('[billService] Error fetching bills:', error.message);
          return billCache?.userId === userId ? billCache.bills : [];
        }

        const result = (data || []) as DbBill[];
        billCache = {
          userId,
          bills: result,
          timestamp: Date.now(),
        };
        return result;
      } finally {
        inFlightBillsPromise = null;
      }
    })();

    return await inFlightBillsPromise;
  } catch (err) {
    console.error('[billService] Unexpected error fetching bills:', err);
    return billCache ? billCache.bills : [];
  }
};

/**
 * Fetch a single bill by its ID from public.bills
 */
export const getBillById = async (id: string): Promise<DbBill | null> => {
  if (!isSupabaseConfigured || !id) return null;

  try {
    // Check in-memory cache first
    if (billCache) {
      const found = billCache.bills.find((b) => b.id === id);
      if (found) return found;
    }

    const userId = await getAuthenticatedUserId();
    if (!userId) return null;

    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return data as DbBill;
  } catch (err) {
    console.error('[billService] Error fetching bill by ID:', err);
    return null;
  }
};

/**
 * Generate the next sequential bill number for the authenticated user
 * Format: [PREFIX][0001] (e.g. JCB-2026-0001)
 */
export const getNextBillNumber = async (customPrefix?: string, billType: 'meter' | 'loading' = 'meter'): Promise<string> => {
  const currentYear = new Date().getFullYear();
  const savedPrefix = typeof window !== 'undefined' ? localStorage.getItem(billType === 'loading' ? 'jcb_load_bill_prefix' : 'jcb_bill_prefix') : null;
  const defaultPrefix = billType === 'loading' ? 'LOAD-' : `JCB-${currentYear}-`;
  const prefix = (customPrefix || savedPrefix || defaultPrefix).trim();

  if (!isSupabaseConfigured) {
    // Fallback if Supabase is unconfigured
    const storageKey = billType === 'loading' ? 'jcb_local_load_bill_count' : 'jcb_local_bill_count';
    const localCount = typeof window !== 'undefined' ? (parseInt(localStorage.getItem(storageKey) || '0', 10) + 1) : 1;
    return `${prefix}${String(localCount).padStart(4, '0')}`;
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return `${prefix}0001`;
    }

    // Retrieve the user's existing bills with this prefix to determine the next sequential number
    const { data, error } = await supabase
      .from('bills')
      .select('bill_number')
      .eq('user_id', user.id)
      .like('bill_number', `${prefix}%`);

    if (error || !data || data.length === 0) {
      return `${prefix}0001`;
    }

    // Extract numerical suffixes and find the maximum
    let maxNumber = 0;
    for (const row of data) {
      const numPart = row.bill_number.replace(prefix, '');
      const parsed = parseInt(numPart, 10);
      if (!isNaN(parsed) && parsed > maxNumber) {
        maxNumber = parsed;
      }
    }

    const nextSeq = maxNumber + 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  } catch (err) {
    console.warn('[billService] Error generating next bill number:', err);
    return `${prefix}0001`;
  }
};

/**
 * Retrieve the latest meter reading for a specific JCB machine (identified by registration_number)
 * to automatically carry-forward as previous_meter_reading in the next bill.
 */
export const getLatestMeterReading = async (registrationNumber?: string | null): Promise<number | null> => {
  const regKey = registrationNumber ? registrationNumber.trim().toUpperCase() : 'default';

  if (!isSupabaseConfigured) {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(`jcb_last_meter_${regKey}`) || localStorage.getItem('jcb_last_meter_default');
      if (cached) {
        const val = parseFloat(cached);
        return isNaN(val) ? null : val;
      }
    }
    return null;
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(`jcb_last_meter_${regKey}`) || localStorage.getItem('jcb_last_meter_default');
        if (cached) {
          const val = parseFloat(cached);
          return isNaN(val) ? null : val;
        }
      }
      return null;
    }

    // 1. Try querying with specific registration_number if provided
    if (registrationNumber && registrationNumber.trim()) {
      const cleanReg = registrationNumber.trim();
      const { data, error } = await supabase
        .from('bills')
        .select('current_meter_reading')
        .eq('user_id', user.id)
        .eq('registration_number', cleanReg)
        .not('current_meter_reading', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0 && data[0].current_meter_reading != null) {
        const num = Number(data[0].current_meter_reading);
        if (!isNaN(num)) {
          if (typeof window !== 'undefined') {
            localStorage.setItem(`jcb_last_meter_${regKey}`, String(num));
          }
          return num;
        }
      }
    }

    // 2. Query any bill with current_meter_reading for this user
    const { data, error } = await supabase
      .from('bills')
      .select('current_meter_reading')
      .eq('user_id', user.id)
      .not('current_meter_reading', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!error && data && data.length > 0 && data[0].current_meter_reading != null) {
      const num = Number(data[0].current_meter_reading);
      if (!isNaN(num)) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(`jcb_last_meter_${regKey}`, String(num));
        }
        return num;
      }
    }

    // 3. Fallback to localStorage if any
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(`jcb_last_meter_${regKey}`) || localStorage.getItem('jcb_last_meter_default');
      if (cached) {
        const val = parseFloat(cached);
        return isNaN(val) ? null : val;
      }
    }

    return null;
  } catch (err) {
    console.warn('[billService] Error fetching latest meter reading:', err);
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(`jcb_last_meter_${regKey}`) || localStorage.getItem('jcb_last_meter_default');
      if (cached) {
        const val = parseFloat(cached);
        return isNaN(val) ? null : val;
      }
    }
    return null;
  }
};

/**
 * Validate bill inputs before sending to PostgreSQL
 */
export const validateBillInput = (input: {
  customer_name: string;
  customer_mobile: string;
  previous_meter: number;
  current_meter: number;
  hourly_rate: number;
  extra_charges: number;
  discount: number;
  paid_amount: number;
}): { isValid: boolean; error: string | null } => {
  if (!input.customer_name || !input.customer_name.trim()) {
    return { isValid: false, error: 'Customer Name is required.' };
  }

  if (!input.customer_mobile || !input.customer_mobile.trim()) {
    return { isValid: false, error: 'Customer Mobile Number is required.' };
  }

  if (!isValidIndianMobile(input.customer_mobile)) {
    return { isValid: false, error: 'Please enter a valid 10-digit Indian mobile number.' };
  }

  if (isNaN(input.previous_meter) || isNaN(input.current_meter)) {
    return { isValid: false, error: 'Meter readings must be valid numbers.' };
  }

  if (input.current_meter < input.previous_meter) {
    return { 
      isValid: false, 
      error: 'Current meter reading cannot be less than the previous reading.' 
    };
  }

  const workingHours = Number((input.current_meter - input.previous_meter).toFixed(2));
  if (workingHours < 0) {
    return { isValid: false, error: 'Working hours cannot be negative.' };
  }

  if (input.hourly_rate < 0) {
    return { isValid: false, error: 'Rate per hour cannot be negative.' };
  }

  if (input.extra_charges < 0) {
    return { isValid: false, error: 'Extra charges cannot be negative.' };
  }

  if (input.discount < 0) {
    return { isValid: false, error: 'Discount cannot be negative.' };
  }

  const baseAmount = Math.round(workingHours * input.hourly_rate);
  const subtotal = baseAmount + input.extra_charges;
  if (input.discount > subtotal) {
    return { isValid: false, error: 'Discount cannot be greater than subtotal amount.' };
  }

  const totalAmount = subtotal - input.discount;
  if (totalAmount < 0) {
    return { isValid: false, error: 'Total amount cannot be negative.' };
  }

  if (input.paid_amount < 0) {
    return { isValid: false, error: 'Paid amount cannot be negative.' };
  }

  if (input.paid_amount > totalAmount) {
    return { isValid: false, error: 'Paid amount cannot be greater than total bill amount.' };
  }

  return { isValid: true, error: null };
};

/**
 * Create a new bill record in public.bills and save to PostgreSQL
 */
export const createBill = async (
  input: CreateBillInput
): Promise<{ data: DbBill | null; error: Error | null }> => {
  if (!isSupabaseConfigured) {
    return {
      data: null,
      error: new Error('Supabase is not configured. Please check your .env file.'),
    };
  }

  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return { data: null, error: new Error('User is not authenticated. Please log in.') };
    }

    // Mathematical calculations to strictly guarantee check constraints
    const totalAmount = Math.max(0, input.total_amount);
    const paidAmount = Math.min(totalAmount, Math.max(0, input.paid_amount));
    const balanceAmount = totalAmount - paidAmount;

    // Determine strict payment status based on amounts (Rules from prompt)
    let paymentStatus: 'Paid' | 'Partially Paid' | 'Unpaid' = 'Unpaid';
    if (paidAmount === totalAmount) {
      paymentStatus = 'Paid';
    } else if (paidAmount > 0 && paidAmount < totalAmount) {
      paymentStatus = 'Partially Paid';
    } else {
      paymentStatus = 'Unpaid';
    }

    // Format normalized phone number
    const normalizedMobile = formatToE164(input.customer_mobile);

    // Payload strictly matching public.bills table
    const payload = {
      user_id: userId,
      bill_number: input.bill_number.trim(),
      customer_name: input.customer_name.trim(),
      customer_mobile: normalizedMobile,
      bill_date: input.bill_date || new Date().toISOString().split('T')[0],
      total_amount: totalAmount,
      paid_amount: paidAmount,
      balance_amount: balanceAmount,
      payment_status: paymentStatus,
      working_hours: input.working_hours ?? null,
      previous_meter_reading: input.previous_meter_reading !== undefined ? input.previous_meter_reading : null,
      current_meter_reading: input.current_meter_reading !== undefined ? input.current_meter_reading : null,
      rate_per_hour: input.rate_per_hour !== undefined ? input.rate_per_hour : null,
      registration_number: input.registration_number ? input.registration_number.trim() : null,
      bill_type: input.bill_type || 'meter',
      loading_details: input.loading_details || null,
    };

    const { data, error } = await supabase
      .from('bills')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('[billService] PostgreSQL insert error:', error.message);
      return { data: null, error: new Error(error.message) };
    }

    const createdBill = data as DbBill;

    // Synchronize in-memory cache
    if (billCache && billCache.userId === userId) {
      billCache.bills = [createdBill, ...billCache.bills];
    }

    // Cache latest meter reading locally for immediate auto-carry-forward
    if (input.current_meter_reading != null) {
      const regKey = input.registration_number ? input.registration_number.trim().toUpperCase() : 'default';
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(`jcb_last_meter_${regKey}`, String(input.current_meter_reading));
          localStorage.setItem('jcb_last_meter_default', String(input.current_meter_reading));
        }
      } catch {}
    }

    return { data: createdBill, error: null };
  } catch (err: any) {
    return { data: null, error: new Error(err.message || 'Unable to save the bill. Please check your connection and try again.') };
  }
};

/**
 * Update payment for an existing bill in PostgreSQL
 * Validates that additionalAmount > 0 and <= balance_amount
 * Strictly maintains check constraints on bills table
 */
export const updateBillPayment = async (
  billId: string,
  additionalAmount: number
): Promise<{ data: DbBill | null; error: Error | null }> => {
  if (!isSupabaseConfigured) {
    return {
      data: null,
      error: new Error('Supabase is not configured. Please check your connection.'),
    };
  }

  if (!billId) {
    return { data: null, error: new Error('Invalid bill ID.') };
  }

  if (isNaN(additionalAmount) || additionalAmount <= 0) {
    return { data: null, error: new Error('Payment amount must be greater than zero.') };
  }

  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return { data: null, error: new Error('User is not authenticated. Please log in.') };
    }

    // 1. Fetch current bill state
    const { data: currentBill, error: fetchError } = await supabase
      .from('bills')
      .select('*')
      .eq('id', billId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !currentBill) {
      return { data: null, error: new Error('Bill not found or access denied.') };
    }

    const currentTotal = Number(currentBill.total_amount);
    const currentPaid = Number(currentBill.paid_amount);
    const currentBalance = Number(currentBill.balance_amount);

    if (currentBalance <= 0 || currentBill.payment_status === 'Paid') {
      return { data: null, error: new Error('This bill is already fully paid.') };
    }

    // Ensure precision to 2 decimal places
    const cleanPayment = Number(additionalAmount.toFixed(2));

    if (cleanPayment > currentBalance + 0.01) {
      return {
        data: null,
        error: new Error(`Payment cannot exceed outstanding balance of ₹${currentBalance.toLocaleString('en-IN')}.`),
      };
    }

    // Calculate new amounts
    let newPaid = Number((currentPaid + cleanPayment).toFixed(2));
    let newBalance = Number((currentTotal - newPaid).toFixed(2));

    // Handle floating-point edge cases
    if (newBalance <= 0 || newPaid >= currentTotal) {
      newPaid = currentTotal;
      newBalance = 0;
    }

    // Determine strict payment status matching PostgreSQL check constraint
    let newStatus: 'Paid' | 'Partially Paid' = 'Partially Paid';
    if (newBalance === 0 || newPaid === currentTotal) {
      newStatus = 'Paid';
    }

    // Update in PostgreSQL
    const { data: updatedBill, error: updateError } = await supabase
      .from('bills')
      .update({
        paid_amount: newPaid,
        balance_amount: newBalance,
        payment_status: newStatus,
      })
      .eq('id', billId)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('[billService] Update payment error:', updateError.message);
      return { data: null, error: new Error(updateError.message) };
    }

    const updated = updatedBill as DbBill;

    // Synchronize in-memory cache
    if (billCache && billCache.userId === userId) {
      billCache.bills = billCache.bills.map((b) => (b.id === billId ? updated : b));
    }

    return { data: updated, error: null };
  } catch (err: any) {
    return { data: null, error: new Error(err.message || 'Failed to update payment.') };
  }
};

/**
 * Delete a bill from public.bills in PostgreSQL
 */
export const deleteBill = async (
  billId: string
): Promise<{ error: Error | null }> => {
  if (!isSupabaseConfigured) {
    return { error: new Error('Supabase is not configured.') };
  }

  if (!billId) {
    return { error: new Error('Invalid bill ID.') };
  }

  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return { error: new Error('User is not authenticated. Please log in.') };
    }

    const { error } = await supabase
      .from('bills')
      .delete()
      .eq('id', billId)
      .eq('user_id', userId);

    if (error) {
      console.error('[billService] Delete bill error:', error.message);
      return { error: new Error(error.message) };
    }

    // Synchronize in-memory cache
    if (billCache && billCache.userId === userId) {
      billCache.bills = billCache.bills.filter((b) => b.id !== billId);
    }

    return { error: null };
  } catch (err: any) {
    return { error: new Error(err.message || 'Failed to delete bill.') };
  }
};

