import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/layout/AppLayout';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../i18n';
import { supabase, isSupabaseConfigured } from '../../services/supabaseClient';
import { getOwnerDetails, upsertOwnerDetails } from '../../services/ownerDetailsService';
import { isValidUpiId, processQrImageFile, removeStoredUpiQr, setStoredUpiQr } from '../../services/upiService';
import { processSignatureImageFile } from '../../services/signatureService';
import { 
  Building2, 
  Truck, 
  Save, 
  CheckCircle2, 
  ShieldCheck,
  AlertCircle,
  QrCode,
  Upload,
  Trash2,
  FileCheck,
  Receipt,
  PenTool
} from 'lucide-react';
import { ActionButton } from '../../components/common/ActionButton';
import { JCBLoader } from '../../components/common/JCBLoader';
import { Toast, type ToastMessage } from '../../components/common/Toast';
import { JCBMachineIcon } from '../../components/common/JCBMachineIcon';

interface OwnerFormState {
  businessName: string;
  ownerName: string;
  mobileNumber: string;
  address: string;
  jcbModel: string;
  registrationNumber: string;
  hourlyRate: number;
  upiId: string;
  upiDisplayName: string;
  upiQrCode: string | null;
  showUpiQr: boolean;
  signature: string | null;
  showSignature: boolean;
  gstNumber: string;
}

export const OwnerDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile: authProfile, user, refreshOwnerDetails } = useAuth();
  const { language, t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<OwnerFormState>({
    businessName: '',
    ownerName: '',
    mobileNumber: '',
    address: '',
    jcbModel: 'JCB 3DX Super Backhoe Loader',
    registrationNumber: '',
    hourlyRate: 1200,
    upiId: '',
    upiDisplayName: '',
    upiQrCode: null,
    showUpiQr: true,
    signature: null,
    showSignature: true,
    gstNumber: '',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasExistingRecord, setHasExistingRecord] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Load existing owner details from PostgreSQL / Local Storage on mount
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const existing = await getOwnerDetails();
        if (!isMounted) return;

        if (existing) {
          setHasExistingRecord(true);
          setForm({
            businessName: existing.business_name || '',
            ownerName: existing.owner_name || authProfile?.username || '',
            mobileNumber: existing.mobile_number || authProfile?.mobile_number || user?.phone || '',
            address: existing.address || '',
            jcbModel: existing.jcb_model || 'JCB 3DX Super Backhoe Loader',
            registrationNumber: existing.registration_number || '',
            hourlyRate: existing.hourly_rate ? Number(existing.hourly_rate) : 1200,
            upiId: existing.upi_id || '',
            upiDisplayName: existing.upi_display_name || existing.business_name || '',
            upiQrCode: existing.upi_qr_code || null,
            showUpiQr: existing.show_upi_qr !== false,
            signature: existing.signature || null,
            showSignature: existing.show_signature !== false,
            gstNumber: existing.gst_number || '',
          });
        } else {
          // If no record exists yet, pre-populate with registered user details
          setHasExistingRecord(false);
          setForm((prev) => ({
            ...prev,
            ownerName: authProfile?.username || '',
            mobileNumber: authProfile?.mobile_number || user?.phone || '',
            upiDisplayName: authProfile?.username || '',
          }));
        }
      } catch (err: any) {
        console.error('[OwnerDetailsPage] Failed to load data:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [authProfile, user]);

  // Handle QR image file upload
  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await processQrImageFile(file);
      setForm((prev) => ({ ...prev, upiQrCode: dataUrl }));
      setStoredUpiQr(dataUrl, user?.id);
      setToast({
        type: 'success',
        message: language === 'ta' ? 'QR குறியீடு வெற்றிகரமாக இணைக்கப்பட்டது!' : 'QR code loaded successfully!',
      });
    } catch (err: any) {
      setToast({
        type: 'error',
        message: err.message || (language === 'ta' ? 'QR குறியீட்டைப் பதிவேற்ற முடியவில்லை.' : 'Failed to load QR code image.'),
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveQr = async () => {
    setForm((prev) => ({ ...prev, upiQrCode: null }));
    removeStoredUpiQr(user?.id);
    removeStoredUpiQr();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (user?.id && isSupabaseConfigured) {
      try {
        await supabase
          .from('owner_details')
          .update({ upi_qr_code: null, updated_at: new Date().toISOString() })
          .eq('user_id', user.id);
        await refreshOwnerDetails();
      } catch (err) {
        console.warn('[OwnerDetailsPage] Failed to clear upi_qr_code in DB:', err);
      }
    }
    setToast({
      type: 'info',
      message: language === 'ta' ? 'QR குறியீடு நீக்கப்பட்டது.' : 'QR code removed.',
    });
  };

  // Handle Signature image file upload with automatic ink detection and cropping
  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await processSignatureImageFile(file);
      setForm((prev) => ({ ...prev, signature: dataUrl }));
      setToast({
        type: 'success',
        message: language === 'ta' ? 'கையொப்பம் வெற்றிகரமாக இணைக்கப்பட்டது!' : 'Signature loaded and cropped successfully!',
      });
    } catch (err: any) {
      setToast({
        type: 'error',
        message: err.message || (language === 'ta' ? 'கையொப்பத்தைப் பதிவேற்ற முடியவில்லை.' : 'Failed to process signature image.'),
      });
    } finally {
      if (signatureInputRef.current) {
        signatureInputRef.current.value = '';
      }
    }
  };

  const handleRemoveSignature = () => {
    setForm((prev) => ({ ...prev, signature: null }));
    if (signatureInputRef.current) {
      signatureInputRef.current.value = '';
    }
    setToast({
      type: 'info',
      message: language === 'ta' ? 'கையொப்பம் நீக்கப்பட்டது.' : 'Signature removed.',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Basic UPI ID validation: Must contain @, no spaces
    if (form.upiId.trim() && !isValidUpiId(form.upiId)) {
      const valMsg = t('ownerDetails.invalidUpiId');
      setErrorMessage(valMsg);
      setToast({ type: 'error', message: valMsg });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await upsertOwnerDetails({
        business_name: form.businessName.trim(),
        owner_name: form.ownerName.trim(),
        mobile_number: form.mobileNumber.trim(),
        address: form.address.trim(),
        jcb_model: form.jcbModel.trim(),
        registration_number: form.registrationNumber.trim().toUpperCase(),
        hourly_rate: form.hourlyRate || 0,
        upi_id: form.upiId.trim() || null,
        upi_display_name: form.upiDisplayName.trim() || null,
        upi_qr_code: form.upiQrCode,
        show_upi_qr: form.showUpiQr,
        signature: form.signature,
        show_signature: form.showSignature,
        gst_number: form.gstNumber.trim().toUpperCase() || null,
      });

      if (error) {
        setErrorMessage(error.message);
        setToast({ type: 'error', message: error.message });
      } else if (data) {
        await refreshOwnerDetails();
        // Immediately reload fresh details from database to populate preview from persisted data
        const fresh = await getOwnerDetails();
        if (fresh) {
          setForm((prev) => ({
            ...prev,
            upiQrCode: fresh.upi_qr_code !== undefined ? (fresh.upi_qr_code || null) : prev.upiQrCode,
            showSignature: fresh.show_signature !== false,
          }));
        }
        setHasExistingRecord(true);
        setIsSaved(true);
        setToast({
          type: 'success',
          message: language === 'ta' ? 'உரிமையாளர் விவரங்கள் வெற்றிகரமாக சேமிக்கப்பட்டது!' : 'Owner details saved successfully!',
        });
        setTimeout(() => {
          navigate('/');
        }, 1500);
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to save owner details.';
      setErrorMessage(msg);
      setToast({ type: 'error', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout title={t('ownerDetails.title')} subtitle={t('common.loading')} showBack>
        <div className="flex flex-col items-center justify-center py-20">
          <JCBLoader mode="card" size="lg" text={t('common.loading')} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={t('ownerDetails.title')} subtitle={t('ownerDetails.subtitle')} showBack>
      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* Profile Card Banner */}
        <div className="bg-slate-900 dark:bg-[#151B23] text-white rounded-2xl p-4 shadow-sm border border-slate-800 dark:border-[#26303D]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 p-1 shadow-xs">
              <JCBMachineIcon width={34} height={26} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold uppercase">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{hasExistingRecord ? (language === 'ta' ? 'சேமிக்கப்பட்ட இயந்திர விவரம்' : 'Saved Machine Profile') : (language === 'ta' ? 'புதிய இயந்திர விவரம்' : 'New Machine Profile')}</span>
              </div>
              <h2 className="font-bold text-base text-white truncate">
                {form.businessName || (language === 'ta' ? 'வணிகத்தின் பெயர்' : 'Business Name Placeholder')}
              </h2>
              <p className="text-xs text-slate-300 dark:text-[#9CA3AF]">
                Prop. {form.ownerName || (language === 'ta' ? 'உரிமையாளர் பெயர்' : 'Owner Name')}
              </p>
            </div>
          </div>
        </div>

        {/* Section 1: Business & Owner Profile */}
        <div className="bg-white dark:bg-[#151B23] rounded-xl p-4 border border-slate-200 dark:border-[#26303D] shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-slate-800 dark:text-[#F9FAFB] uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-amber-500" />
            <span>{t('ownerDetails.businessSection')}</span>
          </h3>

            <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#9CA3AF] mb-1">
              {t('ownerDetails.businessName')} <span className="text-amber-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Gowcik JCB"
              value={form.businessName}
              onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              className="w-full text-sm bg-slate-50 dark:bg-[#1C2430] border border-slate-200 dark:border-[#26303D] text-slate-900 dark:text-[#F9FAFB] rounded-lg p-2.5 focus:bg-white dark:focus:bg-[#151B23] focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#9CA3AF] mb-1">
              {t('ownerDetails.ownerName')} <span className="text-amber-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Gowcik"
              value={form.ownerName}
              onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
              className="w-full text-sm bg-slate-50 dark:bg-[#1C2430] border border-slate-200 dark:border-[#26303D] text-slate-900 dark:text-[#F9FAFB] rounded-lg p-2.5 focus:bg-white dark:focus:bg-[#151B23] focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#9CA3AF] mb-1">
              {t('ownerDetails.mobileNumber')} <span className="text-amber-500">*</span>
            </label>
            <input
              type="tel"
              required
              placeholder="+91 98421 XXXXX"
              value={form.mobileNumber}
              onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })}
              className="w-full text-sm bg-slate-50 dark:bg-[#1C2430] border border-slate-200 dark:border-[#26303D] text-slate-900 dark:text-[#F9FAFB] rounded-lg p-2.5 focus:bg-white dark:focus:bg-[#151B23] focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#9CA3AF] mb-1">
              {t('ownerDetails.address')}
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Kadur, Kunnam TK."
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full text-sm bg-slate-50 dark:bg-[#1C2430] border border-slate-200 dark:border-[#26303D] text-slate-900 dark:text-[#F9FAFB] rounded-lg p-2.5 focus:bg-white dark:focus:bg-[#151B23] focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            />
          </div>
        </div>

        {/* Section 2: Machine Details */}
        <div className="bg-white dark:bg-[#151B23] rounded-xl p-4 border border-slate-200 dark:border-[#26303D] shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-slate-800 dark:text-[#F9FAFB] uppercase tracking-wider flex items-center gap-1.5">
            <Truck className="w-4 h-4 text-amber-500" />
            <span>{t('ownerDetails.machineSection')}</span>
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#9CA3AF] mb-1">
              {t('ownerDetails.jcbModel')}
            </label>
            <input
              type="text"
              placeholder="e.g. JCB 3DX Super Backhoe Loader"
              value={form.jcbModel}
              onChange={(e) => setForm({ ...form, jcbModel: e.target.value })}
              className="w-full text-sm bg-slate-50 dark:bg-[#1C2430] border border-slate-200 dark:border-[#26303D] text-slate-900 dark:text-[#F9FAFB] rounded-lg p-2.5 focus:bg-white dark:focus:bg-[#151B23] focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#9CA3AF] mb-1">
                {t('ownerDetails.regNumber')} <span className="text-amber-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. TN 46 AB 1234"
                value={form.registrationNumber}
                onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
                className="w-full font-mono text-sm bg-slate-50 dark:bg-[#1C2430] border border-slate-200 dark:border-[#26303D] text-slate-900 dark:text-[#F9FAFB] rounded-lg p-2.5 uppercase focus:bg-white dark:focus:bg-[#151B23] focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#9CA3AF] mb-1">
                {t('ownerDetails.hourlyRate')}
              </label>
              <input
                type="number"
                placeholder="1200"
                value={form.hourlyRate}
                onChange={(e) => setForm({ ...form, hourlyRate: parseFloat(e.target.value) || 0 })}
                className="w-full font-mono text-sm bg-slate-50 dark:bg-[#1C2430] border border-slate-200 dark:border-[#26303D] text-slate-900 dark:text-[#F9FAFB] rounded-lg p-2.5 focus:bg-white dark:focus:bg-[#151B23] focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: UPI Payment (Configurable by Owner) */}
        <div className="bg-white dark:bg-[#151B23] rounded-xl p-4 border border-slate-200 dark:border-[#26303D] shadow-xs space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 dark:text-[#F9FAFB] uppercase tracking-wider flex items-center gap-1.5">
              <QrCode className="w-4 h-4 text-amber-500" />
              <span>{t('ownerDetails.upiPaymentSection')}</span>
            </h3>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
              UPI Pay
            </span>
          </div>

          {/* Show UPI QR on Bill Toggle Switch */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-[#1C2430] border border-slate-200 dark:border-[#26303D]">
            <div className="space-y-0.5 pr-2">
              <label htmlFor="show-upi-qr-toggle" className="text-xs font-semibold text-slate-800 dark:text-[#F9FAFB] cursor-pointer">
                {t('ownerDetails.showUpiQrOnBill')}
              </label>
              <p className="text-[11px] text-slate-400 dark:text-[#9CA3AF]">
                {t('ownerDetails.showUpiQrHint')}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                form.showUpiQr
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
              }`}>
                {form.showUpiQr ? 'ON' : 'OFF'}
              </span>
              <button
                type="button"
                id="show-upi-qr-toggle"
                role="switch"
                aria-checked={form.showUpiQr}
                onClick={() => setForm((prev) => ({ ...prev, showUpiQr: !prev.showUpiQr }))}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                  form.showUpiQr ? 'bg-[#FFCC00]' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span className="sr-only">{t('ownerDetails.showUpiQrOnBill')}</span>
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    form.showUpiQr ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 1. UPI ID */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#9CA3AF] mb-1">
              {t('ownerDetails.upiId')}
            </label>
            <input
              type="text"
              placeholder={t('ownerDetails.upiIdPlaceholder')}
              value={form.upiId}
              onChange={(e) => setForm({ ...form, upiId: e.target.value })}
              className="w-full font-mono text-sm bg-slate-50 dark:bg-[#1C2430] border border-slate-200 dark:border-[#26303D] text-slate-900 dark:text-[#F9FAFB] rounded-lg p-2.5 focus:bg-white dark:focus:bg-[#151B23] focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <p className="text-[11px] text-slate-400 dark:text-[#9CA3AF] mt-1">
              {language === 'ta' ? 'டைனமிக் QR குறியீடு உருவாக்க உங்கள் UPI ஐடி உள்ளிடவும்.' : 'Enter your UPI ID to generate dynamic bill-specific QR codes with outstanding balance.'}
            </p>
          </div>

          {/* 2. UPI Display Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#9CA3AF] mb-1">
              {t('ownerDetails.upiDisplayName')}
            </label>
            <input
              type="text"
              placeholder={t('ownerDetails.upiDisplayNamePlaceholder')}
              value={form.upiDisplayName}
              onChange={(e) => setForm({ ...form, upiDisplayName: e.target.value })}
              className="w-full text-sm bg-slate-50 dark:bg-[#1C2430] border border-slate-200 dark:border-[#26303D] text-slate-900 dark:text-[#F9FAFB] rounded-lg p-2.5 focus:bg-white dark:focus:bg-[#151B23] focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <p className="text-[11px] text-slate-400 dark:text-[#9CA3AF] mt-1">
              {language === 'ta' ? 'UPI செயலியில் வாடிக்கையாளருக்கு தெரியும் வணிகப் பெயர்.' : 'Name shown in customer UPI apps (Google Pay, PhonePe, Paytm, etc.).'}
            </p>
          </div>

          {/* 3. Upload UPI QR Code */}
          <div className="pt-2 border-t border-slate-100 dark:border-[#26303D] space-y-2.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#9CA3AF]">
              {t('ownerDetails.upiQrCode')}
            </label>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg, image/jpg"
              onChange={handleQrUpload}
              className="hidden"
            />

            {form.upiQrCode ? (
              <div className="p-3 bg-slate-50 dark:bg-[#1C2430] rounded-xl border border-slate-200 dark:border-[#26303D] flex items-center gap-3.5">
                {/* QR Preview Box */}
                <div className="w-20 h-20 bg-white p-1 rounded-lg border border-slate-300 dark:border-slate-700 shrink-0 shadow-xs flex items-center justify-center overflow-hidden">
                  <img
                    src={form.upiQrCode}
                    alt={t('ownerDetails.qrPreview')}
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    <FileCheck className="w-4 h-4 shrink-0" />
                    <span className="truncate">{t('ownerDetails.qrPreview')}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF] leading-tight">
                    {language === 'ta' ? 'பில்லில் இந்த QR குறியீடு பயன்படுத்தப்படும்.' : 'Uploaded QR image will be used on bills as fallback.'}
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-white dark:bg-[#151B23] border border-slate-300 dark:border-[#26303D] text-slate-700 dark:text-[#F9FAFB] hover:bg-slate-50 transition-colors"
                    >
                      <Upload className="w-3 h-3 text-amber-500" />
                      <span>{t('ownerDetails.replaceQrCode')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleRemoveQr}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 hover:bg-rose-100 transition-colors"
                    >
                      <Trash2 className="w-3 h-3 text-rose-500" />
                      <span>{t('ownerDetails.removeQrCode')}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 dark:border-[#26303D] rounded-xl bg-slate-50/50 dark:bg-[#1C2430]/40 text-center space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-[#26303D] text-slate-500 dark:text-slate-400 flex items-center justify-center">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {language === 'ta' ? 'QR குறியீடு பதிவேற்றப்படவில்லை' : 'No QR Code Uploaded'}
                  </span>
                </div>

                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-slate-800 dark:text-[#F9FAFB]">
                    {t('ownerDetails.uploadQrCode')}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-[#9CA3AF]">
                    {t('ownerDetails.qrHint')}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#FFCC00] text-slate-950 hover:bg-amber-400 active:scale-95 transition-all shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{t('ownerDetails.uploadQrCode')}</span>
                </button>

                {form.showUpiQr && form.upiId.trim() && (
                  <div className="w-full mt-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed text-left flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <span>
                      {language === 'ta'
                        ? '★ UPI கட்டணம் இயக்கப்பட்டுள்ளது. QR குறியீட்டிற்கு பதிலாக பில்லில் UPI கட்டண இணைப்பு காட்டப்படும்.'
                        : '★ UPI payment is enabled. The bill will show the UPI payment link instead of a QR code.'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Section 4: Tax Details */}
        <div className="bg-white dark:bg-[#151B23] rounded-xl p-4 border border-slate-200 dark:border-[#26303D] shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-slate-800 dark:text-[#F9FAFB] uppercase tracking-wider flex items-center gap-1.5">
            <Receipt className="w-4 h-4 text-amber-500" />
            <span>{t('ownerDetails.paymentSection')}</span>
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#9CA3AF] mb-1">
              {t('ownerDetails.gstNumber')}
            </label>
            <input
              type="text"
              placeholder="e.g. 33AABCS1429B1Z8"
              value={form.gstNumber}
              onChange={(e) => setForm({ ...form, gstNumber: e.target.value })}
              className="w-full font-mono text-sm bg-slate-50 dark:bg-[#1C2430] border border-slate-200 dark:border-[#26303D] text-slate-900 dark:text-[#F9FAFB] rounded-lg p-2.5 uppercase focus:bg-white dark:focus:bg-[#151B23] focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Section 5: Owner Signature */}
        <div className="bg-white dark:bg-[#151B23] rounded-xl p-4 border border-slate-200 dark:border-[#26303D] shadow-xs space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 dark:text-[#F9FAFB] uppercase tracking-wider flex items-center gap-1.5">
              <PenTool className="w-4 h-4 text-amber-500" />
              <span>{t('ownerDetails.signatureSection')}</span>
            </h3>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
              {t('ownerDetails.authorizedSignature')}
            </span>
          </div>

          {/* Show Authorized Signature on Bill Toggle Switch */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-[#1C2430] border border-slate-200 dark:border-[#26303D]">
            <div className="space-y-0.5 pr-2">
              <label htmlFor="show-signature-toggle" className="text-xs font-semibold text-slate-800 dark:text-[#F9FAFB] cursor-pointer">
                {t('ownerDetails.showSignatureOnBill')}
              </label>
              <p className="text-[11px] text-slate-400 dark:text-[#9CA3AF]">
                {t('ownerDetails.showSignatureHint')}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                form.showSignature
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
              }`}>
                {form.showSignature ? 'ON' : 'OFF'}
              </span>
              <button
                type="button"
                id="show-signature-toggle"
                role="switch"
                aria-checked={form.showSignature}
                onClick={() => {
                  const next = !form.showSignature;
                  setForm((prev) => ({ ...prev, showSignature: next }));
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                  form.showSignature ? 'bg-[#FFCC00]' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span className="sr-only">{t('ownerDetails.showSignatureOnBill')}</span>
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    form.showSignature ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Hidden file input for signature */}
          <input
            ref={signatureInputRef}
            type="file"
            accept="image/png, image/jpeg, image/jpg"
            onChange={handleSignatureUpload}
            className="hidden"
          />

          {form.signature ? (
            <div className="p-3 bg-slate-50 dark:bg-[#1C2430] rounded-xl border border-slate-200 dark:border-[#26303D] flex items-center gap-3.5">
              {/* Signature Preview Box (Crisp white backdrop so transparent strokes are clearly visible in both light & dark) */}
              <div className="w-32 h-16 bg-white p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 shrink-0 shadow-xs flex items-center justify-center overflow-hidden">
                <img
                  src={form.signature}
                  alt={t('ownerDetails.signaturePreview')}
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  <FileCheck className="w-4 h-4 shrink-0" />
                  <span className="truncate">{t('ownerDetails.signaturePreview')}</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF] leading-tight">
                  {language === 'ta' ? 'தானாக செதுக்கப்பட்ட கையொப்பம் பில்லில் தோன்றும்.' : 'Automatically cropped signature will appear above Authorized Signature on bills.'}
                </p>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => signatureInputRef.current?.click()}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-white dark:bg-[#151B23] border border-slate-300 dark:border-[#26303D] text-slate-700 dark:text-[#F9FAFB] hover:bg-slate-50 transition-colors"
                  >
                    <Upload className="w-3 h-3 text-amber-500" />
                    <span>{t('ownerDetails.replaceSignature')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRemoveSignature}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 hover:bg-rose-100 transition-colors"
                  >
                    <Trash2 className="w-3 h-3 text-rose-500" />
                    <span>{t('ownerDetails.removeSignature')}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 dark:border-[#26303D] rounded-xl bg-slate-50/50 dark:bg-[#1C2430]/40 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <PenTool className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-slate-800 dark:text-[#F9FAFB]">
                  {t('ownerDetails.uploadSignature')}
                </div>
                <div className="text-[11px] text-slate-400 dark:text-[#9CA3AF]">
                  {t('ownerDetails.signatureHint')}
                </div>
              </div>
              <button
                type="button"
                onClick={() => signatureInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#FFCC00] text-slate-950 hover:bg-amber-400 active:scale-95 transition-all shadow-xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{t('ownerDetails.uploadSignature')}</span>
              </button>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="flex items-start gap-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-3 rounded-xl text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span className="font-medium leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Success Alert */}
        {isSaved && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl p-3 flex items-center gap-2 text-xs font-semibold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{t('ownerDetails.savedSuccess')}</span>
          </div>
        )}

        {/* Save Button */}
        <div className="pt-2">
          <ActionButton
            type="submit"
            size="lg"
            variant="primary"
            loading={isSubmitting}
            loadingText={language === 'ta' ? 'சேமிக்கப்படுகிறது...' : 'Saving Details...'}
            icon={<Save className="w-4 h-4 stroke-[2.5]" />}
          >
            {t('ownerDetails.saveDetails')}
          </ActionButton>
        </div>

      </form>

      {/* Floating Toast Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </AppLayout>
  );
};
