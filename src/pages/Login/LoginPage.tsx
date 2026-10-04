import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../i18n';
import { PhoneInput } from '../../components/auth/PhoneInput';
import { isValidIndianMobile } from '../../services/authService';
import { 
  ArrowRight, 
  ShieldCheck, 
  Lock, 
  Eye, 
  EyeOff, 
  Loader2, 
  AlertCircle,
  AlertTriangle,
  UserPlus
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, t } = useI18n();
  const { 
    isAuthenticated, 
    isSupabaseConfigured, 
    signIn 
  } = useAuth();

  // Form Fields
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If already logged in, redirect to dashboard or requested page
  useEffect(() => {
    if (isAuthenticated) {
      const destination = (location.state as any)?.from?.pathname || '/';
      navigate(destination, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // 1. Validation
    if (!isValidIndianMobile(phone)) {
      setErrorMessage(
        language === 'ta'
          ? 'சரியான 10-இலக்க இந்திய மொபைல் எண்ணை உள்ளிடவும்.'
          : 'Please enter a valid 10-digit Indian mobile number.'
      );
      return;
    }

    if (!password) {
      setErrorMessage(
        language === 'ta'
          ? 'கடவுச்சொல்லை உள்ளிடவும்.'
          : 'Please enter your password.'
      );
      return;
    }

    // 2. Check Supabase config
    if (!isSupabaseConfigured) {
      setErrorMessage(
        'Supabase is not configured yet. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
      );
      return;
    }

    // 3. API Call
    setIsLoading(true);
    try {
      const { error } = await signIn(phone, password);
      if (error) {
        if (error.message.includes('No account found')) {
          setErrorMessage(
            language === 'ta'
              ? 'இந்த மொபைல் எண்ணிற்கு எந்த கணக்கும் கிடைக்கவில்லை.'
              : 'No account found for this mobile number.'
          );
        } else if (
          error.message.includes('Incorrect') ||
          error.message.includes('Invalid') ||
          error.message.includes('invalid_grant')
        ) {
          setErrorMessage(
            language === 'ta'
              ? 'தவறான மொபைல் எண் அல்லது கடவுச்சொல்.'
              : 'Incorrect mobile number or password.'
          );
        } else {
          setErrorMessage(error.message);
        }
      } else {
        const destination = (location.state as any)?.from?.pathname || '/';
        navigate(destination, { replace: true });
      }
    } catch (err: any) {
      setErrorMessage(
        err.message ||
          (language === 'ta'
            ? 'உள்நுழைய முடியவில்லை. மீண்டும் முயற்சிக்கவும்.'
            : 'Unable to sign in right now. Please try again.')
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

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700 text-[11px] text-slate-300">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          <span>{language === 'ta' ? 'பாதுகாப்பான கடவுச்சொல் அங்கீகாரம்' : 'Secure Mobile & Password Sign In'}</span>
        </div>
      </div>

      {/* Main Authentication Card */}
      <div className="bg-white text-slate-900 rounded-2xl p-6 shadow-xl space-y-5">
        
        {/* Unconfigured Supabase Banner */}
        {!isSupabaseConfigured && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-950">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{language === 'ta' ? 'Supabase அமைப்பு தேவை' : 'Supabase Setup Required'}</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-800">
              Add your <code className="font-mono bg-amber-100 px-1 rounded">VITE_SUPABASE_URL</code> and <code className="font-mono bg-amber-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> to <code className="font-mono bg-amber-100 px-1 rounded">.env</code>.
            </p>
          </div>
        )}

        <div className="text-center pb-1">
          <h2 className="text-xl font-bold text-slate-900">
            {t('auth.loginTitle')}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'ta' ? 'தொடர உங்கள் மொபைல் எண் மற்றும் கடவுச்சொல்லை உள்ளிடவும்' : 'Enter your mobile number and password to continue'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Mobile Number Field */}
          <PhoneInput
            value={phone}
            onChange={setPhone}
            disabled={isLoading}
          />

          {/* Password Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                {t('auth.password')} <span className="text-amber-500">*</span>
              </label>
              <Link 
                to="/forgot-password"
                className="text-xs font-semibold text-amber-600 hover:text-amber-700 hover:underline"
              >
                {t('auth.forgotPassword')}
              </Link>
            </div>
            <div className="relative flex items-center">
              <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                autoComplete="current-password"
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
          </div>

          {/* Global Error Banner */}
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
              disabled={isLoading || phone.length < 10 || !password}
              className={`w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.99] ${
                isLoading || phone.length < 10 || !password
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 shadow-amber-500/20'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>{language === 'ta' ? 'உள்நுழைகிறது...' : 'Signing In...'}</span>
                </>
              ) : (
                <>
                  <span>{t('auth.loginButton')}</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </>
              )}
            </button>
          </div>

          {/* Register Link */}
          <div className="pt-3 border-t border-slate-100 text-center">
            <Link
              to="/register"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-amber-600 transition-colors py-1"
            >
              <UserPlus className="w-4 h-4 text-amber-500" />
              <span>{t('auth.noAccount')}</span>
            </Link>
          </div>

        </form>

      </div>

      {/* Footer info */}
      <div className="py-6 text-center text-xs text-slate-500 space-y-1">
        <div>JCB Bill Generator • Phase 2 Auth</div>
        <div>Secured with Supabase Password Authentication</div>
      </div>

    </div>
  );
};
