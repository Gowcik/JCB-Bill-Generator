import type { LoadingTractor } from '../types';

export const LOADING_SESSION_KEY = 'jcb_unfinished_loading_session';

export interface LoadingSessionData {
  customerName: string;
  customerMobile: string;
  tractors: LoadingTractor[];
  jcbLoads?: number;
  tractorRate?: number;
  jcbRate?: number;
  paidAmount?: string;
  lastSavedAt: string;
}

/**
 * Persists unfinished loading session to localStorage immediately.
 * Called on every load count increase, undo, customer change, tractor list modification, or rate change.
 */
export const saveLoadingSession = (data: LoadingSessionData): void => {
  if (typeof window === 'undefined') return;
  try {
    const payload: LoadingSessionData = {
      ...data,
      lastSavedAt: new Date().toISOString(),
    };
    localStorage.setItem(LOADING_SESSION_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[loadingSessionService] Failed to save session:', err);
  }
};

/**
 * Retrieves the unfinished loading session from localStorage if present.
 */
export const getLoadingSession = (): LoadingSessionData | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOADING_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LoadingSessionData;
    if (parsed && Array.isArray(parsed.tractors)) {
      return parsed;
    }
    return null;
  } catch (err) {
    console.warn('[loadingSessionService] Failed to parse stored session:', err);
    return null;
  }
};

/**
 * Clears the unfinished loading session from localStorage.
 */
export const clearLoadingSession = (): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LOADING_SESSION_KEY);
  } catch (err) {
    console.warn('[loadingSessionService] Failed to clear session:', err);
  }
};

/**
 * Checks if there is an active unfinished loading session.
 */
export const hasUnfinishedSession = (): boolean => {
  const session = getLoadingSession();
  if (!session) return false;
  // Consider unfinished if there are tractors with loads > 0, customer name entered, or multiple tractors added
  const hasLoads = (session.tractors || []).some((t) => (t.loads || 0) > 0);
  const hasCustomer = Boolean(session.customerName && session.customerName.trim());
  const hasMultipleTractors = (session.tractors || []).length > 1;
  return hasLoads || hasCustomer || hasMultipleTractors;
};
