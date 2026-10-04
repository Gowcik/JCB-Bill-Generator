import React from 'react';
import { Phone } from 'lucide-react';
import { useI18n } from '../../i18n';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string | null;
  autoFocus?: boolean;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  disabled = false,
  error,
  autoFocus = false,
}) => {
  const { language, t } = useI18n();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Keep only numbers, max 10 digits
    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10);
    onChange(cleaned);
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold text-slate-700 dark:text-[#9CA3AF] uppercase tracking-wider">
        {t('auth.mobileNumber')} <span className="text-amber-500">*</span>
      </label>
      
      <div className="relative flex items-center">
        {/* Country code prefix */}
        <div className="absolute left-3 flex items-center gap-1.5 border-r border-slate-200 dark:border-[#26303D] pr-2.5 text-slate-800 dark:text-[#F9FAFB] font-mono font-bold text-sm select-none">
          <span className="text-base" role="img" aria-label="India Flag">🇮🇳</span>
          <span>+91</span>
        </div>

        {/* 10-digit input */}
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          pattern="[6-9][0-9]{9}"
          maxLength={10}
          autoFocus={autoFocus}
          disabled={disabled}
          value={value}
          onChange={handleChange}
          placeholder="98765 43210"
          className={`w-full pl-22 pr-10 py-3.5 bg-slate-50 dark:bg-[#1C2430] border rounded-xl text-base font-mono font-semibold tracking-wider text-slate-900 dark:text-[#F9FAFB] transition-all focus:bg-white dark:focus:bg-[#151B23] focus:outline-none focus:ring-2 ${
            error 
              ? 'border-rose-300 dark:border-rose-800/60 focus:ring-rose-500 bg-rose-50/20 dark:bg-rose-950/20' 
              : 'border-slate-200 dark:border-[#26303D] focus:ring-amber-500 focus:border-amber-500'
          } ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-[#151B23]' : ''}`}
        />

        <Phone className="w-5 h-5 text-slate-400 dark:text-[#6B7280] absolute right-3 pointer-events-none" />
      </div>

      {error ? (
        <p className="text-xs text-rose-600 dark:text-rose-400 font-medium pl-1">{error}</p>
      ) : (
        <p className="text-[11px] text-slate-400 dark:text-[#9CA3AF] pl-1">
          {language === 'ta' ? '10-இலக்க இந்திய மொபைல் எண்ணை உள்ளிடவும்' : 'Enter 10-digit Indian mobile number'}
        </p>
      )}
    </div>
  );
};
