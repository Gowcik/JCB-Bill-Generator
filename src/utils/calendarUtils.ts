import type { DbBill } from '../types';
import type { Language } from '../i18n/types';
import { getStoredLanguage } from '../i18n/I18nContext';
import { translations } from '../i18n/translations';

export interface CalendarDayInfo {
  dateString: string; // YYYY-MM-DD
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  billsCount: number;
  hasPaid: boolean;
  hasPartiallyPaid: boolean;
  hasUnpaid: boolean;
  isAllPaid: boolean;
  isAllUnpaid: boolean;
  hasOutstanding: boolean;
}

export interface MonthlyBillingSummary {
  year: number;
  month: number;
  monthName: string;
  totalBills: number;
  totalTurnover: number;
  totalCollected: number;
  totalOutstanding: number;
  totalHours: number;
}

export interface DailyBillingSummary {
  dateString: string;
  formattedDate: string;
  totalBills: number;
  totalBilled: number;
  totalPaid: number;
  totalOutstanding: number;
  totalHours: number;
  bills: DbBill[];
}

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const getMonthNames = (lang?: Language): readonly string[] => {
  const currentLang = lang || getStoredLanguage();
  return translations[currentLang].calendar.monthNames;
};

export const getWeekDays = (lang?: Language): readonly string[] => {
  const currentLang = lang || getStoredLanguage();
  return translations[currentLang].calendar.weekDays;
};

/**
 * Format a Date object into YYYY-MM-DD string without UTC timezone offset
 */
export const toDateString = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Parse YYYY-MM-DD string safely into { year, month, day }
 */
export const parseDateString = (dateStr: string): { year: number; month: number; day: number } => {
  const parts = dateStr.split('-');
  return {
    year: parseInt(parts[0], 10) || 2026,
    month: parseInt(parts[1], 10) || 1,
    day: parseInt(parts[2], 10) || 1,
  };
};

/**
 * Format YYYY-MM-DD to human friendly Indian display: e.g. "27 September 2026" / "27 செப்டம்பர் 2026"
 */
export const formatFullDate = (dateStr: string, lang?: Language): string => {
  if (!dateStr) return '';
  const { year, month, day } = parseDateString(dateStr);
  const currentLang = lang || getStoredLanguage();
  const monthNames = translations[currentLang].calendar.monthNames;
  const monthName = monthNames[month - 1] || '';
  const dayStr = String(day).padStart(2, '0');
  return `${dayStr} ${monthName} ${year}`;
};

/**
 * Format month and year: e.g. "September 2026" / "செப்டம்பர் 2026"
 */
export const formatMonthYear = (year: number, month: number, lang?: Language): string => {
  const currentLang = lang || getStoredLanguage();
  const monthNames = translations[currentLang].calendar.monthNames;
  const monthName = monthNames[month - 1] || '';
  return `${monthName} ${year}`;
};

/**
 * Get number of days in a given month/year (supports leap years dynamically)
 */
export const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month, 0).getDate();
};

/**
 * Get weekday index (0 = Sun, 6 = Sat) of the 1st day of the given month/year
 */
export const getFirstDayOfWeek = (year: number, month: number): number => {
  return new Date(year, month - 1, 1).getDay();
};

/**
 * Groups bills by their exact bill_date (YYYY-MM-DD)
 */
export const groupBillsByDate = (bills: DbBill[]): Map<string, DbBill[]> => {
  const map = new Map<string, DbBill[]>();
  for (const bill of bills) {
    const d = (bill.bill_date || '').trim();
    if (!d) continue;
    const existing = map.get(d) || [];
    existing.push(bill);
    map.set(d, existing);
  }
  return map;
};

/**
 * Calculates monthly billing summary for a specific year and month
 */
export const calculateMonthlySummary = (
  bills: DbBill[],
  year: number,
  month: number
): MonthlyBillingSummary => {
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
  const monthBills = bills.filter((b) => (b.bill_date || '').startsWith(monthPrefix));

  const totalBills = monthBills.length;
  const totalTurnover = monthBills.reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
  const totalCollected = monthBills.reduce((sum, b) => sum + Number(b.paid_amount || 0), 0);
  const totalOutstanding = monthBills.reduce((sum, b) => sum + Number(b.balance_amount || 0), 0);
  const totalHours = monthBills.reduce((sum, b) => {
    const isLoading = b.bill_type === 'loading' || Boolean(b.loading_details) || Boolean(b.bill_number?.startsWith('LOAD'));
    return sum + (!isLoading ? Number(b.working_hours || 0) : 0);
  }, 0);

  return {
    year,
    month,
    monthName: MONTH_NAMES[month - 1] || '',
    totalBills,
    totalTurnover: Math.round(totalTurnover * 100) / 100,
    totalCollected: Math.round(totalCollected * 100) / 100,
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    totalHours: Math.round(totalHours * 100) / 100,
  };
};

/**
 * Calculates daily billing summary for a specific date (YYYY-MM-DD)
 */
export const calculateDailySummary = (
  bills: DbBill[],
  dateString: string
): DailyBillingSummary => {
  const dayBills = bills.filter((b) => b.bill_date === dateString);

  // Sort newest created bill first
  const sortedBills = [...dayBills].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const totalBills = sortedBills.length;
  const totalBilled = sortedBills.reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
  const totalPaid = sortedBills.reduce((sum, b) => sum + Number(b.paid_amount || 0), 0);
  const totalOutstanding = sortedBills.reduce((sum, b) => sum + Number(b.balance_amount || 0), 0);
  const totalHours = sortedBills.reduce((sum, b) => {
    const isLoading = b.bill_type === 'loading' || Boolean(b.loading_details) || Boolean(b.bill_number?.startsWith('LOAD'));
    return sum + (!isLoading ? Number(b.working_hours || 0) : 0);
  }, 0);

  return {
    dateString,
    formattedDate: formatFullDate(dateString),
    totalBills,
    totalBilled: Math.round(totalBilled * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    totalHours: Math.round(totalHours * 100) / 100,
    bills: sortedBills,
  };
};

/**
 * Generates the full 35-42 calendar cell array for rendering a month
 */
export const generateCalendarMonthDays = (
  year: number,
  month: number,
  billsMap: Map<string, DbBill[]>,
  todayString: string
): CalendarDayInfo[] => {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfWeek = getFirstDayOfWeek(year, month);

  const cells: CalendarDayInfo[] = [];

  // Previous month trailing days
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);

  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const dayNumber = daysInPrevMonth - i;
    const dateString = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
    const dayBills = billsMap.get(dateString) || [];

    cells.push({
      dateString,
      dayNumber,
      isCurrentMonth: false,
      isToday: dateString === todayString,
      billsCount: dayBills.length,
      hasPaid: dayBills.some((b) => b.payment_status === 'Paid'),
      hasPartiallyPaid: dayBills.some((b) => b.payment_status === 'Partially Paid'),
      hasUnpaid: dayBills.some((b) => b.payment_status === 'Unpaid'),
      isAllPaid: dayBills.length > 0 && dayBills.every((b) => b.payment_status === 'Paid'),
      isAllUnpaid: dayBills.length > 0 && dayBills.every((b) => b.payment_status === 'Unpaid'),
      hasOutstanding: dayBills.some((b) => Number(b.balance_amount || 0) > 0),
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateString = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayBills = billsMap.get(dateString) || [];

    cells.push({
      dateString,
      dayNumber: d,
      isCurrentMonth: true,
      isToday: dateString === todayString,
      billsCount: dayBills.length,
      hasPaid: dayBills.some((b) => b.payment_status === 'Paid'),
      hasPartiallyPaid: dayBills.some((b) => b.payment_status === 'Partially Paid'),
      hasUnpaid: dayBills.some((b) => b.payment_status === 'Unpaid'),
      isAllPaid: dayBills.length > 0 && dayBills.every((b) => b.payment_status === 'Paid'),
      isAllUnpaid: dayBills.length > 0 && dayBills.every((b) => b.payment_status === 'Unpaid'),
      hasOutstanding: dayBills.some((b) => Number(b.balance_amount || 0) > 0),
    });
  }

  // Next month leading days to complete the week grid
  const remainingCells = (7 - (cells.length % 7)) % 7;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  for (let d = 1; d <= remainingCells; d++) {
    const dateString = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayBills = billsMap.get(dateString) || [];

    cells.push({
      dateString,
      dayNumber: d,
      isCurrentMonth: false,
      isToday: dateString === todayString,
      billsCount: dayBills.length,
      hasPaid: dayBills.some((b) => b.payment_status === 'Paid'),
      hasPartiallyPaid: dayBills.some((b) => b.payment_status === 'Partially Paid'),
      hasUnpaid: dayBills.some((b) => b.payment_status === 'Unpaid'),
      isAllPaid: dayBills.length > 0 && dayBills.every((b) => b.payment_status === 'Paid'),
      isAllUnpaid: dayBills.length > 0 && dayBills.every((b) => b.payment_status === 'Unpaid'),
      hasOutstanding: dayBills.some((b) => Number(b.balance_amount || 0) > 0),
    });
  }

  return cells;
};
