/**
 * App-level Daily SMS Safety Limit Service (100 SMS / day)
 * Tracks local device usage to safeguard against accidental over-sending.
 * Note: This is an application safety limit, not a carrier-level balance query.
 */

export const DAILY_SMS_LIMIT = 100;
const SMS_USAGE_STORAGE_KEY = 'jcb_daily_sms_usage';

export interface DailySmsUsage {
  date: string; // ISO Date YYYY-MM-DD
  sentCount: number;
  maxLimit: number;
}

/**
 * Returns today's local date string formatted as YYYY-MM-DD
 */
export const getTodayDateKey = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Retrieves the current day's SMS usage.
 * Automatically resets count to 0 if a new calendar day has started.
 */
export const getDailySmsUsage = (): DailySmsUsage => {
  const todayKey = getTodayDateKey();

  try {
    const raw = localStorage.getItem(SMS_USAGE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.date === todayKey && typeof parsed.sentCount === 'number') {
        return {
          date: todayKey,
          sentCount: Math.max(0, parsed.sentCount),
          maxLimit: DAILY_SMS_LIMIT,
        };
      }
    }
  } catch (err) {
    console.warn('[smsUsageService] Failed to read SMS usage from storage:', err);
  }

  // Initialized / new calendar day reset
  const initialUsage: DailySmsUsage = {
    date: todayKey,
    sentCount: 0,
    maxLimit: DAILY_SMS_LIMIT,
  };

  try {
    localStorage.setItem(SMS_USAGE_STORAGE_KEY, JSON.stringify(initialUsage));
  } catch (err) {
    console.warn('[smsUsageService] Failed to initialize SMS usage:', err);
  }

  return initialUsage;
};

/**
 * Checks whether the daily 100 SMS safety limit has been reached
 */
export const hasReachedDailyLimit = (): boolean => {
  const usage = getDailySmsUsage();
  return usage.sentCount >= DAILY_SMS_LIMIT;
};

/**
 * Returns remaining SMS available today under the 100 SMS safety limit
 */
export const getRemainingSmsCount = (): number => {
  const usage = getDailySmsUsage();
  return Math.max(0, DAILY_SMS_LIMIT - usage.sentCount);
};

/**
 * Increments the daily sent SMS counter by 1.
 * Must only be called AFTER Android native layer confirms successful send.
 */
export const incrementDailySmsCount = (): DailySmsUsage => {
  const todayKey = getTodayDateKey();
  const current = getDailySmsUsage();

  const updated: DailySmsUsage = {
    date: todayKey,
    sentCount: current.sentCount + 1,
    maxLimit: DAILY_SMS_LIMIT,
  };

  try {
    localStorage.setItem(SMS_USAGE_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('[smsUsageService] Failed to persist incremented SMS usage:', err);
  }

  return updated;
};
