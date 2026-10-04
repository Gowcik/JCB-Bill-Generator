import React, { useState, useEffect } from 'react';
import type { DbBill, Bill, OwnerDetails } from '../../types';
import {
  sendBillSms,
  isValidIndianMobile,
  formatSmsMobile,
  generateConceptualSmsText,
  openSmsAppSettings,
  type SendSmsResult,
} from '../../services/smsService';
import {
  getDailySmsUsage,
  DAILY_SMS_LIMIT,
  type DailySmsUsage,
} from '../../services/smsUsageService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { StatusBadge } from '../common/StatusBadge';
import { useI18n } from '../../i18n';
import { useBackButton } from '../../hooks/useBackButton';
import {
  MessageSquare,
  X,
  Phone,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  RefreshCw,
  Smartphone,
  Settings,
  ShieldAlert,
  Globe,
} from 'lucide-react';
import { ActionButton } from '../common/ActionButton';
import { JCBMachineIcon } from '../common/JCBMachineIcon';

interface SendSmsModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: DbBill | Bill | null;
  ownerDetails?: OwnerDetails | null;
}

export const SendSmsModal: React.FC<SendSmsModalProps> = ({
  isOpen,
  onClose,
  bill,
  ownerDetails,
}) => {
  useBackButton(isOpen, onClose);
  const { language, t } = useI18n();

  const [smsLang, setSmsLang] = useState<'en' | 'ta'>('en');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<SendSmsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [dailyUsage, setDailyUsage] = useState<DailySmsUsage>(getDailySmsUsage());

  // Refresh daily counter whenever modal opens; default SMS language to English
  useEffect(() => {
    if (isOpen) {
      setDailyUsage(getDailySmsUsage());
      setError(null);
      setErrorCode(null);
      setResult(null);
      setIsSending(false);
      setSmsLang('en');
    }
  }, [isOpen]);

  if (!isOpen || !bill) return null;

  const raw = bill as any;
  const billNumber = raw.bill_number || raw.billNumber || 'JCB-BILL';
  const customerName = (raw.customer_name || raw.customerName || 'Customer').trim();
  const customerMobile = (raw.customer_mobile || raw.customerPhone || '').trim();
  const billDate = raw.bill_date || raw.date || '';
  const totalAmount = Number(raw.total_amount ?? raw.totalAmount ?? 0);
  const paidAmount = Number(raw.paid_amount ?? raw.paidAmount ?? 0);
  const balanceAmount = Number(raw.balance_amount ?? raw.balanceAmount ?? 0);
  const paymentStatus = raw.payment_status || raw.paymentStatus || 'Unpaid';
  const workingHours = raw.working_hours ?? raw.totalHours;

  const businessName = ownerDetails?.business_name || 'JCB Services';
  const isMobileValid = isValidIndianMobile(customerMobile);
  const formattedMobile = formatSmsMobile(customerMobile);
  const smsPreviewText = generateConceptualSmsText(bill, ownerDetails, businessName, smsLang);

  const isLimitReached = dailyUsage.sentCount >= DAILY_SMS_LIMIT;

  const handleClose = () => {
    if (isSending) return; // Prevent closing while SMS dispatch is in-flight
    setResult(null);
    setError(null);
    setErrorCode(null);
    onClose();
  };

  const handleSend = async () => {
    if (isSending) return;

    if (isLimitReached) {
      setError(t('sms.dailyLimitReachedDesc'));
      setErrorCode('DAILY_LIMIT_REACHED');
      return;
    }

    if (!isMobileValid) {
      setError(t('sms.invalidMobile'));
      setErrorCode('INVALID_MOBILE');
      return;
    }

    setIsSending(true);
    setError(null);
    setErrorCode(null);
    setResult(null);

    try {
      const res = await sendBillSms(bill, ownerDetails, smsLang);
      if (res.success) {
        setResult(res);
        setDailyUsage(getDailySmsUsage());
      } else {
        setError(res.error || res.message || t('sms.sendFailed'));
        setErrorCode(res.errorCode || 'SEND_FAILED');
      }
    } catch (err: any) {
      console.error('[SendSmsModal] Direct SMS error:', err);
      setError(t('sms.sendFailed'));
      setErrorCode('SEND_FAILED');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs"
        onClick={handleClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-white dark:bg-[#151B23] border border-slate-100 dark:border-[#26303D] rounded-2xl p-4 sm:p-5 shadow-2xl z-10 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#26303D]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center shadow-sm">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#F9FAFB]">
                {result ? t('sms.smsSentSuccess') : t('sms.title')}
              </h3>
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-[#9CA3AF]">
                <JCBMachineIcon width={14} height={10} />
                <span>{billNumber}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isSending}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1C2430] disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Daily 100 SMS Usage Indicator */}
        <div className="mt-3 px-3 py-2 bg-slate-50 dark:bg-[#1C2430] border border-slate-200/80 dark:border-[#26303D] rounded-xl space-y-1.5">
          <div className="flex justify-between items-center text-[11px]">
            <span className="font-semibold text-slate-600 dark:text-[#9CA3AF] flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-slate-500 dark:text-[#9CA3AF]" />
              <span>{t('sms.usageToday')}</span>
            </span>
            <span className="font-mono font-bold text-slate-900 dark:text-[#F9FAFB]">
              {dailyUsage.sentCount} / {DAILY_SMS_LIMIT}
            </span>
          </div>

          {/* Usage Progress Bar */}
          <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                dailyUsage.sentCount >= DAILY_SMS_LIMIT
                  ? 'bg-rose-500'
                  : dailyUsage.sentCount > 80
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, (dailyUsage.sentCount / DAILY_SMS_LIMIT) * 100)}%` }}
            />
          </div>
        </div>

        {/* Content Body */}
        <div className="my-3 flex-1 overflow-y-auto space-y-3.5 pr-0.5">

          {/* 1. SUCCESS VIEW */}
          {result && result.success ? (
            <div className="space-y-4 py-2">
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5 text-center space-y-2">
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 rounded-full mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 stroke-[2.2]" />
                </div>
                <h4 className="text-base font-bold text-emerald-950 dark:text-emerald-200">
                  {t('sms.smsSentSuccess')}
                </h4>
                <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                  {language === 'ta'
                    ? `பில் ${billNumber} ${customerName} அவர்களுக்கு அனுப்பப்பட்டது.`
                    : `Bill ${billNumber} was sent to ${customerName}.`}
                </p>
              </div>

              {/* Delivery Target Card */}
              <div className="bg-slate-50 dark:bg-[#1C2430] border border-slate-200/80 dark:border-[#26303D] rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-600 dark:text-[#9CA3AF]">
                  <span>{t('sms.customer')}:</span>
                  <span className="font-bold text-slate-900 dark:text-[#F9FAFB]">{customerName}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600 dark:text-[#9CA3AF]">
                  <span>{t('sms.recipient')}:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-[#F9FAFB]">{formattedMobile}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600 dark:text-[#9CA3AF]">
                  <span>{language === 'ta' ? 'பில் குறிப்பு:' : 'Bill Reference:'}</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-[#F9FAFB]">{billNumber}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600 dark:text-[#9CA3AF]">
                  <span>{language === 'ta' ? 'SMS மொழி:' : 'SMS Language:'}</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {smsLang === 'ta' ? 'தமிழ் (Tamil)' : 'English'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600 dark:text-[#9CA3AF]">
                  <span>{language === 'ta' ? 'அனுப்பப்பட்ட வழி:' : 'Channel:'}</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{language === 'ta' ? 'ஃபோன் சிம் (SIM) SMS' : 'Phone SIM SMS'}</span>
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600 dark:text-[#9CA3AF] pt-1.5 border-t border-slate-200/60 dark:border-[#26303D]">
                  <span>{t('sms.usageToday')}:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-[#F9FAFB]">
                    {dailyUsage.sentCount} / {DAILY_SMS_LIMIT}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* 2. CONFIRMATION & PREVIEW VIEW */
            <div className="space-y-3.5">
              
              {/* Daily Limit Warning Banner */}
              {isLimitReached && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">{t('sms.dailyLimitReached')}</span>
                    <span>{t('sms.dailyLimitReachedDesc')}</span>
                  </div>
                </div>
              )}

              {/* Validation Warning if mobile invalid */}
              {!isMobileValid && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-200">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">{language === 'ta' ? 'தவறான மொபைல் எண்' : 'Invalid Mobile Number'}</span>
                    <span>{t('sms.invalidMobile')}</span>
                  </div>
                </div>
              )}

              {/* Error Alert if request failed */}
              {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-200">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-bold block">
                      {language === 'ta' ? 'SMS அனுப்ப முடியவில்லை' : 'Unable to Send SMS'}
                    </span>
                    <span>{error}</span>
                  </div>
                </div>
              )}

              {/* Customer & Bill Summary Pill */}
              <div className="bg-slate-50 dark:bg-[#1C2430] border border-slate-200/80 dark:border-[#26303D] rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-[#9CA3AF]">{t('sms.customer')}:</span>
                  <span className="font-bold text-slate-900 dark:text-[#F9FAFB]">{customerName}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-[#9CA3AF]">{t('sms.mobile')}:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-[#F9FAFB] flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400 dark:text-[#9CA3AF]" />
                    {formattedMobile}
                  </span>
                </div>

                {workingHours != null && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-[#9CA3AF]">{language === 'ta' ? 'வேலை நேரம்:' : 'Working Hours:'}</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      {Number(workingHours).toFixed(2)} {t('common.hrs')}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-[#26303D]">
                  <span className="text-slate-500 dark:text-[#9CA3AF]">{language === 'ta' ? 'பில் தேதி:' : 'Bill Date:'}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">{billDate ? formatDate(billDate, language) : 'N/A'}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-[#9CA3AF]">{language === 'ta' ? 'நிலை:' : 'Status:'}</span>
                  <StatusBadge status={paymentStatus} size="sm" />
                </div>
              </div>

              {/* Financial Snapshot */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 bg-slate-100 dark:bg-[#1C2430] rounded-xl border border-slate-200 dark:border-[#26303D]">
                  <span className="text-[10px] text-slate-500 dark:text-[#9CA3AF] block uppercase font-medium">{t('sms.total')}</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-[#F9FAFB]">{formatCurrency(totalAmount)}</span>
                </div>
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block uppercase font-medium">{t('sms.paid')}</span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(paidAmount)}</span>
                </div>
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-100 dark:border-rose-900/50">
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 block uppercase font-medium">{t('sms.balance')}</span>
                  <span className="font-mono font-bold text-rose-700 dark:text-rose-400">{formatCurrency(balanceAmount)}</span>
                </div>
              </div>

              {/* SMS Language Selector (Independent from App UI Language) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#9CA3AF]">
                  <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-amber-500" />
                    <span>{language === 'ta' ? 'SMS மொழி' : 'SMS Language'}</span>
                  </span>
                  <span className="text-[10px] font-medium text-slate-400 dark:text-[#9CA3AF]">
                    {smsLang === 'ta' ? 'தமிழ் SMS' : 'English SMS'}
                  </span>
                </div>

                <div className="bg-slate-200/70 dark:bg-[#1C2430] p-1 rounded-xl flex border border-slate-200 dark:border-[#26303D] transition-colors">
                  <button
                    type="button"
                    onClick={() => setSmsLang('en')}
                    disabled={isSending}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all text-center select-none active:scale-[0.98] ${
                      smsLang === 'en'
                        ? 'bg-[#FFCC00] text-slate-950 shadow-xs'
                        : 'text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F9FAFB]'
                    }`}
                  >
                    English
                  </button>

                  <button
                    type="button"
                    onClick={() => setSmsLang('ta')}
                    disabled={isSending}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all text-center select-none active:scale-[0.98] ${
                      smsLang === 'ta'
                        ? 'bg-[#FFCC00] text-slate-950 shadow-xs'
                        : 'text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F9FAFB]'
                    }`}
                  >
                    தமிழ்
                  </button>
                </div>
              </div>

              {/* Direct SMS Preview */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#9CA3AF]">
                  <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-amber-500" />
                    <span>{language === 'ta' ? 'SMS முன்னோட்டம்' : 'SMS Preview'}</span>
                  </span>
                  <span className="text-[10px] font-medium text-slate-400 dark:text-[#9CA3AF]">
                    {language === 'ta' ? 'ஃபோன் சிம் SMS' : 'Direct SIM SMS'}
                  </span>
                </div>

                <div className="p-3 bg-slate-950 dark:bg-[#0B0F14] text-slate-200 dark:text-slate-300 rounded-xl font-mono text-[11px] leading-relaxed whitespace-pre-line border border-slate-800 dark:border-[#26303D] shadow-inner">
                  {smsPreviewText}
                </div>
              </div>

              {/* Direct SIM Plan Notice */}
              <div className="p-2.5 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/50 rounded-xl flex items-start gap-2 text-amber-900 dark:text-amber-200 text-xs">
                <Smartphone className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <span className="leading-relaxed">
                  {t('sms.directSimNotice')}
                </span>
              </div>

            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-slate-100 dark:border-[#26303D] flex gap-2">
          {result && result.success ? (
            <ActionButton
              variant="dark"
              onClick={handleClose}
            >
              {t('common.close')}
            </ActionButton>
          ) : (
            <>
              <ActionButton
                variant="secondary"
                onClick={handleClose}
                disabled={isSending}
                fullWidth={false}
                className="flex-1"
              >
                {t('common.cancel')}
              </ActionButton>

              {errorCode === 'PERMISSION_DENIED' && (
                <ActionButton
                  variant="outline"
                  onClick={openSmsAppSettings}
                  disabled={isSending}
                  fullWidth={false}
                  className="px-3"
                  icon={<Settings className="w-4 h-4 text-slate-600" />}
                >
                  {t('sms.openSettings')}
                </ActionButton>
              )}

              <ActionButton
                variant="success"
                onClick={handleSend}
                loading={isSending}
                loadingText={t('sms.sending')}
                disabled={!isMobileValid || isLimitReached || isSending}
                fullWidth={false}
                className="flex-1"
                icon={error ? <RefreshCw className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              >
                {error ? t('common.retry') : t('sms.sendSmsBtn')}
              </ActionButton>
            </>
          )}
        </div>

      </div>
    </div>
  );
};
