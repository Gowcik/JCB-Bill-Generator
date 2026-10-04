import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Gauge, Truck, ChevronRight } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useBackButton } from '../../hooks/useBackButton';

interface NewBillTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewBillTypeModal: React.FC<NewBillTypeModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { language } = useI18n();
  const isTamil = language === 'ta';

  useBackButton(isOpen, onClose);

  if (!isOpen) return null;

  const handleSelectMeter = () => {
    onClose();
    navigate('/create-bill');
  };

  const handleSelectLoading = () => {
    onClose();
    navigate('/create-loading-bill');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity" 
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet / Modal Container */}
      <div className="relative w-full max-w-md bg-white dark:bg-[#151B23] rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-[#26303D] p-5 shadow-2xl z-10 space-y-4 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 text-slate-900 dark:text-[#F9FAFB]">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#26303D]">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-[#F9FAFB]">
              {isTamil ? 'பில் வகையைத் தேர்ந்தெடுக்கவும்' : 'Select Bill Type'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-0.5">
              {isTamil ? 'நீங்கள் உருவாக்க விரும்பும் பில் முறையைத் தேர்வுசெய்க' : 'Choose the billing workflow you want to create'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-[#F9FAFB] hover:bg-slate-100 dark:hover:bg-[#1C2430] transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options */}
        <div className="space-y-3 pt-1">
          {/* Option 1: JCB Meter Reading */}
          <button
            type="button"
            onClick={handleSelectMeter}
            className="w-full text-left p-4 rounded-xl border border-slate-200 dark:border-[#26303D] hover:border-amber-400 dark:hover:border-amber-500/80 bg-slate-50/70 dark:bg-[#1C2430] hover:bg-amber-50/40 dark:hover:bg-[#1C2430]/90 transition-all flex items-center justify-between group active:scale-[0.99]"
          >
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                <Gauge className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900 dark:text-[#F9FAFB] group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                    {isTamil ? 'JCB மீட்டர் ரீடிங்' : 'JCB Meter Reading'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-1 leading-relaxed">
                  {isTamil
                    ? 'தொடக்க & முடிவு மீட்டர் ரீடிங், மணி நேரக் கணக்கீடு'
                    : 'Start & end hour meter readings, hourly rate calculation'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-amber-500 shrink-0 ml-2 transition-transform group-hover:translate-x-0.5" />
          </button>

          {/* Option 2: Loading Bill */}
          <button
            type="button"
            onClick={handleSelectLoading}
            className="w-full text-left p-4 rounded-xl border-2 border-amber-400/80 dark:border-amber-500/80 bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-100/40 dark:hover:bg-amber-950/30 transition-all flex items-center justify-between group active:scale-[0.99] shadow-xs"
          >
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 mt-0.5 shadow-md shadow-amber-500/20">
                <Truck className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm text-slate-900 dark:text-[#F9FAFB] group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                    {isTamil ? 'லோடு பில் (மணல் லோடு)' : 'Loading Bill (Sand Loading)'}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                    {isTamil ? 'புதியது' : 'NEW'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed font-medium">
                  {isTamil
                    ? 'டிராக்டர் (₹300) + JCB (₹200) = ₹500/லோடு கணக்கீடு'
                    : 'Tractor (₹300) + JCB (₹200) = ₹500/Load live counter'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 ml-2 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* Footer cancel button for mobile */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-[#26303D] text-slate-600 dark:text-[#9CA3AF] text-xs font-bold hover:bg-slate-100 dark:hover:bg-[#1C2430] transition-colors"
          >
            {isTamil ? 'ரத்து' : 'Cancel'}
          </button>
        </div>

      </div>
    </div>
  );
};
