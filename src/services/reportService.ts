import type { DbBill } from '../types';
import { toDateString, parseDateString, MONTH_NAMES, getDaysInMonth } from '../utils/calendarUtils';

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface ReportKPIs {
  totalBills: number;
  totalTurnover: number;
  totalCollected: number;
  totalOutstanding: number;
  totalHours: number;
  collectionRate: number; // 0 to 100
  paidCount: number;
  paidAmount: number;
  partiallyPaidCount: number;
  partiallyPaidAmount: number;
  unpaidCount: number;
  unpaidAmount: number;
}

export interface TrendBarPoint {
  label: string;
  subLabel?: string;
  turnover: number;
  collected: number;
  outstanding: number;
  percentage: number; // 0 to 100 for bar height relative to max in series
}

export interface TopCustomerRanking {
  mobile: string;
  name: string;
  billsCount: number;
  totalBilled: number;
  outstanding: number;
}

/**
 * Returns Monday (start of week) for a given Date
 */
export const getMondayOfWeek = (date: Date): Date => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
};

/**
 * Returns Sunday (end of week) for a given Monday Date
 */
export const getSundayOfWeek = (monday: Date): Date => {
  const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
  d.setDate(d.getDate() + 6);
  return d;
};

/**
 * Filter bills belonging to a given period
 */
export const filterBillsByPeriod = (
  bills: DbBill[],
  period: ReportPeriod,
  refDate: Date,
  customRange?: { start: string; end: string }
): {
  filteredBills: DbBill[];
  periodLabel: string;
  dateRange: { start: string; end: string };
} => {
  if (period === 'custom') {
    const startStr = customRange?.start || toDateString(refDate);
    const endStr = customRange?.end || toDateString(refDate);

    const mStart = parseDateString(startStr);
    const mEnd = parseDateString(endStr);
    const sMonth = MONTH_NAMES[mStart.month - 1]?.slice(0, 3) || '';
    const eMonth = MONTH_NAMES[mEnd.month - 1]?.slice(0, 3) || '';
    const periodLabel = `${String(mStart.day).padStart(2, '0')} ${sMonth} ${mStart.year} – ${String(mEnd.day).padStart(2, '0')} ${eMonth} ${mEnd.year}`;

    const filtered = bills.filter(
      (b) => b.bill_date >= startStr && b.bill_date <= endStr
    );
    return {
      filteredBills: filtered,
      periodLabel,
      dateRange: { start: startStr, end: endStr },
    };
  }

  if (period === 'daily') {
    const dateStr = toDateString(refDate);
    const { year, month, day } = parseDateString(dateStr);
    const monthName = MONTH_NAMES[month - 1] || '';
    const periodLabel = `${day} ${monthName} ${year}`;

    const filtered = bills.filter((b) => b.bill_date === dateStr);
    return {
      filteredBills: filtered,
      periodLabel,
      dateRange: { start: dateStr, end: dateStr },
    };
  }

  if (period === 'weekly') {
    const monday = getMondayOfWeek(refDate);
    const sunday = getSundayOfWeek(monday);
    const startStr = toDateString(monday);
    const endStr = toDateString(sunday);

    const mStart = parseDateString(startStr);
    const mEnd = parseDateString(endStr);
    const startLabel = `${mStart.day} ${MONTH_NAMES[mStart.month - 1]?.slice(0, 3)}`;
    const endLabel = `${mEnd.day} ${MONTH_NAMES[mEnd.month - 1]?.slice(0, 3)} ${mEnd.year}`;
    const periodLabel = `${startLabel} – ${endLabel}`;

    const filtered = bills.filter(
      (b) => b.bill_date >= startStr && b.bill_date <= endStr
    );
    return {
      filteredBills: filtered,
      periodLabel,
      dateRange: { start: startStr, end: endStr },
    };
  }

  if (period === 'monthly') {
    const year = refDate.getFullYear();
    const month = refDate.getMonth() + 1;
    const daysInMonth = getDaysInMonth(year, month);

    const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    const periodLabel = `${MONTH_NAMES[month - 1]} ${year}`;

    const filtered = bills.filter(
      (b) => b.bill_date >= startStr && b.bill_date <= endStr
    );
    return {
      filteredBills: filtered,
      periodLabel,
      dateRange: { start: startStr, end: endStr },
    };
  }

  // Yearly
  const year = refDate.getFullYear();
  const startStr = `${year}-01-01`;
  const endStr = `${year}-12-31`;
  const periodLabel = `Year ${year}`;

  const filtered = bills.filter(
    (b) => b.bill_date >= startStr && b.bill_date <= endStr
  );
  return {
    filteredBills: filtered,
    periodLabel,
    dateRange: { start: startStr, end: endStr },
  };
};

/**
 * Calculates core business KPIs strictly from an array of bills
 */
export const calculateReportKPIs = (bills: DbBill[]): ReportKPIs => {
  const totalBills = bills.length;
  let totalTurnover = 0;
  let totalCollected = 0;
  let totalOutstanding = 0;
  let totalHours = 0;

  let paidCount = 0;
  let paidAmount = 0;
  let partiallyPaidCount = 0;
  let partiallyPaidAmount = 0;
  let unpaidCount = 0;
  let unpaidAmount = 0;

  for (const b of bills) {
    const total = Number(b.total_amount || 0);
    const paid = Number(b.paid_amount || 0);
    const balance = Number(b.balance_amount || 0);
    
    // BUSINESS RULE: Total Working Hours must be calculated ONLY from JCB Meter Reading bills.
    // Loading bills are completely separate and must NEVER contribute to Working Hours (0 hrs).
    const isLoadingBill = b.bill_type === 'loading' || Boolean(b.loading_details) || Boolean(b.bill_number?.startsWith('LOAD'));
    const hours = !isLoadingBill ? Number(b.working_hours || 0) : 0;

    totalTurnover += total;
    totalCollected += paid;
    totalOutstanding += balance;
    totalHours += hours;

    if (b.payment_status === 'Paid') {
      paidCount++;
      paidAmount += total;
    } else if (b.payment_status === 'Partially Paid') {
      partiallyPaidCount++;
      partiallyPaidAmount += total;
    } else {
      unpaidCount++;
      unpaidAmount += total;
    }
  }

  const collectionRate =
    totalTurnover > 0
      ? Math.min(100, Math.max(0, Math.round((totalCollected / totalTurnover) * 1000) / 10))
      : 0;

  return {
    totalBills,
    totalTurnover: Math.round(totalTurnover * 100) / 100,
    totalCollected: Math.round(totalCollected * 100) / 100,
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    totalHours: Math.round(totalHours * 100) / 100,
    collectionRate,
    paidCount,
    paidAmount: Math.round(paidAmount * 100) / 100,
    partiallyPaidCount,
    partiallyPaidAmount: Math.round(partiallyPaidAmount * 100) / 100,
    unpaidCount,
    unpaidAmount: Math.round(unpaidAmount * 100) / 100,
  };
};

/**
 * Generates trend points for the selected period
 */
export const generateTrendPoints = (
  bills: DbBill[],
  period: ReportPeriod,
  refDate: Date
): TrendBarPoint[] => {
  const points: TrendBarPoint[] = [];

  if (period === 'daily') {
    // For daily, show payment status composition (Paid, Partial, Unpaid)
    const paid = bills.filter((b) => b.payment_status === 'Paid').reduce((s, b) => s + Number(b.total_amount || 0), 0);
    const partial = bills.filter((b) => b.payment_status === 'Partially Paid').reduce((s, b) => s + Number(b.total_amount || 0), 0);
    const unpaid = bills.filter((b) => b.payment_status === 'Unpaid').reduce((s, b) => s + Number(b.total_amount || 0), 0);
    const maxVal = Math.max(1, paid, partial, unpaid);

    points.push({
      label: 'Paid',
      turnover: paid,
      collected: paid,
      outstanding: 0,
      percentage: Math.round((paid / maxVal) * 100),
    });
    points.push({
      label: 'Partial',
      turnover: partial,
      collected: bills.filter((b) => b.payment_status === 'Partially Paid').reduce((s, b) => s + Number(b.paid_amount || 0), 0),
      outstanding: bills.filter((b) => b.payment_status === 'Partially Paid').reduce((s, b) => s + Number(b.balance_amount || 0), 0),
      percentage: Math.round((partial / maxVal) * 100),
    });
    points.push({
      label: 'Unpaid',
      turnover: unpaid,
      collected: 0,
      outstanding: unpaid,
      percentage: Math.round((unpaid / maxVal) * 100),
    });
    return points;
  }

  if (period === 'weekly') {
    // Monday through Sunday (7 days)
    const monday = getMondayOfWeek(refDate);
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    for (let i = 0; i < 7; i++) {
      const current = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const dateStr = toDateString(current);
      const dayBills = bills.filter((b) => b.bill_date === dateStr);

      const turnover = dayBills.reduce((s, b) => s + Number(b.total_amount || 0), 0);
      const collected = dayBills.reduce((s, b) => s + Number(b.paid_amount || 0), 0);
      const outstanding = dayBills.reduce((s, b) => s + Number(b.balance_amount || 0), 0);

      points.push({
        label: dayNames[i],
        subLabel: `${current.getDate()}`,
        turnover,
        collected,
        outstanding,
        percentage: 0, // will compute after maxVal
      });
    }

    const maxVal = Math.max(1, ...points.map((p) => p.turnover));
    for (const p of points) {
      p.percentage = maxVal > 0 ? Math.round((p.turnover / maxVal) * 100) : 0;
    }
    return points;
  }

  if (period === 'monthly') {
    // 4 to 5 weekly buckets across the month (W1: 1-7, W2: 8-14, W3: 15-21, W4: 22-28, W5: 29-end)
    const year = refDate.getFullYear();
    const month = refDate.getMonth() + 1;
    const daysInMonth = getDaysInMonth(year, month);

    const buckets = [
      { label: 'Week 1', sub: '1-7', start: 1, end: 7 },
      { label: 'Week 2', sub: '8-14', start: 8, end: 14 },
      { label: 'Week 3', sub: '15-21', start: 15, end: 21 },
      { label: 'Week 4', sub: '22-28', start: 22, end: 28 },
      { label: 'Week 5', sub: `29-${daysInMonth}`, start: 29, end: daysInMonth },
    ];

    for (const b of buckets) {
      if (b.start > daysInMonth) continue;
      const startStr = `${year}-${String(month).padStart(2, '0')}-${String(b.start).padStart(2, '0')}`;
      const endStr = `${year}-${String(month).padStart(2, '0')}-${String(Math.min(b.end, daysInMonth)).padStart(2, '0')}`;

      const bBills = bills.filter((bill) => bill.bill_date >= startStr && bill.bill_date <= endStr);
      const turnover = bBills.reduce((s, bill) => s + Number(bill.total_amount || 0), 0);
      const collected = bBills.reduce((s, bill) => s + Number(bill.paid_amount || 0), 0);
      const outstanding = bBills.reduce((s, bill) => s + Number(bill.balance_amount || 0), 0);

      points.push({
        label: b.label,
        subLabel: b.sub,
        turnover,
        collected,
        outstanding,
        percentage: 0,
      });
    }

    const maxVal = Math.max(1, ...points.map((p) => p.turnover));
    for (const p of points) {
      p.percentage = maxVal > 0 ? Math.round((p.turnover / maxVal) * 100) : 0;
    }
    return points;
  }

  // Yearly: 12 months (Jan - Dec)
  const year = refDate.getFullYear();
  const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let m = 1; m <= 12; m++) {
    const prefix = `${year}-${String(m).padStart(2, '0')}`;
    const mBills = bills.filter((b) => (b.bill_date || '').startsWith(prefix));

    const turnover = mBills.reduce((s, b) => s + Number(b.total_amount || 0), 0);
    const collected = mBills.reduce((s, b) => s + Number(b.paid_amount || 0), 0);
    const outstanding = mBills.reduce((s, b) => s + Number(b.balance_amount || 0), 0);

    points.push({
      label: shortMonths[m - 1],
      turnover,
      collected,
      outstanding,
      percentage: 0,
    });
  }

  const maxVal = Math.max(1, ...points.map((p) => p.turnover));
  for (const p of points) {
    p.percentage = maxVal > 0 ? Math.round((p.turnover / maxVal) * 100) : 0;
  }
  return points;
};

/**
 * Calculates top customers ranked by total billed amount within the selected period's bills
 */
export const calculateTopCustomers = (bills: DbBill[], limit: number = 5): TopCustomerRanking[] => {
  if (!bills || bills.length === 0) return [];

  const map = new Map<string, DbBill[]>();

  for (const b of bills) {
    const key = (b.customer_mobile || '').trim();
    if (!key) continue;
    const existing = map.get(key) || [];
    existing.push(b);
    map.set(key, existing);
  }

  const rankings: TopCustomerRanking[] = [];

  for (const [mobile, cBills] of map.entries()) {
    // Sort bills newest first to get most recent name
    cBills.sort((a, b) => {
      const dateA = new Date(a.bill_date || a.created_at).getTime();
      const dateB = new Date(b.bill_date || b.created_at).getTime();
      return dateB - dateA;
    });

    const name = cBills[0].customer_name || 'Customer';
    const billsCount = cBills.length;
    const totalBilled = cBills.reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
    const outstanding = cBills.reduce((sum, b) => sum + Number(b.balance_amount || 0), 0);

    rankings.push({
      mobile,
      name,
      billsCount,
      totalBilled: Math.round(totalBilled * 100) / 100,
      outstanding: Math.round(outstanding * 100) / 100,
    });
  }

  // Rank by total billed descending
  rankings.sort((a, b) => b.totalBilled - a.totalBilled);

  return rankings.slice(0, limit);
};
