import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/layout/AppLayout';
import { useAuth } from '../../hooks/useAuth';
import { createBill, getNextBillNumber, validateBillInput, getLatestMeterReading } from '../../services/billService';
import { PhoneInput } from '../../components/auth/PhoneInput';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatTime } from '../../utils/formatters';
import type { DbBill, DbPaymentStatus } from '../../types';
import { BillImageModal } from '../../components/bills/BillImageModal';
import { SendSmsModal } from '../../components/bills/SendSmsModal';
import { 
  User, 
  Gauge, 
  IndianRupee, 
  CreditCard, 
  Calculator, 
  CheckCircle2, 
  PlusCircle, 
  Receipt, 
  AlertCircle, 
  Calendar,
  Clock,
  FileImage,
  MessageSquare,
  MessageCircle,
  Printer,
  Download
} from 'lucide-react';
import { generateBillImage, shareToWhatsApp } from '../../services/billImageService';
import { printBill } from '../../services/printService';
import { saveBillToGallery, getGalleryButtonLabel } from '../../services/galleryService';
import { ActionButton } from '../../components/common/ActionButton';
import { Toast, type ToastMessage } from '../../components/common/Toast';
import { JCBMachineIcon } from '../../components/common/JCBMachineIcon';
import { useI18n } from '../../i18n';

export const CreateBillPage: React.FC = () => {
  const navigate = useNavigate();
  const { ownerDetails } = useAuth();
  const { language, t, formatHours, formatDate } = useI18n();

  // Temporary Bill Image Modal state
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  // Temporary Bill SMS Modal state
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  // Notification toast state
  const [toastMessage, setToastMessage] = useState<ToastMessage | null>(null);

  // Direct action loading states
  const [isWhatsAppDirect, setIsWhatsAppDirect] = useState(false);
  const [isPrintDirect, setIsPrintDirect] = useState(false);
  const [isSaveDirect, setIsSaveDirect] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleDirectWhatsApp = async () => {
    if (!createdBill) return;
    setIsWhatsAppDirect(true);
    try {
      const gen = await generateBillImage(createdBill, ownerDetails, language);
      const res = await shareToWhatsApp(gen.blob, createdBill, language, gen.dataUrl, ownerDetails);
      if (res.fallbackDownloaded) {
        showToast(language === 'ta' ? 'படம் பதிவிறக்கம் செய்யப்பட்டது! உங்கள் கேலரியிலிருந்து WhatsApp மூலம் பகிரவும்.' : 'Image downloaded! Share via WhatsApp from your device gallery.');
      } else if (res.success) {
        showToast(language === 'ta' ? 'WhatsApp திறக்கப்படுகிறது...' : 'Opening WhatsApp...');
      }
    } catch (err) {
      console.warn('[CreateBillPage] Direct WhatsApp share error:', err);
      showToast(language === 'ta' ? 'WhatsApp இல் பகிர முடியவில்லை.' : 'Unable to share bill to WhatsApp.', 'error');
    } finally {
      setIsWhatsAppDirect(false);
    }
  };

  const handleDirectPrint = async () => {
    if (!createdBill) return;
    setIsPrintDirect(true);
    try {
      const res = await printBill(createdBill, ownerDetails, language);
      if (res.fallbackNeeded) {
        showToast(language === 'ta' ? 'இந்த சாதனத்தில் அச்சிடும் வசதி இல்லை.' : 'Direct printing is not available on this device.', 'error');
      }
    } catch (err) {
      console.warn('[CreateBillPage] Direct print error:', err);
      showToast(language === 'ta' ? 'அச்சிடுதலைத் திறக்க முடியவில்லை.' : 'Unable to open printing.', 'error');
    } finally {
      setIsPrintDirect(false);
    }
  };

  const handleDirectSave = async () => {
    if (!createdBill) return;
    setIsSaveDirect(true);
    try {
      const raw = createdBill as any;
      const billNum = raw.bill_number || raw.billNumber || 'JCB-BILL';
      const gen = await generateBillImage(createdBill, ownerDetails, language);
      const res = await saveBillToGallery(gen.blob, billNum, gen.dataUrl, language);
      showToast(res.message, res.success ? 'success' : 'error');
    } catch {
      showToast(language === 'ta' ? 'கேலரியில் சேமிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.' : 'Unable to save bill image to Gallery. Please try again.', 'error');
    } finally {
      setIsSaveDirect(false);
    }
  };

  // Generated bill number & date
  const [billNumber, setBillNumber] = useState<string>('JCB-2026-0001');
  const [billDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Section 1: Customer
  const [customerName, setCustomerName] = useState<string>('');
  const [customerMobile, setCustomerMobile] = useState<string>('');

  // Section 2: Meter Readings (decimal strings)
  const [previousMeter, setPreviousMeter] = useState<string>('');
  const [currentMeter, setCurrentMeter] = useState<string>('');
  const [autoFilledPrevious, setAutoFilledPrevious] = useState<string | null>(null);
  const [isAutoFilled, setIsAutoFilled] = useState<boolean>(false);
  const [isEdited, setIsEdited] = useState<boolean>(false);

  // Section 3: Billing
  const defaultRate = ownerDetails?.hourly_rate ? Number(ownerDetails.hourly_rate) : 1200;
  const [hourlyRate, setHourlyRate] = useState<number>(defaultRate);
  const [extraCharges, setExtraCharges] = useState<string>('0');
  const [discount, setDiscount] = useState<string>('0');

  // Section 4: Payment
  const [paidAmount, setPaidAmount] = useState<string>('0');

  // Submission & UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdBill, setCreatedBill] = useState<DbBill | null>(null);

  // Update default rate when owner details load
  useEffect(() => {
    if (ownerDetails?.hourly_rate && hourlyRate === 1200) {
      setHourlyRate(Number(ownerDetails.hourly_rate));
    }
  }, [ownerDetails]);

  // Generate sequential bill number on mount
  useEffect(() => {
    let isMounted = true;
    getNextBillNumber().then((nextNum) => {
      if (isMounted) setBillNumber(nextNum);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-populate previous meter reading from the latest bill for the active JCB machine
  useEffect(() => {
    let isMounted = true;
    const regNumber = ownerDetails?.registration_number || null;
    getLatestMeterReading(regNumber).then((latest) => {
      if (isMounted && latest != null && !isNaN(latest) && latest > 0) {
        const valStr = String(latest);
        setPreviousMeter(valStr);
        setAutoFilledPrevious(valStr);
        setIsAutoFilled(true);
        setIsEdited(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [ownerDetails?.registration_number]);

  // Handle user edits to previous meter reading (never locked!)
  const handlePreviousMeterChange = (val: string) => {
    setPreviousMeter(val);
    if (isAutoFilled && autoFilledPrevious) {
      if (val.trim() === autoFilledPrevious.trim()) {
        setIsEdited(false);
      } else {
        setIsEdited(true);
      }
    }
  };

  // Section 2 Calculation: Working Hours = Current - Previous
  const workingHours = useMemo(() => {
    const prev = parseFloat(previousMeter);
    const curr = parseFloat(currentMeter);
    if (isNaN(prev) || isNaN(curr)) return 0;
    const diff = curr - prev;
    if (diff < 0) return 0;
    // Round to 2 decimal places to prevent floating point inaccuracies
    return Math.round(diff * 100) / 100;
  }, [previousMeter, currentMeter]);

  // Meter validation message
  const meterError = useMemo(() => {
    const prev = parseFloat(previousMeter);
    const curr = parseFloat(currentMeter);
    if (!isNaN(prev) && !isNaN(curr) && curr < prev) {
      return t('createBill.meterComparisonError');
    }
    return null;
  }, [previousMeter, currentMeter, t]);

  // Section 3 Calculation: Amounts
  const parsedExtraCharges = parseFloat(extraCharges) || 0;
  const parsedDiscount = parseFloat(discount) || 0;
  const parsedPaidAmount = parseFloat(paidAmount) || 0;

  const baseAmount = useMemo(() => {
    return Math.round(workingHours * (hourlyRate || 0));
  }, [workingHours, hourlyRate]);

  const subtotal = useMemo(() => {
    return baseAmount + Math.max(0, parsedExtraCharges);
  }, [baseAmount, parsedExtraCharges]);

  const totalAmount = useMemo(() => {
    const total = subtotal - Math.max(0, parsedDiscount);
    return Math.max(0, total);
  }, [subtotal, parsedDiscount]);

  // Section 4 Calculation: Balance & Payment Status
  const balanceAmount = useMemo(() => {
    const bal = totalAmount - Math.max(0, parsedPaidAmount);
    return Math.max(0, bal);
  }, [totalAmount, parsedPaidAmount]);

  // Automatically determine strict payment status
  const paymentStatus: DbPaymentStatus = useMemo(() => {
    if (totalAmount === 0) return 'Paid';
    if (parsedPaidAmount >= totalAmount) return 'Paid';
    if (parsedPaidAmount > 0) return 'Partially Paid';
    return 'Unpaid';
  }, [totalAmount, parsedPaidAmount]);

  // Handle Form Submission
  const handleGenerateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const prevNum = parseFloat(previousMeter);
    const currNum = parseFloat(currentMeter);

    if (!isNaN(prevNum) && !isNaN(currNum) && currNum < prevNum) {
      setErrorMessage(t('createBill.meterComparisonError'));
      return;
    }

    // Validate using billService validation
    const validation = validateBillInput({
      customer_name: customerName,
      customer_mobile: customerMobile,
      previous_meter: prevNum,
      current_meter: currNum,
      hourly_rate: hourlyRate,
      extra_charges: parsedExtraCharges,
      discount: parsedDiscount,
      paid_amount: parsedPaidAmount,
    });

    if (!validation.isValid) {
      setErrorMessage(validation.error);
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await createBill({
        bill_number: billNumber,
        customer_name: customerName,
        customer_mobile: customerMobile,
        bill_date: billDate,
        total_amount: totalAmount,
        paid_amount: parsedPaidAmount,
        balance_amount: balanceAmount,
        payment_status: paymentStatus,
        working_hours: workingHours,
        previous_meter_reading: !isNaN(prevNum) ? prevNum : null,
        current_meter_reading: !isNaN(currNum) ? currNum : null,
        rate_per_hour: hourlyRate,
        registration_number: ownerDetails?.registration_number || null,
      });

      if (error) {
        setErrorMessage(error.message);
      } else if (data) {
        setCreatedBill(data);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to save the bill. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form safely to create another bill (carries forward current meter reading!)
  const handleResetForm = async () => {
    setCustomerName('');
    setCustomerMobile('');

    // Carry forward current meter reading to previous reading for the next bill
    const lastCurrent = currentMeter;
    if (lastCurrent && !isNaN(parseFloat(lastCurrent))) {
      setPreviousMeter(lastCurrent);
      setAutoFilledPrevious(lastCurrent);
      setIsAutoFilled(true);
      setIsEdited(false);
    } else {
      setPreviousMeter('');
      setAutoFilledPrevious(null);
      setIsAutoFilled(false);
      setIsEdited(false);
    }

    setCurrentMeter('');
    setExtraCharges('0');
    setDiscount('0');
    setPaidAmount('0');
    setErrorMessage(null);
    setCreatedBill(null);

    // Keep rate from owner_details and generate new bill number
    const nextNum = await getNextBillNumber();
    setBillNumber(nextNum);
  };

  // SUCCESS CONFIRMATION VIEW
  if (createdBill) {
    return (
      <AppLayout title={t('createBill.successTitle')} subtitle={t('createBill.successSubtitle')} showBack>
        <div className="space-y-4">
          
          {/* Success Banner Card */}
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-5 text-center shadow-xs space-y-2">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-full mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 stroke-[2.2]" />
            </div>
            <h2 className="text-lg font-black text-emerald-950 dark:text-emerald-200">
              {t('createBill.successTitle')}
            </h2>
            <p className="text-xs text-emerald-800 dark:text-emerald-400">
              {language === 'ta' ? 'உங்கள் PostgreSQL தரவுத்தளத்தில் வெற்றிகரமாக சேமிக்கப்பட்டது.' : 'Recorded in your PostgreSQL database with Row Level Security.'}
            </p>
          </div>

          {/* Generated Bill Details Card */}
          <div className="bg-white dark:bg-[#151B23] rounded-2xl border border-slate-200 dark:border-[#26303D] p-5 shadow-xs space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#26303D]">
              <div>
                <span className="text-[11px] text-slate-500 dark:text-[#9CA3AF] uppercase font-bold block">{t('createBill.billNo')}</span>
                <span className="font-mono font-black text-base text-slate-900 dark:text-[#F9FAFB]">{createdBill.bill_number}</span>
              </div>
              <StatusBadge status={createdBill.payment_status} size="md" />
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-[#9CA3AF]">{t('createBill.customerName')}:</span>
                <span className="font-bold text-slate-900 dark:text-[#F9FAFB]">{createdBill.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-[#9CA3AF]">{t('createBill.customerMobile')}:</span>
                <span className="font-mono font-medium text-slate-800 dark:text-[#F9FAFB]">{createdBill.customer_mobile}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-[#9CA3AF]">{t('createBill.workingHours')}:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-[#F9FAFB]">{formatHours(createdBill.working_hours)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-[#9CA3AF]">{t('createBill.date')}:</span>
                <span className="font-medium text-slate-800 dark:text-[#F9FAFB]">{formatDate(createdBill.bill_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-[#9CA3AF]">{t('createBill.time')}:</span>
                <span className="font-medium text-slate-800 dark:text-[#F9FAFB]">{formatTime(createdBill.created_at)}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-[#26303D] space-y-2 text-xs">
              <div className="flex justify-between text-slate-800 dark:text-[#F9FAFB]">
                <span>{t('createBill.totalAmount')}:</span>
                <span className="font-mono font-bold text-sm text-slate-900 dark:text-[#F9FAFB]">{formatCurrency(createdBill.total_amount)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                <span>{t('createBill.paidAmount')}:</span>
                <span className="font-mono font-bold">{formatCurrency(createdBill.paid_amount)}</span>
              </div>
              <div className="flex justify-between text-rose-700 dark:text-rose-400 text-sm font-bold pt-1 border-t border-dashed border-slate-200 dark:border-[#26303D]">
                <span>{t('createBill.balanceDue')}:</span>
                <span className="font-mono">{formatCurrency(createdBill.balance_amount)}</span>
              </div>
            </div>

          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-2">
            {/* Quick Actions: WhatsApp & Save to Gallery */}
            <div className="grid grid-cols-2 gap-2">
              <ActionButton
                variant="whatsapp"
                onClick={handleDirectWhatsApp}
                loading={isWhatsAppDirect}
                loadingText={language === 'ta' ? 'திறக்கிறது...' : 'Opening...'}
                icon={<MessageCircle className="w-4 h-4 stroke-[2.2]" />}
              >
                {t('actions.whatsApp')}
              </ActionButton>

              <ActionButton
                variant="primary"
                onClick={handleDirectSave}
                loading={isSaveDirect}
                loadingText={language === 'ta' ? 'சேமிக்கப்படுகிறது...' : 'Saving...'}
                icon={<Download className="w-4 h-4 stroke-[2.5]" />}
              >
                {getGalleryButtonLabel(language)}
              </ActionButton>
            </div>

            {/* Quick Actions: Print Bill & View Bill Image */}
            <div className="grid grid-cols-2 gap-2">
              <ActionButton
                variant="secondary"
                size="sm"
                onClick={handleDirectPrint}
                loading={isPrintDirect}
                loadingText={language === 'ta' ? 'அச்சிடப்படுகிறது...' : 'Printing...'}
                icon={<Printer className="w-4 h-4" />}
              >
                {t('actions.printBill')}
              </ActionButton>

              <ActionButton
                variant="dark"
                size="sm"
                onClick={() => setIsImageModalOpen(true)}
                icon={<FileImage className="w-4 h-4 text-amber-400" />}
              >
                {t('actions.viewImage')}
              </ActionButton>
            </div>

            {/* Send Customer SMS */}
            <ActionButton
              variant="success"
              onClick={() => setIsSmsModalOpen(true)}
              icon={<MessageSquare className="w-4 h-4 text-emerald-100" />}
            >
              {t('actions.sendSms')}
            </ActionButton>

            <ActionButton
              variant="outline"
              onClick={() => navigate('/bill-history')}
              icon={<Receipt className="w-4 h-4 text-slate-600" />}
            >
              {t('createBill.viewInHistory')}
            </ActionButton>

            <ActionButton
              variant="primary"
              onClick={handleResetForm}
              icon={<PlusCircle className="w-4 h-4 stroke-[2.2]" />}
            >
              {t('createBill.createAnother')}
            </ActionButton>
          </div>

        </div>

        {/* Temporary Bill Image Modal */}
        <BillImageModal
          isOpen={isImageModalOpen}
          onClose={() => setIsImageModalOpen(false)}
          bill={createdBill}
          ownerDetails={ownerDetails}
        />

        {/* Send SMS Modal */}
        <SendSmsModal
          isOpen={isSmsModalOpen}
          onClose={() => setIsSmsModalOpen(false)}
          bill={createdBill}
          ownerDetails={ownerDetails}
        />

        {/* Floating Toast Notification */}
        <Toast toast={toastMessage} onClose={() => setToastMessage(null)} />
      </AppLayout>
    );
  }

  // MAIN FORM VIEW
  return (
    <AppLayout title={t('createBill.title')} subtitle={t('createBill.subtitle')} showBack>
      <form onSubmit={handleGenerateBill} className="space-y-4">
        
        {/* Bill Meta Pill */}
        <div className="bg-white dark:bg-[#151B23] rounded-xl p-3 border border-slate-200 dark:border-[#26303D] shadow-xs flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center p-0.5">
              <JCBMachineIcon width={16} height={12} />
            </div>
            <span className="text-slate-500 dark:text-[#9CA3AF] font-medium">{t('createBill.billNo')}:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-[#F9FAFB]">{billNumber}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-[#9CA3AF] font-medium">
            <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-[#6B7280]" />
            <span>{formatDate(billDate)}</span>
          </div>
        </div>

        {/* ==================================================== */}
        {/* SECTION 1 — CUSTOMER */}
        {/* ==================================================== */}
        <div className="bg-white dark:bg-[#151B23] rounded-xl p-4 border border-slate-200 dark:border-[#26303D] shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-slate-800 dark:text-[#F9FAFB] uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 dark:border-[#26303D] pb-2">
            <User className="w-4 h-4 text-amber-500" />
            <span>{t('createBill.customerSection')}</span>
          </h3>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-[#9CA3AF] mb-1">
              {t('createBill.customerName')} <span className="text-amber-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder={t('createBill.customerNamePlaceholder')}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full text-sm bg-slate-50 dark:bg-[#1C2430] border border-slate-200 dark:border-[#26303D] rounded-xl p-3 text-slate-900 dark:text-[#F9FAFB] focus:bg-white dark:focus:bg-[#151B23] focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <PhoneInput
            value={customerMobile}
            onChange={setCustomerMobile}
          />
        </div>

        {/* ==================================================== */}
        {/* SECTION 2 — JCB METER */}
        {/* ==================================================== */}
        <div className="bg-white dark:bg-[#151B23] rounded-xl p-4 border border-slate-200 dark:border-[#26303D] shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-slate-800 dark:text-[#F9FAFB] uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 dark:border-[#26303D] pb-2">
            <Gauge className="w-4 h-4 text-amber-500" />
            <span>{t('createBill.meterSection')}</span>
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-[#9CA3AF] mb-1">
                {t('createBill.prevReading')} <span className="text-amber-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="e.g. 23514.4"
                value={previousMeter}
                onChange={(e) => handlePreviousMeterChange(e.target.value)}
                className="w-full text-sm font-mono font-bold bg-slate-50 dark:bg-[#1C2430] border border-slate-200 dark:border-[#26303D] rounded-xl p-3 text-slate-900 dark:text-[#F9FAFB] focus:bg-white dark:focus:bg-[#151B23] focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              {/* Subtle Auto-filled / Edited Indicator */}
              {isAutoFilled && !isEdited && (
                <div className="flex items-center gap-1 mt-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>{t('createBill.autoFilledFromPrevious')}</span>
                </div>
              )}
              {isAutoFilled && isEdited && (
                <div className="flex items-center gap-1 mt-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <span>{t('createBill.previousReadingEdited')}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-[#9CA3AF] mb-1">
                {t('createBill.currentReading')} <span className="text-amber-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="e.g. 23520.6"
                value={currentMeter}
                onChange={(e) => setCurrentMeter(e.target.value)}
                className={`w-full text-sm font-mono font-bold bg-slate-50 dark:bg-[#1C2430] border rounded-xl p-3 text-slate-900 dark:text-[#F9FAFB] focus:bg-white dark:focus:bg-[#151B23] focus:outline-none focus:ring-2 ${
                  meterError
                    ? 'border-rose-300 dark:border-rose-800/60 focus:ring-rose-500 bg-rose-50/20 dark:bg-rose-950/20'
                    : 'border-slate-200 dark:border-[#26303D] focus:ring-amber-500'
                }`}
              />
            </div>
          </div>

          {/* Meter Error Notice */}
          {meterError && (
            <div className="flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-semibold bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 p-2.5 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{meterError}</span>
            </div>
          )}

          {/* Calculated Working Hours Banner */}
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300/80 dark:border-amber-700/50 rounded-xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-bold text-amber-950 dark:text-amber-300 uppercase tracking-wide">
                {t('createBill.workingHours')}
              </span>
            </div>
            <div className="font-mono text-xl font-black text-amber-950 dark:text-amber-300">
              {formatHours(workingHours)}
            </div>
          </div>
        </div>

        {/* ==================================================== */}
        {/* SECTION 3 — BILLING */}
        {/* ==================================================== */}
        <div className="bg-white dark:bg-[#151B23] rounded-xl p-4 border border-slate-200 dark:border-[#26303D] shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-slate-800 dark:text-[#F9FAFB] uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 dark:border-[#26303D] pb-2">
            <IndianRupee className="w-4 h-4 text-amber-500" />
            <span>{t('createBill.billingSection')}</span>
          </h3>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-[#9CA3AF] mb-1">
                {t('createBill.ratePerHour')} <span className="text-amber-500">*</span>
              </label>
              <input
                type="number"
                required
                min={0}
                placeholder="1200"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
                className="w-full text-sm font-mono font-bold bg-slate-50 dark:bg-[#1C2430] border border-slate-200 dark:border-[#26303D] rounded-lg p-2.5 text-slate-900 dark:text-[#F9FAFB] focus:bg-white dark:focus:bg-[#151B23] focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-[#9CA3AF] mb-1">
                {t('createBill.extraCharges')}
              </label>
              <input
                type="number"
                min={0}
                placeholder="0"
                value={extraCharges}
                onChange={(e) => setExtraCharges(e.target.value)}
                className="w-full text-sm font-mono font-bold bg-slate-50 dark:bg-[#1C2430] border border-slate-200 dark:border-[#26303D] rounded-lg p-2.5 text-slate-900 dark:text-[#F9FAFB] focus:bg-white dark:focus:bg-[#151B23] focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-[#9CA3AF] mb-1">
                {t('createBill.discount')}
              </label>
              <input
                type="number"
                min={0}
                placeholder="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-full text-sm font-mono font-bold bg-slate-50 dark:bg-[#1C2430] border border-slate-200 dark:border-[#26303D] rounded-lg p-2.5 text-slate-900 dark:text-[#F9FAFB] focus:bg-white dark:focus:bg-[#151B23] focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
        </div>

        {/* ==================================================== */}
        {/* SECTION 4 — PAYMENT */}
        {/* ==================================================== */}
        <div className="bg-white dark:bg-[#151B23] rounded-xl p-4 border border-slate-200 dark:border-[#26303D] shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-slate-800 dark:text-[#F9FAFB] uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 dark:border-[#26303D] pb-2">
            <CreditCard className="w-4 h-4 text-amber-500" />
            <span>{t('createBill.paymentSection')}</span>
          </h3>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-[#9CA3AF] mb-1">
              {t('createBill.paidAmount')} (₹)
            </label>
            <input
              type="number"
              min={0}
              max={totalAmount}
              placeholder="0"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              className="w-full text-base font-mono font-black bg-slate-50 dark:bg-[#1C2430] border border-slate-200 dark:border-[#26303D] rounded-xl p-3 text-slate-900 dark:text-[#F9FAFB] focus:bg-white dark:focus:bg-[#151B23] focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex items-center justify-between pt-1 text-xs">
            <span className="text-slate-500 dark:text-[#9CA3AF] font-medium">{t('createBill.paymentStatus')}:</span>
            <StatusBadge status={paymentStatus} size="sm" />
          </div>
        </div>

        {/* ==================================================== */}
        {/* SECTION 5 — LIVE BILL SUMMARY */}
        {/* ==================================================== */}
        <div className="bg-slate-900 dark:bg-[#151B23] text-white rounded-2xl p-4 shadow-md space-y-3 border border-slate-800 dark:border-[#26303D]">
          <div className="flex items-center justify-between border-b border-slate-800 dark:border-[#26303D] pb-2.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-300 dark:text-[#9CA3AF] font-bold uppercase tracking-wider">
              <Calculator className="w-4 h-4 text-amber-400" />
              <span>{t('createBill.billSummary')}</span>
            </div>
            <StatusBadge status={paymentStatus} size="sm" />
          </div>

          <div className="space-y-1.5 text-xs text-slate-300 dark:text-[#9CA3AF]">
            <div className="flex justify-between">
              <span>{t('createBill.workingHours')}:</span>
              <span className="font-mono text-white dark:text-[#F9FAFB] font-semibold">{formatHours(workingHours)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('dashboard.standardRate')}:</span>
              <span className="font-mono text-white dark:text-[#F9FAFB] font-semibold">₹{hourlyRate}/hr</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-800/80 dark:border-[#26303D]">
              <span>{t('createBill.baseAmount')}:</span>
              <span className="font-mono text-white dark:text-[#F9FAFB] font-semibold">{formatCurrency(baseAmount)}</span>
            </div>
            {parsedExtraCharges > 0 && (
              <div className="flex justify-between">
                <span>{t('createBill.extraCharges')}:</span>
                <span className="font-mono text-white dark:text-[#F9FAFB] font-semibold">+{formatCurrency(parsedExtraCharges)}</span>
              </div>
            )}
            {parsedDiscount > 0 && (
              <div className="flex justify-between text-amber-400">
                <span>{t('createBill.discount')}:</span>
                <span className="font-mono font-semibold">-{formatCurrency(parsedDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-white dark:text-[#F9FAFB] pt-2 border-t border-slate-800 dark:border-[#26303D]">
              <span className="uppercase">{t('createBill.totalAmount')}:</span>
              <span className="text-amber-400 font-mono text-base font-black">{formatCurrency(totalAmount)}</span>
            </div>
            <div className="flex justify-between text-emerald-400">
              <span>{t('createBill.paidAmount')}:</span>
              <span className="font-mono font-bold">{formatCurrency(parsedPaidAmount)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-rose-400">
              <span>{t('createBill.balanceDue')}:</span>
              <span className="font-mono text-base font-black">{formatCurrency(balanceAmount)}</span>
            </div>
          </div>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="flex items-start gap-2 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 p-3 rounded-xl text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span className="font-medium leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Generate Bill Button */}
        <div className="pt-2">
          <ActionButton
            type="submit"
            size="lg"
            variant="primary"
            loading={isSubmitting}
            loadingText={language === 'ta' ? 'பில் உருவாக்கப்படுகிறது...' : 'Generating Bill...'}
            disabled={Boolean(meterError) || workingHours <= 0 || !customerName.trim() || customerMobile.length < 10}
            icon={<PlusCircle className="w-5 h-5 stroke-[2.2]" />}
          >
            {t('createBill.generateBill')}
          </ActionButton>
        </div>

      </form>

      {/* Floating Toast Notification */}
      <Toast toast={toastMessage} onClose={() => setToastMessage(null)} />
    </AppLayout>
  );
};
