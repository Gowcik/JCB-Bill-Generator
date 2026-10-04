import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/layout/AppLayout';
import { mockBills, mockDashboardStats, mockOwnerProfile } from '../../data/mockData';
import { getBills, getCachedBills } from '../../services/billService';
import { formatCurrency } from '../../utils/formatters';
import { toDateString } from '../../utils/calendarUtils';
import { isSupabaseConfigured } from '../../services/supabaseClient';
import type { DbBill } from '../../types';
import { 
  PlusCircle, 
  Receipt, 
  IndianRupee, 
  AlertTriangle, 
  Clock, 
  ShieldCheck,
  TrendingUp
} from 'lucide-react';
import { ActionButton } from '../../components/common/ActionButton';
import { JCBMachineIcon } from '../../components/common/JCBMachineIcon';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../i18n';
import { NewBillTypeModal } from '../../components/bills/NewBillTypeModal';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { ownerDetails, profile } = useAuth();
  const { language, t, formatHours } = useI18n();
  const [period, setPeriod] = useState<'today' | 'month'>('today');
  const [dbBills, setDbBills] = useState<DbBill[]>(() => getCachedBills() || []);
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);

  const isTamil = language === 'ta';

  // Fetch real bills from PostgreSQL
  useEffect(() => {
    let isMounted = true;
    getBills().then((bills) => {
      if (isMounted) setDbBills(bills);
    }).catch((err) => {
      console.warn('[DashboardPage] Error loading bills:', err);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const businessName = ownerDetails?.business_name || mockOwnerProfile.businessName;
  const ownerName = ownerDetails?.owner_name || profile?.username || mockOwnerProfile.ownerName;
  const jcbReg = ownerDetails?.registration_number || mockOwnerProfile.jcbRegistrationNumber;
  const hourlyRate = ownerDetails?.hourly_rate ? Number(ownerDetails.hourly_rate) : mockOwnerProfile.defaultHourlyRate;

  // Real bill calculations
  const todayDate = toDateString(new Date());
  const currentMonth = todayDate.substring(0, 7);

  const stats = useMemo(() => {
    if (isSupabaseConfigured) {
      const todayBills = dbBills.filter((b) => b.bill_date === todayDate);
      const todayTurnoverAmount = todayBills.reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
      const todayHoursCount = todayBills.reduce((sum, b) => {
        const isLoading = b.bill_type === 'loading' || Boolean(b.loading_details) || Boolean(b.bill_number?.startsWith('LOAD'));
        return sum + (!isLoading ? Number(b.working_hours || 0) : 0);
      }, 0);
      const todayOutstanding = todayBills.reduce((sum, b) => sum + Number(b.balance_amount || 0), 0);

      const monthBills = dbBills.filter((b) => (b.bill_date || '').startsWith(currentMonth));
      const monthTurnoverAmount = monthBills.reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
      const monthHoursCount = monthBills.reduce((sum, b) => {
        const isLoading = b.bill_type === 'loading' || Boolean(b.loading_details) || Boolean(b.bill_number?.startsWith('LOAD'));
        return sum + (!isLoading ? Number(b.working_hours || 0) : 0);
      }, 0);
      const monthOutstanding = monthBills.reduce((sum, b) => sum + Number(b.balance_amount || 0), 0);

      const totalAllTimeTurnover = dbBills.reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
      const totalAllTimeOutstanding = dbBills.reduce((sum, b) => sum + Number(b.balance_amount || 0), 0);

      return {
        today: {
          billsCount: todayBills.length,
          turnover: todayTurnoverAmount,
          hours: Math.round(todayHoursCount * 100) / 100,
          outstanding: todayOutstanding,
        },
        month: {
          billsCount: monthBills.length,
          turnover: monthTurnoverAmount,
          hours: Math.round(monthHoursCount * 100) / 100,
          outstanding: monthOutstanding,
        },
        monthlyTurnover: monthTurnoverAmount,
        totalAllTimeTurnover,
        totalAllTimeOutstanding,
      };
    }

    // Default foundation mock data if database is unconfigured
    const mockMonthBills = mockBills.filter((b) => (b.date || '').startsWith(currentMonth));
    const mockMonthTurnover = mockMonthBills.length > 0
      ? mockMonthBills.reduce((sum, b) => sum + (b.totalAmount || 0), 0)
      : mockDashboardStats.monthlyTurnover;
    const mockMonthHours = mockMonthBills.length > 0
      ? mockMonthBills.reduce((sum, b) => sum + (b.totalHours || 0), 0)
      : 12.5;
    const mockMonthOutstanding = mockMonthBills.length > 0
      ? mockMonthBills.reduce((sum, b) => sum + (b.balanceAmount || 0), 0)
      : 5000;

    return {
      today: {
        billsCount: mockDashboardStats.todayBillsCount,
        turnover: mockDashboardStats.todayTurnover,
        hours: mockDashboardStats.totalHoursToday,
        outstanding: 5000,
      },
      month: {
        billsCount: mockMonthBills.length || 4,
        turnover: mockMonthTurnover,
        hours: Math.round(mockMonthHours * 100) / 100,
        outstanding: mockMonthOutstanding,
      },
      monthlyTurnover: mockDashboardStats.monthlyTurnover,
      totalAllTimeTurnover: 245000,
      totalAllTimeOutstanding: mockDashboardStats.totalOutstandingAmount,
    };
  }, [dbBills, todayDate, currentMonth]);

  const currentStats = stats[period];


  return (
    <AppLayout isDashboard subtitle={businessName}>
      <div className="space-y-4">
        
        {/* 1. Owner & JCB Machine Placeholder Card at the top */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-4 text-white shadow-md border border-slate-700/60">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center p-1 shrink-0 shadow-xs">
                <JCBMachineIcon width={32} height={24} />
              </div>
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1.5 text-amber-400 text-xs font-semibold tracking-wide uppercase">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{t('dashboard.verifiedOwner')}</span>
                </div>
                <h2 className="text-base font-bold text-white tracking-tight truncate">
                  {businessName}
                </h2>
                <p className="text-xs text-slate-300">
                  {t('dashboard.proprietor')}: <span className="text-white font-medium">{ownerName}</span>
                </p>
              </div>
            </div>
            
            <button
              onClick={() => navigate('/owner-details')}
              className="text-xs font-semibold text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 px-2.5 py-1 rounded-lg border border-amber-400/30 transition-colors shrink-0"
            >
              {t('common.details')}
            </button>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">JCB Reg:</span>
              <span className="font-mono font-bold bg-amber-500 text-slate-950 px-2 py-0.5 rounded text-[11px]">
                {jcbReg}
              </span>
            </div>
            <div className="text-slate-300">
              {t('dashboard.standardRate')}: <strong className="text-amber-400">₹{hourlyRate}/hr</strong>
            </div>
          </div>
        </div>

        {/* 2. Primary Action: Create New Bill Button */}
        <div>
          <ActionButton
            size="lg"
            variant="primary"
            onClick={() => setIsTypeModalOpen(true)}
            icon={<PlusCircle className="w-5 h-5 stroke-[2.5]" />}
          >
            {t('dashboard.createNewBill')}
          </ActionButton>
        </div>

        {/* 3. Period Selector Toggle: Today vs This Month */}
        <div className="bg-slate-200/70 dark:bg-[#151B23] p-1 rounded-xl flex border border-slate-200 dark:border-[#26303D] transition-colors">
          <button
            type="button"
            onClick={() => setPeriod('today')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all text-center select-none active:scale-[0.98] ${
              period === 'today'
                ? 'bg-[#FFCC00] text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F9FAFB]'
            }`}
          >
            {isTamil ? 'இன்று' : 'Today'}
          </button>

          <button
            type="button"
            onClick={() => setPeriod('month')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all text-center select-none active:scale-[0.98] ${
              period === 'month'
                ? 'bg-[#FFCC00] text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F9FAFB]'
            }`}
          >
            {isTamil ? 'இந்த மாதம்' : 'This Month'}
          </button>
        </div>

        {/* 4. Key Financial Metrics: Bills, Turnover, Outstanding Amount */}
        <div className="grid grid-cols-2 gap-3">
          
          {/* Bills Count Card */}
          <div className="bg-white dark:bg-[#151B23] rounded-xl border border-slate-200 dark:border-[#26303D] p-3.5 shadow-xs transition-colors">
            <div className="flex items-center justify-between text-slate-500 dark:text-[#9CA3AF] mb-1.5">
              <span className="text-xs font-medium">
                {period === 'today' 
                  ? (isTamil ? 'இன்றைய பில்கள்' : "Today's Bills") 
                  : (isTamil ? 'இந்த மாத பில்கள்' : "This Month's Bills")}
              </span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-[#F9FAFB]">
              {currentStats.billsCount}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-[#9CA3AF] mt-1">
              <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
              <span>{formatHours(currentStats.hours)}</span>
            </div>
          </div>

          {/* Turnover Card */}
          <div className="bg-white dark:bg-[#151B23] rounded-xl border border-slate-200 dark:border-[#26303D] p-3.5 shadow-xs transition-colors">
            <div className="flex items-center justify-between text-slate-500 dark:text-[#9CA3AF] mb-1.5">
              <span className="text-xs font-medium">
                {period === 'today' 
                  ? (isTamil ? 'இன்றைய விற்றுமுதல்' : "Today's Turnover") 
                  : (isTamil ? 'இந்த மாத விற்றுமுதல்' : "This Month's Turnover")}
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <IndianRupee className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {formatCurrency(currentStats.turnover)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-[#9CA3AF] mt-1">
              {period === 'today' ? (isTamil ? 'இன்று' : 'Daily') : (isTamil ? 'இந்த மாதம்' : 'Monthly')}
            </div>
          </div>

        </div>

        {/* Outstanding Amount Card (Full Width) */}
        <div className="bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl p-3.5 shadow-xs transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-rose-800 dark:text-rose-300 uppercase tracking-wide">
                  {period === 'today'
                    ? (isTamil ? 'இன்றைய நிலுவை' : "Today's Pending")
                    : (isTamil ? 'இந்த மாத நிலுவை' : "This Month's Pending")}
                </div>
                <div className="text-xs text-rose-600 dark:text-rose-400">
                  {isTamil ? 'வசூலிக்க வேண்டிய தொகை' : 'Pending Balance Due'}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-black text-rose-700 dark:text-rose-300">
                {formatCurrency(currentStats.outstanding)}
              </div>
              <button
                onClick={() => navigate('/bill-history')}
                className="text-[11px] font-bold text-rose-700 dark:text-rose-400 underline mt-0.5 hover:text-rose-900 dark:hover:text-rose-300"
              >
                {t('common.details')}
              </button>
            </div>
          </div>
        </div>

        {/* Summary Quick Pill (Monthly Turnover in Today mode; All-Time Turnover in Month mode to prevent duplication) */}
        <div className="bg-white dark:bg-[#151B23] rounded-xl border border-slate-200 dark:border-[#26303D] p-3 flex items-center justify-between text-xs transition-colors">
          <div className="flex items-center gap-2 text-slate-600 dark:text-[#9CA3AF]">
            <TrendingUp className="w-4 h-4 text-amber-500" />
            <span>
              {period === 'today'
                ? t('dashboard.monthlyTurnover')
                : (isTamil ? 'மொத்த விற்றுமுதல்' : 'All-Time Turnover')}
            </span>
          </div>
          <div className="font-bold text-slate-900 dark:text-[#F9FAFB] font-mono">
            {formatCurrency(period === 'today' ? stats.monthlyTurnover : stats.totalAllTimeTurnover)}
          </div>
        </div>

        {/* New Bill Type Selection Modal */}
        <NewBillTypeModal
          isOpen={isTypeModalOpen}
          onClose={() => setIsTypeModalOpen(false)}
        />

      </div>
    </AppLayout>
  );
};
