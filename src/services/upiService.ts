import QRCode from 'qrcode';

export const UPI_QR_STORAGE_KEY = 'jcb_owner_upi_qr';
export const UPI_DISPLAY_NAME_STORAGE_KEY = 'jcb_owner_upi_display_name';
export const SHOW_UPI_QR_STORAGE_KEY = 'jcb_show_upi_qr';

/**
 * Validates a UPI ID
 * Basic validation:
 * - Must contain @
 * - Must not contain spaces
 * - Must not be empty when owner wants to use UPI ID payment
 * - No bank-specific or provider-specific validation
 */
export const isValidUpiId = (upiId: string | null | undefined): boolean => {
  if (!upiId) return false;
  const trimmed = upiId.trim();
  if (trimmed.length < 3) return false;
  if (trimmed.includes(' ')) return false;
  if (!trimmed.includes('@')) return false;

  const parts = trimmed.split('@');
  if (parts.length !== 2) return false;
  if (!parts[0] || !parts[1]) return false;

  return true;
};

/**
 * Builds standard UPI payment deep-link URI
 * Example: upi://pay?pa=gowcik@upi&pn=Gowcik%20JCB&am=520.00&cu=INR&tn=Bill%20BILL-0042
 */
export const generateUpiPaymentUri = ({
  upiId,
  payeeName,
  amount,
  billNumber,
  businessName,
}: {
  upiId: string;
  payeeName?: string | null;
  amount: number;
  billNumber?: string;
  businessName?: string | null;
}): string => {
  const pa = upiId.trim();
  const pn = (payeeName || businessName || 'JCB Services').trim();
  // Standard 2-decimal monetary amount for UPI
  const am = Number(Math.max(0, amount)).toFixed(2);
  const tn = billNumber ? `Bill ${billNumber}` : 'JCB Bill Payment';

  const queryParts = [
    `pa=${encodeURIComponent(pa).replace(/%40/g, '@')}`,
    `pn=${encodeURIComponent(pn)}`,
    `am=${encodeURIComponent(am)}`,
    `cu=INR`,
    `tn=${encodeURIComponent(tn)}`,
  ];

  return `upi://pay?${queryParts.join('&')}`;
};

/**
 * Generates a PNG DataURL for a given UPI deep-link URI using QRCode
 */
export const generateUpiQrCodeDataUrl = async (upiUri: string): Promise<string> => {
  try {
    return await QRCode.toDataURL(upiUri, {
      margin: 1,
      width: 700,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
  } catch (err) {
    console.error('[upiService] Failed to generate QR code data URL:', err);
    throw err;
  }
};

/**
 * Opens the native Android / mobile UPI payment chooser.
 * Triggers the upi:// scheme so the user can choose Google Pay, PhonePe, BHIM, Paytm, etc.
 */
export const openUpiPayment = (upiUri: string): { success: boolean; error?: string } => {
  try {
    // 1. Direct window.location.href to activate Android Intent resolution
    window.location.href = upiUri;
    return { success: true };
  } catch (err: any) {
    console.warn('[upiService] Failed to launch UPI URI directly, attempting link click fallback:', err);
    try {
      const link = document.createElement('a');
      link.href = upiUri;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return { success: true };
    } catch (fallbackErr: any) {
      console.error('[upiService] Failed to launch UPI payment app:', fallbackErr);
      return { success: false, error: fallbackErr?.message || 'Unable to open UPI application.' };
    }
  }
};

/**
 * Process and optimize an uploaded QR code image file (PNG / JPEG)
 * Scales down large images to a clean 400x400 PNG DataURL to prevent high storage overhead.
 */
export const processQrImageFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.match(/^image\/(png|jpeg|jpg)$/i)) {
      reject(new Error('Please upload a valid PNG or JPG/JPEG image.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (!result) {
        reject(new Error('Empty image file.'));
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image for processing.'));
      img.onload = () => {
        // Create canvas to normalize and optimize size
        const canvas = document.createElement('canvas');
        const maxDim = 600;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(result); // Fallback to raw data url if canvas context fails
          return;
        }

        // Fill white background for transparent PNGs
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const optimizedDataUrl = canvas.toDataURL('image/png', 0.95);
        resolve(optimizedDataUrl);
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
};

/**
 * Local storage helpers for owner's uploaded QR code
 */
export const getStoredUpiQr = (userId?: string | null): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const key = userId ? `${UPI_QR_STORAGE_KEY}_${userId}` : UPI_QR_STORAGE_KEY;
    return localStorage.getItem(key) || localStorage.getItem(UPI_QR_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const setStoredUpiQr = (dataUrl: string, userId?: string | null): void => {
  if (typeof window === 'undefined') return;
  try {
    const key = userId ? `${UPI_QR_STORAGE_KEY}_${userId}` : UPI_QR_STORAGE_KEY;
    localStorage.setItem(key, dataUrl);
    localStorage.setItem(UPI_QR_STORAGE_KEY, dataUrl);
  } catch (err) {
    console.warn('[upiService] Failed to save QR to localStorage:', err);
  }
};

export const removeStoredUpiQr = (userId?: string | null): void => {
  if (typeof window === 'undefined') return;
  try {
    const key = userId ? `${UPI_QR_STORAGE_KEY}_${userId}` : UPI_QR_STORAGE_KEY;
    localStorage.removeItem(key);
    localStorage.removeItem(UPI_QR_STORAGE_KEY);
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(UPI_QR_STORAGE_KEY)) {
        toRemove.push(k);
      }
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    console.warn('[upiService] Failed to remove QR from localStorage:', err);
  }
};

/**
 * Local storage helpers for owner's UPI display name
 */
export const getStoredUpiDisplayName = (userId?: string | null): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const key = userId ? `${UPI_DISPLAY_NAME_STORAGE_KEY}_${userId}` : UPI_DISPLAY_NAME_STORAGE_KEY;
    return localStorage.getItem(key) || localStorage.getItem(UPI_DISPLAY_NAME_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const setStoredUpiDisplayName = (name: string, userId?: string | null): void => {
  if (typeof window === 'undefined') return;
  try {
    const key = userId ? `${UPI_DISPLAY_NAME_STORAGE_KEY}_${userId}` : UPI_DISPLAY_NAME_STORAGE_KEY;
    localStorage.setItem(key, name);
    localStorage.setItem(UPI_DISPLAY_NAME_STORAGE_KEY, name);
  } catch (err) {
    console.warn('[upiService] Failed to save UPI display name to localStorage:', err);
  }
};

/**
 * Local storage helpers for "Show UPI QR on Bill" toggle setting (Default: true)
 */
export const getStoredShowUpiQr = (userId?: string | null): boolean => {
  if (typeof window === 'undefined') return true;
  try {
    const key = userId ? `${SHOW_UPI_QR_STORAGE_KEY}_${userId}` : SHOW_UPI_QR_STORAGE_KEY;
    const val = localStorage.getItem(key) ?? localStorage.getItem(SHOW_UPI_QR_STORAGE_KEY);
    if (val === null) return true; // Default ON
    return val === 'true';
  } catch {
    return true;
  }
};

export const setStoredShowUpiQr = (show: boolean, userId?: string | null): void => {
  if (typeof window === 'undefined') return;
  try {
    const key = userId ? `${SHOW_UPI_QR_STORAGE_KEY}_${userId}` : SHOW_UPI_QR_STORAGE_KEY;
    const strVal = show ? 'true' : 'false';
    localStorage.setItem(key, strVal);
    localStorage.setItem(SHOW_UPI_QR_STORAGE_KEY, strVal);
  } catch (err) {
    console.warn('[upiService] Failed to save Show UPI QR setting to localStorage:', err);
  }
};

