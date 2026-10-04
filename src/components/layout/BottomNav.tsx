import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ReceiptText, Plus, Users, TrendingUp } from 'lucide-react';
import { useI18n } from '../../i18n';
import { NewBillTypeModal } from '../bills/NewBillTypeModal';

export const BottomNav: React.FC = () => {
  const { t } = useI18n();
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 bg-white dark:bg-[#151B23] border-t border-slate-200 dark:border-[#26303D] z-30 pb-safe transition-colors">
        <div className="max-w-md mx-auto px-3 flex items-center justify-around h-16">
          
          {/* Dashboard */}
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 py-1 text-xs font-medium transition-colors ${
                isActive ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F9FAFB]'
              }`
            }
          >
            <LayoutDashboard className="w-5 h-5 mb-0.5" />
            <span className="truncate max-w-[65px]">{t('nav.home')}</span>
          </NavLink>

          {/* Bill History */}
          <NavLink
            to="/bill-history"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 py-1 text-xs font-medium transition-colors ${
                isActive ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F9FAFB]'
              }`
            }
          >
            <ReceiptText className="w-5 h-5 mb-0.5" />
            <span className="truncate max-w-[65px]">{t('nav.bills')}</span>
          </NavLink>

          {/* Create Bill - Quick Action Button (Opens NewBillTypeModal) */}
          <div className="flex flex-col items-center justify-center -mt-5 px-1">
            <button
              type="button"
              onClick={() => setIsTypeModalOpen(true)}
              className="w-12 h-12 rounded-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black shadow-lg shadow-amber-500/30 flex items-center justify-center active:scale-95 transition-transform border-2 border-white dark:border-[#151B23]"
              aria-label="Create New Bill"
            >
              <Plus className="w-7 h-7 stroke-[2.5]" />
            </button>
            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 mt-1 truncate max-w-[70px]">{t('nav.newBill')}</span>
          </div>

        {/* Customers */}
        <NavLink
          to="/customers"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center flex-1 py-1 text-xs font-medium transition-colors ${
              isActive ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F9FAFB]'
            }`
          }
        >
          <Users className="w-5 h-5 mb-0.5" />
          <span className="truncate max-w-[65px]">{t('nav.customers')}</span>
        </NavLink>

        {/* Reports */}
        <NavLink
          to="/reports"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center flex-1 py-1 text-xs font-medium transition-colors ${
              isActive ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F9FAFB]'
            }`
          }
        >
          <TrendingUp className="w-5 h-5 mb-0.5" />
          <span className="truncate max-w-[65px]">{t('nav.reports')}</span>
        </NavLink>

      </div>
    </nav>

    {/* New Bill Type Selection Modal */}
    <NewBillTypeModal
      isOpen={isTypeModalOpen}
      onClose={() => setIsTypeModalOpen(false)}
    />
  </>
  );
};

