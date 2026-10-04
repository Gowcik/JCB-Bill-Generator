import { registerPlugin, Capacitor } from '@capacitor/core';
import type { Language } from '../i18n/types';
import { getStoredLanguage } from '../i18n/I18nContext';

export interface NativeSharePluginInterface {
  isWhatsAppInstalled(): Promise<{ installed: boolean }>;
  shareImage(options: {
    base64Data: string;
    fileName: string;
    text?: string;
    target?: 'whatsapp' | 'general';
  }): Promise<{ success: boolean; target: string }>;
}

export const NativeSharePlugin = registerPlugin<NativeSharePluginInterface>('NativeSharePlugin');

export interface ShareImageResult {
  success: boolean;
  platform: 'android' | 'web';
  whatsappInstalled?: boolean;
  fallbackDownloaded?: boolean;
  message?: string;
  error?: string;
}

/**
 * Converts a Blob into base64 Data URL string
 */
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Checks if WhatsApp is installed on native device
 */
export const isWhatsAppInstalled = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const res = await NativeSharePlugin.isWhatsAppInstalled();
    return Boolean(res?.installed);
  } catch {
    return true; // Fallback assume true to attempt intent
  }
};

/**
 * Shares an image specifically to WhatsApp via native Android FileProvider + ACTION_SEND.
 * Directly attaches the PNG image and prefills caption text.
 */
export const shareImageToWhatsApp = async (
  blob: Blob,
  fileName: string,
  text?: string,
  existingDataUrl?: string,
  lang?: Language
): Promise<ShareImageResult> => {
  const currentLang = lang || getStoredLanguage();

  // 1. Android Native Platform Flow
  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = existingDataUrl || (await blobToBase64(blob));
      await NativeSharePlugin.shareImage({
        base64Data,
        fileName,
        text: text || '',
        target: 'whatsapp',
      });

      return {
        success: true,
        platform: 'android',
        whatsappInstalled: true,
      };
    } catch (err: any) {
      console.warn('[NativeShare] WhatsApp share error:', err);
      const msg = (err?.message || '').toLowerCase();
      const code = (err?.code || '').toUpperCase();

      if (code === 'WHATSAPP_NOT_INSTALLED' || msg.includes('not installed')) {
        return {
          success: false,
          platform: 'android',
          whatsappInstalled: false,
          message: currentLang === 'ta'
            ? 'இந்த ஃபோனில் WhatsApp நிறுவப்படவில்லை.'
            : 'WhatsApp is not installed on this phone.',
          error: 'WhatsApp is not installed on this phone.',
        };
      }

      return {
        success: false,
        platform: 'android',
        message: currentLang === 'ta'
          ? 'WhatsApp இல் பகிர முடியவில்லை. மீண்டும் முயற்சிக்கவும்.'
          : 'Unable to share via WhatsApp. Please try again.',
        error: err?.message || 'Share failed',
      };
    }
  }

  // 2. Web / Browser Fallback Flow
  try {
    const file = new File([blob], fileName, { type: 'image/png' });
    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: fileName,
        text: text || '',
        files: [file],
      });
      return { success: true, platform: 'web' };
    }

    // Direct download fallback
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    return {
      success: true,
      platform: 'web',
      fallbackDownloaded: true,
      message: currentLang === 'ta' ? 'படம் பதிவிறக்கப்பட்டது' : 'Image downloaded',
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { success: false, platform: 'web' };
    }
    return {
      success: false,
      platform: 'web',
      message: currentLang === 'ta'
        ? 'பகிர முடியவில்லை.'
        : 'Unable to share.',
      error: err?.message,
    };
  }
};

/**
 * Shares an image using the native Android share chooser (All apps)
 */
export const shareImageGeneral = async (
  blob: Blob,
  fileName: string,
  text?: string,
  existingDataUrl?: string,
  lang?: Language
): Promise<ShareImageResult> => {
  const currentLang = lang || getStoredLanguage();

  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = existingDataUrl || (await blobToBase64(blob));
      await NativeSharePlugin.shareImage({
        base64Data,
        fileName,
        text: text || '',
        target: 'general',
      });

      return {
        success: true,
        platform: 'android',
      };
    } catch (err: any) {
      console.warn('[NativeShare] General share error:', err);
      return {
        success: false,
        platform: 'android',
        message: currentLang === 'ta' ? 'பகிர முடியவில்லை.' : 'Unable to share.',
        error: err?.message,
      };
    }
  }

  // Web fallback
  try {
    const file = new File([blob], fileName, { type: 'image/png' });
    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: fileName,
        text: text || '',
        files: [file],
      });
      return { success: true, platform: 'web' };
    }

    return {
      success: true,
      platform: 'web',
      fallbackDownloaded: true,
    };
  } catch {
    return { success: false, platform: 'web' };
  }
};
