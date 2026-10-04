import React, { useState } from 'react';
import { AppLayout } from '../../components/layout/AppLayout';
import { useI18n } from '../../i18n';
import { useTheme } from '../../contexts/ThemeContext';
import type { Language } from '../../i18n/types';
import { 
  Globe, 
  FileText, 
  Smartphone, 
  Database, 
  Check, 
  Shield, 
  Server,
  Sun,
  Moon,
  Award
} from 'lucide-react';
import { 
  getStoredShowDeveloperCredit, 
  setStoredShowDeveloperCredit 
} from '../../services/billImageService';

export const SettingsPage: React.FC = () => {
  const { language, setLanguage, t } = useI18n();
  const { theme, setTheme } = useTheme();
  const [billPrefix, setBillPrefix] = useState<string>(() => {
    return localStorage.getItem('jcb_bill_prefix') || `JCB-${new Date().getFullYear()}-`;
  });
  const [autoIncludeBatta, setAutoIncludeBatta] = useState(false);
  const [showDeveloperCredit, setShowDeveloperCredit] = useState<boolean>(() => {
    return getStoredShowDeveloperCredit();
  });

  const handleToggleDeveloperCredit = (val: boolean) => {
    setShowDeveloperCredit(val);
    setStoredShowDeveloperCredit(val);
  };

  const handlePrefixChange = (val: string) => {
    setBillPrefix(val);
    localStorage.setItem('jcb_bill_prefix', val);
  };

  const languages: { code: Language; name: string; sub: string }[] = [
    { code: 'en', name: t('settings.english'), sub: t('settings.defaultBadge') },
    { code: 'ta', name: t('settings.tamil'), sub: t('settings.regionalBadge') },
  ];

  return (
    <AppLayout title={t('settings.title')} subtitle={t('settings.subtitle')} showBack>
      <div className="space-y-4">
        
        {/* Developer Credit Top Highlight */}
        <div className="bg-white dark:bg-[#151B23] rounded-xl p-3.5 border border-slate-200 dark:border-[#26303D] shadow-xs flex items-center justify-between transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 dark:border-amber-400/20 flex items-center justify-center text-amber-600 dark:text-amber-400 font-black text-sm shadow-xs">
              JCB
            </div>
            <div>
              <div className="text-[11px] font-semibold tracking-wide text-slate-500 dark:text-[#9CA3AF] uppercase">
                JCB Bill Generator v1.0.0
              </div>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200 mt-0.5">
                Developed By <span className="font-bold text-amber-600 dark:text-amber-400 text-base">Gowcik</span>
              </div>
            </div>
          </div>
          <div className="hidden xs:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-[10px] font-bold text-amber-700 dark:text-amber-300">
            PRO
          </div>
        </div>

        {/* Section 1: Theme Switcher (Exactly TWO themes: Light & Dark, NO system option) */}
        <div className="bg-white dark:bg-[#151B23] rounded-xl p-4 border border-slate-200 dark:border-[#26303D] shadow-xs space-y-3 transition-colors">
          <h3 className="text-xs font-bold text-slate-800 dark:text-[#F9FAFB] uppercase tracking-wider flex items-center gap-1.5">
            <Sun className="w-4 h-4 text-amber-500" />
            <span>{t('settings.themeSection')}</span>
          </h3>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Light Theme Button */}
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all active:scale-[0.98] ${
                theme === 'light'
                  ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 ring-2 ring-amber-500 text-slate-900 dark:text-amber-300 font-bold'
                  : 'border-slate-200 dark:border-[#26303D] bg-white dark:bg-[#1C2430] text-slate-700 dark:text-[#9CA3AF] hover:bg-slate-50 dark:hover:bg-[#26303D]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Sun className={`w-5 h-5 ${theme === 'light' ? 'text-amber-500' : 'text-slate-400 dark:text-slate-500'}`} />
                <span className="text-sm font-bold">{t('settings.lightTheme')}</span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-[#9CA3AF] text-center">
                {t('settings.lightThemeSub')}
              </span>
              {theme === 'light' && (
                <div className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center mt-0.5">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
            </button>

            {/* Dark Theme Button */}
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all active:scale-[0.98] ${
                theme === 'dark'
                  ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 ring-2 ring-amber-500 text-slate-900 dark:text-amber-300 font-bold'
                  : 'border-slate-200 dark:border-[#26303D] bg-white dark:bg-[#1C2430] text-slate-700 dark:text-[#9CA3AF] hover:bg-slate-50 dark:hover:bg-[#26303D]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Moon className={`w-5 h-5 ${theme === 'dark' ? 'text-amber-400' : 'text-slate-400 dark:text-slate-500'}`} />
                <span className="text-sm font-bold">{t('settings.darkTheme')}</span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-[#9CA3AF] text-center">
                {t('settings.darkThemeSub')}
              </span>
              {theme === 'dark' && (
                <div className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center mt-0.5">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Section 2: Language Switcher (Exactly TWO languages: English & Tamil) */}
        <div className="bg-white dark:bg-[#151B23] rounded-xl p-4 border border-slate-200 dark:border-[#26303D] shadow-xs space-y-3 transition-colors">
          <h3 className="text-xs font-bold text-slate-800 dark:text-[#F9FAFB] uppercase tracking-wider flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-amber-500" />
            <span>{t('settings.languageSection')}</span>
          </h3>

          <div className="space-y-2">
            {languages.map((lang) => (
              <label
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                  language === lang.code
                    ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/20 ring-1 ring-amber-500/30'
                    : 'border-slate-200 dark:border-[#26303D] hover:bg-slate-50 dark:hover:bg-[#1C2430]'
                }`}
              >
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-[#F9FAFB]">{lang.name}</div>
                  <div className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">{lang.sub}</div>
                </div>
                {language === lang.code && (
                  <div className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-xs">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                )}
              </label>
            ))}
          </div>
        </div>

        {/* Section 3: Billing Preferences */}
        <div className="bg-white dark:bg-[#151B23] rounded-xl p-4 border border-slate-200 dark:border-[#26303D] shadow-xs space-y-3 transition-colors">
          <h3 className="text-xs font-bold text-slate-800 dark:text-[#F9FAFB] uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-amber-500" />
            <span>{t('settings.billingSection')}</span>
          </h3>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-[#9CA3AF] mb-1">
              {t('settings.billPrefix')}
            </label>
            <input
              type="text"
              value={billPrefix}
              onChange={(e) => handlePrefixChange(e.target.value)}
              className="w-full font-mono text-sm bg-slate-50 dark:bg-[#1C2430] border border-slate-200 dark:border-[#26303D] text-slate-900 dark:text-[#F9FAFB] rounded-lg p-2.5 focus:bg-white dark:focus:bg-[#1C2430] focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <p className="text-[11px] text-slate-400 dark:text-[#9CA3AF] mt-1">
              {t('settings.billPrefixHint')} (e.g. {billPrefix}0001)
            </p>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-[#26303D]">
            <div>
              <div className="text-xs font-semibold text-slate-800 dark:text-[#F9FAFB]">{t('settings.autoBatta')}</div>
              <div className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">{t('settings.autoBattaSub')}</div>
            </div>
            <input
              type="checkbox"
              checked={autoIncludeBatta}
              onChange={(e) => setAutoIncludeBatta(e.target.checked)}
              className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
            />
          </div>
        </div>

        {/* Section: Developer Credit Setting */}
        <div className="bg-white dark:bg-[#151B23] rounded-xl p-4 border border-slate-200 dark:border-[#26303D] shadow-xs space-y-3 transition-colors">
          <h3 className="text-xs font-bold text-slate-800 dark:text-[#F9FAFB] uppercase tracking-wider flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-500" />
            <span>{language === 'ta' ? 'டெவலப்பர் தகவல்' : 'Developer Credit'}</span>
          </h3>

          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-slate-900 dark:text-[#F9FAFB]">
                {language === 'ta' ? 'டெவலப்பர் தகவல் காட்டு' : 'Show Developer Credit'}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">
                {language === 'ta'
                  ? 'ரசீதுகளில் \'Developed By "Gowcik"\' என்பதைக் காட்டு'
                  : 'Show \'Developed By "Gowcik"\' on generated bills'}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded transition-colors ${
                showDeveloperCredit 
                  ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-[#9CA3AF]'
              }`}>
                {showDeveloperCredit ? 'ON' : 'OFF'}
              </span>

              <button
                type="button"
                role="switch"
                aria-checked={showDeveloperCredit}
                onClick={() => handleToggleDeveloperCredit(!showDeveloperCredit)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  showDeveloperCredit ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    showDeveloperCredit ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Section 4: Architecture & Sync Status */}
        <div className="bg-white dark:bg-[#151B23] rounded-xl p-4 border border-slate-200 dark:border-[#26303D] shadow-xs space-y-3 transition-colors">
          <h3 className="text-xs font-bold text-slate-800 dark:text-[#F9FAFB] uppercase tracking-wider flex items-center gap-1.5">
            <Database className="w-4 h-4 text-amber-500" />
            <span>{t('settings.backendSection')}</span>
          </h3>

          <div className="p-3 bg-slate-50 dark:bg-[#1C2430] rounded-lg space-y-2 border border-slate-200/60 dark:border-[#26303D]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-[#9CA3AF] flex items-center gap-1.5 font-medium">
                <Server className="w-3.5 h-3.5 text-slate-400" />
                {t('settings.cloudDb')}
              </span>
              <span className="font-semibold text-slate-600 dark:text-slate-300 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px]">
                {t('settings.readySupabase')}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-[#9CA3AF] flex items-center gap-1.5 font-medium">
                <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                {t('settings.nativeRuntime')}
              </span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 rounded text-[10px]">
                Capacitor Android
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-[#9CA3AF] flex items-center gap-1.5 font-medium">
                <Shield className="w-3.5 h-3.5 text-slate-400" />
                {t('settings.offlineCache')}
              </span>
              <span className="font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/40 px-2 py-0.5 rounded text-[10px]">
                {t('settings.enabled')}
              </span>
            </div>
          </div>
        </div>

        {/* Section 5: App Info & Version */}
        <div className="bg-white dark:bg-[#151B23] rounded-xl p-4 border border-slate-200 dark:border-[#26303D] shadow-xs space-y-2 text-xs transition-colors">
          <div className="flex justify-between text-slate-600 dark:text-[#9CA3AF]">
            <span>{t('settings.appName')}:</span>
            <span className="font-semibold text-slate-900 dark:text-[#F9FAFB]">JCB Bill Generator</span>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-[#9CA3AF]">
            <span>{t('settings.version')}:</span>
            <span className="font-mono text-slate-900 dark:text-[#F9FAFB]">1.0.0 (Foundation)</span>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-[#9CA3AF]">
            <span>{t('settings.framework')}:</span>
            <span className="font-semibold text-slate-900 dark:text-[#F9FAFB]">React + Vite + TypeScript</span>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-[#9CA3AF]">
            <span>{t('settings.platform')}:</span>
            <span className="font-semibold text-slate-900 dark:text-[#F9FAFB]">Mobile-First Android Ready</span>
          </div>
        </div>

        {/* Developer Credit Footer */}
        <footer className="pt-2 pb-2 text-center text-xs space-y-0.5 select-none">
          <div className="font-semibold text-slate-700 dark:text-slate-300">
            JCB Bill Generator
          </div>
          <div className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">
            {language === 'ta' ? 'பதிப்பு 1.0.0' : 'Version 1.0.0'}
          </div>
          <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-0.5">
            Developed By <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">Gowcik</span>
          </div>
        </footer>

      </div>
    </AppLayout>
  );
};
