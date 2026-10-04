import React from 'react';
import type { Bill, DbBill } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { useI18n } from '../../i18n';
import { StatusBadge } from '../common/StatusBadge';
import { JCBMachineIcon } from '../common/JCBMachineIcon';
import { Clock, Phone, User, ChevronRight, Truck } from 'lucide-react';

interface BillCardProps {
  bill: Bill | DbBill;
  onClick?: () => void;
  showDetails?: boolean;
}

export const BillCard: React.FC<BillCardProps> = ({ bill, onClick }) => {
  const { t, formatDate, formatHours, language } = useI18n();

  // Normalize both DbBill (snake_case) and legacy Bill (camelCase) formats
  const raw = bill as any;
  const billNumber = raw.bill_number || raw.billNumber || 'JCB-BILL';
  const customerName = raw.customer_name || raw.customerName || 'Customer';
  const customerMobile = raw.customer_mobile || raw.customerPhone || '';
  const billDate = raw.bill_date || raw.date || '';
  const totalAmount = raw.total_amount ?? raw.totalAmount ?? 0;
  const paidAmount = raw.paid_amount ?? raw.paidAmount ?? 0;
  const balanceAmount = raw.balance_amount ?? raw.balanceAmount ?? 0;
  const paymentStatus = raw.payment_status || raw.paymentStatus || 'Unpaid';
  const hours = raw.working_hours ?? raw.totalHours ?? null;
  const isLoad = raw.bill_type === 'loading' || Boolean(raw.loading_details);
  const loadingDetails = raw.loading_details;
  const completeLoadsCount = loadingDetails?.completeLoads ?? (hours !== null ? Number(hours) : 0);

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-[#151B23] rounded-xl border border-slate-200 dark:border-[#26303D] p-4 shadow-xs hover:border-amber-400 active:scale-[0.99] transition-all cursor-pointer relative"
    >
      {/* Top Header: Bill Number & Payment Status */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100 dark:border-[#26303D]">
        {isLoad ? (
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 font-mono text-xs font-bold px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 rounded-md border border-amber-300 dark:border-amber-800/60">
              <Truck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>{billNumber}</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500 text-slate-950">
              {language === 'ta' ? 'ஏற்றுதல் பில்' : 'Loading Bill'}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 font-mono text-xs font-bold px-2.5 py-1 bg-slate-100 dark:bg-[#1C2430] text-slate-800 dark:text-[#F9FAFB] rounded-md border border-slate-200 dark:border-[#26303D]">
            <JCBMachineIcon width={16} height={12} />
            <span>{billNumber}</span>
          </div>
        )}
        <StatusBadge status={paymentStatus} size="sm" />
      </div>

      {/* Customer Name & Tappable Mobile */}
      <div className="space-y-1 mb-2.5">
        <div className="flex items-center gap-2 text-slate-900 dark:text-[#F9FAFB] font-bold text-sm">
          <User className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="truncate">{customerName}</span>
        </div>

        {customerMobile && (
          <div className="pl-6">
            <a
              href={`tel:${customerMobile}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 active:text-blue-900 hover:underline py-0.5"
              title="Tap to call"
            >
              <Phone className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 shrink-0" />
              <span>{customerMobile}</span>
            </a>
          </div>
        )}
      </div>

      {/* Loads or Working Hours Metric */}
      {isLoad ? (
        <div className="flex items-center justify-between text-xs bg-amber-50/70 dark:bg-amber-950/30 px-2.5 py-1.5 rounded-lg mb-3 border border-amber-200/60 dark:border-amber-800/50">
          <div className="flex items-center gap-1.5 text-slate-700 dark:text-[#9CA3AF]">
            <Truck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{language === 'ta' ? 'மொத்த லோடு:' : 'Total Loads:'}</span>
            <span className="font-mono font-bold text-amber-950 dark:text-amber-300">
              {loadingDetails?.totalTractorLoads ?? (loadingDetails?.totalLoads ?? completeLoadsCount)} {language === 'ta' ? 'லோடு' : 'Loads'}
            </span>
          </div>
          {loadingDetails && (
            <span className="text-[11px] font-mono text-slate-500 dark:text-[#9CA3AF]">
              (₹{loadingDetails.combinedRate ?? ((loadingDetails.tractorRate ?? 300) + (loadingDetails.jcbRate ?? 200))}/{language === 'ta' ? 'லோடு' : 'load'})
            </span>
          )}
        </div>
      ) : (
        hours !== null && (
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-[#9CA3AF] bg-slate-50 dark:bg-[#1C2430] px-2.5 py-1.5 rounded-lg mb-3 border border-slate-100 dark:border-[#26303D]">
            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="text-slate-500 dark:text-[#9CA3AF]">{t('billHistory.workingTime')}:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-[#F9FAFB]">{formatHours(hours)}</span>
          </div>
        )
      )}

      {/* Amounts 3-Column Summary: Total, Paid, Balance */}
      <div className="grid grid-cols-3 gap-2 bg-slate-50/80 dark:bg-[#1C2430] rounded-xl p-2.5 border border-slate-200/70 dark:border-[#26303D] text-xs mb-2.5">
        <div>
          <div className="text-[11px] text-slate-500 dark:text-[#9CA3AF] font-medium">{t('billHistory.total')}</div>
          <div className="text-xs font-bold text-slate-900 dark:text-[#F9FAFB] font-mono mt-0.5 truncate">
            {formatCurrency(totalAmount)}
          </div>
        </div>

        <div className="border-x border-slate-200/80 dark:border-[#26303D] px-2">
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">{t('billHistory.paidLabel')}</div>
          <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 font-mono mt-0.5 truncate">
            {formatCurrency(paidAmount)}
          </div>
        </div>

        <div className="text-right">
          <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">{t('billHistory.balanceLabel')}</div>
          <div className={`text-xs font-bold font-mono mt-0.5 truncate ${
            balanceAmount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
          }`}>
            {formatCurrency(balanceAmount)}
          </div>
        </div>
      </div>

      {/* Footer: Date & Details Prompt */}
      <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400 dark:text-[#9CA3AF]">
        <span>{billDate ? formatDate(billDate) : ''}</span>
        <div className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-medium">
          <span>{t('common.details')}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
};

