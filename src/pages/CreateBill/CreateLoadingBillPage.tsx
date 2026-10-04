import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/layout/AppLayout';
import { useAuth } from '../../hooks/useAuth';
import { createBill, getNextBillNumber } from '../../services/billService';
import { PhoneInput } from '../../components/auth/PhoneInput';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatTime } from '../../utils/formatters';
import type { DbBill, DbPaymentStatus, LoadingTractor, LoadingBillDetails } from '../../types';
import { BillImageModal } from '../../components/bills/BillImageModal';
import { SendSmsModal } from '../../components/bills/SendSmsModal';
import {
  Truck,
  User,
  Plus,
  RotateCcw,
  Trash2,
  PlusCircle,
  Calculator,
  AlertCircle,
  Calendar,
  MessageCircle,
  MessageSquare,
  Printer,
  Download,
  FileImage,
  Receipt,
  CheckCircle2,
  Layers,
  AlertTriangle,
  CreditCard
} from 'lucide-react';
import { generateBillImage, shareToWhatsApp } from '../../services/billImageService';
import { printBill } from '../../services/printService';
import { saveBillToGallery, getGalleryButtonLabel } from '../../services/galleryService';
import { ActionButton } from '../../components/common/ActionButton';
import { Toast, type ToastMessage } from '../../components/common/Toast';
import { JCBMachineIcon } from '../../components/common/JCBMachineIcon';
import { useI18n } from '../../i18n';
import { isValidIndianMobile } from '../../services/authService';
import {
  saveLoadingSession,
  getLoadingSession,
  clearLoadingSession,
  hasUnfinishedSession,
  type LoadingSessionData,
} from '../../services/loadingSessionService';

export const CreateLoadingBillPage: React.FC = () => {
  const navigate = useNavigate();
  const { ownerDetails } = useAuth();
  const { language, t, formatDate } = useI18n();
  const isTamil = language === 'ta';

  // Floating Toast notification
  const [toastMessage, setToastMessage] = useState<ToastMessage | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Modals state
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);

  // Direct action loading states
  const [isWhatsAppDirect, setIsWhatsAppDirect] = useState(false);
  const [isPrintDirect, setIsPrintDirect] = useState(false);
  const [isSaveDirect, setIsSaveDirect] = useState(false);

  // Unfinished Session Recovery state
  const [recoverySession, setRecoverySession] = useState<LoadingSessionData | null>(null);
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
  const [isConfirmDiscardOpen, setIsConfirmDiscardOpen] = useState(false);

  // Bill metadata
  const [billNumber, setBillNumber] = useState<string>('LOAD-0001');
  const [billDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Section 1: Customer
  const [customerName, setCustomerName] = useState<string>('');
  const [customerMobile, setCustomerMobile] = useState<string>('');

  // Section 2: Tractors (Dynamic Multi-Tractor)
  const [tractors, setTractors] = useState<LoadingTractor[]>([
    { id: '1', name: 'Tractor 1', vehicleNo: '', loads: 0 },
  ]);

  // Section 3: Rates (Fully Editable Numeric Inputs with Defaults)
  const [tractorRate, setTractorRate] = useState<string>('300');
  const [jcbRate, setJcbRate] = useState<string>('200');

  // Section 4: Payment
  const [paidAmount, setPaidAmount] = useState<string>('0');

  // Submission & Result state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdBill, setCreatedBill] = useState<DbBill | null>(null);

  // Fetch next sequential LOAD- bill number
  useEffect(() => {
    let isMounted = true;
    getNextBillNumber(undefined, 'loading').then((num) => {
      if (isMounted) setBillNumber(num);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Check for unfinished session on mount
  useEffect(() => {
    if (hasUnfinishedSession()) {
      const saved = getLoadingSession();
      if (saved) {
        setRecoverySession(saved);
        setIsRecoveryModalOpen(true);
      }
    }
  }, []);

  // Parse rates safely
  const parsedTractorRate = useMemo(() => Math.max(0, parseFloat(tractorRate) || 0), [tractorRate]);
  const parsedJcbRate = useMemo(() => Math.max(0, parseFloat(jcbRate) || 0), [jcbRate]);
  const combinedRate = useMemo(() => parsedTractorRate + parsedJcbRate, [parsedTractorRate, parsedJcbRate]);

  // Auto-persist unfinished session after every action
  const triggerAutoSave = useCallback(
    (
      currentCustName: string,
      currentCustMobile: string,
      currentTractors: LoadingTractor[],
      curTractorRate: string,
      curJcbRate: string,
      curPaidAmount?: string
    ) => {
      const hasAnyWork =
        (currentCustName && currentCustName.trim().length > 0) ||
        currentTractors.some((t) => t.loads > 0) ||
        currentTractors.length > 1;

      if (hasAnyWork) {
        saveLoadingSession({
          customerName: currentCustName,
          customerMobile: currentCustMobile,
          tractors: currentTractors,
          jcbLoads: currentTractors.reduce((sum, t) => sum + (t.loads || 0), 0),
          tractorRate: parseFloat(curTractorRate) || 300,
          jcbRate: parseFloat(curJcbRate) || 200,
          paidAmount: curPaidAmount,
          lastSavedAt: new Date().toISOString(),
        });
      }
    },
    []
  );

  // Recovery Handlers
  const handleContinueSession = () => {
    if (recoverySession) {
      setCustomerName(recoverySession.customerName || '');
      setCustomerMobile(recoverySession.customerMobile || '');
      if (Array.isArray(recoverySession.tractors) && recoverySession.tractors.length > 0) {
        setTractors(recoverySession.tractors);
      }
      if (recoverySession.tractorRate != null) {
        setTractorRate(String(recoverySession.tractorRate));
      }
      if (recoverySession.jcbRate != null) {
        setJcbRate(String(recoverySession.jcbRate));
      }
      if (recoverySession.paidAmount != null) {
        setPaidAmount(recoverySession.paidAmount);
      }
      showToast(isTamil ? 'லோடு அமர்வு மீட்கப்பட்டது!' : 'Loading session restored!');
    }
    setIsRecoveryModalOpen(false);
    setRecoverySession(null);
  };

  const handleDiscardSession = () => {
    setIsRecoveryModalOpen(false);
    setIsConfirmDiscardOpen(true);
  };

  const handleConfirmDiscard = () => {
    clearLoadingSession();
    setIsConfirmDiscardOpen(false);
    setRecoverySession(null);
    setCustomerName('');
    setCustomerMobile('');
    setTractors([{ id: '1', name: 'Tractor 1', vehicleNo: '', loads: 0 }]);
    setTractorRate('300');
    setJcbRate('200');
    setPaidAmount('0');
    showToast(isTamil ? 'அமர்வு நீக்கப்பட்டு புதிய பில் தொடங்கப்பட்டது.' : 'Session discarded. Fresh bill started.');
  };

  // Tractor Actions
  const handleAddTractor = () => {
    const nextIndex = tractors.length + 1;
    const newTractor: LoadingTractor = {
      id: Date.now().toString(),
      name: `Tractor ${nextIndex}`,
      vehicleNo: '',
      loads: 0,
    };
    const updated = [...tractors, newTractor];
    setTractors(updated);
    triggerAutoSave(customerName, customerMobile, updated, tractorRate, jcbRate, paidAmount);
  };

  const handleRemoveTractor = (id: string) => {
    if (tractors.length <= 1) return;
    const updated = tractors.filter((t) => t.id !== id);
    setTractors(updated);
    triggerAutoSave(customerName, customerMobile, updated, tractorRate, jcbRate, paidAmount);
  };

  const handleTractorNameChange = (id: string, name: string) => {
    const updated = tractors.map((t) => (t.id === id ? { ...t, name } : t));
    setTractors(updated);
    triggerAutoSave(customerName, customerMobile, updated, tractorRate, jcbRate, paidAmount);
  };

  const handleTractorVehicleNoChange = (id: string, vehicleNo: string) => {
    const updated = tractors.map((t) => (t.id === id ? { ...t, vehicleNo: vehicleNo.toUpperCase() } : t));
    setTractors(updated);
    triggerAutoSave(customerName, customerMobile, updated, tractorRate, jcbRate, paidAmount);
  };

  const handleIncrementTractor = (id: string) => {
    const updated = tractors.map((t) => (t.id === id ? { ...t, loads: t.loads + 1 } : t));
    setTractors(updated);
    triggerAutoSave(customerName, customerMobile, updated, tractorRate, jcbRate, paidAmount);
  };

  const handleDecrementTractor = (id: string) => {
    const updated = tractors.map((t) => (t.id === id ? { ...t, loads: Math.max(0, t.loads - 1) } : t));
    setTractors(updated);
    triggerAutoSave(customerName, customerMobile, updated, tractorRate, jcbRate, paidAmount);
  };

  // Customer Field Handlers
  const handleCustomerNameChange = (val: string) => {
    setCustomerName(val);
    triggerAutoSave(val, customerMobile, tractors, tractorRate, jcbRate, paidAmount);
  };

  const handleCustomerMobileChange = (val: string) => {
    setCustomerMobile(val);
    triggerAutoSave(customerName, val, tractors, tractorRate, jcbRate, paidAmount);
  };

  // ====================================================================
  // Live Calculation Matrix
  // 1 Tractor Load = 1 Complete Loading Operation
  // JCB load count is strictly and AUTOMATICALLY equal to total tractor loads.
  // ====================================================================
  const totalTractorLoads = useMemo(() => {
    return tractors.reduce((sum, t) => sum + (t.loads || 0), 0);
  }, [tractors]);

  // JCB Loads is AUTOMATICALLY equal to Total Tractor Loads
  const jcbLoads = totalTractorLoads;
  const totalLoads = totalTractorLoads;

  const tractorTotal = useMemo(() => {
    return totalTractorLoads * parsedTractorRate;
  }, [totalTractorLoads, parsedTractorRate]);

  const jcbTotal = useMemo(() => {
    return jcbLoads * parsedJcbRate;
  }, [jcbLoads, parsedJcbRate]);

  // Complete Loads is strictly totalLoads
  const completeLoads = totalLoads;

  const totalAmount = useMemo(() => {
    return tractorTotal + jcbTotal;
  }, [tractorTotal, jcbTotal]);

  const parsedPaidAmount = parseFloat(paidAmount) || 0;

  const balanceAmount = useMemo(() => {
    return Math.max(0, totalAmount - Math.max(0, parsedPaidAmount));
  }, [totalAmount, parsedPaidAmount]);

  const paymentStatus: DbPaymentStatus = useMemo(() => {
    if (totalAmount === 0) return 'Paid';
    if (parsedPaidAmount >= totalAmount) return 'Paid';
    if (parsedPaidAmount > 0) return 'Partially Paid';
    return 'Unpaid';
  }, [totalAmount, parsedPaidAmount]);

  // Submission Handler
  const handleGenerateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!customerName.trim()) {
      setErrorMessage(isTamil ? 'வாடிக்கையாளர் பெயரை உள்ளிடவும்.' : 'Customer Name is required.');
      return;
    }

    if (!isValidIndianMobile(customerMobile)) {
      setErrorMessage(isTamil ? 'சரியான 10-இலக்க மொபைல் எண்ணை உள்ளிடவும்.' : 'Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    if (totalTractorLoads === 0) {
      setErrorMessage(isTamil ? 'குறைந்தது 1 லோடு சேர்க்கப்பட வேண்டும்.' : 'Please record at least 1 load before generating the bill.');
      return;
    }

    if (parsedPaidAmount > totalAmount) {
      setErrorMessage(isTamil ? 'செலுத்திய தொகை மொத்த தொகையை விட அதிகமாக இருக்கக்கூடாது.' : 'Paid amount cannot exceed total bill amount.');
      return;
    }

    setIsSubmitting(true);

    try {
      const loadingDetails: LoadingBillDetails = {
        tractors,
        totalTractorLoads,
        jcbLoads,
        totalLoads,
        completeLoads,
        tractorRate: parsedTractorRate,
        jcbRate: parsedJcbRate,
        combinedRate,
        tractorTotal,
        jcbTotal,
      };

      const { data, error } = await createBill({
        bill_number: billNumber,
        customer_name: customerName.trim(),
        customer_mobile: customerMobile.trim(),
        bill_date: billDate,
        total_amount: totalAmount,
        paid_amount: parsedPaidAmount,
        balance_amount: balanceAmount,
        payment_status: paymentStatus,
        working_hours: null,
        bill_type: 'loading',
        loading_details: loadingDetails,
        registration_number: ownerDetails?.registration_number || null,
      });

      if (error) {
        setErrorMessage(error.message);
      } else if (data) {
        // Clear active session once bill is successfully saved
        clearLoadingSession();
        setCreatedBill(data);
      }
    } catch (err: any) {
      console.error('[CreateLoadingBillPage] Generation error:', err);
      setErrorMessage(err.message || 'Failed to generate bill.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset to create another loading bill
  const handleResetForm = async () => {
    setCustomerName('');
    setCustomerMobile('');
    setTractors([{ id: '1', name: 'Tractor 1', vehicleNo: '', loads: 0 }]);
    setTractorRate('300');
    setJcbRate('200');
    setPaidAmount('0');
    setErrorMessage(null);
    setCreatedBill(null);
    clearLoadingSession();

    const nextNum = await getNextBillNumber(undefined, 'loading');
    setBillNumber(nextNum);
  };

  // Direct Action Handlers (WhatsApp, Print, Save)
  const handleDirectWhatsApp = async () => {
    if (!createdBill) return;
    setIsWhatsAppDirect(true);
    try {
      const gen = await generateBillImage(createdBill, ownerDetails, language);
      const res = await shareToWhatsApp(gen.blob, createdBill, language, gen.dataUrl, ownerDetails);
      if (res.fallbackDownloaded) {
        showToast(isTamil ? 'படம் பதிவிறக்கம் செய்யப்பட்டது! WhatsApp மூலம் பகிரவும்.' : 'Image downloaded! Share via WhatsApp.');
      } else if (res.success) {
        showToast(isTamil ? 'WhatsApp திறக்கப்படுகிறது...' : 'Opening WhatsApp...');
      }
    } catch (err) {
      console.warn('[CreateLoadingBillPage] WhatsApp share error:', err);
      showToast(isTamil ? 'WhatsApp இல் பகிர முடியவில்லை.' : 'Unable to share bill to WhatsApp.', 'error');
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
        showToast(isTamil ? 'இந்த சாதனத்தில் அச்சிடும் வசதி இல்லை.' : 'Direct printing is not available on this device.', 'error');
      }
    } catch (err) {
      console.warn('[CreateLoadingBillPage] Print error:', err);
      showToast(isTamil ? 'அச்சிடுதலைத் திறக்க முடியவில்லை.' : 'Unable to open printing.', 'error');
    } finally {
      setIsPrintDirect(false);
    }
  };

  const handleDirectSave = async () => {
    if (!createdBill) return;
    setIsSaveDirect(true);
    try {
      const raw = createdBill as any;
      const billNum = raw.bill_number || raw.billNumber || 'LOAD-BILL';
      const gen = await generateBillImage(createdBill, ownerDetails, language);
      const res = await saveBillToGallery(gen.blob, billNum, gen.dataUrl, language);
      showToast(res.message, res.success ? 'success' : 'error');
    } catch {
      showToast(isTamil ? 'கேலரியில் சேமிக்க முடியவில்லை.' : 'Unable to save bill image to Gallery.', 'error');
    } finally {
      setIsSaveDirect(false);
    }
  };

  // ====================================================================
  // SUCCESS VIEW
  // ====================================================================
  if (createdBill) {
    const rawCreated = createdBill as any;
    const details: LoadingBillDetails | null = rawCreated.loading_details || null;

    return (
      <AppLayout title={t('loadingBill.successTitle')} subtitle={t('loadingBill.successSubtitle')} showBack>
        <div className="space-y-4">
          
          {/* Success Banner */}
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-5 text-center shadow-xs space-y-2">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-full mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 stroke-[2.2]" />
            </div>
            <h2 className="text-lg font-black text-emerald-950 dark:text-emerald-200">
              {t('loadingBill.successTitle')}
            </h2>
            <p className="text-xs text-emerald-800 dark:text-emerald-400">
              {isTamil ? 'உங்கள் PostgreSQL தரவுத்தளத்தில் வெற்றிகரமாக சேமிக்கப்பட்டது.' : 'Recorded in your PostgreSQL database with Row Level Security.'}
            </p>
          </div>

          {/* Bill Details Summary Card */}
          <div className="bg-white dark:bg-[#151B23] rounded-2xl border border-slate-200 dark:border-[#26303D] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#26303D]">
              <div>
                <span className="text-[11px] text-slate-500 dark:text-[#9CA3AF] uppercase font-bold block">
                  {t('loadingBill.billNo')}
                </span>
                <span className="font-mono font-black text-base text-slate-900 dark:text-[#F9FAFB]">
                  {createdBill.bill_number}
                </span>
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

              {/* Total Loads Metric */}
              <div className="flex justify-between pt-1 border-t border-slate-100 dark:border-[#26303D]">
                <span className="text-amber-600 dark:text-amber-400 font-bold">{isTamil ? 'மொத்த லோடுகள்:' : 'Total Loads:'}</span>
                <span className="font-mono font-black text-slate-900 dark:text-[#F9FAFB] text-sm">
                  {details ? (details.totalLoads ?? details.totalTractorLoads) : (createdBill.working_hours ?? 0)} {isTamil ? 'லோடு' : 'Loads'}
                </span>
              </div>

              {details && (
                <>
                  <div className="flex justify-between text-slate-600 dark:text-[#9CA3AF]">
                    <span>{isTamil ? `டிராக்டர் (₹${details.tractorRate}/லோடு):` : `Tractor (₹${details.tractorRate}/Load):`}</span>
                    <span className="font-mono font-medium">{details.totalTractorLoads} {isTamil ? 'லோடு' : 'Loads'} ({formatCurrency(details.tractorTotal)})</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-[#9CA3AF]">
                    <span>{isTamil ? `JCB (₹${details.jcbRate}/லோடு):` : `JCB (₹${details.jcbRate}/Load):`}</span>
                    <span className="font-mono font-medium">{details.jcbLoads} {isTamil ? 'லோடு' : 'Loads'} ({formatCurrency(details.jcbTotal)})</span>
                  </div>
                  <div className="flex justify-between text-slate-500 dark:text-[#9CA3AF] text-[11px] italic">
                    <span>{isTamil ? 'ஒருங்கிணைந்த கட்டணம்:' : 'Combined Rate:'}</span>
                    <span className="font-mono font-medium">₹{details.combinedRate} / {isTamil ? 'லோடு' : 'Load'}</span>
                  </div>
                </>
              )}

              <div className="flex justify-between pt-1 border-t border-slate-100 dark:border-[#26303D]">
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
                <span>{t('loadingBill.totalAmount')}:</span>
                <span className="font-mono font-bold text-sm text-slate-900 dark:text-[#F9FAFB]">{formatCurrency(createdBill.total_amount)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                <span>{t('loadingBill.paidAmount')}:</span>
                <span className="font-mono font-bold">{formatCurrency(createdBill.paid_amount)}</span>
              </div>
              <div className="flex justify-between text-rose-700 dark:text-rose-400 text-sm font-bold pt-1 border-t border-dashed border-slate-200 dark:border-[#26303D]">
                <span>{t('loadingBill.balanceDue')}:</span>
                <span className="font-mono">{formatCurrency(createdBill.balance_amount)}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <ActionButton
                variant="whatsapp"
                onClick={handleDirectWhatsApp}
                loading={isWhatsAppDirect}
                loadingText={isTamil ? 'திறக்கிறது...' : 'Opening...'}
                icon={<MessageCircle className="w-4 h-4 stroke-[2.2]" />}
              >
                {t('actions.whatsApp')}
              </ActionButton>

              <ActionButton
                variant="primary"
                onClick={handleDirectSave}
                loading={isSaveDirect}
                loadingText={isTamil ? 'சேமிக்கப்படுகிறது...' : 'Saving...'}
                icon={<Download className="w-4 h-4 stroke-[2.5]" />}
              >
                {getGalleryButtonLabel(language)}
              </ActionButton>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <ActionButton
                variant="secondary"
                size="sm"
                onClick={handleDirectPrint}
                loading={isPrintDirect}
                loadingText={isTamil ? 'அச்சிடப்படுகிறது...' : 'Printing...'}
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
              {t('loadingBill.createAnother')}
            </ActionButton>
          </div>

        </div>

        {/* Modals */}
        <BillImageModal
          isOpen={isImageModalOpen}
          onClose={() => setIsImageModalOpen(false)}
          bill={createdBill}
          ownerDetails={ownerDetails}
        />

        <SendSmsModal
          isOpen={isSmsModalOpen}
          onClose={() => setIsSmsModalOpen(false)}
          bill={createdBill}
          ownerDetails={ownerDetails}
        />

        <Toast toast={toastMessage} onClose={() => setToastMessage(null)} />
      </AppLayout>
    );
  }

  // ====================================================================
  // MAIN FORM VIEW
  // ====================================================================
  return (
    <AppLayout title={t('loadingBill.title')} subtitle={t('loadingBill.subtitle')} showBack>
      <form onSubmit={handleGenerateBill} className="space-y-4">
        
        {/* Bill Meta Pill */}
        <div className="bg-white dark:bg-[#151B23] rounded-xl p-3 border border-slate-200 dark:border-[#26303D] shadow-xs flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center p-0.5">
              <Truck className="w-4 h-4 stroke-[2.2]" />
            </div>
            <span className="text-slate-500 dark:text-[#9CA3AF] font-medium">{t('loadingBill.billNo')}:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-[#F9FAFB]">{billNumber}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-[#9CA3AF] font-medium">
            <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-[#6B7280]" />
            <span>{formatDate(billDate)}</span>
          </div>
        </div>

        {/* ==================================================== */}
        {/* SECTION 1 — CUSTOMER DETAILS */}
        {/* ==================================================== */}
        <div className="bg-white dark:bg-[#151B23] rounded-xl p-4 border border-slate-200 dark:border-[#26303D] shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-slate-800 dark:text-[#F9FAFB] uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 dark:border-[#26303D] pb-2">
            <User className="w-4 h-4 text-amber-500" />
            <span>{t('loadingBill.customerSection')}</span>
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
              onChange={(e) => handleCustomerNameChange(e.target.value)}
              className="w-full text-sm bg-slate-50 dark:bg-[#1C2430] border border-slate-200 dark:border-[#26303D] rounded-xl p-3 text-slate-900 dark:text-[#F9FAFB] focus:bg-white dark:focus:bg-[#151B23] focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <PhoneInput
            value={customerMobile}
            onChange={handleCustomerMobileChange}
          />
        </div>

        {/* ==================================================== */}
        {/* SECTION 2 — MULTI-TRACTOR LOADING COUNTERS */}
        {/* ==================================================== */}
        <div className="bg-white dark:bg-[#151B23] rounded-xl p-4 border border-slate-200 dark:border-[#26303D] shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#26303D] pb-2">
            <h3 className="text-xs font-bold text-slate-800 dark:text-[#F9FAFB] uppercase tracking-wider flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-amber-500" />
              <span>{t('loadingBill.tractorsSection')}</span>
            </h3>
            <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 rounded-lg px-2 py-1">
              <label className="text-[11px] font-bold text-amber-900 dark:text-amber-300">
                {isTamil ? 'கட்டணம்: ₹' : 'Rate: ₹'}
              </label>
              <input
                type="number"
                min="0"
                value={tractorRate}
                onFocus={() => {
                  if (tractorRate === '0') setTractorRate('');
                }}
                onBlur={() => {
                  if (!tractorRate || isNaN(parseFloat(tractorRate))) setTractorRate('300');
                }}
                onChange={(e) => {
                  const val = e.target.value.replace(/^0+(?=\d)/, '');
                  setTractorRate(val);
                  triggerAutoSave(customerName, customerMobile, tractors, val, jcbRate, paidAmount);
                }}
                className="w-14 font-mono font-black text-xs bg-white dark:bg-[#151B23] text-slate-900 dark:text-[#F9FAFB] border border-amber-300 dark:border-amber-700 rounded px-1.5 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <span className="text-[10px] font-bold text-amber-800 dark:text-amber-400">/{isTamil ? 'லோடு' : 'Load'}</span>
            </div>
          </div>

          {/* Tractors List */}
          <div className="space-y-3 pt-1">
            {tractors.map((tractor, index) => (
              <div
                key={tractor.id}
                className="bg-slate-50 dark:bg-[#1C2430] rounded-xl p-3.5 border border-slate-200/80 dark:border-[#26303D] space-y-3"
              >
                {/* Tractor Header: Name & Vehicle No */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      value={tractor.name}
                      onChange={(e) => handleTractorNameChange(tractor.id, e.target.value)}
                      placeholder={`Tractor ${index + 1}`}
                      className="font-bold text-sm text-slate-900 dark:text-[#F9FAFB] bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-amber-500 focus:outline-none py-0.5 max-w-[120px]"
                    />
                  </div>

                  <input
                    type="text"
                    value={tractor.vehicleNo || ''}
                    onChange={(e) => handleTractorVehicleNoChange(tractor.id, e.target.value)}
                    placeholder={t('loadingBill.vehicleNoPlaceholder')}
                    className="text-xs font-mono font-medium text-slate-800 dark:text-[#F9FAFB] bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#26303D] rounded-lg px-2 py-1 max-w-[140px] focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />

                  {tractors.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTractor(tractor.id)}
                      className="p-1 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
                      title="Remove tractor"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Counter Card */}
                <div className="flex items-center justify-between bg-white dark:bg-[#151B23] rounded-xl p-3 border border-slate-200 dark:border-[#26303D]">
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-[#9CA3AF] font-medium">
                      {t('loadingBill.loadsCount')}
                    </div>
                    <div className="font-mono font-black text-2xl text-slate-900 dark:text-[#F9FAFB]">
                      {tractor.loads}
                    </div>
                    <div className="text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      = ₹{(tractor.loads * parsedTractorRate).toLocaleString('en-IN')}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Undo Last Load */}
                    <button
                      type="button"
                      onClick={() => handleDecrementTractor(tractor.id)}
                      disabled={tractor.loads <= 0}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#26303D] bg-slate-100 dark:bg-[#1C2430] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-[#9CA3AF] disabled:opacity-40 disabled:pointer-events-none text-xs font-bold flex items-center gap-1 active:scale-95 transition-all"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{t('loadingBill.undoBtn')}</span>
                    </button>

                    {/* + LOAD Button */}
                    <button
                      type="button"
                      onClick={() => handleIncrementTractor(tractor.id)}
                      className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm shadow-md shadow-amber-500/20 flex items-center gap-1.5 active:scale-95 transition-all"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span>{t('loadingBill.loadBtn')}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add Tractor Button */}
          <button
            type="button"
            onClick={handleAddTractor}
            className="w-full py-2.5 rounded-xl border-2 border-dashed border-amber-400/80 dark:border-amber-500/60 bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-100/50 dark:hover:bg-amber-950/30 text-amber-700 dark:text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors active:scale-[0.99]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{t('loadingBill.addTractor')}</span>
          </button>
        </div>

        {/* ==================================================== */}
        {/* SECTION 3 — AUTOMATIC JCB LOADING COUNTER */}
        {/* ==================================================== */}
        <div className="bg-white dark:bg-[#151B23] rounded-xl p-4 border border-slate-200 dark:border-[#26303D] shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#26303D] pb-2">
            <h3 className="text-xs font-bold text-slate-800 dark:text-[#F9FAFB] uppercase tracking-wider flex items-center gap-1.5">
              <JCBMachineIcon width={18} height={14} />
              <span>{t('loadingBill.jcbSection')}</span>
            </h3>
            <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 rounded-lg px-2 py-1">
              <label className="text-[11px] font-bold text-amber-900 dark:text-amber-300">
                {isTamil ? 'கட்டணம்: ₹' : 'Rate: ₹'}
              </label>
              <input
                type="number"
                min="0"
                value={jcbRate}
                onFocus={() => {
                  if (jcbRate === '0') setJcbRate('');
                }}
                onBlur={() => {
                  if (!jcbRate || isNaN(parseFloat(jcbRate))) setJcbRate('200');
                }}
                onChange={(e) => {
                  const val = e.target.value.replace(/^0+(?=\d)/, '');
                  setJcbRate(val);
                  triggerAutoSave(customerName, customerMobile, tractors, tractorRate, val, paidAmount);
                }}
                className="w-14 font-mono font-black text-xs bg-white dark:bg-[#151B23] text-slate-900 dark:text-[#F9FAFB] border border-amber-300 dark:border-amber-700 rounded px-1.5 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <span className="text-[10px] font-bold text-amber-800 dark:text-amber-400">/{isTamil ? 'லோடு' : 'Load'}</span>
            </div>
          </div>

          <div className="flex items-center justify-between bg-slate-50 dark:bg-[#1C2430] rounded-xl p-3.5 border border-slate-200 dark:border-[#26303D]">
            <div>
              <div className="text-[11px] text-slate-500 dark:text-[#9CA3AF] font-medium flex items-center gap-1.5">
                <span>{t('loadingBill.jcbLoadsCount')}</span>
                <span className="px-1.5 py-0.2 text-[10px] font-bold rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {isTamil ? 'தானாக' : 'Automatic'}
                </span>
              </div>
              <div className="font-mono font-black text-2xl text-slate-900 dark:text-[#F9FAFB]">
                {jcbLoads}
              </div>
              <div className="text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                = ₹{(jcbLoads * parsedJcbRate).toLocaleString('en-IN')}
              </div>
            </div>

            <div className="text-right text-xs space-y-1">
              <span className="text-[11px] text-slate-500 dark:text-[#9CA3AF] block font-medium">
                {isTamil ? '1 டிராக்டர் லோடு = 1 JCB லோடு' : '1 Tractor Load = 1 JCB Load'}
              </span>
              <span className="font-mono text-xs text-slate-700 dark:text-slate-300 font-bold block">
                {jcbLoads} × ₹{parsedJcbRate}
              </span>
            </div>
          </div>
        </div>

        {/* ==================================================== */}
        {/* SECTION 4 — DYNAMIC LIVE CALCULATION & SUMMARY */}
        {/* ==================================================== */}
        <div className="bg-slate-900 dark:bg-[#151B23] text-white rounded-2xl p-4 shadow-md space-y-3 border border-slate-800 dark:border-[#26303D]">
          <div className="flex items-center justify-between border-b border-slate-800 dark:border-[#26303D] pb-2.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-300 dark:text-[#9CA3AF] font-bold uppercase tracking-wider">
              <Calculator className="w-4 h-4 text-amber-400" />
              <span>{t('loadingBill.summarySection')}</span>
            </div>
            <StatusBadge status={paymentStatus} size="sm" />
          </div>

          <div className="space-y-2 text-xs text-slate-300 dark:text-[#9CA3AF]">
            {/* Tractor Totals */}
            <div className="flex justify-between">
              <span>{isTamil ? `டிராக்டர் மொத்தம் (₹${parsedTractorRate}/லோடு):` : `Tractor Total (₹${parsedTractorRate}/Load):`}</span>
              <span className="font-mono text-white dark:text-[#F9FAFB] font-semibold">
                {totalTractorLoads} {isTamil ? 'லோடு' : 'Loads'} × ₹{parsedTractorRate} = {formatCurrency(tractorTotal)}
              </span>
            </div>

            {/* JCB Totals */}
            <div className="flex justify-between">
              <span>{isTamil ? `JCB மொத்தம் (₹${parsedJcbRate}/லோடு):` : `JCB Total (₹${parsedJcbRate}/Load):`}</span>
              <span className="font-mono text-white dark:text-[#F9FAFB] font-semibold">
                {jcbLoads} {isTamil ? 'லோடு' : 'Loads'} × ₹{parsedJcbRate} = {formatCurrency(jcbTotal)}
              </span>
            </div>

            {/* Total Loads Highlight (CRITICAL: 7 loads, NOT 14 loads) */}
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-between text-amber-300">
              <div className="flex items-center gap-1.5 font-bold">
                <Layers className="w-4 h-4 text-amber-400" />
                <span>{isTamil ? 'மொத்த லோடுகள்:' : 'Total Loads:'}</span>
              </div>
              <span className="font-mono font-black text-sm text-amber-400">
                {totalTractorLoads} {isTamil ? 'லோடு' : 'Loads'} (₹{combinedRate} / {isTamil ? 'லோடு' : 'Load'})
              </span>
            </div>

            <div className="text-[11px] text-slate-400 dark:text-[#9CA3AF] italic text-right">
              {isTamil
                ? `1 முழு லோடு = 1 டிராக்டர் (₹${parsedTractorRate}) + 1 JCB (₹${parsedJcbRate}) = ₹${combinedRate}`
                : `1 Complete Load = 1 Tractor (₹${parsedTractorRate}) + 1 JCB (₹${parsedJcbRate}) = ₹${combinedRate}`}
            </div>

            {/* Total Amount */}
            <div className="flex justify-between text-sm font-bold text-white dark:text-[#F9FAFB] pt-2 border-t border-slate-800 dark:border-[#26303D]">
              <span className="uppercase">{t('loadingBill.totalAmount')}:</span>
              <span className="text-amber-400 font-mono text-base font-black">{formatCurrency(totalAmount)}</span>
            </div>

            {/* Paid Amount */}
            <div className="flex justify-between text-emerald-400">
              <span>{t('loadingBill.paidAmount')}:</span>
              <span className="font-mono font-bold">{formatCurrency(parsedPaidAmount)}</span>
            </div>

            {/* Balance Due */}
            <div className="flex justify-between text-sm font-bold text-rose-400">
              <span>{t('loadingBill.balanceDue')}:</span>
              <span className="font-mono text-base font-black">{formatCurrency(balanceAmount)}</span>
            </div>
          </div>
        </div>

        {/* ==================================================== */}
        {/* SECTION 5 — PAYMENT SETTLEMENT */}
        {/* ==================================================== */}
        <div className="bg-white dark:bg-[#151B23] rounded-xl p-4 border border-slate-200 dark:border-[#26303D] shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-slate-800 dark:text-[#F9FAFB] uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 dark:border-[#26303D] pb-2">
            <CreditCard className="w-4 h-4 text-amber-500" />
            <span>{t('loadingBill.paymentSection')}</span>
          </h3>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-[#9CA3AF] mb-1">
              {t('loadingBill.paidAmount')} (₹)
            </label>
            <input
              type="number"
              min="0"
              max={totalAmount}
              value={paidAmount}
              onFocus={() => {
                if (paidAmount === '0') setPaidAmount('');
              }}
              onBlur={() => {
                if (paidAmount === '' || isNaN(parseFloat(paidAmount))) setPaidAmount('0');
              }}
              onChange={(e) => {
                let val = e.target.value;
                if (val === '') {
                  setPaidAmount('');
                  return;
                }
                if (/^0\d+/.test(val)) {
                  val = val.replace(/^0+/, '');
                }
                const num = parseFloat(val);
                if (!isNaN(num)) {
                  if (num < 0) {
                    setPaidAmount('0');
                  } else if (num > totalAmount) {
                    setPaidAmount(String(totalAmount));
                  } else {
                    setPaidAmount(val);
                  }
                }
              }}
              className="w-full text-base font-mono font-bold bg-slate-50 dark:bg-[#1C2430] border border-slate-200 dark:border-[#26303D] rounded-xl p-3 text-slate-900 dark:text-[#F9FAFB] focus:bg-white dark:focus:bg-[#151B23] focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Quick Pay Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setPaidAmount('0')}
              className="flex-1 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-[#26303D] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-[#9CA3AF]"
            >
              {isTamil ? 'நிலுவை (₹0)' : 'Unpaid (₹0)'}
            </button>
            <button
              type="button"
              onClick={() => setPaidAmount(String(totalAmount))}
              className="flex-1 py-1.5 text-xs font-bold rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800/60"
            >
              {isTamil ? 'முழுவதும் (Paid)' : 'Full Paid'}
            </button>
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
            loadingText={t('loadingBill.savingToDb')}
            disabled={!customerName.trim() || customerMobile.length < 10 || (totalTractorLoads === 0 && jcbLoads === 0)}
            icon={<PlusCircle className="w-5 h-5 stroke-[2.2]" />}
          >
            {t('loadingBill.generateBill')}
          </ActionButton>
        </div>

      </form>

      {/* ==================================================== */}
      {/* SESSION RECOVERY MODAL */}
      {/* ==================================================== */}
      {isRecoveryModalOpen && recoverySession && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs" />
          <div className="relative w-full max-w-sm bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#26303D] rounded-2xl p-5 shadow-2xl z-10 space-y-4 animate-in zoom-in-95 duration-200 text-slate-900 dark:text-[#F9FAFB]">
            <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto">
              <Truck className="w-6 h-6 stroke-[2.2]" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-black text-base text-slate-900 dark:text-[#F9FAFB]">
                {t('loadingBill.sessionFoundTitle')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#9CA3AF] leading-relaxed">
                {t('loadingBill.sessionFoundDesc')}
              </p>
            </div>

            {/* Session snapshot details */}
            <div className="bg-slate-50 dark:bg-[#1C2430] rounded-xl p-3 text-xs space-y-1.5 border border-slate-200/70 dark:border-[#26303D]">
              {recoverySession.customerName && (
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-[#9CA3AF]">{t('createBill.customerName')}:</span>
                  <span className="font-bold">{recoverySession.customerName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-[#9CA3AF]">{t('loadingBill.totalTractorLoads')}:</span>
                <span className="font-mono font-bold">
                  {(recoverySession.tractors || []).reduce((s, t) => s + (t.loads || 0), 0)} {isTamil ? 'லோடு' : 'Loads'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-[#9CA3AF]">{t('loadingBill.jcbLoadsCount')}:</span>
                <span className="font-mono font-bold">
                  {(recoverySession.tractors || []).reduce((s, t) => s + (t.loads || 0), 0)} {isTamil ? 'லோடு (தானாக)' : 'Loads (Auto)'}
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>{isTamil ? 'கட்டணங்கள்:' : 'Rates:'}</span>
                <span className="font-mono">
                  {isTamil ? 'டிராக்டர்' : 'Tractor'}: ₹{recoverySession.tractorRate ?? 300} | JCB: ₹{recoverySession.jcbRate ?? 200}
                </span>
              </div>
              {recoverySession.lastSavedAt && (
                <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-200 dark:border-[#26303D]">
                  <span>{isTamil ? 'சேமிக்கப்பட்ட நேரம்' : 'Saved at'}:</span>
                  <span>{formatTime(recoverySession.lastSavedAt)}</span>
                </div>
              )}
            </div>

            <div className="space-y-2 pt-1">
              <ActionButton
                variant="primary"
                onClick={handleContinueSession}
                icon={<CheckCircle2 className="w-4 h-4 stroke-[2.5]" />}
              >
                {t('loadingBill.continueSession')}
              </ActionButton>

              <button
                type="button"
                onClick={handleDiscardSession}
                className="w-full py-2.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors"
              >
                {t('loadingBill.discardSession')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* CONFIRM DISCARD MODAL */}
      {/* ==================================================== */}
      {isConfirmDiscardOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs" onClick={() => setIsConfirmDiscardOpen(false)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#26303D] rounded-2xl p-5 shadow-2xl z-10 space-y-4 animate-in zoom-in-95 duration-200 text-slate-900 dark:text-[#F9FAFB]">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-black text-base text-slate-900 dark:text-[#F9FAFB]">
                {t('loadingBill.confirmDiscardTitle')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#9CA3AF] leading-relaxed">
                {t('loadingBill.confirmDiscardDesc')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <ActionButton
                variant="secondary"
                size="sm"
                onClick={() => setIsConfirmDiscardOpen(false)}
              >
                {t('common.cancel')}
              </ActionButton>
              <ActionButton
                variant="outline"
                size="sm"
                onClick={handleConfirmDiscard}
                className="text-rose-600 border-rose-200 dark:border-rose-900/60 dark:hover:bg-rose-950/30 hover:bg-rose-50 font-bold"
              >
                {t('common.delete')}
              </ActionButton>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      <Toast toast={toastMessage} onClose={() => setToastMessage(null)} />
    </AppLayout>
  );
};

export default CreateLoadingBillPage;
