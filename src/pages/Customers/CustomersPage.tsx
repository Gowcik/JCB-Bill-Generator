import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/layout/AppLayout';
import { getBills, getCachedBills, updateBillPayment, deleteBill } from '../../services/billService';
import { deriveCustomersFromBills, matchesCustomerSearch } from '../../services/customerService';
import type { DbBill, DerivedCustomer } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../i18n';
import { useBackButton } from '../../hooks/useBackButton';
import { BillImageModal } from '../../components/bills/BillImageModal';
import { SendSmsModal } from '../../components/bills/SendSmsModal';
import { generateBillImage, shareToWhatsApp } from '../../services/billImageService';
import { printBill } from '../../services/printService';
import { saveBillToGallery, getGalleryButtonLabel } from '../../services/galleryService';
import { 
  Users, 
  Search, 
  PlusCircle, 
  Phone, 
  X, 
  Loader2, 
  AlertTriangle, 
  CheckCircle2, 
  Receipt, 
  Clock, 
  ChevronRight, 
  IndianRupee, 
  Trash2, 
  Check, 
  FileImage, 
  MessageSquare,
  MessageCircle,
  Printer,
  Download
} from 'lucide-react';

export const CustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const { ownerDetails } = useAuth();
  const { language, t, formatHours, formatDate } = useI18n();

  // Data State
  const cachedBills = getCachedBills();
  const [dbBills, setDbBills] = useState<DbBill[]>(cachedBills || []);
  const [isLoading, setIsLoading] = useState(!cachedBills);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Outstanding' | 'Paid'>('ALL');

  // Customer Details Modal State (tracks by customer mobile)
  const [selectedMobile, setSelectedMobile] = useState<string | null>(null);

  // Bill Details & Payment Modal State (for nested bill interactions)
  const [selectedBill, setSelectedBill] = useState<DbBill | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);

  // Payment Form State
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Deletion State
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
  useBackButton(
    selectedMobile !== null && selectedBill === null && !isPaymentModalOpen && !isDeleteModalOpen && !isImageModalOpen && !isSmsModalOpen,
    () => setSelectedMobile(null)
  );

  // Feedback Toast
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

  // Fetch real bills from PostgreSQL
  const loadBills = async (force: boolean = false) => {
    try {
      setErrorMessage(null);
      if (!getCachedBills() && dbBills.length === 0) {
        setIsLoading(true);
      }
      const bills = await getBills(force);
      setDbBills(bills);
    } catch (err: any) {
      console.error('[CustomersPage] Error fetching bills:', err);
      setErrorMessage('Unable to load customers. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBills();
  }, []);

  // 1. Derive unique customer profiles dynamically from PostgreSQL bills
  const customers: DerivedCustomer[] = useMemo(() => {
    return deriveCustomersFromBills(dbBills);
  }, [dbBills]);

  // Active customer object currently viewed in details modal
  const activeCustomer: DerivedCustomer | null = useMemo(() => {
    if (!selectedMobile) return null;
    return customers.find((c) => c.mobile === selectedMobile) || null;
  }, [customers, selectedMobile]);

  // Total working hours for active customer in detailed report (Meter bills only)
  const activeCustomerTotalHours = useMemo(() => {
    if (!activeCustomer) return 0;
    return activeCustomer.bills.reduce((sum, b) => {
      const isLoading = b.bill_type === 'loading' || Boolean(b.loading_details) || Boolean(b.bill_number?.startsWith('LOAD'));
      return sum + (!isLoading ? (Number(b.working_hours) || 0) : 0);
    }, 0);
  }, [activeCustomer]);

  // 2. Dynamic statistics at the top of the Customers page
  const stats = useMemo(() => {
    const totalCustomers = customers.length;
    const outstandingCount = customers.filter((c) => c.status === 'Outstanding').length;
    const paidCount = customers.filter((c) => c.status === 'Paid').length;
    const totalOutstanding = customers.reduce((sum, c) => sum + c.outstandingBalance, 0);

    return {
      totalCustomers,
      outstandingCount,
      paidCount,
      totalOutstanding,
    };
  }, [customers]);

  // 3. Filtered customer list
  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const matchesSearch = matchesCustomerSearch(customer, searchTerm);
      const matchesFilter =
        statusFilter === 'ALL' || customer.status === statusFilter;
      return matchesSearch && matchesFilter;
    });
  }, [customers, searchTerm, statusFilter]);

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
        // Refresh local bill list from PostgreSQL
        setDbBills((prev) => prev.map((b) => (b.id === updatedBill.id ? updatedBill : b)));
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
    <AppLayout title={t('nav.customers')} subtitle={t('customers.subtitle')} showBack>
      <div className="space-y-3.5">
        
        {/* Floating Toast Notification */}
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

        {/* 1. Customer Statistics Banner */}
        <div className="bg-slate-900 dark:bg-[#151B23] text-white rounded-2xl p-4 shadow-sm border border-slate-800 dark:border-[#26303D] transition-colors">
          <div className="grid grid-cols-3 gap-2 divide-x divide-slate-800 dark:divide-[#26303D] text-center">
            <div>
              <div className="text-[11px] text-slate-400 dark:text-slate-400 font-medium uppercase tracking-wider">
                {t('customers.totalCustomers')}
              </div>
              <div className="text-xl font-black text-white mt-0.5 font-mono">
                {stats.totalCustomers}
              </div>
            </div>

            <div className="pl-2">
              <div className="text-[11px] text-amber-400 font-medium uppercase tracking-wider">
                {t('customers.outstanding')}
              </div>
              <div className="text-xl font-black text-amber-400 mt-0.5 font-mono">
                {stats.outstandingCount}
              </div>
            </div>

            <div className="pl-2">
              <div className="text-[11px] text-rose-400 font-medium uppercase tracking-wider">
                {t('customers.totalBalanceDue')}
              </div>
              <div className="text-base font-black text-rose-400 mt-0.5 font-mono truncate">
                {formatCurrency(stats.totalOutstanding)}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Action Row: Search & Create Bill Link */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={t('customers.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#26303D] text-slate-900 dark:text-[#F9FAFB] rounded-xl text-sm placeholder:text-slate-400 dark:placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent shadow-xs transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              onClick={() => navigate('/create-bill')}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold px-3.5 py-2.5 rounded-xl text-xs shrink-0 shadow-xs active:scale-95 transition-all"
            >
              <PlusCircle className="w-4 h-4 stroke-[2.5]" />
              <span>{t('nav.createBill')}</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400 dark:text-slate-400 px-1">
            {language === 'ta' ? '* முதல் பில் உருவாக்கும் போது வாடிக்கையாளர் தானாக சேர்க்கப்படுவார்.' : '* Customers are automatically added when you create their first bill.'}
          </div>
        </div>

        {/* 3. Status Filters: ALL, OUTSTANDING, PAID */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          {[
            { id: 'ALL', label: t('customers.all'), count: stats.totalCustomers },
            { id: 'Outstanding', label: t('customers.outstanding'), count: stats.outstandingCount },
            { id: 'Paid', label: t('customers.paid'), count: stats.paidCount },
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

        {/* 4. Customer Directory List & States */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-2" />
            <span className="text-xs font-semibold">{t('common.loading')}</span>
          </div>
        ) : errorMessage ? (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs text-center space-y-2">
            <AlertTriangle className="w-6 h-6 mx-auto text-rose-500" />
            <div>{errorMessage}</div>
            <button
              onClick={() => loadBills(true)}
              className="text-xs font-bold text-rose-800 underline hover:text-rose-900"
            >
              {t('common.retry')}
            </button>
          </div>
        ) : filteredCustomers.length > 0 ? (
          <div className="space-y-3">
            {filteredCustomers.map((customer) => {
              const isOutstanding = customer.status === 'Outstanding';

              return (
                <div
                  key={customer.mobile}
                  onClick={() => setSelectedMobile(customer.mobile)}
                  className="bg-white dark:bg-[#151B23] rounded-2xl border border-slate-200 dark:border-[#26303D] p-4 shadow-xs hover:border-amber-400 dark:hover:border-amber-500/60 active:scale-[0.99] transition-all cursor-pointer relative space-y-3"
                >
                  {/* Top: Customer Tag & Name + Status Badge */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                        {t('customers.customerLabel')}
                      </div>
                      <h3 className="font-extrabold text-base text-slate-900 dark:text-[#F9FAFB] tracking-tight">
                        {customer.name}
                      </h3>
                    </div>

                    {isOutstanding ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                        <span>{t('customers.outstanding')}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span>{t('customers.cleared')}</span>
                      </span>
                    )}
                  </div>

                  {/* Middle: Mobile with Quick Dial */}
                  <div>
                    <a
                      href={`tel:${customer.mobile}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 active:underline"
                      title={t('customers.callCustomer')}
                    >
                      <Phone className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 shrink-0" />
                      <span>{customer.mobile}</span>
                    </a>
                  </div>

                  {/* Financial 3-Column Summary: Bills | Billed | Due */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-[#1C2430] p-2.5 rounded-xl border border-slate-200/80 dark:border-[#26303D] text-center">
                    <div>
                      <div className="text-sm font-extrabold text-slate-900 dark:text-[#F9FAFB] font-mono">
                        {customer.totalBills}
                      </div>
                      <div className="text-[10px] font-semibold text-slate-500 dark:text-[#9CA3AF] uppercase tracking-wider mt-0.5">
                        {t('customers.billsCountLabel')}
                      </div>
                    </div>

                    <div className="border-x border-slate-200/80 dark:border-[#26303D] px-1">
                      <div className="text-sm font-extrabold text-slate-900 dark:text-[#F9FAFB] font-mono truncate">
                        {formatCurrency(customer.totalBilledAmount)}
                      </div>
                      <div className="text-[10px] font-semibold text-slate-500 dark:text-[#9CA3AF] uppercase tracking-wider mt-0.5">
                        {t('customers.billedLabel')}
                      </div>
                    </div>

                    <div>
                      <div className={`text-sm font-extrabold font-mono truncate ${
                        isOutstanding ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {formatCurrency(customer.outstandingBalance)}
                      </div>
                      <div className="text-[10px] font-semibold text-slate-500 dark:text-[#9CA3AF] uppercase tracking-wider mt-0.5">
                        {t('customers.dueLabel')}
                      </div>
                    </div>
                  </div>

                  {/* Compact Action Button: View Report → */}
                  <button
                    type="button"
                    onClick={() => setSelectedMobile(customer.mobile)}
                    className="w-full py-2 px-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 active:bg-amber-500/30 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>{t('customers.viewReport')}</span>
                    <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty States */
          <div className="text-center py-12 bg-white dark:bg-[#151B23] rounded-xl border border-dashed border-slate-300 dark:border-[#26303D] p-6 space-y-3 transition-colors">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-[#1C2430] text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto">
              {searchTerm ? (
                <Search className="w-6 h-6 text-slate-400 dark:text-slate-500" />
              ) : (
                <Users className="w-6 h-6 text-slate-400 dark:text-slate-500" />
              )}
            </div>

            <div>
              <div className="text-sm font-bold text-slate-800 dark:text-[#F9FAFB]">
                {searchTerm
                  ? t('customers.noCustomersFound')
                  : statusFilter === 'Outstanding'
                  ? (language === 'ta' ? 'நிலுவை வாடிக்கையாளர்கள் இல்லை' : 'No Customers with Outstanding Balance')
                  : statusFilter === 'Paid'
                  ? (language === 'ta' ? 'முழுவதும் செலுத்திய வாடிக்கையாளர்கள் இல்லை' : 'No Paid Customers Yet')
                  : t('customers.noCustomersFound')}
              </div>
              <div className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-1 max-w-xs mx-auto">
                {searchTerm
                  ? t('customers.noCustomersMatch')
                  : statusFilter === 'Outstanding'
                  ? (language === 'ta' ? 'அனைத்து வாடிக்கையாளர்களும் நிலுவை தொகையை செலுத்திவிட்டனர்.' : 'All customers have cleared their outstanding dues.')
                  : statusFilter === 'Paid'
                  ? (language === 'ta' ? 'நிலுவை இல்லாத வாடிக்கையாளர்கள் இங்கு தோன்றுவார்கள்.' : 'Customers with zero balance will appear here.')
                  : (language === 'ta' ? 'முதல் பில் உருவாக்கிய பின் வாடிக்கையாளர்கள் இங்கு தோன்றுவர்.' : 'Customers will appear automatically after you create your first bill.')}
              </div>
            </div>

            {customers.length === 0 && !searchTerm && (
              <button
                onClick={() => navigate('/create-bill')}
                className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all mt-2"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{t('createBill.generateBill')}</span>
              </button>
            )}

            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline"
              >
                {language === 'ta' ? 'தேடலை நீக்கு' : 'Clear Search'}
              </button>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* MODAL 1: Customer Details & Detailed Report Modal                 */}
        {/* ================================================================ */}
        {activeCustomer && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs"
              onClick={() => setSelectedMobile(null)}
            />

            <div className="relative w-full max-w-md bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#26303D] rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl z-10 max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-200 text-slate-900 dark:text-[#F9FAFB] transition-colors">
              
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#26303D]">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                    {t('customers.detailedReport')}
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-[#F9FAFB]">
                    {activeCustomer.name}
                  </h3>
                  <div className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-0.5">
                    {activeCustomer.totalBills} {activeCustomer.totalBills === 1 ? (language === 'ta' ? 'பில்' : 'Invoice') : (language === 'ta' ? 'பில்கள்' : 'Invoices')}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {activeCustomer.status === 'Outstanding' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                      <span>{t('customers.outstanding')}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>{t('customers.cleared')}</span>
                    </span>
                  )}
                  <button
                    onClick={() => setSelectedMobile(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1C2430] min-w-[36px] min-h-[36px] flex items-center justify-center"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Quick Contact & Native Phone Dialer */}
              <div className="mt-3.5 p-3.5 bg-slate-50 dark:bg-[#1C2430] rounded-xl flex items-center justify-between border border-slate-100 dark:border-[#26303D]">
                <div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-400 font-semibold uppercase tracking-wider">
                    {language === 'ta' ? 'வாடிக்கையாளர் தொடர்பு' : 'Customer Contact'}
                  </div>
                  <div className="font-mono text-sm font-bold text-slate-900 dark:text-[#F9FAFB] mt-0.5">
                    {activeCustomer.mobile}
                  </div>
                </div>

                <a
                  href={`tel:${activeCustomer.mobile}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800/60 rounded-lg text-xs font-bold active:scale-95 transition-all"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{t('common.call')}</span>
                </a>
              </div>

              {/* Financial & Work Breakdown Card (With Total Working Hours) */}
              <div className="mt-3.5 bg-slate-900 dark:bg-[#1C2430] text-white rounded-xl p-3.5 space-y-2.5 text-xs border border-slate-800 dark:border-[#26303D]">
                <div className="text-slate-400 font-semibold uppercase tracking-wider text-[11px] flex items-center justify-between">
                  <span>{language === 'ta' ? 'முழு கணக்கு & வேலை அறிக்கை' : 'Financial & Work Summary'}</span>
                  <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatHours(activeCustomerTotalHours)}</span>
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 dark:border-[#26303D]">
                  <div>
                    <div className="text-[11px] text-slate-400">{t('customers.totalBilled')}</div>
                    <div className="text-sm font-bold text-white font-mono mt-0.5 truncate">
                      {formatCurrency(activeCustomer.totalBilledAmount)}
                    </div>
                  </div>
                  <div className="border-x border-slate-800 dark:border-[#26303D] px-2">
                    <div className="text-[11px] text-emerald-400">{t('customers.totalPaid')}</div>
                    <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5 truncate">
                      {formatCurrency(activeCustomer.totalPaidAmount)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-rose-400">{t('customers.dueLabel')}</div>
                    <div className="text-sm font-bold text-rose-400 font-mono mt-0.5 truncate">
                      {formatCurrency(activeCustomer.outstandingBalance)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Customer Bill History Section */}
              <div className="mt-5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-[#F9FAFB] flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-amber-500" />
                    <span>{t('customers.billHistory')}</span>
                    <span className="text-xs font-normal text-slate-500 dark:text-[#9CA3AF] font-mono">
                      ({activeCustomer.bills.length})
                    </span>
                  </h4>
                  <span className="text-[11px] text-slate-400 dark:text-[#9CA3AF]">
                    {language === 'ta' ? 'புதியது முதலில்' : 'Newest first'}
                  </span>
                </div>

                <div className="space-y-2">
                  {activeCustomer.bills.map((bill) => (
                    <div
                      key={bill.id}
                      onClick={() => setSelectedBill(bill)}
                      className="p-3 bg-white dark:bg-[#1C2430] border border-slate-200 dark:border-[#26303D] rounded-xl hover:border-amber-400 dark:hover:border-amber-500 active:scale-[0.99] transition-all cursor-pointer shadow-2xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-[#F9FAFB]">
                          {bill.bill_number}
                        </span>
                        <StatusBadge status={bill.payment_status} size="sm" />
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#9CA3AF]">
                        <span>{t('createBill.date')}: {formatDate(bill.bill_date)}</span>
                        {bill.working_hours !== null && (
                          <span className="flex items-center gap-1 font-mono text-slate-700 dark:text-slate-300">
                            <Clock className="w-3 h-3 text-amber-500" />
                            {formatHours(bill.working_hours)}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-slate-100 dark:border-[#26303D] text-[11px]">
                        <div>
                          <span className="text-slate-400 dark:text-[#9CA3AF]">{t('billHistory.total')}: </span>
                          <strong className="font-mono text-slate-800 dark:text-slate-200">{formatCurrency(bill.total_amount)}</strong>
                        </div>
                        <div className="text-center">
                          <span className="text-slate-400 dark:text-[#9CA3AF]">{t('billHistory.paidLabel')}: </span>
                          <strong className="font-mono text-emerald-700 dark:text-emerald-400">{formatCurrency(bill.paid_amount)}</strong>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-400 dark:text-[#9CA3AF]">{t('billHistory.balanceLabel')}: </span>
                          <strong className={`font-mono ${bill.balance_amount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {formatCurrency(bill.balance_amount)}
                          </strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Close Button */}
              <div className="mt-5 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedMobile(null)}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 dark:bg-amber-500 dark:hover:bg-amber-600 dark:text-slate-950 text-white rounded-xl text-xs font-bold active:scale-95 transition-all"
                >
                  {t('common.close')}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* MODAL 2: Bill Details View (Tapped from Customer Bill History)     */}
        {/* ================================================================ */}
        {selectedBill && (
          <div className="fixed inset-0 z-55 flex items-end sm:items-center justify-center p-0 sm:p-4">
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
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1C2430]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Customer Info */}
              <div className="mt-4 p-3 bg-slate-50 dark:bg-[#1C2430] border border-slate-100 dark:border-[#26303D] rounded-xl space-y-1 text-xs">
                <div className="text-[11px] text-slate-400 dark:text-[#9CA3AF] font-semibold uppercase tracking-wider">
                  {t('billModal.customer')}
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-[#F9FAFB]">
                  {selectedBill.customer_name}
                </div>
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-[#9CA3AF] font-mono">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedBill.customer_mobile}</span>
                </div>
              </div>

              {/* Working Hours */}
              {selectedBill.working_hours !== null && (
                <div className="mt-3 p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
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
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-xs font-bold active:scale-95 transition-all"
                  >
                    <Printer className="w-4 h-4" />
                    <span>{t('actions.printBill')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsImageModalOpen(true)}
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-slate-900 dark:bg-[#26303D] hover:bg-slate-800 dark:hover:bg-[#323D4D] text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all"
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
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-white dark:bg-[#151B23] hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs font-bold active:scale-95 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>{t('actions.deleteBill')}</span>
                  </button>

                  <button
                    onClick={() => setSelectedBill(null)}
                    className="py-2.5 px-3 bg-slate-200 dark:bg-[#26303D] hover:bg-slate-300 dark:hover:bg-[#323D4D] text-slate-800 dark:text-[#F9FAFB] rounded-xl text-xs font-bold active:scale-95 transition-all"
                  >
                    {t('actions.backToHistory')}
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* MODAL 3: Add Payment Modal                                       */}
        {/* ================================================================ */}
        {isPaymentModalOpen && selectedBill && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs"
              onClick={() => !isUpdatingPayment && setIsPaymentModalOpen(false)}
            />

            <div className="relative w-full max-w-sm bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#26303D] text-slate-900 dark:text-[#F9FAFB] rounded-2xl p-5 shadow-2xl z-10 animate-in zoom-in-95 duration-150">
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
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
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
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t('billModal.paymentAmountLabel')}</label>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentAmountInput(billBalance.toString());
                        setPaymentError(null);
                      }}
                      className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline"
                    >
                      {t('actions.payFull')} (₹{billBalance})
                    </button>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
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
                  <div className="p-2.5 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-[11px] space-y-1">
                    <div className="flex justify-between text-emerald-800 dark:text-emerald-300">
                      <span>{t('billModal.newTotalPaid')}:</span>
                      <strong className="font-mono">{formatCurrency(previewNewPaid)}</strong>
                    </div>
                    <div className="flex justify-between text-emerald-800 dark:text-emerald-300">
                      <span>{t('billModal.remainingBalance')}:</span>
                      <strong className="font-mono">{formatCurrency(previewNewBalance)}</strong>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-emerald-200 dark:border-emerald-800/60">
                      <span className="text-slate-600 dark:text-slate-400">{t('billModal.updatedStatus')}:</span>
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
        {/* MODAL 4: Delete Bill Confirmation Modal                          */}
        {/* ================================================================ */}
        {isDeleteModalOpen && selectedBill && (
          <div className="fixed inset-0 z-65 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs"
              onClick={() => !isDeleting && setIsDeleteModalOpen(false)}
            />

            <div className="relative w-full max-w-sm bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#26303D] text-slate-900 dark:text-[#F9FAFB] rounded-2xl p-5 shadow-2xl z-10 animate-in zoom-in-95 duration-150 text-center">
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
                <div className="mt-2.5 p-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg text-[11px] text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
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
        {/* MODAL 5: Bill Image Modal (Phase 9 - Temporary Image)             */}
        {/* ================================================================ */}
        <BillImageModal
          isOpen={isImageModalOpen}
          onClose={() => setIsImageModalOpen(false)}
          bill={selectedBill}
          ownerDetails={ownerDetails}
        />

        {/* ================================================================ */}
        {/* MODAL 6: Send SMS Modal (Phase 10 - MSG91 + Supabase Function)    */}
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
