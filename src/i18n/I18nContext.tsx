import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import type { Language } from './types';
import { LANGUAGE_STORAGE_KEY, DEFAULT_LANGUAGE } from './types';
import { translations } from './translations';
import type { PaymentStatus } from '../types';

export interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string, fallback?: string) => string;
  formatDate: (dateString: string, style?: 'short' | 'full') => string;
  formatHours: (hours: number | string | null | undefined) => string;
  formatMonthYear: (year: number, month: number) => string;
  getStatusLabel: (status: PaymentStatus | string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

/**
 * Read safely from localStorage without throwing on SSR/restricted environments.
 * Strictly adheres to allowed values: 'en' | 'ta'. Defaults to 'en'.
 */
export const getStoredLanguage = (): Language => {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'en' || saved === 'ta') {
      return saved;
    }
  } catch (err) {
    console.warn('[i18n] Failed to read language from localStorage:', err);
  }
  return DEFAULT_LANGUAGE;
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => getStoredLanguage());

  const setLanguage = useCallback((newLang: Language) => {
    if (newLang !== 'en' && newLang !== 'ta') {
      newLang = 'en';
    }
    setLanguageState(newLang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
      document.documentElement.lang = newLang;
    } catch (err) {
      console.warn('[i18n] Failed to persist language to localStorage:', err);
    }
  }, []);

  // Update HTML lang attribute on mount and change
  useEffect(() => {
    try {
      document.documentElement.lang = language;
    } catch {
      // Ignore in non-browser environments
    }
  }, [language]);

  /**
   * Safe nested key lookup with automatic English fallback and provided default fallback.
   * Never returns undefined, null, or blank string.
   */
  const t = useCallback(
    (path: string, fallback?: string): string => {
      if (!path) return fallback || '';

      const getNested = (obj: any, keys: string[]): any => {
        let current = obj;
        for (const k of keys) {
          if (!current || typeof current !== 'object') return undefined;
          current = current[k];
        }
        return current;
      };

      const keys = path.split('.');

      // 1. Try current language
      const val = getNested(translations[language], keys);
      if (typeof val === 'string' && val.trim() !== '') {
        return val;
      }

      // 2. Fall back to English
      if (language !== 'en') {
        const enVal = getNested(translations.en, keys);
        if (typeof enVal === 'string' && enVal.trim() !== '') {
          return enVal;
        }
      }

      // 3. Fall back to provided fallback or last key fragment
      if (fallback) return fallback;
      return keys[keys.length - 1] || path;
    },
    [language]
  );

  /**
   * Localized date formatter.
   * Keeps underlying date strings (YYYY-MM-DD) unchanged.
   * Formats into English: "27 Sep 2026" / "27 September 2026"
   * Formats into Tamil: "27 செப் 2026" / "27 செப்டம்பர் 2026"
   */
  const formatDate = useCallback(
    (dateString: string, style: 'short' | 'full' = 'short'): string => {
      if (!dateString) return '';
      try {
        const clean = dateString.split('T')[0];
        const parts = clean.split('-');
        if (parts.length < 3) return dateString;

        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);

        if (isNaN(year) || isNaN(month) || isNaN(day)) return dateString;

        const monthIndex = Math.max(0, Math.min(11, month - 1));
        const dayFormatted = String(day).padStart(2, '0');

        if (language === 'ta') {
          const tamilMonths = translations.ta.calendar.monthNames;
          const monthName = tamilMonths[monthIndex] || '';
          return `${dayFormatted} ${monthName} ${year}`;
        }

        const date = new Date(year, monthIndex, day);
        return new Intl.DateTimeFormat('en-IN', {
          day: '2-digit',
          month: style === 'full' ? 'long' : 'short',
          year: 'numeric',
        }).format(date);
      } catch {
        return dateString;
      }
    },
    [language]
  );

  /**
   * Localized working hours formatter.
   * Keeps the numeric value unchanged.
   * English: "6.20 hrs"
   * Tamil: "6.20 மணி"
   */
  const formatHours = useCallback(
    (hours: number | string | null | undefined): string => {
      if (hours === null || hours === undefined || hours === '') return '';
      const num = Number(hours);
      const formatted = isNaN(num) ? String(hours) : num.toFixed(2);
      const unit = language === 'ta' ? 'மணி' : 'hrs';
      return `${formatted} ${unit}`;
    },
    [language]
  );

  /**
   * Localized month + year header (e.g. "September 2026" / "செப்டம்பர் 2026")
   */
  const formatMonthYear = useCallback(
    (year: number, month: number): string => {
      const monthIndex = Math.max(0, Math.min(11, month - 1));
      const monthName = translations[language].calendar.monthNames[monthIndex] || '';
      return `${monthName} ${year}`;
    },
    [language]
  );

  /**
   * Localized payment status label.
   * Paid -> "Paid" / "செலுத்தப்பட்டது"
   * Partially Paid -> "Partially Paid" / "பகுதி செலுத்தப்பட்டது"
   * Unpaid -> "Unpaid" / "செலுத்தப்படவில்லை"
   */
  const getStatusLabel = useCallback(
    (status: PaymentStatus | string): string => {
      switch (status) {
        case 'PAID':
        case 'Paid':
          return translations[language].status.paid;
        case 'PARTIALLY_PAID':
        case 'Partially Paid':
          return translations[language].status.partiallyPaid;
        case 'UNPAID':
        case 'Unpaid':
          return translations[language].status.unpaid;
        default:
          return String(status);
      }
    },
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      formatDate,
      formatHours,
      formatMonthYear,
      getStatusLabel,
    }),
    [language, setLanguage, t, formatDate, formatHours, formatMonthYear, getStatusLabel]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within a LanguageProvider');
  }
  return context;
};

// Convenient alias
export const useTranslation = useI18n;
