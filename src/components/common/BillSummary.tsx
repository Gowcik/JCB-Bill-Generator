import React from 'react';
import type { PaymentStatus } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { StatusBadge } from './StatusBadge';
import { useI18n } from '../../i18n';
import { Receipt, DollarSign, Wallet, QrCode } from 'lucide-react';

interface BillSummaryProps {
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  workingHours?: number | null;
  hourlyRate?: number | null;
  extraCharges?: number;
  discount?: number;
  paymentStatus: PaymentStatus;
  upiId?: string | null;
  className?: string;
  showCalculationsTable?: boolean;
}

/**
 * Reusable Bill Summary & Calculation Card for JCB Work Invoices.
 * Cleanly breaks down hours, rate, totals, paid, balance, and payment status badge.
 */
export const BillSummary: React.FC<BillSummaryProps> = ({
  totalAmount,
  paidAmount,
  balanceAmount,
  workingHours,
  hourlyRate,
  extraCharges = 0,
  discount = 0,
  paymentStatus,
  upiId,
  className = '',
  showCalculationsTable = true,
}) => {
  const { language, t, formatHours } = useI18n();

  return (
    <div className={`space-y-3.5 ${className}`}>
      {/* Calculation Table */}
      {showCalculationsTable && workingHours !== undefined && workingHours !== null && workingHours > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="bg-slate-900 text-white px-3 py-2 text-[11px] font-bold uppercase tracking-wider flex justify-between">
            <span>{language === 'ta' ? 'விளக்கம்' : 'DESCRIPTION'}</span>
            <div className="flex gap-4">
              <span>{language === 'ta' ? 'மணி' : 'HOURS'}</span>
              <span>{language === 'ta' ? 'விகிதம்' : 'RATE'}</span>
              <span>{language === 'ta' ? 'தொகை' : 'AMOUNT'}</span>
            </div>
          </div>

          <div className="p-3 text-xs space-y-2">
            <div className="flex items-center justify-between font-semibold text-slate-800">
              <span className="truncate pr-2">JCB Machine Work</span>
              <div className="flex items-center gap-4 font-mono text-right shrink-0">
                <span className="w-14">{formatHours(workingHours)}</span>
                <span className="w-16">{hourlyRate ? `₹${hourlyRate}/h` : '-'}</span>
                <span className="w-20 font-bold">{formatCurrency((workingHours || 0) * (hourlyRate || 0))}</span>
              </div>
            </div>

            {extraCharges > 0 && (
              <div className="flex items-center justify-between text-slate-600 text-[11px] pt-1 border-t border-slate-100">
                <span>{language === 'ta' ? 'கூடுதல் கட்டணம்' : 'Extra Charges'}</span>
                <span className="font-mono font-medium text-slate-900">+{formatCurrency(extraCharges)}</span>
              </div>
            )}

            {discount > 0 && (
              <div className="flex items-center justify-between text-emerald-600 text-[11px]">
                <span>{language === 'ta' ? 'தள்ளுபடி' : 'Discount'}</span>
                <span className="font-mono font-medium">-{formatCurrency(discount)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Summary Metrics Box */}
      <div className="bg-white rounded-xl border-2 border-slate-200 p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider">
            <Receipt className="w-4 h-4 text-amber-500" />
            <span>{t('createBill.billSummary')}</span>
          </div>
          <StatusBadge status={paymentStatus} />
        </div>

        {/* Amount Rows */}
        <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
          {/* Total Amount */}
          <div className="flex justify-between items-center text-sm font-black text-slate-900">
            <span className="text-slate-600 font-bold">{t('createBill.totalAmount')}:</span>
            <span className="font-mono text-base">{formatCurrency(totalAmount)}</span>
          </div>

          {/* Paid Amount */}
          <div className="flex justify-between items-center text-emerald-700 font-semibold">
            <span className="flex items-center gap-1 text-slate-600 font-medium">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              {t('createBill.paidAmount')}:
            </span>
            <span className="font-mono font-bold">{formatCurrency(paidAmount)}</span>
          </div>

          {/* Balance Due */}
          <div className="flex justify-between items-center pt-2 border-t border-slate-200/80">
            <span className="font-bold text-slate-800 flex items-center gap-1 text-sm">
              <Wallet className="w-4 h-4 text-rose-500" />
              {t('createBill.balanceDue')}:
            </span>
            <span className={`font-mono font-black text-base ${balanceAmount > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
              {formatCurrency(balanceAmount)}
            </span>
          </div>
        </div>

        {/* UPI Details (if provided) */}
        {upiId && (
          <div className="mt-3 p-2.5 bg-amber-50/60 border border-amber-200/70 rounded-lg flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-slate-700">
              <QrCode className="w-4 h-4 text-amber-600" />
              <span className="font-semibold">{language === 'ta' ? 'UPI பணம் செலுத்துதல்:' : 'Quick UPI Pay:'}</span>
            </div>
            <span className="font-mono font-bold text-slate-900 select-all">{upiId}</span>
          </div>
        )}
      </div>
    </div>
  );
};
