import type { DbBill, DerivedCustomer } from '../types';

/**
 * Normalizes phone strings to digit-only format for flexible searching and comparison.
 * e.g. "+91 98765 43210" -> "9876543210" (or "919876543210")
 */
export const normalizePhoneDigits = (phone: string): string => {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
};

/**
 * Matches a search query against a customer's name or mobile number.
 * Supports:
 * - Case-insensitive partial name match ("Ravi", "ravi kumar")
 * - Direct mobile string match ("+919876543210", "9876543210")
 * - Substring digit match (e.g. searching "98765" or "43210")
 */
export const matchesCustomerSearch = (customer: DerivedCustomer, query: string): boolean => {
  if (!query || !query.trim()) return true;

  const cleanQuery = query.trim().toLowerCase();
  const digitsQuery = cleanQuery.replace(/\D/g, '');

  // 1. Name match (case-insensitive)
  if (customer.name.toLowerCase().includes(cleanQuery)) {
    return true;
  }

  // 2. Direct mobile text match
  if (customer.mobile.toLowerCase().includes(cleanQuery)) {
    return true;
  }

  // 3. Digit-based search (ignoring +91 country code formatting)
  if (digitsQuery.length > 0) {
    const customerDigits = normalizePhoneDigits(customer.mobile);
    if (customerDigits.includes(digitsQuery)) {
      return true;
    }
  }

  return false;
};

/**
 * Derives unique customer profiles dynamically from PostgreSQL bills.
 * 
 * Rules:
 * 1. Groups bills by customer_mobile as the primary customer identity key.
 * 2. Uses the most recent bill's customer_name as the current display name.
 * 3. Calculates Total Bills, Total Billed, Total Paid, and Outstanding Balance.
 * 4. Assigns status: 'Paid' (balance == 0) or 'Outstanding' (balance > 0).
 * 5. Sorts customers: Outstanding first, then Paid; within each group, most recent bill first.
 */
export const deriveCustomersFromBills = (bills: DbBill[]): DerivedCustomer[] => {
  if (!bills || bills.length === 0) return [];

  // Group bills by normalized mobile key
  const customerMap = new Map<string, DbBill[]>();

  for (const bill of bills) {
    const mobileKey = (bill.customer_mobile || '').trim();
    if (!mobileKey) continue;

    const existing = customerMap.get(mobileKey) || [];
    existing.push(bill);
    customerMap.set(mobileKey, existing);
  }

  const derivedList: DerivedCustomer[] = [];

  for (const [mobile, customerBills] of customerMap.entries()) {
    // Sort customer's bills from newest to oldest
    const sortedBills = [...customerBills].sort((a, b) => {
      const dateA = new Date(a.bill_date || a.created_at).getTime();
      const dateB = new Date(b.bill_date || b.created_at).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    // Use latest available customer_name associated with this mobile number
    const latestBill = sortedBills[0];
    const customerName = latestBill.customer_name?.trim() || 'Valued Customer';

    // Calculate aggregations directly from stored bills
    const totalBills = sortedBills.length;
    const totalBilledAmount = sortedBills.reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
    const totalPaidAmount = sortedBills.reduce((sum, b) => sum + Number(b.paid_amount || 0), 0);
    const outstandingBalance = sortedBills.reduce((sum, b) => sum + Number(b.balance_amount || 0), 0);

    // Strictly two statuses: 'Paid' if 0 balance, else 'Outstanding'
    const status: 'Paid' | 'Outstanding' = outstandingBalance > 0 ? 'Outstanding' : 'Paid';

    derivedList.push({
      mobile,
      name: customerName,
      totalBills,
      totalBilledAmount: Math.round(totalBilledAmount * 100) / 100,
      totalPaidAmount: Math.round(totalPaidAmount * 100) / 100,
      outstandingBalance: Math.round(outstandingBalance * 100) / 100,
      status,
      latestBillDate: latestBill.bill_date || latestBill.created_at,
      bills: sortedBills,
    });
  }

  // Sort: Outstanding first, then Paid; within each group, most recent activity first
  derivedList.sort((a, b) => {
    // Outstanding before Paid
    if (a.outstandingBalance > 0 && b.outstandingBalance <= 0) return -1;
    if (a.outstandingBalance <= 0 && b.outstandingBalance > 0) return 1;

    // Same group: most recent bill first
    const dateA = new Date(a.latestBillDate).getTime();
    const dateB = new Date(b.latestBillDate).getTime();
    return dateB - dateA;
  });

  return derivedList;
};

/**
 * Get a single derived customer by their mobile number
 */
export const getCustomerByMobile = (
  bills: DbBill[],
  mobile: string
): DerivedCustomer | null => {
  const all = deriveCustomersFromBills(bills);
  const targetClean = (mobile || '').trim();
  const targetDigits = normalizePhoneDigits(targetClean);

  return (
    all.find(
      (c) => c.mobile === targetClean || normalizePhoneDigits(c.mobile) === targetDigits
    ) || null
  );
};
