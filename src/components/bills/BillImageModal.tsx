import React, { useState, useEffect } from 'react';
import type { DbBill, Bill, OwnerDetails } from '../../types';
import type { Language } from '../../i18n/types';
import {
  generateBillImage,
  shareBillImage,
  shareToWhatsApp,
  type GeneratedBillImage,
} from '../../services/billImageService';
import { printBill } from '../../services/printService';
import { saveBillToGallery, getGalleryButtonLabel } from '../../services/galleryService';
import { useI18n } from '../../i18n';
import { useBackButton } from '../../hooks/useBackButton';
import { 
  X, 
  Share2, 
  Download, 
  AlertTriangle, 
  RefreshCw,
  MessageCircle,
  Printer,
  Globe
} from 'lucide-react';
import { ActionButton } from '../common/ActionButton';
import { JCBLoader } from '../common/JCBLoader';
import { Toast, type ToastMessage } from '../common/Toast';
import { JCBMachineIcon } from '../common/JCBMachineIcon';

interface BillImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: DbBill | Bill | null;
  ownerDetails?: OwnerDetails | null;
}

export const BillImageModal: React.FC<BillImageModalProps> = ({
  isOpen,
  onClose,
  bill,
  ownerDetails,
}) => {
  useBackButton(isOpen, onClose);
  const { language, t } = useI18n();
  // Independent Bill Image Language: completely decoupled from App language and SMS language
  const [billLang, setBillLang] = useState<Language>(language);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<GeneratedBillImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleGenerate = async (selectedLang?: Language) => {
    if (!bill) return;

    const targetLang = selectedLang || billLang;
    setIsGenerating(true);
    setError(null);

    try {
      const result = await generateBillImage(bill, ownerDetails, targetLang);
      setGeneratedImage(result);
    } catch (err: any) {
      console.error('[BillImageModal] Generation error:', err);
      setError(t('billModal.errorGenerate'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLanguageChange = (newLang: Language) => {
    if (newLang === billLang || isGenerating) return;
    setBillLang(newLang);
    handleGenerate(newLang);
  };

  useEffect(() => {
    if (isOpen && bill) {
      setBillLang(language);
      handleGenerate(language);
    } else {
      setGeneratedImage(null);
      setError(null);
    }
  }, [isOpen, bill]);

  if (!isOpen || !bill) return null;

  const raw = bill as any;
  const billNumber = raw.bill_number || raw.billNumber || 'Bill';

  // WhatsApp Sharing
  const handleWhatsApp = async () => {
    if (!generatedImage) return;

    setIsSharing(true);
    try {
      const res = await shareToWhatsApp(generatedImage.blob, bill, billLang, generatedImage.dataUrl, ownerDetails);
      if (res.whatsappInstalled === false) {
        showToast(billLang === 'ta' ? 'வாட்ஸ்அப் செயலி இந்த சாதனத்தில் நிறுவப்படவில்லை.' : 'WhatsApp is not installed on this device.', 'error');
      } else if (res.fallbackDownloaded) {
        showToast(billLang === 'ta' ? 'படம் பதிவிறக்கம் செய்யப்பட்டது! உங்கள் கேலரியிலிருந்து WhatsApp மூலம் பகிரவும்.' : 'Image downloaded! Share via WhatsApp from your device gallery.', 'info');
      } else if (res.success) {
        showToast(billLang === 'ta' ? 'WhatsApp திறக்கப்படுகிறது...' : 'Opening WhatsApp...');
      } else {
        showToast(res.error || (billLang === 'ta' ? 'பில்லைப் பகிர முடியவில்லை. மீண்டும் முயற்சிக்கவும்.' : 'Unable to share the bill. Please try again.'), 'error');
      }
    } catch (err: any) {
      showToast(billLang === 'ta' ? 'பில்லைப் பகிர முடியவில்லை. மீண்டும் முயற்சிக்கவும்.' : 'Unable to share the bill. Please try again.', 'error');
    } finally {
      setIsSharing(false);
    }
  };

  // Generic Sharing
  const handleShare = async () => {
    if (!generatedImage) return;

    setIsSharing(true);
    try {
      const res = await shareBillImage(generatedImage.blob, billNumber, generatedImage.dataUrl, billLang);
      if (res.fallbackDownloaded) {
        showToast(billLang === 'ta' ? 'படம் பதிவிறக்கம் செய்யப்பட்டது! உங்கள் கேலரியிலிருந்து பகிரவும்.' : 'Image downloaded! Share via your device gallery or messaging apps.', 'info');
      } else if (res.success) {
        showToast(billLang === 'ta' ? 'பகிர்வு திறக்கப்பட்டது.' : 'Share sheet opened successfully.');
      }
    } catch (err: any) {
      showToast(billLang === 'ta' ? 'பில் படத்தைப் பகிர முடியவில்லை.' : 'Unable to share the bill image.', 'error');
    } finally {
      setIsSharing(false);
    }
  };

  // Save Image (Gallery on Android / Download on Web)
  const handleSave = async () => {
    if (!generatedImage) return;
    setIsSaving(true);
    try {
      const res = await saveBillToGallery(generatedImage.blob, billNumber, generatedImage.dataUrl, billLang);
      if (res.success) {
        showToast(res.message);
      } else {
        showToast(res.error || (billLang === 'ta' ? 'கேலரியில் சேமிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.' : 'Unable to save bill image to Gallery. Please try again.'), 'error');
      }
    } catch {
      showToast(billLang === 'ta' ? 'கேலரியில் சேமிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.' : 'Unable to save bill image to Gallery. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Print Bill
  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const res = await printBill(bill, ownerDetails, billLang);
      if (res.fallbackNeeded) {
        showToast(billLang === 'ta' ? 'இந்த சாதனத்தில் அச்சிடும் வசதி இல்லை. பில் படத்தை சேமிக்கலாம் அல்லது பகிரலாம்.' : 'Direct printing is not available on this device. You can save or share the bill.', 'info');
      } else if (res.success) {
        showToast(billLang === 'ta' ? 'அச்சிடுதல் திறக்கப்படுகிறது...' : 'Opening print dialog...');
      }
    } catch (err: any) {
      showToast(billLang === 'ta' ? 'அச்சிடுதலைத் திறக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.' : 'Unable to open printing. Please try again.', 'error');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs"
        onClick={() => !isGenerating && !isSharing && !isPrinting && onClose()}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-white dark:bg-[#151B23] border border-slate-100 dark:border-[#26303D] rounded-2xl p-4 sm:p-5 shadow-2xl z-10 flex flex-col max-h-[94vh] animate-in zoom-in-95 duration-150">
        
        {/* Floating feedback toast */}
        <Toast toast={toast} onClose={() => setToast(null)} />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#26303D]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center p-1 shadow-xs">
              <JCBMachineIcon width={24} height={18} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-[#F9FAFB] tracking-tight">
                {generatedImage ? t('billModal.titleReady') : t('billModal.titleGenerating')}
              </h3>
              <p className="text-[11px] font-mono font-medium text-slate-500 dark:text-[#9CA3AF]">{billNumber}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating || isSharing || isPrinting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1C2430] disabled:opacity-50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Independent Bill Language Selector */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 dark:bg-[#1C2430] border border-slate-200/80 dark:border-[#26303D] rounded-xl mt-2.5 mb-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <Globe className="w-3.5 h-3.5 text-amber-500" />
            <span>{billLang === 'ta' ? 'பில் மொழி' : 'Bill Language'}:</span>
          </div>
          <div className="flex items-center gap-1 bg-white dark:bg-[#151B23] p-0.5 rounded-lg border border-slate-200/80 dark:border-[#26303D]">
            <button
              type="button"
              onClick={() => handleLanguageChange('en')}
              disabled={isGenerating}
              className={`px-3 py-0.5 text-xs font-bold rounded-md transition-all ${
                billLang === 'en'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => handleLanguageChange('ta')}
              disabled={isGenerating}
              className={`px-3 py-0.5 text-xs font-bold rounded-md transition-all ${
                billLang === 'ta'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              தமிழ்
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="my-3 flex-1 overflow-y-auto flex flex-col items-center justify-center min-h-[260px]">
          {isGenerating ? (
            <JCBLoader
              mode="card"
              size="lg"
              text={t('billModal.generating')}
              subtext={t('billModal.generatingSub')}
            />
          ) : error ? (
            <div className="text-center p-6 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl space-y-2.5 max-w-sm">
              <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
              <div className="text-xs font-semibold text-rose-700 dark:text-rose-300">{error}</div>
              <ActionButton
                variant="outline"
                size="sm"
                fullWidth={false}
                onClick={() => handleGenerate()}
                icon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                {t('common.retry')}
              </ActionButton>
            </div>
          ) : generatedImage ? (
            <div className="w-full flex flex-col items-center">
              {/* Image Preview */}
              <div className="w-full max-h-[52vh] overflow-y-auto rounded-xl border border-slate-200 dark:border-[#26303D] bg-slate-100 dark:bg-[#0B0F14] p-2 shadow-inner flex justify-center">
                <img
                  src={generatedImage.dataUrl}
                  alt={`Bill ${billNumber}`}
                  className="w-full max-w-[380px] h-auto object-contain rounded-lg shadow-sm"
                />
              </div>
              <div className="text-[11px] text-slate-400 dark:text-[#9CA3AF] text-center mt-2 font-medium">
                {t('billModal.highResSubtitle')}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="pt-2.5 border-t border-slate-100 dark:border-[#26303D] space-y-2">
          {generatedImage && !isGenerating && (
            <>
              {/* Primary Actions: WhatsApp & Share */}
              <div className="grid grid-cols-2 gap-2">
                <ActionButton
                  variant="whatsapp"
                  onClick={handleWhatsApp}
                  loading={isSharing}
                  loadingText={language === 'ta' ? 'திறக்கிறது...' : 'Opening...'}
                  icon={<MessageCircle className="w-4 h-4 stroke-[2.2]" />}
                >
                  {t('actions.whatsApp')}
                </ActionButton>

                <ActionButton
                  variant="dark"
                  onClick={handleShare}
                  loading={isSharing}
                  loadingText={language === 'ta' ? 'பகிர்கிறது...' : 'Sharing...'}
                  icon={<Share2 className="w-4 h-4" />}
                >
                  {t('actions.share')}
                </ActionButton>
              </div>

              {/* Secondary Actions: Print Bill & Save Image */}
              <div className="grid grid-cols-3 gap-2">
                <ActionButton
                  variant="secondary"
                  size="sm"
                  onClick={handlePrint}
                  loading={isPrinting}
                  loadingText={language === 'ta' ? 'அச்சிடப்படுகிறது...' : 'Printing...'}
                  icon={<Printer className="w-3.5 h-3.5" />}
                >
                  {t('actions.printBill')}
                </ActionButton>

                <ActionButton
                  variant="primary"
                  size="sm"
                  onClick={handleSave}
                  loading={isSaving}
                  loadingText={language === 'ta' ? 'சேமிக்கப்படுகிறது...' : 'Saving...'}
                  icon={<Download className="w-3.5 h-3.5 stroke-[2.5]" />}
                >
                  {getGalleryButtonLabel(language)}
                </ActionButton>

                <ActionButton
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  disabled={isGenerating || isSharing || isPrinting}
                >
                  {t('common.close')}
                </ActionButton>
              </div>
            </>
          )}

          {!generatedImage && (
            <ActionButton
              variant="secondary"
              onClick={onClose}
              disabled={isGenerating}
            >
              {t('common.close')}
            </ActionButton>
          )}
        </div>

      </div>
    </div>
  );
};
