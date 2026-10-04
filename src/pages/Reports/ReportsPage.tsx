import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/layout/AppLayout';
import { BillCard } from '../../components/bills/BillCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { getBills, getCachedBills, updateBillPayment, deleteBill } from '../../services/billService';
import type { DbBill } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import {
  type ReportPeriod,
  filterBillsByPeriod,
  calculateReportKPIs,
  generateTrendPoints,
  calculateTopCustomers,
} from '../../services/reportService';
import {
  generateReportImage,
  saveReportToGallery,
  shareReportToWhatsApp as shareReportImageToWhatsApp,
} from '../../services/reportImageService';
import { toDateString } from '../../utils/calendarUtils';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../i18n';
import { BillImageModal } from '../../components/bills/BillImageModal';
import { SendSmsModal } from '../../components/bills/SendSmsModal';
import { generateBillImage, shareToWhatsApp } from '../../services/billImageService';
import { printBill } from '../../services/printService';
import { saveBillToGallery, getGalleryButtonLabel } from '../../services/galleryService';
import {
  TrendingUp,
  Clock,
  Receipt,
  IndianRupee,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Users,
  PlusCircle,
  X,
  Loader2,
  Trash2,
  Check,
  BarChart3,
  Phone,
  FileImage,
  MessageSquare,
  MessageCircle,
  Printer,
  Download,
  Calendar as CalendarIcon,
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const { ownerDetails } = useAuth();
  const { language, t, formatHours, formatDate } = useI18n();

  // Selected period mode
  const [period, setPeriod] = useState<ReportPeriod>('monthly');

  // Navigation reference date (device local date)
  const [refDate, setRefDate] = useState<Date>(() => new Date());

  // Custom date range state
  const todayStr = useMemo(() => toDateString(new Date()), []);
  const startOfMonthStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }, []);
  const [customStartDate, setCustomStartDate] = useState<string>(startOfMonthStr);
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  // Report Export states
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);
  const [isSharingReport, setIsSharingReport] = useState(false);

  // Database state
  const cachedBills = getCachedBills();
  const [bills, setBills] = useState<DbBill[]>(cachedBills || []);
  const [isLoading, setIsLoading] = useState(!cachedBills);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals state (nested bill details & payment update)
  const [selectedBill, setSelectedBill] = useState<DbBill | null>(null);
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

  // Feedback Notification state
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleDirectWhatsApp = async () => {
    if (!selectedBill) return;
    try {
      const gen = await generateBillImage(selectedBill, ownerDetails, language);
      const res = await shareToWhatsApp(gen.blob, selectedBill, language, gen.dataUrl, ownerDetails);
      if (res.fallbackDownloaded) {
        showToast(t('toasts.downloadedToDevice'));
      } else if (res.success) {
        showToast(t('toasts.openingWhatsApp'));
      }
    } catch {
      showToast(t('toasts.whatsAppFailed'), 'error');
    }
  };

  const handleDirectPrint = async () => {
    if (!selectedBill) return;
    try {
      const res = await printBill(selectedBill, ownerDetails, language);
      if (res.fallbackNeeded) {
        showToast(t('toasts.printingNotAvailable'), 'error');
      } else {
        showToast(t('toasts.openingPrint'));
      }
    } catch {
      showToast(t('toasts.openPrintFailed'), 'error');
    }
  };

  const handleDirectSave = async () => {
    if (!selectedBill) return;
    try {
      const raw = selectedBill as any;
      const billNum = raw.bill_number || raw.billNumber || 'JCB-BILL';
      const gen = await generateBillImage(selectedBill, ownerDetails, language);
      const res = await saveBillToGallery(gen.blob, billNum, gen.dataUrl, language);
      showToast(res.message, res.success ? 'success' : 'error');
    } catch {
      showToast(t('toasts.saveToGalleryFailed'), 'error');
    }
  };

  // Load real bills from PostgreSQL
  const loadBills = async (force: boolean = false) => {
    try {
      setErrorMessage(null);
      if (!getCachedBills() && bills.length === 0) {
        setIsLoading(true);
      }
      const data = await getBills(force);
      setBills(data);
    } catch (err: any) {
      console.error('[ReportsPage] Error loading bills:', err);
      setErrorMessage('Unable to load reports. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBills();
  }, []);

  // Filter bills by currently selected period
  // Filter bills by currently selected period
  const { filteredBills, periodLabel } = useMemo(() => {
    return filterBillsByPeriod(
      bills,
      period,
      refDate,
      period === 'custom' ? { start: customStartDate, end: customEndDate } : undefined
    );
  }, [bills, period, refDate, customStartDate, customEndDate]);

  // Report Export Actions
  const handleDownloadReport = async () => {
    if (filteredBills.length === 0) {
      showToast(t('reports.noBillsFound'), 'error');
      return;
    }
    setIsDownloadingReport(true);
    try {
      const img = await generateReportImage(kpis, periodLabel, filteredBills, ownerDetails, language);
      const res = await saveReportToGallery(img.blob, periodLabel, img.dataUrl, language);
      if (res.success) {
        showToast(res.message);
      } else {
        showToast(res.error || t('reports.failedToSave'), 'error');
      }
    } catch (err: any) {
      console.error('[ReportsPage] Download report error:', err);
      showToast(t('reports.failedToSave'), 'error');
    } finally {
      setIsDownloadingReport(false);
    }
  };

  const handleShareReport = async () => {
    if (filteredBills.length === 0) {
      showToast(t('reports.noBillsFound'), 'error');
      return;
    }
    setIsSharingReport(true);
    try {
      const img = await generateReportImage(kpis, periodLabel, filteredBills, ownerDetails, language);
      const res = await shareReportImageToWhatsApp(img.blob, periodLabel, kpis, img.dataUrl, language);
      if (res.whatsappInstalled === false) {
        showToast(t('reports.whatsAppNotInstalled'), 'error');
      } else if (res.fallbackDownloaded) {
        showToast(t('toasts.downloadedToDevice'));
      } else if (res.success) {
        showToast(language === 'ta' ? 'WhatsApp திறக்கப்படுகிறது...' : 'Opening WhatsApp...');
      } else {
        showToast(res.error || t('reports.failedToShare'), 'error');
      }
    } catch (err: any) {
      console.error('[ReportsPage] Share report error:', err);
      showToast(t('reports.failedToShare'), 'error');
    } finally {
      setIsSharingReport(false);
    }
  };

  // Calculate core business KPIs
  const kpis = useMemo(() => {
    return calculateReportKPIs(filteredBills);
  }, [filteredBills]);

  // Generate trend data points
  const trendPoints = useMemo(() => {
    return generateTrendPoints(filteredBills, period, refDate);
  }, [filteredBills, period, refDate]);

  // Top customers ranked by turnover
  const topCustomers = useMemo(() => {
    return calculateTopCustomers(filteredBills, 5);
  }, [filteredBills]);

  // Period Navigation Handlers
  const handlePrev = () => {
    setRefDate((prev) => {
      const d = new Date(prev);
      if (period === 'daily') {
        d.setDate(d.getDate() - 1);
      } else if (period === 'weekly') {
        d.setDate(d.getDate() - 7);
      } else if (period === 'monthly') {
        d.setMonth(d.getMonth() - 1);
      } else if (period === 'yearly') {
        d.setFullYear(d.getFullYear() - 1);
      }
      return d;
    });
  };

  const handleNext = () => {
    setRefDate((prev) => {
      const d = new Date(prev);
      if (period === 'daily') {
        d.setDate(d.getDate() + 1);
      } else if (period === 'weekly') {
        d.setDate(d.getDate() + 7);
      } else if (period === 'monthly') {
        d.setMonth(d.getMonth() + 1);
      } else if (period === 'yearly') {
        d.setFullYear(d.getFullYear() + 1);
      }
      return d;
    });
  };

  const handleResetCurrent = () => {
    setRefDate(new Date());
  };

  // Payment helpers for selected bill
  const billTotal = selectedBill ? Number(selectedBill.total_amount || 0) : 0;
  const billPaid = selectedBill ? Number(selectedBill.paid_amount || 0) : 0;
  const billBalance = selectedBill ? Number(selectedBill.balance_amount || 0) : 0;
  const paymentAmountNum = parseFloat(paymentAmountInput) || 0;
  const isValidPaymentAmount = paymentAmountNum > 0 && paymentAmountNum <= billBalance;
  const previewNewPaid = Math.min(billTotal, billPaid + (paymentAmountNum > 0 ? paymentAmountNum : 0));
  const previewNewBalance = Math.max(0, billTotal - previewNewPaid);
  const previewNewStatus = previewNewBalance === 0 ? 'Paid' : 'Partially Paid';

  const handleOpenAddPayment = (bill: DbBill) => {
    setSelectedBill(bill);
    setPaymentAmountInput('');
    setPaymentError(null);
    setIsPaymentModalOpen(true);
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBill) return;

    if (!paymentAmountInput.trim() || isNaN(paymentAmountNum) || paymentAmountNum <= 0) {
      setPaymentError('Please enter a payment amount greater than ₹0.');
      return;
    }

    if (paymentAmountNum > billBalance) {
      setPaymentError(`Payment amount cannot exceed pending balance of ₹${billBalance.toLocaleString('en-IN')}.`);
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
        setBills((prev) => prev.map((b) => (b.id === updatedBill.id ? updatedBill : b)));
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

      const deletedNumber = selectedBill.bill_number;
      setBills((prev) => prev.filter((b) => b.id !== selectedBill.id));
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
    <AppLayout title={t('nav.reports')} subtitle={t('reports.subtitle')} showBack>
      <div className="space-y-4">
        
        {/* Floating Toast Feedback */}
        {toastMessage && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-60 max-w-sm w-[90%] shadow-lg animate-in fade-in slide-in-from-top-4 duration-200">
            <div className={`flex items-center gap-2.5 p-3 rounded-xl text-xs font-semibold text-white ${
              toastMessage.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
            }`}>
              {toastMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span className="flex-1">{toastMessage.text}</span>
              <button onClick={() => setToastMessage(null)} className="p-1 hover:opacity-75">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* 1. Report Period Selector (Daily, Weekly, Monthly, Yearly, Custom) */}
        <div className="grid grid-cols-5 gap-1 bg-slate-100 dark:bg-[#151B23] p-1 rounded-xl border border-slate-200/80 dark:border-[#26303D] text-[11px] font-bold">
          {(['daily', 'weekly', 'monthly', 'yearly', 'custom'] as const).map((p) => {
            const isActive = period === p;
            const label =
              p === 'daily'
                ? t('reports.daily')
                : p === 'weekly'
                ? t('reports.weekly')
                : p === 'monthly'
                ? t('reports.monthly')
                : p === 'yearly'
                ? t('reports.yearly')
                : t('reports.custom');
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`py-2 rounded-lg text-center transition-all ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
                    : 'text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F9FAFB]'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Custom Date Range Filter Inputs */}
        {period === 'custom' && (
          <div className="bg-white dark:bg-[#151B23] rounded-xl border border-slate-200 dark:border-[#26303D] p-3 shadow-xs space-y-2 animate-in fade-in duration-150">
            <div className="text-[11px] font-bold text-slate-700 dark:text-[#9CA3AF] uppercase tracking-wider flex items-center gap-1.5">
              <CalendarIcon className="w-3.5 h-3.5 text-amber-500" />
              <span>{language === 'ta' ? 'தேதி வரம்பைத் தேர்ந்தெடுக்கவும்' : 'Select Custom Date Range'}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-[#9CA3AF] mb-1">
                  {t('reports.fromDate')}
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  max={customEndDate || todayStr}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-[#1C2430] border border-slate-200 dark:border-[#26303D] rounded-lg text-xs font-mono text-slate-800 dark:text-[#F9FAFB] focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white dark:focus:bg-[#151B23]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-[#9CA3AF] mb-1">
                  {t('reports.toDate')}
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  min={customStartDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-[#1C2430] border border-slate-200 dark:border-[#26303D] rounded-lg text-xs font-mono text-slate-800 dark:text-[#F9FAFB] focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white dark:focus:bg-[#151B23]"
                />
              </div>
            </div>
          </div>
        )}

        {/* 2. Date / Period Navigation Header */}
        <div className="flex items-center justify-between bg-white dark:bg-[#151B23] rounded-xl border border-slate-200 dark:border-[#26303D] p-2.5 shadow-xs">
          {period !== 'custom' ? (
            <>
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Previous Period"
                className="p-1.5 rounded-lg text-slate-700 dark:text-[#9CA3AF] hover:bg-slate-100 dark:hover:bg-[#1C2430] active:scale-95 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="text-center">
                <h3 className="text-sm font-bold text-slate-900 dark:text-[#F9FAFB] tracking-tight">
                  {periodLabel}
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleNext}
                  aria-label="Next Period"
                  className="p-1.5 rounded-lg text-slate-700 dark:text-[#9CA3AF] hover:bg-slate-100 dark:hover:bg-[#1C2430] active:scale-95 transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleResetCurrent}
                  className="text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/40 hover:bg-amber-200 dark:hover:bg-amber-900/50 px-2 py-1 rounded-lg border border-amber-300 dark:border-amber-800/60 active:scale-95 transition-all"
                >
                  {language === 'ta' ? 'தற்போது' : 'Current'}
                </button>
              </div>
            </>
          ) : (
            <div className="w-full flex items-center justify-center gap-2 py-0.5">
              <CalendarIcon className="w-4 h-4 text-amber-600 shrink-0" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-[#F9FAFB] tracking-tight font-mono">
                {periodLabel}
              </h3>
            </div>
          )}
        </div>

        {/* 3. Report Export & Share Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleDownloadReport}
            disabled={isDownloadingReport || isSharingReport || filteredBills.length === 0}
            className="flex items-center justify-center gap-2 py-2.5 px-3 bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#26303D] hover:bg-slate-50 dark:hover:bg-[#1C2430] text-slate-800 dark:text-[#F9FAFB] rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDownloadingReport ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                <span className="truncate">{t('reports.generatingReport')}</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="truncate">{t('reports.downloadReport')}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleShareReport}
            disabled={isDownloadingReport || isSharingReport || filteredBills.length === 0}
            className="flex items-center justify-center gap-2 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSharingReport ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span className="truncate">{t('reports.generatingReport')}</span>
              </>
            ) : (
              <>
                <MessageCircle className="w-4 h-4 text-white shrink-0" />
                <span className="truncate">{t('reports.shareReport')}</span>
              </>
            )}
          </button>
        </div>

        {/* Loading and Error States */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 dark:text-[#9CA3AF]">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-2" />
            <span className="text-xs font-semibold">{t('common.loading')}</span>
          </div>
        ) : errorMessage ? (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-xl text-rose-700 dark:text-rose-300 text-xs text-center space-y-2">
            <AlertTriangle className="w-6 h-6 mx-auto text-rose-500" />
            <div>{errorMessage}</div>
            <button
              onClick={() => loadBills(true)}
              className="text-xs font-bold text-rose-800 dark:text-rose-400 underline hover:text-rose-900"
            >
              {t('common.retry')}
            </button>
          </div>
        ) : (
          <>
            {/* 3. Core KPI Card: Turnover, Collection Progress, Collected, Outstanding */}
            <div className="bg-slate-900 dark:bg-[#151B23] text-white rounded-2xl p-4 shadow-md border border-slate-800 dark:border-[#26303D] space-y-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 dark:text-[#9CA3AF] font-semibold uppercase tracking-wider text-[11px]">
                  {t('reports.turnover')} ({period === 'daily' ? t('reports.daily') : period === 'weekly' ? t('reports.weekly') : period === 'monthly' ? t('reports.monthly') : t('reports.yearly')})
                </span>
                <span className="inline-flex items-center gap-1 text-amber-400 font-bold bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>{language === 'ta' ? 'உண்மை பில்கள்' : 'Real Invoices'}</span>
                </span>
              </div>

              <div className="text-3xl font-black text-amber-400 font-mono tracking-tight">
                {formatCurrency(kpis.totalTurnover)}
              </div>

              {/* Collection Progress Indicator */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-300 dark:text-[#9CA3AF] font-medium">{t('reports.collectionProgress')}</span>
                  <span className="text-emerald-400 font-bold font-mono">
                    {kpis.collectionRate}% {language === 'ta' ? 'வசூலானது' : 'Collected'}
                  </span>
                </div>

                <div className="w-full bg-slate-800 dark:bg-[#1C2430] rounded-full h-2.5 overflow-hidden flex border border-slate-700/60 dark:border-[#26303D]">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-500"
                    style={{ width: `${kpis.collectionRate}%` }}
                  />
                  <div
                    className="bg-rose-500 h-full transition-all duration-500"
                    style={{ width: `${100 - kpis.collectionRate}%` }}
                  />
                </div>
              </div>

              {/* Financial Split: Collected vs Outstanding */}
              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800 dark:border-[#26303D] text-xs">
                <div>
                  <div className="text-slate-400 dark:text-[#9CA3AF] text-[11px]">{t('reports.collected')}</div>
                  <div className="text-emerald-400 font-bold text-base font-mono mt-0.5">
                    {formatCurrency(kpis.totalCollected)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-slate-400 dark:text-[#9CA3AF] text-[11px]">{t('reports.outstanding')}</div>
                  <div className="text-rose-400 font-bold text-base font-mono mt-0.5">
                    {formatCurrency(kpis.totalOutstanding)}
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Secondary KPI Cards: Invoices & Working Hours */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white dark:bg-[#151B23] rounded-xl border border-slate-200 dark:border-[#26303D] p-3.5 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 dark:text-[#9CA3AF] mb-1">
                  <span className="text-xs font-medium">{t('reports.totalBills')}</span>
                  <Receipt className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-[#F9FAFB] font-mono">
                  {kpis.totalBills}
                </div>
                <div className="text-[11px] text-slate-400 dark:text-[#9CA3AF] mt-1">
                  {period === 'daily' ? t('reports.daily') : period === 'weekly' ? t('reports.weekly') : period === 'monthly' ? t('reports.monthly') : t('reports.yearly')}
                </div>
              </div>

              <div className="bg-white dark:bg-[#151B23] rounded-xl border border-slate-200 dark:border-[#26303D] p-3.5 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 dark:text-[#9CA3AF] mb-1">
                  <span className="text-xs font-medium">{t('reports.workingHours')}</span>
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-[#F9FAFB] font-mono">
                  {kpis.totalHours} <span className="text-xs font-normal text-slate-500 dark:text-[#9CA3AF] font-sans">{t('common.hrs')}</span>
                </div>
                <div className="text-[11px] text-slate-400 dark:text-[#9CA3AF] mt-1">
                  {language === 'ta' ? 'இயந்திர வேலை நேரம்' : 'Machine run time'}
                </div>
              </div>
            </div>

            {/* 5. Payment Status Breakdown */}
            <div className="bg-white dark:bg-[#151B23] rounded-xl border border-slate-200 dark:border-[#26303D] p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 dark:text-[#F9FAFB] uppercase tracking-wider">
                  {language === 'ta' ? 'பணம் செலுத்திய நிலை விவரம்' : 'Payment Status Breakdown'}
                </h3>
                <span className="text-[11px] text-slate-400 dark:text-[#9CA3AF] font-mono">
                  {kpis.totalBills} {t('billHistory.total')}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {/* Paid */}
                <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 rounded-xl p-2.5 space-y-1">
                  <div className="flex items-center justify-center gap-1 text-emerald-800 dark:text-emerald-300 font-bold text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>{t('reports.paidBills')}</span>
                  </div>
                  <div className="text-base font-black text-emerald-700 dark:text-emerald-400 font-mono">
                    {kpis.paidCount}
                  </div>
                  <div className="text-[10px] text-emerald-800/80 dark:text-emerald-400/80 font-mono truncate">
                    {formatCurrency(kpis.paidAmount)}
                  </div>
                </div>

                {/* Partially Paid */}
                <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 rounded-xl p-2.5 space-y-1">
                  <div className="flex items-center justify-center gap-1 text-amber-800 dark:text-amber-300 font-bold text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>{t('reports.partialBills')}</span>
                  </div>
                  <div className="text-base font-black text-amber-700 dark:text-amber-400 font-mono">
                    {kpis.partiallyPaidCount}
                  </div>
                  <div className="text-[10px] text-amber-800/80 dark:text-amber-400/80 font-mono truncate">
                    {formatCurrency(kpis.partiallyPaidAmount)}
                  </div>
                </div>

                {/* Unpaid */}
                <div className="bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-800/50 rounded-xl p-2.5 space-y-1">
                  <div className="flex items-center justify-center gap-1 text-rose-800 dark:text-rose-300 font-bold text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span>{t('reports.unpaidBills')}</span>
                  </div>
                  <div className="text-base font-black text-rose-700 dark:text-rose-400 font-mono">
                    {kpis.unpaidCount}
                  </div>
                  <div className="text-[10px] text-rose-800/80 dark:text-rose-400/80 font-mono truncate">
                    {formatCurrency(kpis.unpaidAmount)}
                  </div>
                </div>
              </div>
            </div>

            {/* 6. Trend / Chart Visualization */}
            <div className="bg-white dark:bg-[#151B23] rounded-xl border border-slate-200 dark:border-[#26303D] p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-xs">
                <h3 className="font-bold text-slate-900 dark:text-[#F9FAFB] uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-amber-500" />
                  <span>
                    {period === 'daily'
                      ? (language === 'ta' ? 'தினசரி பகுப்பாய்வு' : 'Daily Composition')
                      : period === 'weekly'
                      ? (language === 'ta' ? 'வாராந்திர விற்றுமுதல் (திங்கள்–ஞாயிறு)' : 'Daily Turnover (Mon–Sun)')
                      : period === 'monthly'
                      ? (language === 'ta' ? 'மாதாந்திர விற்றுமுதல்' : 'Weekly Turnover')
                      : (language === 'ta' ? 'ஆண்டு விற்றுமுதல் (ஜன–டிச)' : 'Monthly Turnover (Jan–Dec)')}
                  </span>
                </h3>
                <span className="text-[11px] text-slate-400 dark:text-[#9CA3AF] font-mono">{t('reports.turnover')}</span>
              </div>

              {trendPoints.length > 0 && kpis.totalTurnover > 0 ? (
                <div className="pt-2">
                  <div className="flex items-end justify-between gap-1.5 h-32 px-1">
                    {trendPoints.map((pt, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                        {/* Bar */}
                        <div className="w-full max-w-[28px] bg-slate-100 dark:bg-[#1C2430] rounded-t-md relative flex flex-col justify-end overflow-hidden h-24">
                          <div
                            className="w-full bg-amber-500 rounded-t-md transition-all duration-300 group-hover:bg-amber-600"
                            style={{ height: `${Math.max(pt.turnover > 0 ? 6 : 0, pt.percentage)}%` }}
                            title={`${pt.label}: ${formatCurrency(pt.turnover)}`}
                          />
                        </div>

                        {/* Label */}
                        <span className="text-[10px] font-bold text-slate-600 dark:text-[#9CA3AF] mt-1 truncate">
                          {pt.label}
                        </span>
                        {pt.subLabel && (
                          <span className="text-[9px] text-slate-400 dark:text-[#6B7280] truncate">
                            {pt.subLabel}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-center gap-4 text-[11px] text-slate-500 dark:text-[#9CA3AF] pt-2 border-t border-slate-100 dark:border-[#26303D] mt-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-amber-500 rounded-xs" />
                      <span>{t('reports.turnover')}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 dark:text-[#9CA3AF] text-xs">
                  {t('reports.noBillsInPeriod')}
                </div>
              )}
            </div>

            {/* 7. Top Customers Ranking */}
            <div className="bg-white dark:bg-[#151B23] rounded-xl border border-slate-200 dark:border-[#26303D] p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 dark:text-[#F9FAFB] text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-amber-500" />
                  <span>{t('reports.topCustomers')} ({period === 'daily' ? t('reports.daily') : period === 'weekly' ? t('reports.weekly') : period === 'monthly' ? t('reports.monthly') : t('reports.yearly')})</span>
                </h3>
                <span className="text-[11px] text-slate-400 dark:text-[#9CA3AF] font-mono">{language === 'ta' ? 'அளவு அடிப்படையில்' : 'Ranked by Volume'}</span>
              </div>

              {topCustomers.length > 0 ? (
                <div className="space-y-2">
                  {topCustomers.map((cust, idx) => (
                    <div
                      key={cust.mobile}
                      className="p-2.5 bg-slate-50 dark:bg-[#1C2430] rounded-xl border border-slate-200/70 dark:border-[#26303D] flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <span className="w-5 h-5 rounded-full bg-slate-900 dark:bg-amber-500 text-amber-400 dark:text-slate-950 font-mono font-black text-[10px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-[#F9FAFB] truncate">
                            {cust.name}
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-[#9CA3AF] font-mono">
                            {cust.billsCount} {cust.billsCount === 1 ? (language === 'ta' ? 'பில்' : 'bill') : (language === 'ta' ? 'பில்கள்' : 'bills')}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-bold text-slate-900 dark:text-[#F9FAFB] font-mono">
                          {formatCurrency(cust.totalBilled)}
                        </div>
                        {cust.outstanding > 0 ? (
                          <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 font-mono">
                            {t('reports.outstanding')}: {formatCurrency(cust.outstanding)}
                          </div>
                        ) : (
                          <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            {language === 'ta' ? 'முழுவதும் செலுத்தப்பட்டது' : 'Fully Settled'}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 dark:text-[#9CA3AF] text-xs">
                  {t('reports.noBillsInPeriod')}
                </div>
              )}
            </div>

            {/* 8. Report Bill List */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 dark:text-[#F9FAFB] text-sm flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-amber-500" />
                  <span>{t('reports.billsInPeriod')}</span>
                  <span className="text-xs font-normal text-slate-500 dark:text-[#9CA3AF] font-mono">
                    ({filteredBills.length})
                  </span>
                </h3>
              </div>

              {filteredBills.length > 0 ? (
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
                <div className="text-center py-10 bg-white dark:bg-[#151B23] rounded-xl border border-dashed border-slate-300 dark:border-[#26303D] p-6 space-y-2 transition-colors">
                  <Receipt className="w-8 h-8 text-slate-300 dark:text-[#6B7280] mx-auto" />
                  <div className="text-sm font-bold text-slate-700 dark:text-[#F9FAFB]">{t('reports.noBillsInPeriod')}</div>
                  <div className="text-xs text-slate-400 dark:text-[#9CA3AF] max-w-xs mx-auto">
                    {language === 'ta' ? `${periodLabel} காலகட்டத்தில் எந்த பில்களும் இல்லை.` : `No JCB work invoices recorded for ${periodLabel}.`}
                  </div>
                  <button
                    onClick={() => navigate('/create-bill')}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 underline pt-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>{t('nav.createBill')}</span>
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* ================================================================ */}
        {/* MODAL 1: Bill Details Modal (Tapped from Report Bill List)        */}
        {/* ================================================================ */}
        {selectedBill && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
              onClick={() => setSelectedBill(null)}
            />

            <div className="relative w-full max-w-md bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#26303D] rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl z-10 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-200 text-slate-900 dark:text-[#F9FAFB]">
              
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#26303D]">
                <div>
                  <span className="font-mono text-xs font-bold px-2.5 py-1 bg-slate-100 dark:bg-[#1C2430] text-slate-800 dark:text-[#F9FAFB] rounded-md border border-slate-200 dark:border-[#26303D]">
                    {selectedBill.bill_number}
                  </span>
                  <div className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-1">
                    {t('createBill.date')}: {formatDate(selectedBill.bill_date)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge status={selectedBill.payment_status} />
                  <button
                    onClick={() => setSelectedBill(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-[#F9FAFB] hover:bg-slate-100 dark:hover:bg-[#1C2430]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Customer Info */}
              <div className="mt-4 p-3.5 bg-slate-50 dark:bg-[#1C2430] rounded-xl space-y-1 text-xs border border-slate-100 dark:border-[#26303D]">
                <div className="text-[11px] text-slate-400 dark:text-[#9CA3AF] font-semibold uppercase tracking-wider">
                  {t('billModal.customer')}
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-[#F9FAFB]">
                  {selectedBill.customer_name}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="font-mono text-slate-600 dark:text-[#9CA3AF]">{selectedBill.customer_mobile}</span>
                  <a
                    href={`tel:${selectedBill.customer_mobile}`}
                    className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-bold"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{t('common.call')}</span>
                  </a>
                </div>
              </div>

              {/* Working Hours */}
              {selectedBill.working_hours !== null && (
                <div className="mt-3 p-3 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/50 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-[#9CA3AF]">
                    <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>{t('billModal.workingHours')}:</span>
                  </div>
                  <span className="font-mono font-bold text-amber-950 dark:text-amber-300 text-sm">
                    {formatHours(selectedBill.working_hours)}
                  </span>
                </div>
              )}

              {/* Financial Breakdown */}
              <div className="mt-3.5 bg-slate-50 dark:bg-[#1C2430] rounded-xl p-3.5 space-y-2 border border-slate-200/80 dark:border-[#26303D] text-xs">
                <div className="flex justify-between items-center text-sm font-bold text-slate-900 dark:text-[#F9FAFB]">
                  <span>{t('billModal.totalAmount')}:</span>
                  <span className="font-mono">{formatCurrency(selectedBill.total_amount)}</span>
                </div>
                <div className="flex justify-between items-center text-emerald-700 dark:text-emerald-400 font-semibold">
                  <span>{t('billModal.alreadyPaid')}:</span>
                  <span className="font-mono">{formatCurrency(selectedBill.paid_amount)}</span>
                </div>
                <div className="flex justify-between items-center text-rose-600 dark:text-rose-400 font-bold text-sm pt-2 border-t border-slate-200 dark:border-[#26303D]">
                  <span>{t('billModal.balanceDue')}:</span>
                  <span className="font-mono">{formatCurrency(selectedBill.balance_amount)}</span>
                </div>
              </div>

              {/* Action Buttons: WhatsApp, Save to Gallery, Print, View Image, Send SMS, Add Payment & Delete */}
              <div className="mt-5 space-y-2">
                {/* Row 1: Instant WhatsApp & Save to Gallery */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleDirectWhatsApp}
                    className="flex items-center justify-center gap-1.5 py-3 bg-[#25D366] hover:bg-[#20bd5a] active:bg-[#1caa51] text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all"
                  >
                    <MessageCircle className="w-4 h-4 stroke-[2.2]" />
                    <span>{t('actions.whatsApp')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDirectSave}
                    className="flex items-center justify-center gap-1.5 py-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all"
                  >
                    <Download className="w-4 h-4 stroke-[2.5]" />
                    <span>{getGalleryButtonLabel(language)}</span>
                  </button>
                </div>

                {/* Row 2: Print Bill & View Bill Image */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleDirectPrint}
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-xs font-bold active:scale-95 transition-all"
                  >
                    <Printer className="w-4 h-4" />
                    <span>{t('actions.printBill')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsImageModalOpen(true)}
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-slate-900 dark:bg-[#1C2430] hover:bg-slate-800 dark:hover:bg-[#26303D] text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all border border-transparent dark:border-[#26303D]"
                  >
                    <FileImage className="w-4 h-4 text-amber-400" />
                    <span>{t('actions.viewImage')}</span>
                  </button>
                </div>

                {/* Row 3: Send Customer SMS */}
                <button
                  type="button"
                  onClick={() => setIsSmsModalOpen(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs active:scale-[0.99] transition-all"
                >
                  <MessageSquare className="w-4 h-4 text-emerald-100" />
                  <span>{t('actions.sendSms')}</span>
                </button>

                {selectedBill.payment_status !== 'Paid' && selectedBill.balance_amount > 0 && (
                  <button
                    onClick={() => handleOpenAddPayment(selectedBill)}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 rounded-xl text-sm font-bold shadow-xs active:scale-95 transition-all"
                  >
                    <IndianRupee className="w-4 h-4 stroke-[2.5]" />
                    <span>{t('actions.addPayment')}</span>
                  </button>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-white dark:bg-[#151B23] hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs font-bold active:scale-95 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>{t('actions.deleteBill')}</span>
                  </button>

                  <button
                    onClick={() => setSelectedBill(null)}
                    className="py-2.5 px-3 bg-slate-200 dark:bg-[#1C2430] hover:bg-slate-300 dark:hover:bg-[#26303D] text-slate-800 dark:text-[#F9FAFB] rounded-xl text-xs font-bold active:scale-95 transition-all"
                  >
                    {t('common.close')}
                  </button>
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
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#26303D]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                    <IndianRupee className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-[#F9FAFB]">{t('billModal.addPaymentTitle')}</h3>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-[#9CA3AF]">{selectedBill.bill_number}</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsPaymentModalOpen(false)}
                  disabled={isUpdatingPayment}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-[#F9FAFB]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-3.5 p-3 bg-slate-50 dark:bg-[#1C2430] rounded-xl border border-slate-200 dark:border-[#26303D] text-xs space-y-1">
                <div className="flex justify-between text-slate-600 dark:text-[#9CA3AF]">
                  <span>{t('billModal.customer')}:</span>
                  <span className="font-bold text-slate-900 dark:text-[#F9FAFB]">{selectedBill.customer_name}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-[#9CA3AF]">
                  <span>{t('billModal.totalAmount')}:</span>
                  <span className="font-mono">{formatCurrency(billTotal)}</span>
                </div>
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                  <span>{t('billModal.alreadyPaid')}:</span>
                  <span className="font-mono">{formatCurrency(billPaid)}</span>
                </div>
                <div className="flex justify-between text-rose-600 dark:text-rose-400 font-bold pt-1 border-t border-slate-200 dark:border-[#26303D]">
                  <span>{t('billModal.balanceDue')}:</span>
                  <span className="font-mono text-sm">{formatCurrency(billBalance)}</span>
                </div>
              </div>

              <form onSubmit={handleConfirmPayment} className="mt-4 space-y-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-[#9CA3AF]">{t('billModal.paymentAmountLabel')}</label>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentAmountInput(billBalance.toString());
                        setPaymentError(null);
                      }}
                      className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 underline"
                    >
                      {t('actions.payFull')} (₹{billBalance})
                    </button>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 dark:text-[#6B7280]">₹</span>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      max={billBalance}
                      placeholder={`Max ${billBalance}`}
                      value={paymentAmountInput}
                      onChange={(e) => {
                        setPaymentAmountInput(e.target.value);
                        if (paymentError) setPaymentError(null);
                      }}
                      disabled={isUpdatingPayment}
                      autoFocus
                      className="w-full pl-8 pr-4 py-2.5 bg-white dark:bg-[#1C2430] border border-slate-300 dark:border-[#26303D] rounded-xl text-sm font-mono font-bold text-slate-900 dark:text-[#F9FAFB] focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  {paymentError && (
                    <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium mt-1.5 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{paymentError}</span>
                    </div>
                  )}
                </div>

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

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsPaymentModalOpen(false)}
                    disabled={isUpdatingPayment}
                    className="py-2.5 px-3 bg-white dark:bg-[#1C2430] border border-slate-200 dark:border-[#26303D] hover:bg-slate-50 dark:hover:bg-[#26303D] text-slate-700 dark:text-[#9CA3AF] rounded-xl text-xs font-bold active:scale-95 transition-all"
                  >
                    {t('common.cancel')}
                  </button>

                  <button
                    type="submit"
                    disabled={isUpdatingPayment || !isValidPaymentAmount}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isUpdatingPayment ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{language === 'ta' ? 'புதுப்பிக்கிறது...' : 'Updating...'}</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>{t('actions.confirm')}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* MODAL 3: Delete Bill Confirmation Modal                          */}
        {/* ================================================================ */}
        {isDeleteModalOpen && selectedBill && (
          <div className="fixed inset-0 z-65 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs"
              onClick={() => !isDeleting && setIsDeleteModalOpen(false)}
            />

            <div className="relative w-full max-w-sm bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#26303D] rounded-2xl p-5 shadow-2xl z-10 animate-in zoom-in-95 duration-150 text-center text-slate-900 dark:text-[#F9FAFB]">
              <div className="w-11 h-11 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-5 h-5 stroke-[2]" />
              </div>

              <h3 className="text-base font-bold text-slate-900 dark:text-[#F9FAFB]">{t('billHistory.deleteBill')}?</h3>
              <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-1 leading-relaxed">
                {language === 'ta' ? 'எச்சரிக்கை: இந்த பில் உங்கள் பில் வரலாறு மற்றும் அறிக்கைகளில் இருந்து நீக்கப்படும். இந்த செயலை மாற்ற முடியாது.' : 'Warning: This bill will be removed from your billing history and reports. This action cannot be undone.'}
              </p>

              <div className="mt-3.5 p-3 bg-slate-50 dark:bg-[#1C2430] rounded-xl border border-slate-200 dark:border-[#26303D] text-xs space-y-1 font-mono">
                <div className="font-bold text-slate-900 dark:text-[#F9FAFB]">{selectedBill.bill_number}</div>
                <div className="text-slate-600 dark:text-[#9CA3AF] font-sans">{selectedBill.customer_name}</div>
                <div className="text-amber-700 dark:text-amber-400 font-bold">{formatCurrency(selectedBill.total_amount)}</div>
              </div>

              {deleteError && (
                <div className="mt-2.5 p-2 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-lg text-[11px] text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isDeleting}
                  className="py-2.5 px-3 bg-white dark:bg-[#1C2430] border border-slate-200 dark:border-[#26303D] hover:bg-slate-50 dark:hover:bg-[#26303D] text-slate-700 dark:text-[#9CA3AF] rounded-xl text-xs font-bold active:scale-95 transition-all"
                >
                  {t('common.cancel')}
                </button>

                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{language === 'ta' ? 'நீக்குகிறது...' : 'Deleting...'}</span>
                    </>
                  ) : (
                    <span>{t('actions.deleteBill')}</span>
                  )}
                </button>
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
