import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/layout/AppLayout';
import { BillCard } from '../../components/bills/BillCard';
import { mockBills } from '../../data/mockData';
import { getBills, getCachedBills, updateBillPayment, deleteBill } from '../../services/billService';
import { isSupabaseConfigured } from '../../services/supabaseClient';
import type { Bill, DbBill } from '../../types';
import { formatCurrency, formatTime } from '../../utils/formatters';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  toDateString,
  parseDateString,
  formatFullDate,
  getMonthNames,
  getWeekDays,
  groupBillsByDate,
  calculateMonthlySummary,
  calculateDailySummary,
  generateCalendarMonthDays,
  type CalendarDayInfo,
} from '../../utils/calendarUtils';
import { useAuth } from '../../hooks/useAuth';
import { BillImageModal } from '../../components/bills/BillImageModal';
import { SendSmsModal } from '../../components/bills/SendSmsModal';
import { generateBillImage, shareToWhatsApp } from '../../services/billImageService';
import { printBill } from '../../services/printService';
import { saveBillToGallery, getGalleryButtonLabel } from '../../services/galleryService';
import { useI18n } from '../../i18n';
import { useBackButton } from '../../hooks/useBackButton';
import { 
  Search, 
  Receipt, 
  X, 
  Phone, 
  Clock, 
  Trash2,
  PlusCircle,
  IndianRupee,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  Check,
  Calendar as CalendarIcon,
  ListFilter,
  ChevronLeft,
  ChevronRight,
  FileImage,
  MessageSquare,
  MessageCircle,
  Printer,
  Download,
  Truck
} from 'lucide-react';
import { ActionButton } from '../../components/common/ActionButton';
import { JCBLoader } from '../../components/common/JCBLoader';
import { Toast, type ToastMessage } from '../../components/common/Toast';
import { JCBMachineIcon } from '../../components/common/JCBMachineIcon';

export const BillHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { ownerDetails } = useAuth();
  const { language, t, formatHours, formatDate } = useI18n();

  // View Mode: 'list' or 'calendar'
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  // Search & Status Filter (List View)
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Paid' | 'Partially Paid' | 'Unpaid'>('ALL');
  
  // Data state
  const cachedBills = getCachedBills();
  const [dbBills, setDbBills] = useState<DbBill[]>(cachedBills || []);
  const [isLoading, setIsLoading] = useState(!cachedBills);

  // Calendar State (Timezone-safe device date initialization)
  const todayDateObj = useMemo(() => new Date(), []);
  const todayString = useMemo(() => toDateString(todayDateObj), [todayDateObj]);
  const [calendarYear, setCalendarYear] = useState<number>(todayDateObj.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(todayDateObj.getMonth() + 1); // 1-12
  const [selectedDate, setSelectedDate] = useState<string>(todayString);

  // Modals state
  const [selectedBill, setSelectedBill] = useState<DbBill | Bill | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);

  // Payment Form state
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Deletion state
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Android hardware back button handlers (modal/sheet dismiss stack)
  useBackButton(isPaymentModalOpen, () => {
    setIsPaymentModalOpen(false);
    setPaymentError(null);
  });
  useBackButton(isDeleteModalOpen, () => {
    setIsDeleteModalOpen(false);
    setDeleteError(null);
  });
  useBackButton(
    selectedBill !== null && !isPaymentModalOpen && !isDeleteModalOpen && !isImageModalOpen && !isSmsModalOpen,
    () => setSelectedBill(null)
  );

  // Feedback Notification state
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
    if (!selectedBill) return;
    setIsWhatsAppDirect(true);
    try {
      const gen = await generateBillImage(selectedBill, ownerDetails, language);
      const res = await shareToWhatsApp(gen.blob, selectedBill, language, gen.dataUrl, ownerDetails);
      if (res.fallbackDownloaded) {
        showToast(language === 'ta' ? 'படம் பதிவிறக்கம் செய்யப்பட்டது! உங்கள் கேலரியிலிருந்து WhatsApp மூலம் பகிரவும்.' : 'Image downloaded! Share via WhatsApp from your device gallery.');
      } else if (res.success) {
        showToast(language === 'ta' ? 'WhatsApp திறக்கப்படுகிறது...' : 'Opening WhatsApp...');
      }
    } catch {
      showToast(language === 'ta' ? 'WhatsApp இல் பகிர முடியவில்லை.' : 'Unable to share bill to WhatsApp.', 'error');
    } finally {
      setIsWhatsAppDirect(false);
    }
  };

  const handleDirectPrint = async () => {
    if (!selectedBill) return;
    setIsPrintDirect(true);
    try {
      const res = await printBill(selectedBill, ownerDetails, language);
      if (res.fallbackNeeded) {
        showToast(language === 'ta' ? 'இந்த சாதனத்தில் அச்சிடும் வசதி இல்லை.' : 'Direct printing is not available on this device. You can save or share the bill image.', 'error');
      }
    } catch {
      showToast(language === 'ta' ? 'அச்சிடுதலைத் திறக்க முடியவில்லை.' : 'Unable to open printing.', 'error');
    } finally {
      setIsPrintDirect(false);
    }
  };

  const handleDirectSave = async () => {
    if (!selectedBill) return;
    setIsSaveDirect(true);
    try {
      const raw = selectedBill as any;
      const billNum = raw.bill_number || raw.billNumber || 'JCB-BILL';
      const gen = await generateBillImage(selectedBill, ownerDetails, language);
      const res = await saveBillToGallery(gen.blob, billNum, gen.dataUrl, language);
      showToast(res.message, res.success ? 'success' : 'error');
    } catch {
      showToast(language === 'ta' ? 'கேலரியில் சேமிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.' : 'Unable to save bill image to Gallery. Please try again.', 'error');
    } finally {
      setIsSaveDirect(false);
    }
  };

  // Fetch real bills from PostgreSQL
  const loadBills = async (force: boolean = false) => {
    if (!getCachedBills() && dbBills.length === 0) {
      setIsLoading(true);
    }
    try {
      const bills = await getBills(force);
      setDbBills(bills);
    } catch (err) {
      console.warn('[BillHistoryPage] Error loading bills:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBills();
  }, []);

  // Display PostgreSQL bills for configured apps; only fallback to mock bills if Supabase is unconfigured
  const allBills: (DbBill | Bill)[] = useMemo(() => {
    if (isSupabaseConfigured) {
      return dbBills;
    }
    return dbBills.length > 0 ? dbBills : mockBills;
  }, [dbBills]);

  // Dynamic status counts based strictly on loaded PostgreSQL bills
  const statusCounts = useMemo(() => {
    const counts = {
      all: allBills.length,
      paid: 0,
      partiallyPaid: 0,
      unpaid: 0,
    };

    for (const item of allBills) {
      const raw = item as any;
      const status = raw.payment_status || raw.paymentStatus;
      if (status === 'Paid' || status === 'PAID') {
        counts.paid++;
      } else if (status === 'Partially Paid' || status === 'PARTIALLY_PAID') {
        counts.partiallyPaid++;
      } else {
        counts.unpaid++;
      }
    }

    return counts;
  }, [allBills]);

  // Filter bills by search query and payment status (List View)
  const filteredBills = useMemo(() => {
    return allBills.filter((item) => {
      const bill = item as any;
      const customerName = (bill.customer_name || bill.customerName || '').toLowerCase();
      const customerMobile = (bill.customer_mobile || bill.customerPhone || '').toLowerCase();
      const billNumber = (bill.bill_number || bill.billNumber || '').toLowerCase();

      const query = searchTerm.trim().toLowerCase();
      const matchesSearch = 
        !query ||
        customerName.includes(query) ||
        customerMobile.includes(query) ||
        billNumber.includes(query);

      const status = bill.payment_status || bill.paymentStatus;
      const normalizedStatus = 
        status === 'PAID' || status === 'Paid' ? 'Paid' :
        status === 'PARTIALLY_PAID' || status === 'Partially Paid' ? 'Partially Paid' : 'Unpaid';

      const matchesStatus = statusFilter === 'ALL' || normalizedStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [allBills, searchTerm, statusFilter]);

  // Summary totals for current filtered view
  const summary = useMemo(() => {
    return filteredBills.reduce(
      (acc, item) => {
        const bill = item as any;
        const total = Number(bill.total_amount ?? bill.totalAmount ?? 0);
        const balance = Number(bill.balance_amount ?? bill.balanceAmount ?? 0);
        const paid = Number(bill.paid_amount ?? bill.paidAmount ?? 0);

        acc.totalAmount += total;
        acc.balanceAmount += balance;
        acc.paidAmount += paid;
        return acc;
      },
      { totalAmount: 0, balanceAmount: 0, paidAmount: 0 }
    );
  }, [filteredBills]);

  // ====================================================================
  // CALENDAR AGGREGATIONS & DERIVATIONS
  // ====================================================================

  const billsMap = useMemo(() => {
    return groupBillsByDate(allBills as DbBill[]);
  }, [allBills]);

  const calendarCells = useMemo(() => {
    return generateCalendarMonthDays(calendarYear, calendarMonth, billsMap, todayString);
  }, [calendarYear, calendarMonth, billsMap, todayString]);

  const monthlySummary = useMemo(() => {
    return calculateMonthlySummary(allBills as DbBill[], calendarYear, calendarMonth);
  }, [allBills, calendarYear, calendarMonth]);

  const dailySummary = useMemo(() => {
    return calculateDailySummary(allBills as DbBill[], selectedDate);
  }, [allBills, selectedDate]);

  // Calendar Navigation Handlers
  const handlePrevMonth = () => {
    if (calendarMonth === 1) {
      setCalendarYear((y) => y - 1);
      setCalendarMonth(12);
    } else {
      setCalendarMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 12) {
      setCalendarYear((y) => y + 1);
      setCalendarMonth(1);
    } else {
      setCalendarMonth((m) => m + 1);
    }
  };

  const handlePrevYear = () => {
    setCalendarYear((y) => y - 1);
  };

  const handleNextYear = () => {
    setCalendarYear((y) => y + 1);
  };

  const handleGoToToday = () => {
    const now = new Date();
    setCalendarYear(now.getFullYear());
    setCalendarMonth(now.getMonth() + 1);
    setSelectedDate(todayString);
  };

  const handleSelectDay = (cell: CalendarDayInfo) => {
    setSelectedDate(cell.dateString);
    if (!cell.isCurrentMonth) {
      const { year, month } = parseDateString(cell.dateString);
      setCalendarYear(year);
      setCalendarMonth(month);
    }
  };

  // Helpers for selected bill (handling DbBill & Bill formats)
  const rawSelected = selectedBill as any;
  const selectedBalance = rawSelected ? Number(rawSelected.balance_amount ?? rawSelected.balanceAmount ?? 0) : 0;
  const selectedPaid = rawSelected ? Number(rawSelected.paid_amount ?? rawSelected.paidAmount ?? 0) : 0;
  const selectedTotal = rawSelected ? Number(rawSelected.total_amount ?? rawSelected.totalAmount ?? 0) : 0;
  const selectedStatus = rawSelected ? (rawSelected.payment_status || rawSelected.paymentStatus || 'Unpaid') : 'Unpaid';

  // Handle open Add Payment modal
  const handleOpenAddPayment = () => {
    setPaymentAmountInput('');
    setPaymentError(null);
    setIsPaymentModalOpen(true);
  };

  // Quick fill full balance
  const handleSetFullBalance = () => {
    setPaymentAmountInput(selectedBalance.toString());
    setPaymentError(null);
  };

  // Preview calculations for Add Payment modal
  const paymentAmountNum = parseFloat(paymentAmountInput) || 0;
  const isValidPaymentAmount = paymentAmountNum > 0 && paymentAmountNum <= selectedBalance;
  const previewNewPaid = Math.min(selectedTotal, selectedPaid + (paymentAmountNum > 0 ? paymentAmountNum : 0));
  const previewNewBalance = Math.max(0, selectedTotal - previewNewPaid);
  const previewNewStatus = previewNewBalance === 0 ? 'Paid' : 'Partially Paid';

  // Submit payment update to PostgreSQL
  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBill) return;

    if (!paymentAmountInput.trim() || isNaN(paymentAmountNum) || paymentAmountNum <= 0) {
      setPaymentError('Please enter a payment amount greater than ₹0.');
      return;
    }

    if (paymentAmountNum > selectedBalance) {
      setPaymentError(`Payment amount cannot exceed the pending balance of ₹${selectedBalance.toLocaleString('en-IN')}.`);
      return;
    }

    setPaymentError(null);
    setIsUpdatingPayment(true);

    try {
      const { data: updatedBill, error } = await updateBillPayment(selectedBill.id, paymentAmountNum);

      if (error) {
        setPaymentError(error.message);
        setIsUpdatingPayment(false);
        return;
      }

      if (updatedBill) {
        // Update local state list
        setDbBills((prev) => prev.map((b) => (b.id === updatedBill.id ? updatedBill : b)));
        // Update selectedBill so details view reflects the new payment
        setSelectedBill(updatedBill);
        setIsPaymentModalOpen(false);
        setPaymentAmountInput('');
        showToast(`Payment of ${formatCurrency(paymentAmountNum)} recorded successfully!`);
      }
    } catch (err: any) {
      setPaymentError(err.message || 'Failed to update payment.');
    } finally {
      setIsUpdatingPayment(false);
    }
  };

  // Submit bill deletion to PostgreSQL
  const handleConfirmDelete = async () => {
    if (!selectedBill) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const { error } = await deleteBill(selectedBill.id);

      if (error) {
        setDeleteError(error.message);
        setIsDeleting(false);
        return;
      }

      const deletedNumber = rawSelected.bill_number || rawSelected.billNumber || 'Bill';
      // Remove from local state
      setDbBills((prev) => prev.filter((b) => b.id !== selectedBill.id));
      setIsDeleteModalOpen(false);
      setSelectedBill(null);
      showToast(`${deletedNumber} deleted successfully.`);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete bill.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AppLayout title={t('billHistory.title')} subtitle={t('billHistory.subtitle')} showBack>
      <div className="space-y-3.5">
        
        {/* Floating Toast Feedback */}
        <Toast toast={toastMessage} onClose={() => setToastMessage(null)} />

        {/* View Switcher: List View vs Calendar View */}
        <div className="flex bg-slate-100 dark:bg-[#151B23] p-1 rounded-xl text-xs font-bold border border-slate-200/80 dark:border-[#26303D]">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${
              viewMode === 'list'
                ? 'bg-white dark:bg-[#1C2430] text-slate-900 dark:text-[#F9FAFB] shadow-xs'
                : 'text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F9FAFB]'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" />
            <span>{t('billHistory.listView')}</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('calendar')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${
              viewMode === 'calendar'
                ? 'bg-white dark:bg-[#1C2430] text-slate-900 dark:text-[#F9FAFB] shadow-xs'
                : 'text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F9FAFB]'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>{t('billHistory.calendarView')}</span>
          </button>
        </div>

        {/* ================================================================ */}
        {/* VIEW 1: LIST VIEW                                                */}
        {/* ================================================================ */}
        {viewMode === 'list' && (
          <div className="space-y-3.5">
            {/* 1. Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#9CA3AF]" />
              <input
                type="text"
                placeholder={t('billHistory.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#26303D] text-slate-900 dark:text-[#F9FAFB] rounded-xl text-sm placeholder:text-slate-400 dark:placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent shadow-xs transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-[#F9FAFB] p-0.5"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* 2. Status Filter Tabs with Dynamic Real PostgreSQL Counts */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
              {[
                { id: 'ALL', label: t('billHistory.all'), count: statusCounts.all },
                { id: 'Paid', label: t('billHistory.paid'), count: statusCounts.paid },
                { id: 'Partially Paid', label: t('billHistory.partiallyPaid'), count: statusCounts.partiallyPaid },
                { id: 'Unpaid', label: t('billHistory.unpaid'), count: statusCounts.unpaid },
              ].map((tab) => {
                const isActive = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id as any)}
                    className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 shadow-xs font-bold'
                        : 'bg-white dark:bg-[#151B23] text-slate-600 dark:text-[#9CA3AF] border border-slate-200 dark:border-[#26303D] hover:bg-slate-50 dark:hover:bg-[#1C2430]'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      isActive 
                        ? 'bg-amber-500 text-slate-950 font-bold dark:bg-slate-950 dark:text-amber-400' 
                        : 'bg-slate-100 dark:bg-[#1C2430] text-slate-600 dark:text-[#9CA3AF]'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 3. Summary Filter Banner */}
            <div className="bg-slate-900 dark:bg-[#151B23] text-white rounded-xl p-3 text-xs shadow-xs border border-transparent dark:border-[#26303D]">
              <div className="grid grid-cols-3 gap-2 divide-x divide-slate-800 dark:divide-[#26303D]">
                <div>
                  <div className="text-[11px] text-slate-400 dark:text-[#9CA3AF]">{t('calendar.bills')}</div>
                  <div className="text-sm font-bold text-white dark:text-[#F9FAFB] mt-0.5 font-mono">
                    {filteredBills.length}
                  </div>
                </div>
                <div className="pl-3">
                  <div className="text-[11px] text-emerald-400">{t('calendar.collected')}</div>
                  <div className="text-sm font-bold text-emerald-400 mt-0.5 font-mono truncate">
                    {formatCurrency(summary.paidAmount)}
                  </div>
                </div>
                <div className="pl-3 text-right">
                  <div className="text-[11px] text-rose-400">{t('calendar.outstanding')}</div>
                  <div className="text-sm font-bold text-rose-400 mt-0.5 font-mono truncate">
                    {formatCurrency(summary.balanceAmount)}
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Bills List & Empty States */}
            {isLoading ? (
              <div className="py-12 flex justify-center">
                <JCBLoader mode="card" size="md" text={t('common.loading')} />
              </div>
            ) : filteredBills.length > 0 ? (
              <div className="space-y-3">
                {filteredBills.map((bill) => (
                  <BillCard
                    key={bill.id}
                    bill={bill}
                    onClick={() => setSelectedBill(bill)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white dark:bg-[#151B23] rounded-xl border border-dashed border-slate-300 dark:border-[#26303D] p-6 space-y-3 transition-colors">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-[#1C2430] text-slate-400 dark:text-[#9CA3AF] flex items-center justify-center mx-auto">
                  {statusFilter === 'Paid' ? (
                    <Check className="w-6 h-6 text-emerald-500" />
                  ) : statusFilter === 'Partially Paid' ? (
                    <CreditCard className="w-6 h-6 text-amber-500" />
                  ) : statusFilter === 'Unpaid' ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  ) : searchTerm ? (
                    <Search className="w-6 h-6 text-slate-400" />
                  ) : (
                    <Receipt className="w-6 h-6 text-slate-400" />
                  )}
                </div>

                <div>
                  <div className="text-sm font-bold text-slate-800 dark:text-[#F9FAFB]">
                    {t('billHistory.noBillsFound')}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-1 max-w-xs mx-auto">
                    {t('billHistory.noBillsMatching')}
                  </div>
                </div>

                {statusFilter === 'ALL' && !searchTerm && (
                  <button
                    onClick={() => navigate('/create-bill')}
                    className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all mt-2"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>{t('dashboard.createNewBill')}</span>
                  </button>
                )}

                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 underline"
                  >
                    {t('common.cancel')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* VIEW 2: CALENDAR VIEW (PHASE 7)                                  */}
        {/* ================================================================ */}
        {viewMode === 'calendar' && (
          <div className="space-y-3.5">
            
            {/* 1. Month / Year Navigation Header */}
            <div className="flex items-center justify-between bg-white dark:bg-[#151B23] rounded-xl border border-slate-200 dark:border-[#26303D] p-2.5 shadow-xs">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  aria-label="Previous Month"
                  className="p-1.5 rounded-lg text-slate-700 dark:text-[#9CA3AF] hover:bg-slate-100 dark:hover:bg-[#1C2430] active:scale-95 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handlePrevYear}
                  aria-label="Previous Year"
                  className="px-1.5 py-0.5 text-[10px] font-bold text-slate-400 dark:text-[#6B7280] hover:text-slate-800 dark:hover:text-[#F9FAFB] hover:bg-slate-100 dark:hover:bg-[#1C2430] rounded transition-all"
                  title="Previous Year"
                >
                  -1Y
                </button>
              </div>

              <div className="text-center">
                <h3 className="text-sm font-bold text-slate-900 dark:text-[#F9FAFB] tracking-tight">
                  {getMonthNames(language)[calendarMonth - 1]} {calendarYear}
                </h3>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleNextYear}
                  aria-label="Next Year"
                  className="px-1.5 py-0.5 text-[10px] font-bold text-slate-400 dark:text-[#6B7280] hover:text-slate-800 dark:hover:text-[#F9FAFB] hover:bg-slate-100 dark:hover:bg-[#1C2430] rounded transition-all"
                  title="Next Year"
                >
                  +1Y
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  aria-label="Next Month"
                  className="p-1.5 rounded-lg text-slate-700 dark:text-[#9CA3AF] hover:bg-slate-100 dark:hover:bg-[#1C2430] active:scale-95 transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleGoToToday}
                  className="ml-1 text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/40 hover:bg-amber-200 dark:hover:bg-amber-900/50 px-2 py-1 rounded-lg border border-amber-300 dark:border-amber-800/60 active:scale-95 transition-all"
                >
                  {t('common.today')}
                </button>
              </div>
            </div>

            {/* 2. Monthly Billing Summary Banner (Requirement 14) */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-[#151B23] dark:via-[#1C2430] dark:to-[#151B23] text-white rounded-xl p-3.5 shadow-xs border border-slate-800 dark:border-[#26303D] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold uppercase tracking-wider text-[11px]">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{getMonthNames(language)[calendarMonth - 1]} {calendarYear} {language === 'ta' ? 'கண்ணோட்டம்' : 'Overview'}</span>
                </div>
                <span className="text-[11px] font-mono bg-slate-800 dark:bg-[#1C2430] text-slate-300 dark:text-[#9CA3AF] px-2 py-0.5 rounded border border-slate-700 dark:border-[#26303D]">
                  {monthlySummary.totalBills} {t('calendar.bills')}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 dark:border-[#26303D] text-center">
                <div>
                  <div className="text-[10px] text-slate-400 dark:text-[#9CA3AF]">{t('calendar.turnover')}</div>
                  <div className="font-bold font-mono text-white dark:text-[#F9FAFB] text-xs mt-0.5 truncate">
                    {formatCurrency(monthlySummary.totalTurnover)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-emerald-400">{t('calendar.collected')}</div>
                  <div className="font-bold font-mono text-emerald-400 text-xs mt-0.5 truncate">
                    {formatCurrency(monthlySummary.totalCollected)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-rose-400">{t('calendar.outstanding')}</div>
                  <div className="font-bold font-mono text-rose-400 text-xs mt-0.5 truncate">
                    {formatCurrency(monthlySummary.totalOutstanding)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-amber-400">{t('calendar.hours')}</div>
                  <div className="font-bold font-mono text-amber-400 text-xs mt-0.5 truncate">
                    {formatHours(monthlySummary.totalHours)}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Monthly Calendar Grid */}
            <div className="bg-white dark:bg-[#151B23] rounded-xl border border-slate-200 dark:border-[#26303D] p-3 shadow-xs space-y-2">
              {/* Weekday Row */}
              <div className="grid grid-cols-7 text-center">
                {getWeekDays(language).map((day) => (
                  <div key={day} className="text-[11px] font-bold text-slate-400 dark:text-[#9CA3AF] py-1 uppercase">
                    {day}
                  </div>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarCells.map((cell) => {
                  const isSelected = cell.dateString === selectedDate;

                  return (
                    <button
                      key={cell.dateString}
                      type="button"
                      onClick={() => handleSelectDay(cell)}
                      className={`min-h-[46px] sm:min-h-[50px] p-1 rounded-xl flex flex-col items-center justify-between text-xs transition-all relative ${
                        isSelected
                          ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-black shadow-sm ring-2 ring-amber-500 scale-[1.03] z-10'
                          : cell.isCurrentMonth
                          ? 'bg-white dark:bg-[#1C2430] text-slate-800 dark:text-[#F9FAFB] border border-slate-100 dark:border-[#26303D] hover:border-amber-400'
                          : 'bg-slate-50/50 dark:bg-[#0B0F14]/40 text-slate-300 dark:text-[#6B7280] border border-transparent'
                      }`}
                    >
                      <span
                        className={`text-xs ${
                          cell.isToday && !isSelected
                            ? 'font-black text-amber-600 dark:text-amber-400 underline underline-offset-2'
                            : ''
                        }`}
                      >
                        {cell.dayNumber}
                      </span>

                      {/* Status indicator dots */}
                      <div className="min-h-[6px] flex items-center gap-0.5 justify-center">
                        {cell.billsCount > 0 && (
                          <>
                            {cell.isAllPaid ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Paid" />
                            ) : cell.isAllUnpaid ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" title="Unpaid" />
                            ) : (
                              <>
                                {cell.hasPaid && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                                {cell.hasPartiallyPaid && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                                {cell.hasUnpaid && !cell.hasPartiallyPaid && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Selected Date Daily Summary (Requirements 8, 9, 10) */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-[#F9FAFB]">
                    {formatFullDate(selectedDate, language)}
                  </h4>
                  {selectedDate === todayString && (
                    <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-[10px] font-bold rounded-full border border-amber-300 dark:border-amber-800/60">
                      {t('common.today')}
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-500 dark:text-[#9CA3AF] font-semibold font-mono">
                  {dailySummary.totalBills} {t('calendar.bills')}
                </span>
              </div>

              {/* Daily Summary Card */}
              {dailySummary.totalBills > 0 && (
                <div className="bg-slate-900 dark:bg-[#151B23] text-white rounded-xl p-3.5 shadow-xs text-xs space-y-2 border border-transparent dark:border-[#26303D]">
                  <div className="flex items-center justify-between text-slate-400 dark:text-[#9CA3AF] font-semibold uppercase tracking-wider text-[11px]">
                    <span>{t('calendar.dailySummary')}</span>
                    <span className="text-amber-400 font-bold">{dailySummary.totalBills} {t('calendar.bills')}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-800 dark:border-[#26303D] text-center">
                    <div>
                      <div className="text-[10px] text-slate-400 dark:text-[#9CA3AF]">{t('customers.totalBilled')}</div>
                      <div className="font-bold font-mono text-white dark:text-[#F9FAFB] text-xs mt-0.5 truncate">
                        {formatCurrency(dailySummary.totalBilled)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-emerald-400">{t('calendar.collected')}</div>
                      <div className="font-bold font-mono text-emerald-400 text-xs mt-0.5 truncate">
                        {formatCurrency(dailySummary.totalPaid)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-rose-400">{t('calendar.outstanding')}</div>
                      <div className="font-bold font-mono text-rose-400 text-xs mt-0.5 truncate">
                        {formatCurrency(dailySummary.totalOutstanding)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-amber-400">{t('calendar.hours')}</div>
                      <div className="font-bold font-mono text-amber-400 text-xs mt-0.5 truncate">
                        {formatHours(dailySummary.totalHours)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Daily Bills List */}
              {dailySummary.bills.length > 0 ? (
                <div className="space-y-3">
                  {dailySummary.bills.map((bill) => (
                    <BillCard
                      key={bill.id}
                      bill={bill}
                      onClick={() => setSelectedBill(bill)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 bg-white dark:bg-[#151B23] rounded-xl border border-dashed border-slate-300 dark:border-[#26303D] p-6 space-y-2 transition-colors">
                  <CalendarIcon className="w-8 h-8 text-slate-300 dark:text-[#6B7280] mx-auto" />
                  <div className="text-sm font-bold text-slate-700 dark:text-[#F9FAFB]">
                    {language === 'ta' ? 'இந்த தேதியில் பில்கள் இல்லை' : 'No Bills for This Date'}
                  </div>
                  <div className="text-xs text-slate-400 dark:text-[#9CA3AF] max-w-xs mx-auto">
                    {language === 'ta'
                      ? `${formatFullDate(selectedDate, language)} அன்று JCB பில் எதுவும் உருவாக்கப்படவில்லை.`
                      : `No JCB billing records were created on ${formatFullDate(selectedDate)}.`}
                  </div>
                  {selectedDate === todayString && (
                    <button
                      onClick={() => navigate('/create-bill')}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 underline pt-1"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>{language === 'ta' ? 'இன்றைய பில் உருவாக்கவும்' : 'Create Bill for Today'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ================================================================ */}
        {/* MODAL 1: Bill Details Modal (Strictly PostgreSQL stored columns)  */}
        {/* ================================================================ */}
        {selectedBill && rawSelected && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
              onClick={() => setSelectedBill(null)}
            />
            
            <div className="relative w-full max-w-md bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#26303D] rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl z-10 max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-200 text-slate-900 dark:text-[#F9FAFB] transition-colors">
              
              {/* Header: Bill Number, Date & Status */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#26303D]">
                <div>
                  {rawSelected.bill_type === 'loading' || Boolean(rawSelected.loading_details) ? (
                    <div className="flex items-center gap-1.5">
                      <div className="inline-flex items-center gap-1.5 font-mono text-xs font-bold px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 rounded-md border border-amber-300 dark:border-amber-800/60">
                        <Truck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span>{rawSelected.bill_number || rawSelected.billNumber}</span>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500 text-slate-950">
                        {language === 'ta' ? 'ஏற்றுதல் பில்' : 'Loading Bill'}
                      </span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 font-mono text-xs font-bold px-2.5 py-1 bg-slate-100 dark:bg-[#1C2430] text-slate-800 dark:text-[#F9FAFB] rounded-md border border-slate-200 dark:border-[#26303D]">
                      <JCBMachineIcon width={16} height={12} />
                      <span>{rawSelected.bill_number || rawSelected.billNumber}</span>
                    </div>
                  )}
                  <div className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-1 flex items-center gap-1.5">
                    <span>{t('createBill.date')}: {formatDate(rawSelected.bill_date || rawSelected.date)}</span>
                    {(rawSelected.created_at || rawSelected.createdAt) && (
                      <>
                        <span>•</span>
                        <span>{formatTime(rawSelected.created_at || rawSelected.createdAt)}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge status={selectedStatus} />
                  <button
                    onClick={() => setSelectedBill(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-[#F9FAFB] hover:bg-slate-100 dark:hover:bg-[#1C2430]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Customer Info & Dialer */}
              <div className="mt-4 p-3.5 bg-slate-50 dark:bg-[#1C2430] rounded-xl space-y-2.5 border border-slate-100 dark:border-[#26303D]">
                <div className="text-[11px] font-semibold text-slate-400 dark:text-[#9CA3AF] uppercase tracking-wider">
                  {t('billImage.customerDetails')}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-[#F9FAFB]">
                      {rawSelected.customer_name || rawSelected.customerName}
                    </div>
                    {(rawSelected.customer_mobile || rawSelected.customerPhone) && (
                      <div className="font-mono text-xs text-slate-600 dark:text-[#9CA3AF] mt-0.5">
                        {rawSelected.customer_mobile || rawSelected.customerPhone}
                      </div>
                    )}
                  </div>

                  {(rawSelected.customer_mobile || rawSelected.customerPhone) && (
                    <a
                      href={`tel:${rawSelected.customer_mobile || rawSelected.customerPhone}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800/60 rounded-lg text-xs font-bold active:scale-95 transition-all"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>{t('common.call')}</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Loading Details Breakdown or Working Hours Metric */}
              {rawSelected.bill_type === 'loading' || Boolean(rawSelected.loading_details) ? (
                <div className="mt-3.5 p-3.5 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/50 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-[#F9FAFB]">
                      <Truck className="w-4 h-4 text-amber-500" />
                      <span>{language === 'ta' ? 'மொத்த லோடுகள்:' : 'Total Loads:'}</span>
                    </div>
                    <span className="font-mono font-black text-amber-950 dark:text-amber-300 text-sm">
                      {rawSelected.loading_details?.totalLoads ?? (rawSelected.loading_details?.totalTractorLoads ?? (rawSelected.working_hours ?? 0))} {language === 'ta' ? 'லோடு' : 'Loads'}
                    </span>
                  </div>

                  {rawSelected.loading_details && (
                    <div className="pt-2 border-t border-amber-200/60 dark:border-amber-800/40 space-y-1.5 text-slate-600 dark:text-[#9CA3AF]">
                      <div className="flex justify-between">
                        <span>{language === 'ta' ? `டிராக்டர் (₹${rawSelected.loading_details.tractorRate ?? 300}/லோடு):` : `Tractor (₹${rawSelected.loading_details.tractorRate ?? 300}/Load):`}</span>
                        <span className="font-mono font-semibold text-slate-900 dark:text-[#F9FAFB]">
                          {rawSelected.loading_details.totalTractorLoads} {language === 'ta' ? 'லோடு' : 'Loads'} = {formatCurrency(rawSelected.loading_details.tractorTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>{language === 'ta' ? `JCB (₹${rawSelected.loading_details.jcbRate ?? 200}/லோடு):` : `JCB (₹${rawSelected.loading_details.jcbRate ?? 200}/Load):`}</span>
                        <span className="font-mono font-semibold text-slate-900 dark:text-[#F9FAFB]">
                          {rawSelected.loading_details.jcbLoads} {language === 'ta' ? 'லோடு' : 'Loads'} = {formatCurrency(rawSelected.loading_details.jcbTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-500 dark:text-[#9CA3AF] text-[11px] italic">
                        <span>{language === 'ta' ? 'ஒருங்கிணைந்த கட்டணம்:' : 'Combined Rate:'}</span>
                        <span className="font-mono font-medium">
                          ₹{rawSelected.loading_details.combinedRate ?? ((rawSelected.loading_details.tractorRate ?? 300) + (rawSelected.loading_details.jcbRate ?? 200))} / {language === 'ta' ? 'லோடு' : 'Load'}
                        </span>
                      </div>

                      {rawSelected.loading_details.tractors && rawSelected.loading_details.tractors.length > 1 && (
                        <div className="pt-1.5 border-t border-dashed border-amber-200/60 dark:border-amber-800/40 space-y-1 text-[11px]">
                          <div className="font-bold text-slate-700 dark:text-slate-300">
                            {language === 'ta' ? 'டிராக்டர் வாரியான விவரங்கள்:' : 'Tractor-wise breakdown:'}
                          </div>
                          {rawSelected.loading_details.tractors.map((tr: any) => (
                            <div key={tr.id} className="flex justify-between pl-2">
                              <span>{tr.name} {tr.vehicleNo ? `(${tr.vehicleNo})` : ''}:</span>
                              <span className="font-mono font-medium">{tr.loads} {language === 'ta' ? 'லோடு' : 'Loads'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                (rawSelected.working_hours !== undefined && rawSelected.working_hours !== null) && (
                  <div className="mt-3.5 p-3 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/50 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-slate-700 dark:text-[#9CA3AF] font-medium">
                      <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span>{t('createBill.workingHours')}:</span>
                    </div>
                    <span className="font-mono font-bold text-amber-950 dark:text-amber-300 text-sm">
                      {formatHours(rawSelected.working_hours)}
                    </span>
                  </div>
                )
              )}

              {/* Financial Breakdown (Stored in PostgreSQL) */}
              <div className="mt-4 space-y-2">
                <div className="text-[11px] font-semibold text-slate-400 dark:text-[#9CA3AF] uppercase tracking-wider">
                  {t('createBill.billSummary')}
                </div>
                <div className="bg-slate-50 dark:bg-[#1C2430] rounded-xl p-3.5 space-y-2.5 border border-slate-200/80 dark:border-[#26303D] text-xs">
                  <div className="flex justify-between items-center text-sm font-bold text-slate-900 dark:text-[#F9FAFB]">
                    <span>{t('createBill.totalAmount')}:</span>
                    <span className="font-mono">{formatCurrency(selectedTotal)}</span>
                  </div>

                  <div className="flex justify-between items-center text-emerald-700 dark:text-emerald-400 font-semibold">
                    <span>{t('createBill.paidAmount')}:</span>
                    <span className="font-mono">{formatCurrency(selectedPaid)}</span>
                  </div>

                  <div className="flex justify-between items-center text-rose-600 dark:text-rose-400 font-bold text-sm pt-2 border-t border-slate-200 dark:border-[#26303D]">
                    <span>{t('createBill.balanceDue')}:</span>
                    <span className="font-mono">{formatCurrency(selectedBalance)}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: WhatsApp, Save to Gallery, Print, View Image, Send SMS, Payment, Delete */}
              <div className="mt-5 space-y-2">
                {/* Row 1: WhatsApp & Save to Gallery */}
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

                {/* Row 2: Print Bill & View Bill Image */}
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

                {/* Row 3: Send Customer SMS */}
                <ActionButton
                  variant="success"
                  onClick={() => setIsSmsModalOpen(true)}
                  icon={<MessageSquare className="w-4 h-4 text-emerald-100" />}
                >
                  {t('actions.sendSms')}
                </ActionButton>

                {/* Add Payment Button: Only visible on Unpaid or Partially Paid */}
                {selectedStatus !== 'Paid' && selectedBalance > 0 && (
                  <ActionButton
                    variant="primary"
                    onClick={handleOpenAddPayment}
                    icon={<IndianRupee className="w-4 h-4 stroke-[2.5]" />}
                  >
                    {t('actions.addPayment')}
                  </ActionButton>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1">
                  {/* Delete Bill Button */}
                  <ActionButton
                    variant="outline"
                    size="sm"
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="text-rose-600 border-rose-200 dark:border-rose-900/60 dark:hover:bg-rose-950/30 hover:bg-rose-50"
                    icon={<Trash2 className="w-3.5 h-3.5 text-rose-500" />}
                  >
                    {t('actions.deleteBill')}
                  </ActionButton>

                  {/* Close View Button */}
                  <ActionButton
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedBill(null)}
                  >
                    {t('common.close')}
                  </ActionButton>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* MODAL 2: Add Payment Modal                                       */}
        {/* ================================================================ */}
        {isPaymentModalOpen && selectedBill && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs"
              onClick={() => !isUpdatingPayment && setIsPaymentModalOpen(false)}
            />

            <div className="relative w-full max-w-sm bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#26303D] rounded-2xl p-5 shadow-2xl z-10 animate-in zoom-in-95 duration-150 text-slate-900 dark:text-[#F9FAFB]">
              
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#26303D]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                    <IndianRupee className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-[#F9FAFB]">{t('billModal.addPaymentTitle')}</h3>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-[#9CA3AF]">
                      {rawSelected.bill_number || rawSelected.billNumber}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsPaymentModalOpen(false)}
                  disabled={isUpdatingPayment}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-[#F9FAFB] disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Balance Summary Box */}
              <div className="mt-4 p-3 bg-slate-50 dark:bg-[#1C2430] rounded-xl border border-slate-200/80 dark:border-[#26303D] text-xs space-y-1.5">
                <div className="flex justify-between text-slate-600 dark:text-[#9CA3AF]">
                  <span>{t('billModal.customer')}:</span>
                  <span className="font-bold text-slate-900 dark:text-[#F9FAFB] truncate max-w-[160px]">
                    {rawSelected.customer_name || rawSelected.customerName}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-[#9CA3AF]">
                  <span>{t('billModal.totalAmount')}:</span>
                  <span className="font-mono font-medium">{formatCurrency(selectedTotal)}</span>
                </div>
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                  <span>{t('billModal.alreadyPaid')}:</span>
                  <span className="font-mono font-medium">{formatCurrency(selectedPaid)}</span>
                </div>
                <div className="flex justify-between text-rose-600 dark:text-rose-400 font-bold pt-1 border-t border-slate-200 dark:border-[#26303D]">
                  <span>{t('billModal.balanceDue')}:</span>
                  <span className="font-mono text-sm">{formatCurrency(selectedBalance)}</span>
                </div>
              </div>

              {/* Payment Form */}
              <form onSubmit={handleConfirmPayment} className="mt-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-[#9CA3AF]">
                      {t('billModal.paymentAmountLabel')}
                    </label>
                    <button
                      type="button"
                      onClick={handleSetFullBalance}
                      className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 underline"
                    >
                      {t('actions.payFull')} (₹{selectedBalance})
                    </button>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 dark:text-[#6B7280]">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      max={selectedBalance}
                      placeholder={`Max ${selectedBalance}`}
                      value={paymentAmountInput}
                      onChange={(e) => {
                        setPaymentAmountInput(e.target.value);
                        if (paymentError) setPaymentError(null);
                      }}
                      disabled={isUpdatingPayment}
                      autoFocus
                      className="w-full pl-8 pr-4 py-2.5 bg-white dark:bg-[#1C2430] border border-slate-300 dark:border-[#26303D] rounded-xl text-sm font-mono font-bold text-slate-900 dark:text-[#F9FAFB] focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>

                  {paymentError && (
                    <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium mt-1.5 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{paymentError}</span>
                    </div>
                  )}
                </div>

                {/* Live Preview if valid amount */}
                {isValidPaymentAmount && (
                  <div className="p-2.5 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl text-[11px] space-y-1">
                    <div className="flex justify-between text-emerald-800 dark:text-emerald-300">
                      <span>{t('billModal.newTotalPaid')}:</span>
                      <strong className="font-mono">{formatCurrency(previewNewPaid)}</strong>
                    </div>
                    <div className="flex justify-between text-emerald-800 dark:text-emerald-300">
                      <span>{t('billModal.remainingBalance')}:</span>
                      <strong className="font-mono">{formatCurrency(previewNewBalance)}</strong>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-emerald-200 dark:border-emerald-800/50">
                      <span className="text-slate-600 dark:text-[#9CA3AF]">{t('billModal.updatedStatus')}:</span>
                      <StatusBadge status={previewNewStatus} size="sm" />
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <ActionButton
                    variant="outline"
                    size="sm"
                    onClick={() => setIsPaymentModalOpen(false)}
                    disabled={isUpdatingPayment}
                  >
                    {t('common.cancel')}
                  </ActionButton>

                  <ActionButton
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={isUpdatingPayment}
                    loadingText={t('common.saving')}
                    disabled={!isValidPaymentAmount}
                    icon={<Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                  >
                    {t('common.confirm')}
                  </ActionButton>
                </div>
              </form>

            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* MODAL 3: Delete Confirmation Modal                               */}
        {/* ================================================================ */}
        {isDeleteModalOpen && selectedBill && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs"
              onClick={() => !isDeleting && setIsDeleteModalOpen(false)}
            />

            <div className="relative w-full max-w-sm bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#26303D] rounded-2xl p-5 shadow-2xl z-10 animate-in zoom-in-95 duration-150 text-slate-900 dark:text-[#F9FAFB]">
              
              <div className="w-11 h-11 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-5 h-5 stroke-[2]" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-[#F9FAFB]">{t('billModal.deleteTitle')}</h3>
                <p className="text-xs text-slate-500 dark:text-[#9CA3AF] leading-relaxed">
                  {t('billModal.deleteWarning')}
                </p>
              </div>

              {/* Bill brief preview */}
              <div className="mt-3.5 p-3 bg-slate-50 dark:bg-[#1C2430] rounded-xl border border-slate-200 dark:border-[#26303D] text-xs space-y-1 text-center font-mono">
                <div className="font-bold text-slate-900 dark:text-[#F9FAFB]">
                  {rawSelected.bill_number || rawSelected.billNumber}
                </div>
                <div className="text-slate-600 dark:text-[#9CA3AF] font-sans">
                  {rawSelected.customer_name || rawSelected.customerName}
                </div>
                <div className="text-amber-700 dark:text-amber-400 font-bold">
                  {formatCurrency(selectedTotal)}
                </div>
              </div>

              {deleteError && (
                <div className="mt-3 p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-xl text-[11px] text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 mt-5">
                <ActionButton
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isDeleting}
                >
                  {t('common.cancel')}
                </ActionButton>

                <ActionButton
                  variant="danger"
                  size="sm"
                  onClick={handleConfirmDelete}
                  loading={isDeleting}
                  loadingText={language === 'ta' ? 'நீக்கப்படுகிறது...' : 'Deleting...'}
                  icon={<Trash2 className="w-3.5 h-3.5 stroke-[2]" />}
                >
                  {t('actions.deleteBill')}
                </ActionButton>
              </div>

            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* MODAL 4: Bill Image Modal (Phase 9 - Temporary Image)             */}
        {/* ================================================================ */}
        <BillImageModal
          isOpen={isImageModalOpen}
          onClose={() => setIsImageModalOpen(false)}
          bill={selectedBill}
          ownerDetails={ownerDetails}
        />

        {/* ================================================================ */}
        {/* MODAL 5: Send SMS Modal (Phase 10 - MSG91 + Supabase Function)    */}
        {/* ================================================================ */}
        <SendSmsModal
          isOpen={isSmsModalOpen}
          onClose={() => setIsSmsModalOpen(false)}
          bill={selectedBill}
          ownerDetails={ownerDetails}
        />

      </div>
    </AppLayout>
  );
};
