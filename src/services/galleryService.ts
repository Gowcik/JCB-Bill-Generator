import { registerPlugin, Capacitor } from '@capacitor/core';
import { sanitizeFileName, saveBillImage } from './billImageService';
import type { Language } from '../i18n/types';
import { getStoredLanguage } from '../i18n/I18nContext';

export interface GalleryPluginInterface {
  saveImageToGallery(options: {
    base64Data: string;
    fileName: string;
    albumName?: string;
  }): Promise<{ success: boolean; uri?: string; filePath?: string; message?: string }>;
}

export const GalleryPlugin = registerPlugin<GalleryPluginInterface>('GalleryPlugin');

export interface SaveGalleryResult {
  success: boolean;
  platform: 'android' | 'web';
  message: string;
  filePath?: string;
  error?: string;
}

/**
 * Returns true if running as an installed native mobile app (Capacitor Android)
 */
export const isNativeApp = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Returns user-facing action label depending on platform and language:
 *  - Android native: "Save to Gallery" / "கேலரியில் சேமி"
 *  - Web/browser: "Download Image" / "பதிவிறக்கு"
 */
export const getGalleryButtonLabel = (lang?: Language): string => {
  const currentLang = lang || getStoredLanguage();
  if (isNativeApp()) {
    return currentLang === 'ta' ? 'கேலரியில் சேமி' : 'Save to Gallery';
  }
  return currentLang === 'ta' ? 'பதிவிறக்கு' : 'Download Image';
};

/**
 * Helper to convert Blob to base64 string
 */
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Saves a bill PNG image:
 *  - On Android: Native MediaStore into user-visible Pictures/JCB Bills/ (instantly appears in Gallery/Photos)
 *  - On Web/browser: Direct browser file download fallback
 */
export const saveBillToGallery = async (
  blob: Blob,
  billNumber: string,
  existingDataUrl?: string,
  lang?: Language
): Promise<SaveGalleryResult> => {
  const currentLang = lang || getStoredLanguage();
  const fileName = sanitizeFileName(billNumber);

  // 1. Android Native MediaStore Flow
  if (isNativeApp()) {
    try {
      const base64Data = existingDataUrl || (await blobToBase64(blob));
      const res = await GalleryPlugin.saveImageToGallery({
        base64Data,
        fileName,
        albumName: 'JCB Bills',
      });

      return {
        success: true,
        platform: 'android',
        message: currentLang === 'ta' ? 'பில் படம் கேலரியில் சேமிக்கப்பட்டது' : 'Bill image saved to Gallery',
        filePath: res.filePath || `Pictures/JCB Bills/${fileName}`,
      };
    } catch (err: any) {
      console.warn('[saveBillToGallery] Native gallery save failed, falling back to download:', err);
      // Graceful fallback to file download
      try {
        saveBillImage(blob, billNumber);
        return {
          success: true,
          platform: 'web',
          message: currentLang === 'ta' ? 'பதிவிறக்கம் செய்யப்பட்டது' : 'Saved to Downloads',
        };
      } catch {
        return {
          success: false,
          platform: 'android',
          message: currentLang === 'ta' ? 'கேலரியில் சேமிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.' : 'Unable to save bill image to Gallery. Please try again.',
          error: err?.message || 'Failed to save image to Android MediaStore.',
        };
      }
    }
  }

  // 2. Web / Desktop Browser Fallback Flow
  try {
    saveBillImage(blob, billNumber);
    return {
      success: true,
      platform: 'web',
      message: currentLang === 'ta' ? 'பில் படம் பதிவிறக்கப்பட்டது' : 'Bill image downloaded to your device',
      filePath: fileName,
    };
  } catch (err: any) {
    console.error('[saveBillToGallery] Web download failed:', err);
    return {
      success: false,
      platform: 'web',
      message: currentLang === 'ta' ? 'படத்தை பதிவிறக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.' : 'Unable to download bill image. Please try again.',
      error: err?.message || 'Download failed.',
    };
  }
};
