import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../i18n';
import { PhoneInput } from '../../components/auth/PhoneInput';
import { isValidIndianMobile, isValidEmail } from '../../services/authService';
import { 
  ArrowRight, 
  ShieldCheck, 
  User, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Loader2, 
  AlertCircle, 
  AlertTriangle, 
  LogIn 
} from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, t } = useI18n();
  const { 
    isAuthenticated, 
    isSupabaseConfigured, 
    signUp 
  } = useAuth();

  // Form Fields
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConfirmationRequired, setIsConfirmationRequired] = useState(false);

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
    if (!username.trim()) {
      setErrorMessage(
        language === 'ta'
          ? 'உங்கள் பயனர்பெயர் அல்லது உரிமையாளர் பெயரை உள்ளிடவும்.'
          : 'Please enter your username / owner name.'
      );
      return;
    }

    if (!isValidIndianMobile(phone)) {
      setErrorMessage(
        language === 'ta'
          ? 'சரியான 10-இலக்க இந்திய மொபைல் எண்ணை உள்ளிடவும்.'
          : 'Please enter a valid 10-digit Indian mobile number.'
      );
      return;
    }

    if (!isValidEmail(email)) {
      setErrorMessage(
        language === 'ta'
          ? 'சரியான மின்னஞ்சல் முகவரியை உள்ளிடவும் (கடவுச்சொல் மீட்புக்கு தேவை).'
          : 'Please enter a valid email address (required for password recovery).'
      );
      return;
    }

    if (password.length < 8) {
      setErrorMessage(
        language === 'ta'
          ? 'கடவுச்சொல் குறைந்தது 8 எழுத்துக்கள் இருக்க வேண்டும்.'
          : 'Password must be at least 8 characters long.'
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
      const { error, needsConfirmation } = await signUp({
        username: username.trim(),
        phone,
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(error.message);
      } else if (needsConfirmation) {
        // Supabase requires email/account confirmation before issuing a session
        // Do NOT navigate to Owner Details
        setIsConfirmationRequired(true);
      } else {
        // Active session established -> Navigate to Owner Details for profile setup
        navigate('/owner-details', { replace: true });
      }
    } catch (err: any) {
      setErrorMessage(
        err.message ||
          (language === 'ta'
            ? 'பதிவு செய்ய முடியவில்லை. மீண்டும் முயற்சிக்கவும்.'
            : 'Registration failed. Please try again.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-between p-4 max-w-md mx-auto antialiased text-white">
      
      {/* Top Branding Section */}
      <div className="pt-6 pb-4 text-center space-y-2">
        <div className="flex items-center justify-center">
          <img
            src="/jcb-logo.png"
            alt="JCB Logo"
            className="w-32 h-auto object-contain drop-shadow-md"
          />
        </div>
        
        <div>
          <h1 className="text-xl font-black text-white tracking-tight">
            {t('auth.appTitle')}
          </h1>
          <p className="text-xs text-amber-400 font-medium mt-0.5">
            {language === 'ta' ? 'JCB பில்லிங் மற்றும் கணக்கு மேலாண்மை' : 'Earthmoving Billing & Customer Accounts'}
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700 text-[11px] text-slate-300">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          <span>{language === 'ta' ? 'புதிய உரிமையாளர் கணக்கு பதிவு' : 'New Machine Owner Registration'}</span>
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white text-slate-900 rounded-2xl p-6 shadow-xl space-y-4">
        
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
            {t('auth.registerTitle')}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'ta' ? 'உங்கள் இயந்திரங்களை நிர்வகிக்க கணக்கை உருவாக்கவும்' : 'Create an account to manage your machines & bills'}
          </p>
        </div>

        {isConfirmationRequired ? (
          <div className="space-y-4 py-2">
            <div className="flex flex-col items-center text-center p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
              <Mail className="w-10 h-10 text-amber-600" />
              <p className="text-sm font-bold text-amber-950">
                {t('auth.confirmationRequiredTitle')}
              </p>
              <p className="text-xs text-amber-800 leading-relaxed">
                {t('auth.confirmationRequiredDesc')}
              </p>
              <div className="text-[11px] font-mono text-slate-700 bg-amber-100/70 px-2.5 py-1 rounded-lg">
                {email}
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-800">
                {language === 'ta' ? 'அடுத்த படி:' : 'Next Steps:'}
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {language === 'ta'
                  ? 'உங்கள் மின்னஞ்சலில் உள்ள உறுதிப்படுத்தல் இணைப்பைக் கிளிக் செய்த பிறகு, உங்கள் மொபைல் எண் மற்றும் கடவுச்சொல்லுடன் உள்நுழையவும்.'
                  : 'After clicking the confirmation link in your email, log in with your 10-digit mobile number and password.'}
              </p>
            </div>

            <div className="pt-2">
              <Link
                to="/login"
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-bold text-sm bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 shadow-md shadow-amber-500/20 transition-all active:scale-[0.99]"
              >
                <span>{t('auth.goToLogin')}</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
          
          {/* Username Field */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              {t('auth.fullName')} <span className="text-amber-500">*</span>
            </label>
            <div className="relative">
              <User className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('auth.fullNamePlaceholder')}
                disabled={isLoading}
                className="w-full pl-11 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-60"
              />
            </div>
          </div>

          {/* Mobile Number Field */}
          <PhoneInput
            value={phone}
            onChange={setPhone}
            disabled={isLoading}
          />

          {/* Email Address Field */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              {t('auth.emailAddress')} <span className="text-amber-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. gowcik@example.com"
                disabled={isLoading}
                autoComplete="email"
                className="w-full pl-11 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-60"
              />
            </div>
            <p className="text-[11px] text-slate-400 pl-1">
              {language === 'ta' ? 'கடவுச்சொல் மீட்புக்கான இணைப்பை அனுப்பப் பயன்படும்' : 'Used for password reset and recovery'}
            </p>
          </div>

          {/* Password Field */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              {t('auth.password')} <span className="text-amber-500">*</span>
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
                className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-60"
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

          {/* Confirm Password Field */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              {t('auth.confirmPassword')} <span className="text-amber-500">*</span>
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
                className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-60"
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
              disabled={isLoading || !username.trim() || phone.length < 10 || !email.trim() || password.length < 8 || password !== confirmPassword}
              className={`w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.99] ${
                isLoading || !username.trim() || phone.length < 10 || !email.trim() || password.length < 8 || password !== confirmPassword
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 shadow-amber-500/20'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>{language === 'ta' ? 'பதிவு செய்யப்படுகிறது...' : 'Creating Account...'}</span>
                </>
              ) : (
                <>
                  <span>{t('auth.createAccountButton')}</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </>
              )}
            </button>
          </div>

          {/* Login Link */}
          <div className="pt-3 border-t border-slate-100 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-amber-600 transition-colors py-1"
            >
              <LogIn className="w-4 h-4 text-amber-500" />
              <span>{t('auth.haveAccount')}</span>
            </Link>
          </div>

        </form>
        )}

      </div>

      {/* Footer info */}
      <div className="py-4 text-center text-xs text-slate-500 space-y-1">
        <div>JCB Bill Generator • Phase 2 Auth</div>
        <div>Secured with Supabase Password Authentication</div>
      </div>

    </div>
  );
};
