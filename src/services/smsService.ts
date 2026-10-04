import { registerPlugin, Capacitor } from '@capacitor/core';
import type { DbBill, Bill, OwnerDetails } from '../types';
import {
  hasReachedDailyLimit,
  incrementDailySmsCount,
  getDailySmsUsage,
} from './smsUsageService';

export interface SendSmsResult {
  success: boolean;
  mode?: 'mock' | 'production';
  message: string;
  preview?: {
    recipient: string;
    customer_name: string;
    bill_number: string;
    total_amount: string;
    paid_amount: string;
    balance_amount: string;
    payment_status: string;
    working_hours: string;
    hourly_rate?: string;
    business_name: string;
    owner_mobile?: string;
  };
  error?: string;
  errorCode?: 'PERMISSION_DENIED' | 'NO_SIM' | 'SERVICE_UNAVAILABLE' | 'SEND_FAILED' | 'DAILY_LIMIT_REACHED' | 'INVALID_MOBILE' | 'UNKNOWN';
  dailyCount?: number;
}

export interface DirectSmsPluginInterface {
  checkSmsPermission(): Promise<{ granted: boolean }>;
  requestSmsPermission(): Promise<{ granted: boolean }>;
  openAppSettings(): Promise<void>;
  sendSms(options: { phoneNumber: string; message: string }): Promise<{
    success: boolean;
    parts?: number;
    recipient?: string;
  }>;
}

export const DirectSmsPlugin = registerPlugin<DirectSmsPluginInterface>('DirectSmsPlugin');

/**
 * Checks whether Android SEND_SMS permission is granted
 */
export const checkSmsPermission = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const res = await DirectSmsPlugin.checkSmsPermission();
    return Boolean(res?.granted);
  } catch {
    return false;
  }
};

/**
 * Prompts user for Android SEND_SMS permission at runtime
 */
export const requestSmsPermission = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const res = await DirectSmsPlugin.requestSmsPermission();
    return Boolean(res?.granted);
  } catch {
    return false;
  }
};

/**
 * Opens system App Settings page to allow user to manually enable permissions
 */
export const openSmsAppSettings = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await DirectSmsPlugin.openAppSettings();
  } catch (err) {
    console.warn('[DirectSms] Failed to open app settings:', err);
  }
};

/**
 * Validates whether an Indian mobile number contains 10 local digits starting with 6, 7, 8, or 9
 */
export const isValidIndianMobile = (mobile: string | null | undefined): boolean => {
  if (!mobile || typeof mobile !== 'string') return false;
  const digits = mobile.replace(/\D/g, '');
  let local = '';
  if (digits.length === 10) {
    local = digits;
  } else if (digits.length === 12 && digits.startsWith('91')) {
    local = digits.substring(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    local = digits.substring(1);
  } else {
    return false;
  }
  return /^[6-9]\d{9}$/.test(local);
};

/**
 * Formats a mobile number into standard Indian display format (+91 98765 43210)
 */
export const formatSmsMobile = (mobile: string | null | undefined): string => {
  if (!mobile) return 'N/A';
  const digits = mobile.replace(/\D/g, '');
  let local = '';
  if (digits.length === 10) local = digits;
  else if (digits.length === 12 && digits.startsWith('91')) local = digits.substring(2);
  else if (digits.length === 11 && digits.startsWith('0')) local = digits.substring(1);
  else return mobile;

  return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
};

/**
 * Normalizes phone number to E.164 with +91 country code (avoiding duplicate +91)
 */
export const normalizeToSmsRecipient = (mobile: string): string => {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+91${digits.substring(1)}`;
  }
  return mobile.trim().startsWith('+') ? `+${digits}` : `+91${digits}`;
};

/**
 * Generates direct mobile SMS text for the bill
 * Matches the required format with owner name, owner mobile, bill no, customer,
 * working hours, hourly rate, total, paid, balance, status.
 * Supports both English and Tamil SMS formats.
 */
export const generateConceptualSmsText = (
  bill: DbBill | Bill,
  ownerDetails?: OwnerDetails | null,
  businessNameFallback: string = 'JCB Services',
  lang: 'en' | 'ta' = 'en'
): string => {
  const raw = bill as any;
  const billNumber = raw.bill_number || raw.billNumber || 'JCB-BILL';
  const customerName = (raw.customer_name || raw.customerName || 'Customer').trim();
  const totalAmount = Number(raw.total_amount ?? raw.totalAmount ?? 0);
  const paidAmount = Number(raw.paid_amount ?? raw.paidAmount ?? 0);
  const balanceAmount = Number(raw.balance_amount ?? raw.balanceAmount ?? 0);
  const paymentStatus = raw.payment_status || raw.paymentStatus || 'Unpaid';
  const workingHours = raw.working_hours ?? raw.totalHours;

  const businessName = (ownerDetails?.business_name || businessNameFallback || 'JCB Services').toUpperCase();
  const ownerMobile = (ownerDetails?.mobile_number || '').trim();

  // Actual hourly rate used for this bill
  const hourlyRateNum = raw.rate_per_hour != null
    ? Number(raw.rate_per_hour)
    : (raw.hourly_rate != null
        ? Number(raw.hourly_rate)
        : (raw.hourlyRate != null
            ? Number(raw.hourlyRate)
            : (ownerDetails?.hourly_rate != null ? Number(ownerDetails.hourly_rate) : null)));

  const parsedHours = workingHours != null ? Number(workingHours) : 0;

  const isLoadingBill = raw.bill_type === 'loading' || Boolean(raw.loading_details);
  const loadingDetails = raw.loading_details;
  const totalLoads = loadingDetails?.totalTractorLoads ?? (loadingDetails?.totalLoads ?? (raw.working_hours != null ? Number(raw.working_hours) : 0));
  const tractorRate = loadingDetails?.tractorRate ?? 300;
  const jcbRate = loadingDetails?.jcbRate ?? 200;
  const combinedRate = loadingDetails?.combinedRate ?? (tractorRate + jcbRate);

  const ownerName = (ownerDetails?.owner_name || '').trim();

  // 1. TAMIL SMS FORMAT
  if (lang === 'ta') {
    const totalStr = `₹${Math.round(totalAmount).toLocaleString('en-IN')}`;
    const paidStr = `₹${Math.round(paidAmount).toLocaleString('en-IN')}`;
    const balanceStr = `₹${Math.round(balanceAmount).toLocaleString('en-IN')}`;

    let tamilStatus = 'செலுத்தப்படவில்லை';
    const statusUpper = String(paymentStatus).toUpperCase();
    if (statusUpper.includes('PAID') && !statusUpper.includes('PARTIAL') && !statusUpper.includes('UN')) {
      tamilStatus = 'செலுத்தப்பட்டது';
    } else if (statusUpper.includes('PARTIAL')) {
      tamilStatus = 'பகுதி செலுத்தப்பட்டது';
    }

    const tamilHeader = [
      businessName,
      ownerName ? `உரிமையாளர்: ${ownerName}` : '',
      ownerMobile ? `மொபைல்: ${ownerMobile}` : '',
    ].filter(Boolean).join('\n');

    if (isLoadingBill) {
      return `${tamilHeader}

ஏற்றுதல் பில்: ${billNumber}
வாடிக்கையாளர்: ${customerName}

மொத்த லோடு: ${totalLoads}
ஒரு லோடு: ₹${combinedRate}

மொத்த தொகை: ${totalStr}
செலுத்திய தொகை: ${paidStr}
நிலுவை தொகை: ${balanceStr}
கட்டண நிலை: ${tamilStatus}

நன்றி!`;
    }

    const hoursStr = parsedHours > 0 ? `${Number(parsedHours).toFixed(2)} மணி` : '-';
    const rateStr = hourlyRateNum != null
      ? `₹${Number(hourlyRateNum).toLocaleString('en-IN')}/மணி`
      : '₹1200/மணி';

    const ownerMobileLine = ownerMobile ? `\n\nஉரிமையாளர் மொபைல்: ${ownerMobile}` : '';

    return `${businessName}${ownerMobileLine}

JCB பில்: ${billNumber}
வாடிக்கையாளர்: ${customerName}

பணி நேரம்: ${hoursStr}
மணி நேரக் கட்டணம்: ${rateStr}

மொத்த தொகை: ${totalStr}
செலுத்திய தொகை: ${paidStr}
செலுத்த வேண்டிய தொகை: ${balanceStr}

கட்டண நிலை: ${tamilStatus}

நன்றி.`;
  }

  // 2. ENGLISH SMS FORMAT (DEFAULT)
  const totalStr = `₹${Math.round(totalAmount).toLocaleString('en-IN')}`;
  const paidStr = `₹${Math.round(paidAmount).toLocaleString('en-IN')}`;
  const balanceStr = `₹${Math.round(balanceAmount).toLocaleString('en-IN')}`;

  const englishHeader = [
    businessName,
    ownerName ? `Owner: ${ownerName}` : '',
    ownerMobile ? `Mobile: ${ownerMobile}` : '',
  ].filter(Boolean).join('\n');

  if (isLoadingBill) {
    return `${englishHeader}

Loading Bill: ${billNumber}
Customer: ${customerName}

Total Loads: ${totalLoads}
Rate: ₹${combinedRate} / Load

Total Amount: ${totalStr}
Paid Amount: ${paidStr}
Balance Amount: ${balanceStr}
Payment Status: ${paymentStatus}

Thank you for your business!`;
  }

  const hoursStr = parsedHours > 0 ? `${parsedHours} hrs` : '-';

  const rateStr = hourlyRateNum != null
    ? `Rs.${Number(hourlyRateNum).toLocaleString('en-IN')}/hr`
    : 'Rs.1,200/hr';

  const ownerMobileLine = ownerMobile ? `\nOwner Mobile: ${ownerMobile}` : '';

  return `${businessName}${ownerMobileLine}

JCB Bill: ${billNumber}
Customer: ${customerName}

Working Hours: ${hoursStr}
Hourly Rate: ${rateStr}

Total: ${totalStr}
Paid: ${paidStr}
Balance: ${balanceStr}
Status: ${paymentStatus}

Thank you.`;
};

/**
 * Maps native Android SMS errors to friendly user-facing messages
 */
const mapAndroidSmsError = (err: any): { message: string; errorCode: SendSmsResult['errorCode'] } => {
  const code = (err?.code || '').toUpperCase();
  const msg = (err?.message || '').toLowerCase();

  if (code === 'PERMISSION_DENIED' || msg.includes('permission')) {
    return {
      message: 'Direct SIM SMS permission is unavailable on this device.',
      errorCode: 'PERMISSION_DENIED',
    };
  }
  if (code === 'NO_SIM' || msg.includes('sim') || msg.includes('no active sim')) {
    return {
      message: 'No active SIM card was detected.',
      errorCode: 'NO_SIM',
    };
  }
  if (code === 'SERVICE_UNAVAILABLE' || msg.includes('service') || msg.includes('no service')) {
    return {
      message: "The phone's SMS service is currently unavailable.",
      errorCode: 'SERVICE_UNAVAILABLE',
    };
  }
  if (code === 'SEND_FAILED' || msg.includes('failed') || msg.includes('network')) {
    return {
      message: 'SMS could not be sent. Please check your SIM network and SMS balance.',
      errorCode: 'SEND_FAILED',
    };
  }

  return {
    message: 'SMS could not be sent. Please try again.',
    errorCode: 'UNKNOWN',
  };
};

/**
 * Sends bill SMS directly through the physical Android phone's default SIM.
 * Operates 100% offline without requiring internet, MSG91, or Supabase Edge Functions.
 */
export const sendBillSms = async (
  bill: DbBill | Bill,
  ownerDetails?: OwnerDetails | null,
  lang: 'en' | 'ta' = 'en'
): Promise<SendSmsResult> => {
  // 1. App-level Daily 100 SMS safety check
  if (hasReachedDailyLimit()) {
    const usage = getDailySmsUsage();
    return {
      success: false,
      message: 'Daily SMS limit reached. 100 of 100 SMS have been used today.',
      error: 'Daily SMS limit reached. 100 of 100 SMS have been used today.',
      errorCode: 'DAILY_LIMIT_REACHED',
      dailyCount: usage.sentCount,
    };
  }

  // 2. Extract and validate customer mobile
  const raw = bill as any;
  const customerMobile = (raw.customer_mobile || raw.customerPhone || '').trim();
  const customerName = (raw.customer_name || raw.customerName || 'Customer').trim();
  const billNumber = raw.bill_number || raw.billNumber || 'JCB-BILL';
  const businessName = ownerDetails?.business_name || 'JCB Services';

  if (!isValidIndianMobile(customerMobile)) {
    return {
      success: false,
      message: 'A valid 10-digit Indian mobile number is required to send SMS.',
      error: 'Invalid customer mobile number.',
      errorCode: 'INVALID_MOBILE',
    };
  }

  const normalizedPhone = normalizeToSmsRecipient(customerMobile);
  const smsMessage = generateConceptualSmsText(bill, ownerDetails, businessName, lang);

  const hourlyRateNum = raw.rate_per_hour != null
    ? Number(raw.rate_per_hour)
    : (raw.hourly_rate != null
        ? Number(raw.hourly_rate)
        : (raw.hourlyRate != null
            ? Number(raw.hourlyRate)
            : (ownerDetails?.hourly_rate != null ? Number(ownerDetails.hourly_rate) : null)));
  const rateStr = hourlyRateNum != null ? `Rs.${Number(hourlyRateNum).toLocaleString('en-IN')}/hr` : 'Rs.1,200/hr';

  const isLoad = raw.bill_type === 'loading' || Boolean(raw.loading_details);
  const totalLoadsCount = raw.loading_details?.totalTractorLoads ?? (raw.loading_details?.totalLoads ?? (raw.working_hours != null ? Number(raw.working_hours) : 0));
  const tractorRate = raw.loading_details?.tractorRate ?? 300;
  const jcbRate = raw.loading_details?.jcbRate ?? 200;
  const combinedRate = raw.loading_details?.combinedRate ?? (tractorRate + jcbRate);
  const loadUnit = lang === 'ta' ? 'லோடு' : 'Loads';
  const previewHours = isLoad ? `${totalLoadsCount} ${loadUnit}` : String(raw.working_hours ?? raw.totalHours ?? 0);
  const previewRate = isLoad ? `₹${combinedRate}/${loadUnit}` : rateStr;

  // 3. Native Android Direct SIM Sending
  if (Capacitor.isNativePlatform()) {
    try {
      // Step A: Check and request permission if needed
      let hasPerm = await checkSmsPermission();
      if (!hasPerm) {
        hasPerm = await requestSmsPermission();
      }

      if (!hasPerm) {
        const permMsg = lang === 'ta'
          ? 'இந்த சாதனத்தில் நேரடி சிம் (SIM) SMS அனுமதி கிடைக்கவில்லை.'
          : 'Direct SIM SMS permission is unavailable on this device.';
        return {
          success: false,
          message: permMsg,
          error: permMsg,
          errorCode: 'PERMISSION_DENIED',
        };
      }

      // Step B: Dispatch via native Android SmsManager
      await DirectSmsPlugin.sendSms({
        phoneNumber: normalizedPhone,
        message: smsMessage,
      });

      // Step C: Increment daily counter ONLY upon confirmed success
      const newUsage = incrementDailySmsCount();

      return {
        success: true,
        mode: 'production',
        message: `Bill ${billNumber} was sent to ${customerName}.`,
        preview: {
          recipient: normalizedPhone,
          customer_name: customerName,
          bill_number: billNumber,
          total_amount: String(raw.total_amount ?? raw.totalAmount ?? 0),
          paid_amount: String(raw.paid_amount ?? raw.paidAmount ?? 0),
          balance_amount: String(raw.balance_amount ?? raw.balanceAmount ?? 0),
          payment_status: raw.payment_status || raw.paymentStatus || 'Unpaid',
          working_hours: previewHours,
          hourly_rate: previewRate,
          business_name: businessName,
          owner_mobile: ownerDetails?.mobile_number || undefined,
        },
        dailyCount: newUsage.sentCount,
      };
    } catch (err: any) {
      console.warn('[DirectSms] Native SMS send failed:', err);
      const mapped = mapAndroidSmsError(err);
      return {
        success: false,
        message: mapped.message,
        error: mapped.message,
        errorCode: mapped.errorCode,
        dailyCount: getDailySmsUsage().sentCount,
      };
    }
  }

  // 4. Web Browser Simulation (for development / debugging in browser)
  console.log('[DirectSms:Mock] Direct SMS simulated for web platform:\n' + smsMessage);
  const newUsage = incrementDailySmsCount();

  return {
    success: true,
    mode: 'mock',
    message: `Bill ${billNumber} was sent to ${customerName}. (Browser Simulation)`,
    preview: {
      recipient: normalizedPhone,
      customer_name: customerName,
      bill_number: billNumber,
      total_amount: String(raw.total_amount ?? raw.totalAmount ?? 0),
      paid_amount: String(raw.paid_amount ?? raw.paidAmount ?? 0),
      balance_amount: String(raw.balance_amount ?? raw.balanceAmount ?? 0),
      payment_status: raw.payment_status || raw.paymentStatus || 'Unpaid',
      working_hours: previewHours,
      hourly_rate: previewRate,
      business_name: businessName,
      owner_mobile: ownerDetails?.mobile_number || undefined,
    },
    dailyCount: newUsage.sentCount,
  };
};
