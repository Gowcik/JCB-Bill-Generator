import type { PaymentStatus } from '../types';
import type { Language } from '../i18n/types';
import { getStoredLanguage } from '../i18n/I18nContext';
import { translations } from '../i18n/translations';

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (dateString: string, lang?: Language): string => {
  try {
    const clean = dateString.split('T')[0];
    const parts = clean.split('-');
    if (parts.length < 3) return dateString;

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);

    if (isNaN(year) || isNaN(month) || isNaN(day)) return dateString;

    const currentLang = lang || getStoredLanguage();
    const dayFormatted = String(day).padStart(2, '0');
    const monthIndex = Math.max(0, Math.min(11, month - 1));

    if (currentLang === 'ta') {
      const tamilMonths = translations.ta.calendar.monthNames;
      const monthName = tamilMonths[monthIndex] || '';
      return `${dayFormatted} ${monthName} ${year}`;
    }

    const date = new Date(year, monthIndex, day);
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateString;
  }
};

/**
 * Format timestamp into 12-hour time format with AM/PM (e.g. 7:23 PM)
 * Converts date or ISO string to the device's local timezone (India Standard Time IST UTC+05:30).
 */
export const formatTime = (timeInput?: string | Date | null): string => {
  try {
    let dateObj: Date;
    if (!timeInput) {
      dateObj = new Date();
    } else if (typeof timeInput === 'string') {
      const trimmed = timeInput.trim();
      // If string is strictly a date without time (e.g. "2026-10-02"), fallback to current device time
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        dateObj = new Date();
      } else {
        dateObj = new Date(trimmed);
      }
    } else {
      dateObj = timeInput;
    }

    if (isNaN(dateObj.getTime())) {
      dateObj = new Date();
    }

    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(dateObj);
  } catch {
    return '';
  }
};

export const getStatusBadgeConfig = (status: PaymentStatus) => {
  switch (status) {
    case 'PAID':
    case 'Paid':
      return {
        label: 'Paid',
        bg: 'bg-emerald-100 dark:bg-emerald-950/40',
        text: 'text-emerald-800 dark:text-emerald-400',
        border: 'border-emerald-300 dark:border-emerald-800/60',
        dot: 'bg-emerald-500',
      };
    case 'PARTIALLY_PAID':
    case 'Partially Paid':
      return {
        label: 'Partially Paid',
        bg: 'bg-amber-100 dark:bg-amber-950/40',
        text: 'text-amber-800 dark:text-amber-400',
        border: 'border-amber-300 dark:border-amber-800/60',
        dot: 'bg-amber-500',
      };
    case 'UNPAID':
    case 'Unpaid':
      return {
        label: 'Unpaid',
        bg: 'bg-rose-100 dark:bg-rose-950/40',
        text: 'text-rose-800 dark:text-rose-400',
        border: 'border-rose-300 dark:border-rose-900/60',
        dot: 'bg-rose-500',
      };
    default:
      return {
        label: status,
        bg: 'bg-slate-100 dark:bg-slate-800',
        text: 'text-slate-800 dark:text-slate-200',
        border: 'border-slate-300 dark:border-slate-700',
        dot: 'bg-slate-500',
      };
  }
};
