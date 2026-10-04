export type DbPaymentStatus = 'Paid' | 'Partially Paid' | 'Unpaid';
export type PaymentStatus = DbPaymentStatus | 'PAID' | 'PARTIALLY_PAID' | 'UNPAID';

export type PaymentMode = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE';

export interface Bill {
  id: string;
  billNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerLocation?: string;
  date: string;
  siteLocation: string;
  workDescription: string;
  startHourMeter: number;
  endHourMeter: number;
  totalHours: number;
  hourlyRate: number;
  extraCharges: number;
  discount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: PaymentStatus;
  paymentMode?: PaymentMode;
  notes?: string;
  bill_type?: 'meter' | 'loading';
  loading_details?: LoadingBillDetails | null;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  totalBills: number;
  totalBilledAmount: number;
  totalPaidAmount: number;
  outstandingBalance: number;
  createdAt: string;
}

export type CustomerStatus = 'Paid' | 'Outstanding';

export interface DerivedCustomer {
  mobile: string;
  name: string;
  totalBills: number;
  totalBilledAmount: number;
  totalPaidAmount: number;
  outstandingBalance: number;
  status: CustomerStatus;
  latestBillDate: string;
  bills: DbBill[];
}


export interface OwnerProfile {
  id: string;
  businessName: string;
  ownerName: string;
  phone: string;
  secondaryPhone?: string;
  email?: string;
  address: string;
  jcbModel: string;
  jcbRegistrationNumber: string;
  defaultHourlyRate: number;
  upiId?: string;
  upiDisplayName?: string;
  upiQrCode?: string;
  showUpiQr?: boolean;
  signature?: string;
  showSignature?: boolean;
  gstNumber?: string;
}

export interface DashboardStats {
  ownerName: string;
  businessName: string;
  jcbNumber: string;
  todayBillsCount: number;
  todayTurnover: number;
  totalOutstandingAmount: number;
  monthlyTurnover: number;
  totalHoursToday: number;
}

export interface UserProfile {
  id: string;
  username: string;
  mobile_number: string;
  email?: string;
  created_at: string;
}

// ====================================================================
// Phase 3 PostgreSQL Database Types (Supabase tables)
// ====================================================================

export interface OwnerDetails {
  id: string;
  user_id: string;
  business_name: string | null;
  owner_name: string | null;
  mobile_number: string | null;
  address: string | null;
  jcb_model: string | null;
  registration_number: string | null;
  hourly_rate: number | null;
  upi_id: string | null;
  upi_display_name?: string | null;
  upi_qr_code?: string | null;
  show_upi_qr?: boolean | null;
  signature?: string | null;
  show_signature?: boolean | null;
  gst_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface OwnerDetailsInput {
  business_name?: string | null;
  owner_name?: string | null;
  mobile_number?: string | null;
  address?: string | null;
  jcb_model?: string | null;
  registration_number?: string | null;
  hourly_rate?: number | null;
  upi_id?: string | null;
  upi_display_name?: string | null;
  upi_qr_code?: string | null;
  show_upi_qr?: boolean | null;
  signature?: string | null;
  show_signature?: boolean | null;
  gst_number?: string | null;
}

export interface LoadingTractor {
  id: string;
  name: string;
  vehicleNo?: string;
  loads: number;
}

export interface LoadingBillDetails {
  tractors: LoadingTractor[];
  totalTractorLoads: number;
  jcbLoads: number;
  totalLoads: number;
  completeLoads: number;
  tractorRate: number;
  jcbRate: number;
  tractorTotal: number;
  jcbTotal: number;
  combinedRate: number;
}

export interface DbBill {
  id: string;
  user_id: string;
  bill_number: string;
  customer_name: string;
  customer_mobile: string;
  bill_date: string;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
  payment_status: DbPaymentStatus;
  working_hours: number | null;
  previous_meter_reading?: number | null;
  current_meter_reading?: number | null;
  rate_per_hour?: number | null;
  registration_number?: string | null;
  bill_type?: 'meter' | 'loading';
  loading_details?: LoadingBillDetails | null;
  created_at: string;
}

export interface CreateBillInput {
  bill_number: string;
  customer_name: string;
  customer_mobile: string;
  bill_date?: string;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
  payment_status: DbPaymentStatus;
  working_hours?: number | null;
  previous_meter_reading?: number | null;
  current_meter_reading?: number | null;
  rate_per_hour?: number | null;
  registration_number?: string | null;
  bill_type?: 'meter' | 'loading';
  loading_details?: LoadingBillDetails | null;
}

