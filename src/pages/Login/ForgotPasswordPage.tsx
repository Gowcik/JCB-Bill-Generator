import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../i18n';
import { PhoneInput } from '../../components/auth/PhoneInput';
import { isValidIndianMobile } from '../../services/authService';
import { 
  ArrowLeft, 
  CheckCircle2, 
  Loader2, 
  AlertCircle,
  KeyRound,
  Mail
} from 'lucide-react';

export const ForgotPasswordPage: React.FC = () => {
  const { language, t } = useI18n();
  const { sendPasswordReset } = useAuth();

  const [phone, setPhone] = useState('');
  const [maskedEmail, setMaskedEmail] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isValidIndianMobile(phone)) {
      setErrorMessage(
        language === 'ta'
          ? 'சரியான 10-இலக்க இந்திய மொபைல் எண்ணை உள்ளிடவும்.'
          : 'Please enter a valid 10-digit Indian mobile number.'
      );
      return;
    }

    setIsLoading(true);
    try {
      const { error, maskedEmail: emailHint } = await sendPasswordReset(phone.trim());
      if (error) {
        if (error.message.includes('No account found')) {
          setErrorMessage(
            language === 'ta'
              ? 'இந்த மொபைல் எண்ணிற்கு எந்த கணக்கும் கிடைக்கவில்லை.'
              : 'No account found for this mobile number.'
          );
        } else {
          setErrorMessage(error.message);
        }
      } else {
        setMaskedEmail(emailHint || '');
        setIsSuccess(true);
      }
    } catch (err: any) {
      setErrorMessage(
        err.message ||
          (language === 'ta'
            ? 'இணைப்பை அனுப்ப முடியவில்லை. மீண்டும் முயற்சிக்கவும்.'
            : 'Failed to send password reset email. Please try again.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-between p-4 max-w-md mx-auto antialiased text-white">
      
      {/* Top Branding Section */}
      <div className="pt-8 pb-5 text-center space-y-2.5">
        <div className="flex items-center justify-center">
          <img
            src="/jcb-logo.png"
            alt="JCB Logo"
            className="w-36 h-auto object-contain drop-shadow-md"
          />
        </div>
        
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            {t('auth.appTitle')}
          </h1>
          <p className="text-xs text-amber-400 font-medium mt-0.5">
            {language === 'ta' ? 'JCB பில்லிங் மற்றும் கணக்கு மேலாண்மை' : 'Earthmoving Billing & Customer Accounts'}
          </p>
        </div>
      </div>

      {/* Main Authentication Card */}
      <div className="bg-white text-slate-900 rounded-2xl p-6 shadow-xl space-y-5">
        
        <div className="text-center space-y-1">
          <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full mx-auto flex items-center justify-center mb-2">
            <KeyRound className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight">
            {t('auth.forgotPasswordTitle')}
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed px-2">
            {t('auth.forgotPasswordSubtitle')}
          </p>
        </div>

        {isSuccess ? (
          <div className="space-y-4 py-2">
            <div className="flex flex-col items-center text-center p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2.5">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              <p className="text-sm font-bold text-emerald-900">
                {t('auth.resetLinkSent')}
              </p>
              {maskedEmail && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-emerald-200 rounded-lg text-xs font-mono font-bold text-emerald-800 shadow-sm">
                  <Mail className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{maskedEmail}</span>
                </div>
              )}
              <p className="text-xs text-emerald-700 leading-relaxed">
                {language === 'ta'
                  ? 'உங்கள் மின்னஞ்சல் இன்பாக்ஸ் அல்லது ஸ்பேம் கோப்புறையை சரிபார்த்து புதிய கடவுச்சொல்லை அமைக்கவும்.'
                  : 'Check your inbox or spam folder to complete password reset.'}
              </p>
            </div>

            <div className="pt-2">
              <Link
                to="/login"
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-slate-900 hover:bg-slate-800 text-white shadow-md transition-all active:scale-[0.99]"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{t('auth.backToLogin')}</span>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Mobile Number Field */}
            <PhoneInput
              value={phone}
              onChange={setPhone}
              disabled={isLoading}
            />

            <p className="text-[11px] text-slate-500 leading-normal">
              {language === 'ta'
                ? 'உங்கள் கணக்குடன் பதிவுசெய்யப்பட்ட மின்னஞ்சல் முகவரிக்கு கடவுச்சொல் மீட்டமைப்பு இணைப்பு அனுப்பப்படும்.'
                : 'A password recovery link will be sent to the email address registered with this mobile number.'}
            </p>

            {/* Error Message */}
            {errorMessage && (
              <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 p-3 rounded-xl text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span className="font-medium leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={isLoading || phone.length < 10}
                className={`w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.99] ${
                  isLoading || phone.length < 10
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                    : 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 shadow-amber-500/20'
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    <span>{language === 'ta' ? 'அனுப்பப்படுகிறது...' : 'Sending Link...'}</span>
                  </>
                ) : (
                  <span>{t('auth.sendResetLink')}</span>
                )}
              </button>
            </div>

            {/* Back to Login Link */}
            <div className="pt-2 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors py-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{t('auth.backToLogin')}</span>
              </Link>
            </div>

          </form>
        )}

      </div>

      {/* Footer info */}
      <div className="py-6 text-center text-xs text-slate-500 space-y-1">
        <div>JCB Bill Generator • Password Recovery</div>
        <div>Secured by Supabase Auth</div>
      </div>

    </div>
  );
};
