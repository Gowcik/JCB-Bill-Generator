import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../i18n';
import { 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  Loader2, 
  AlertCircle,
  KeyRound,
  ArrowRight
} from 'lucide-react';

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { language, t } = useI18n();
  const { resetPassword, signOut } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < 8) {
      setErrorMessage(
        language === 'ta'
          ? 'புதிய கடவுச்சொல் குறைந்தது 8 எழுத்துக்கள் இருக்க வேண்டும்.'
          : 'New password must be at least 8 characters long.'
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(
        language === 'ta'
          ? 'கடவுச்சொற்கள் பொருந்தவில்லை. மீண்டும் சரிபார்க்கவும்.'
          : 'Passwords do not match.'
      );
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await resetPassword(password);
      if (error) {
        setErrorMessage(error.message);
      } else {
        setIsSuccess(true);
        // Cleanly sign out the recovery session so they log in fresh with their mobile and new password
        await signOut().catch(() => {});
      }
    } catch (err: any) {
      setErrorMessage(
        err.message ||
          (language === 'ta'
            ? 'கடவுச்சொல்லை புதுப்பிக்க முடியவில்லை. இணைப்பு காலாவதியாகி இருக்கலாம்.'
            : 'Failed to update password. Recovery link may have expired.')
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
            {t('auth.resetPasswordTitle')}
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed px-2">
            {language === 'ta' 
              ? 'உங்கள் கணக்கிற்கான புதிய கடவுச்சொல்லை உள்ளிடவும்.' 
              : 'Enter a secure new password for your account.'}
          </p>
        </div>

        {isSuccess ? (
          <div className="space-y-4 py-2">
            <div className="flex flex-col items-center text-center p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              <p className="text-sm font-bold text-emerald-900">
                {t('auth.passwordUpdated')}
              </p>
              <p className="text-xs text-emerald-700">
                {language === 'ta'
                  ? 'உங்கள் புதிய கடவுச்சொல் மூலம் இப்போது நீங்கள் உள்நுழையலாம்.'
                  : 'You can now sign in using your mobile number and new password.'}
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate('/login', { replace: true })}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-bold text-sm bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 shadow-md shadow-amber-500/20 transition-all active:scale-[0.99]"
              >
                <span>{t('auth.goToLogin')}</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* New Password Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                {t('auth.newPassword')} <span className="text-amber-500">*</span>
              </label>
              <div className="relative flex items-center">
                <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isLoading}
                  autoComplete="new-password"
                  className="w-full pl-11 pr-11 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 p-1 text-slate-400 hover:text-slate-600 focus:outline-none"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 pl-1">
                {language === 'ta' ? 'குறைந்தது 8 எழுத்துக்கள் தேவை' : 'Minimum 8 characters'}
              </p>
            </div>

            {/* Confirm New Password Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                {t('auth.confirmNewPassword')} <span className="text-amber-500">*</span>
              </label>
              <div className="relative flex items-center">
                <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isLoading}
                  autoComplete="new-password"
                  className="w-full pl-11 pr-11 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 p-1 text-slate-400 hover:text-slate-600 focus:outline-none"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 p-3 rounded-xl text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span className="font-medium leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading || password.length < 8 || password !== confirmPassword}
                className={`w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.99] ${
                  isLoading || password.length < 8 || password !== confirmPassword
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                    : 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 shadow-amber-500/20'
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    <span>{language === 'ta' ? 'புதுப்பிக்கப்படுகிறது...' : 'Updating Password...'}</span>
                  </>
                ) : (
                  <span>{t('auth.updatePassword')}</span>
                )}
              </button>
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
