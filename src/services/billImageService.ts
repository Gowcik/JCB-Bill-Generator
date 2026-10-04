import type { DbBill, Bill, OwnerDetails } from '../types';
import { formatDate, formatTime } from '../utils/formatters';
import type { Language } from '../i18n/types';
import { getStoredLanguage } from '../i18n/I18nContext';
import { getJCBMachineSvgString } from '../components/common/JCBMachineIcon';
import { shareImageToWhatsApp, shareImageGeneral } from './nativeShareService';
import {
  isValidUpiId,
  generateUpiPaymentUri,
  generateUpiQrCodeDataUrl,
  getStoredUpiQr,
  getStoredShowUpiQr,
} from './upiService';
import { getStoredSignature, getStoredShowSignature } from './signatureService';

export const CANVAS_FONT = '"Noto Sans Tamil", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Mukta Malar", "Latha", sans-serif';

export interface GeneratedBillImage {
  blob: Blob;
  dataUrl: string;
  fileName: string;
  width: number;
  height: number;
}

/**
 * Local storage key for developer credit on generated bill images
 */
export const DEVELOPER_CREDIT_KEY = 'jcb_show_developer_credit';

/**
 * Check if the developer credit is enabled (default is true / ON)
 */
export const getStoredShowDeveloperCredit = (): boolean => {
  try {
    const val = localStorage.getItem(DEVELOPER_CREDIT_KEY);
    if (val === null) return true; // Default is ON
    return val === 'true';
  } catch {
    return true;
  }
};

/**
 * Update the developer credit enabled preference
 */
export const setStoredShowDeveloperCredit = (show: boolean): void => {
  try {
    localStorage.setItem(DEVELOPER_CREDIT_KEY, String(show));
  } catch (err) {
    console.warn('[billImageService] Failed to persist developer credit setting:', err);
  }
};

/**
 * Format currency with exact 2 decimal places in Indian style (₹1,920.00)
 */
export const formatCurrencyWithDecimals = (amount: number): string => {
  const clean = isNaN(amount) ? 0 : Number(amount.toFixed(2));
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(clean);
};

/**
 * Sanitize bill number for filesystem and sharing
 */
export const sanitizeFileName = (billNumber: string): string => {
  const clean = (billNumber || 'bill').replace(/[^a-zA-Z0-9-_]/g, '_');
  return `JCB-Bill-${clean}.png`;
};

/**
 * Helper to draw a rounded rectangle on Canvas 2D
 */
const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillColor?: string,
  strokeColor?: string,
  lineWidth: number = 1
) => {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();

  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  ctx.restore();
};

/**
 * Ensure fonts (especially Noto Sans Tamil) are ready before canvas operations
 */
const ensureFontsReady = async () => {
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await Promise.race([
        Promise.all([
          document.fonts.load('bold 24px "Noto Sans Tamil"'),
          document.fonts.load('16px "Noto Sans Tamil"'),
          document.fonts.ready,
        ]),
        new Promise((resolve) => setTimeout(resolve, 1200)),
      ]);
    } catch {
      // Continue gracefully even if font load times out
    }
  }
};

/**
 * Asynchronously loads an SVG string into an HTMLImageElement for Canvas rendering at high resolution
 */
const loadSvgImage = (svgString: string): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      // Ensure SVG is rasterized at high resolution (1200x840 for 2x canvas)
      const hiResSvg = svgString.includes('width=')
        ? svgString.replace(/width="[^"]*"/, 'width="1200"').replace(/height="[^"]*"/, 'height="840"')
        : svgString.replace('<svg ', '<svg width="1200" height="840" ');
      const svgBase64 = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(hiResSvg);
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = svgBase64;
    } catch {
      resolve(null);
    }
  });
};

/**
 * Asynchronously loads a Data URL or image source into an HTMLImageElement for Canvas rendering
 */
const loadImageElement = (src: string): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    } catch {
      resolve(null);
    }
  });
};

/**
 * Generate a professional, commercial JCB / Earthmoving Equipment Work Invoice image (1140 × 1620).
 * Implements strict JCB branding, header excavator machine illustration, and NO meter readings.
 */
export const generateBillImage = async (
  bill: DbBill | Bill,
  ownerDetails?: OwnerDetails | null,
  lang?: Language,
  showDevCredit?: boolean
): Promise<GeneratedBillImage> => {
  const currentLang: Language = lang || getStoredLanguage();
  const isTamil = currentLang === 'ta';
  const showDeveloperCredit = showDevCredit !== undefined 
    ? showDevCredit 
    : getStoredShowDeveloperCredit();

  // Ensure fonts (especially Tamil unicode fonts) are loaded and ready before canvas operations
  await ensureFontsReady();

  const raw = bill as any;
  const billNumber = raw.bill_number || raw.billNumber || 'JCB-BILL';
  const billDate = raw.bill_date || raw.date || '';
  const billCreatedAt = raw.created_at || raw.createdAt || raw.timestamp || '';
  const formattedDate = billDate ? formatDate(billDate, currentLang) : formatDate(new Date().toISOString(), currentLang);
  const formattedTime = formatTime(billCreatedAt || (billDate && billDate.includes('T') ? billDate : new Date()));

  const customerName = (raw.customer_name || raw.customerName || 'Customer').trim();
  const customerMobile = (raw.customer_mobile || raw.customerPhone || '').trim();
  const totalAmount = Number(raw.total_amount ?? raw.totalAmount ?? 0);
  const paidAmount = Number(raw.paid_amount ?? raw.paidAmount ?? 0);
  const balanceAmount = Number(raw.balance_amount ?? raw.balanceAmount ?? 0);
  const paymentStatus = (raw.payment_status || raw.paymentStatus || 'Unpaid').toUpperCase();
  const workingHours = raw.working_hours ?? raw.totalHours ?? null;

  // Pricing calculations
  const parsedHours = workingHours ? Number(workingHours) : 0;
  const hourlyRate = raw.rate_per_hour || raw.hourly_rate || raw.hourlyRate || ownerDetails?.hourly_rate || (parsedHours > 0 ? Math.round(totalAmount / parsedHours) : 1200);
  const extraCharges = Number(raw.extra_charges || raw.extraCharges || 0);
  const discount = Number(raw.discount || 0);

  // Owner information
  const businessName = (ownerDetails?.business_name || 'JCB BILL GENERATOR').trim();
  const ownerName = (ownerDetails?.owner_name || '').trim();
  const ownerMobile = (ownerDetails?.mobile_number || '').trim();
  const ownerAddress = (ownerDetails?.address || '').trim();
  const jcbModel = (ownerDetails?.jcb_model || 'JCB 3DX Super Backhoe Loader').trim();
  const registrationNumber = (ownerDetails?.registration_number || '').trim();
  const upiId = (ownerDetails?.upi_id || '').trim();
  const upiDisplayName = (ownerDetails?.upi_display_name || ownerDetails?.business_name || '').trim();
  const uploadedQr = (ownerDetails && ownerDetails.upi_qr_code)
    ? ownerDetails.upi_qr_code
    : (ownerDetails && (ownerDetails.upi_qr_code === null || ownerDetails.upi_qr_code === ''))
      ? null
      : getStoredUpiQr();
  const showUpiQr = ownerDetails ? (ownerDetails.show_upi_qr !== false) : (getStoredShowUpiQr() !== false);
  const uploadedSignature = ownerDetails ? (ownerDetails.signature || null) : getStoredSignature();
  const showSignature = ownerDetails ? (ownerDetails.show_signature !== false) : (getStoredShowSignature() !== false);
  const gstNumber = (ownerDetails?.gst_number || '').trim();

  // Loading bill specifics (if applicable)
  const isLoadingBill = raw.bill_type === 'loading' || Boolean(raw.loading_details);
  const loadingDetails = raw.loading_details;
  const totalTractorLoads = loadingDetails?.totalTractorLoads ?? (raw.working_hours != null ? Number(raw.working_hours) : 0);
  const jcbLoads = loadingDetails?.jcbLoads ?? totalTractorLoads;
  const totalLoads = loadingDetails?.totalLoads ?? totalTractorLoads;
  const tractorRate = loadingDetails?.tractorRate ?? 300;
  const jcbRate = loadingDetails?.jcbRate ?? 200;
  const combinedRate = loadingDetails?.combinedRate ?? (tractorRate + jcbRate);
  const tractorTotal = loadingDetails?.tractorTotal ?? (totalTractorLoads * tractorRate);
  const jcbTotal = loadingDetails?.jcbTotal ?? (jcbLoads * jcbRate);

  // Pre-calculate billing table ending Y position:
  // tableY = 562 (headerY 40 + headerH 226 + 20 + 104 + 16 + cardH 136 + 20)
  const tableY = 562;
  let estCalcRowY = tableY + 74;
  if (isLoadingBill) {
    const tractorsList: any[] = loadingDetails?.tractors || [];
    if (tractorsList.length > 1) {
      estCalcRowY += (tractorsList.length - 1) * 36;
      estCalcRowY += 34; // Tractor total row
    }
    estCalcRowY += 38; // JCB loading row
    estCalcRowY += 34; // Total loads note
  }
  if (extraCharges > 0) estCalcRowY += 36;
  if (discount > 0) estCalcRowY += 36;
  estCalcRowY += 24 + 34; // Divider + Total row

  const paySummaryY = estCalcRowY + 28;
  const paySummaryH = 146;
  const paySummaryBottom = paySummaryY + paySummaryH;

  // Determine UPI payment display logic (3 cases):
  // Case A: UPI ON + balance > 0 + uploaded QR image -> QR Card (356px)
  // Case B: UPI ON + balance > 0 + no QR image + valid UPI ID -> UPI ID Card (110px, strictly NO synthetic QR, NO payment link!)
  // Case C: UPI OFF or balance <= 0 -> Omit completely (0px)
  const hasBalance = balanceAmount > 0;
  let paymentSectionType: 'QR' | 'UPI_LINK' | 'NONE' = 'NONE';
  let paymentCardH = 0;

  if (showUpiQr && hasBalance) {
    if (uploadedQr) {
      paymentSectionType = 'QR';
      paymentCardH = 356;
    } else if (isValidUpiId(upiId)) {
      paymentSectionType = 'UPI_LINK';
      paymentCardH = 110;
    }
  }

  // Dynamic Signature and Footer positions
  let sigSectionTop: number;
  if (paymentSectionType !== 'NONE') {
    // Generous 42px vertical gap between payment card and signature section
    sigSectionTop = paySummaryBottom + 20 + paymentCardH + 42;
  } else {
    // When no UPI payment section: signature moves up cleanly to follow payment summary!
    sigSectionTop = paySummaryBottom + 40;
  }

  // 70px empty space above signature line for customer physical pen signature
  const sigLineY = sigSectionTop + 70;
  const footerTop = sigLineY + 58;
  const footerBottom = footerTop + (showDeveloperCredit ? 74 : 44);

  // Dynamic canvas height to perfectly frame the invoice without awkward voids or cutoffs
  const width = 1140;
  const height = Math.max(980, Math.round(footerBottom + 36));
  const scale = 2;

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is not available.');
  }

  // Scale context for crisp high-resolution 2x rendering
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Load the JCB Machine SVG illustration for the header
  const machineSvg = getJCBMachineSvgString();
  const machineImg = await loadSvgImage(machineSvg);

  // Pre-load dynamic QR (with balance amount) or uploaded QR image
  let qrImg: HTMLImageElement | null = null;
  if (paymentSectionType === 'QR' && uploadedQr) {
    try {
      if (isValidUpiId(upiId)) {
        try {
          const upiUri = generateUpiPaymentUri({
            upiId,
            payeeName: upiDisplayName,
            amount: balanceAmount,
            billNumber,
            businessName,
          });
          const dynamicQrDataUrl = await generateUpiQrCodeDataUrl(upiUri);
          qrImg = await loadImageElement(dynamicQrDataUrl);
        } catch (dynErr) {
          console.warn('[billImageService] Dynamic QR generation failed, falling back to uploaded QR:', dynErr);
          qrImg = await loadImageElement(uploadedQr);
        }
      } else {
        qrImg = await loadImageElement(uploadedQr);
      }
    } catch (qrErr) {
      console.warn('[billImageService] Error loading QR image:', qrErr);
    }
  }

  // Load owner signature image if configured and enabled
  let signatureImg: HTMLImageElement | null = null;
  if (showSignature && uploadedSignature) {
    try {
      signatureImg = await loadImageElement(uploadedSignature);
    } catch (sigErr) {
      console.warn('[billImageService] Failed to load owner signature image:', sigErr);
    }
  }

  // 1. Base Canvas Background (Crisp White)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Outer Border
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 4;
  ctx.strokeRect(14, 14, width - 28, height - 28);

  // 2. Top Industrial Accent Strip (JCB Yellow / Slate)
  ctx.fillStyle = '#F59E0B'; // Amber 500
  ctx.fillRect(16, 16, width - 32, 14);

  // 3. Premium Header Card (Dark Navy / Industrial Charcoal)
  const headerY = 40;
  const headerHeight = 226;
  drawRoundedRect(
    ctx,
    36,
    headerY,
    width - 72,
    headerHeight,
    18,
    '#0F172A', // Slate 900
    '#1E293B',
    2
  );

  // Header Content - Center-balanced composition
  // Right side accommodates the JCB machine illustration, while business & contact details
  // are beautifully centered in the main visual area, filling the navy header with clean hierarchy.
  const machineW = 180;
  const machineH = 125;
  const machineX = width - 48 - machineW - 16;
  const machineY = headerY + Math.round((headerHeight - machineH) / 2);

  const headerCenterX = machineImg ? 480 : width / 2;

  // Address & GSTIN combination
  const addressLine = [ownerAddress, gstNumber ? `GST: ${gstNumber}` : ''].filter(Boolean).join('  •  ');

  // Business Name font sizing with max-width protection
  const busNameUpper = businessName.toUpperCase();
  const nameLen = busNameUpper.length;
  let busFontSize = nameLen > 28 ? 32 : nameLen > 20 ? 38 : 42;
  ctx.font = `900 ${busFontSize}px ${CANVAS_FONT}`;
  const maxBusWidth = machineImg ? 700 : width - 160;
  let busMeasured = ctx.measureText(busNameUpper).width;
  if (busMeasured > maxBusWidth) {
    busFontSize = Math.max(26, Math.floor(busFontSize * (maxBusWidth / busMeasured)));
  }

  // Define layout rows for dynamic vertical centering inside header card
  type HeaderRowType = 'business' | 'service' | 'proprietor' | 'mobile' | 'address';
  interface HeaderRow {
    type: HeaderRowType;
    height: number;
    gapBefore: number;
  }

  const headerRows: HeaderRow[] = [
    { type: 'business', height: busFontSize, gapBefore: 0 },
    { type: 'service', height: 18, gapBefore: 12 },
  ];

  if (ownerName) {
    headerRows.push({ type: 'proprietor', height: 21, gapBefore: 14 });
  }
  if (ownerMobile) {
    headerRows.push({ type: 'mobile', height: 20, gapBefore: 10 });
  }
  if (addressLine) {
    headerRows.push({ type: 'address', height: 17, gapBefore: 10 });
  }

  // Calculate total vertical height and center within header card
  let totalHeaderRowsHeight = 0;
  for (let i = 0; i < headerRows.length; i++) {
    totalHeaderRowsHeight += headerRows[i].height + (i > 0 ? headerRows[i].gapBefore : 0);
  }

  const verticalPadding = Math.max(20, Math.round((headerHeight - totalHeaderRowsHeight) / 2));
  let currentY = headerY + verticalPadding;

  for (let i = 0; i < headerRows.length; i++) {
    const row = headerRows[i];
    if (i > 0) {
      currentY += row.gapBefore;
    }

    if (row.type === 'business') {
      // 1. Business Name (Largest, commanding, crisp white)
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `900 ${busFontSize}px ${CANVAS_FONT}`;
      ctx.fillText(busNameUpper, headerCenterX, currentY + busFontSize * 0.82);
      currentY += row.height;
    } else if (row.type === 'service') {
      // 2. Service: JCB / EARTHMOVING SERVICES (Vibrant JCB Golden Amber, prominent accent)
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FBBF24'; // Vibrant JCB Golden Amber
      ctx.font = `800 18px ${CANVAS_FONT}`;
      if (!isTamil) ctx.letterSpacing = '2px';
      ctx.fillText(isTamil ? 'JCB / மண் அள்ளும் இயந்திர சேவைகள்' : 'JCB / EARTHMOVING SERVICES', headerCenterX, currentY + 18 * 0.82);
      ctx.letterSpacing = '0px';
      currentY += row.height;
    } else if (row.type === 'proprietor') {
      // 3. Proprietor / Owner Name (Two-tone hierarchy: light secondary label + bright white name)
      const propLabel = isTamil ? 'உரிமையாளர்: ' : 'Proprietor: ';
      ctx.font = `600 21px ${CANVAS_FONT}`;
      const propLabelWidth = ctx.measureText(propLabel).width;
      ctx.font = `800 21px ${CANVAS_FONT}`;
      const propNameWidth = ctx.measureText(ownerName).width;
      const totalPropWidth = propLabelWidth + propNameWidth;
      const propStartX = headerCenterX - totalPropWidth / 2;

      ctx.textAlign = 'left';
      ctx.font = `600 21px ${CANVAS_FONT}`;
      ctx.fillStyle = '#CBD5E1'; // Light secondary label
      ctx.fillText(propLabel, propStartX, currentY + 21 * 0.82);

      ctx.font = `800 21px ${CANVAS_FONT}`;
      ctx.fillStyle = '#FFFFFF'; // Bright pure white name
      ctx.fillText(ownerName, propStartX + propLabelWidth, currentY + 21 * 0.82);
      currentY += row.height;
    } else if (row.type === 'mobile') {
      // 4. Mobile Number (Two-tone hierarchy: light secondary label + bright white number)
      const phoneLabel = isTamil ? 'மொபைல்: ' : 'Mobile: ';
      ctx.font = `600 20px ${CANVAS_FONT}`;
      const phoneLabelWidth = ctx.measureText(phoneLabel).width;
      ctx.font = `700 20px ${CANVAS_FONT}`;
      const phoneValWidth = ctx.measureText(ownerMobile).width;
      const totalPhoneWidth = phoneLabelWidth + phoneValWidth;
      const phoneStartX = headerCenterX - totalPhoneWidth / 2;

      ctx.textAlign = 'left';
      ctx.font = `600 20px ${CANVAS_FONT}`;
      ctx.fillStyle = '#CBD5E1'; // Light secondary label
      ctx.fillText(phoneLabel, phoneStartX, currentY + 20 * 0.82);

      ctx.font = `700 20px ${CANVAS_FONT}`;
      ctx.fillStyle = '#FFFFFF'; // Bright pure white number
      ctx.fillText(ownerMobile, phoneStartX + phoneLabelWidth, currentY + 20 * 0.82);
      currentY += row.height;
    } else if (row.type === 'address') {
      // 5. Address & GSTIN (Clean muted light gray)
      ctx.textAlign = 'center';
      ctx.fillStyle = '#94A3B8';
      ctx.font = `500 17px ${CANVAS_FONT}`;
      ctx.fillText(addressLine, headerCenterX, currentY + 17 * 0.82);
      currentY += row.height;
    }
  }

  // Header Content - Right Side: Clean JCB Excavator Machine Illustration
  if (machineImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(machineX + machineW / 2, machineY + machineH / 2, 70, 0, Math.PI * 2);
    ctx.fillStyle = '#1E293B';
    ctx.fill();
    ctx.restore();

    ctx.drawImage(machineImg, machineX, machineY, machineW, machineH);
  }

  // 4. Invoice Title & Metadata Bar
  const titleY = headerY + headerHeight + 20;

  // Title: JCB WORK INVOICE / JCB LOADING INVOICE
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0F172A';
  ctx.font = `900 32px ${CANVAS_FONT}`;
  if (isLoadingBill) {
    ctx.fillText(isTamil ? 'JCB மணல் லோடு பட்டியல்' : 'JCB LOADING INVOICE', 48, titleY + 30);
    ctx.fillStyle = '#64748B';
    ctx.font = `600 16px ${CANVAS_FONT}`;
    ctx.fillText(isTamil ? 'வணிக மணல் லோடு பணிப் பட்டியல்' : 'Commercial Sand Loading Work Invoice', 48, titleY + 58);
  } else {
    ctx.fillText(isTamil ? 'JCB பணிப் பட்டியல்' : 'JCB WORK INVOICE', 48, titleY + 30);
    ctx.fillStyle = '#64748B';
    ctx.font = `600 16px ${CANVAS_FONT}`;
    ctx.fillText(isTamil ? 'வணிக இயந்திரப் பணிப் பட்டியல்' : 'Commercial Equipment Work Invoice', 48, titleY + 58);
  }

  // Metadata Pill Box on Right (Bill Number, Date & Time)
  const metaBoxW = 410;
  const metaBoxX = width - 48 - metaBoxW;
  const metaBoxH = 98;
  drawRoundedRect(
    ctx,
    metaBoxX,
    titleY - 8,
    metaBoxW,
    metaBoxH,
    14,
    '#F8FAFC',
    '#E2E8F0',
    1.5
  );

  const billNoLabel = isTamil ? 'பில் எண்' : 'Bill No';
  const dateLabel = isTamil ? 'தேதி' : 'Date';
  const timeLabel = isTamil ? 'நேரம்' : 'Time';

  ctx.fillStyle = '#0F172A';
  ctx.font = `800 19px ${CANVAS_FONT}`;
  ctx.fillText(`${billNoLabel}: ${billNumber}`, metaBoxX + 20, titleY + 22);

  ctx.fillStyle = '#475569';
  ctx.font = `600 16px ${CANVAS_FONT}`;
  ctx.fillText(`${dateLabel}: ${formattedDate}`, metaBoxX + 20, titleY + 52);
  ctx.fillText(`${timeLabel}: ${formattedTime}`, metaBoxX + 20, titleY + 78);

  // Divider
  const divY = titleY + 104;
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(48, divY);
  ctx.lineTo(width - 48, divY);
  ctx.stroke();

  // 5. Two-Column Information Cards: Customer Details (Left) & Machine Details (Right)
  // STRICT RULE: NEVER DISPLAY ANY METER READINGS!
  const cardsY = divY + 16;
  const cardW = (width - 96 - 20) / 2;
  const cardH = 136;

  // Left Card: CUSTOMER DETAILS
  drawRoundedRect(ctx, 48, cardsY, cardW, cardH, 14, '#F8FAFC', '#E2E8F0', 1.5);
  ctx.fillStyle = '#64748B';
  ctx.font = `800 14px ${CANVAS_FONT}`;
  if (!isTamil) ctx.letterSpacing = '0.5px';
  ctx.fillText(isTamil ? 'வாடிக்கையாளர் விவரங்கள்' : 'CUSTOMER DETAILS', 68, cardsY + 30);
  ctx.letterSpacing = '0px';

  ctx.fillStyle = '#0F172A';
  ctx.font = `800 24px ${CANVAS_FONT}`;
  ctx.fillText(customerName, 68, cardsY + 68);

  if (customerMobile) {
    ctx.fillStyle = '#2563EB'; // Blue
    ctx.font = `bold 19px ${CANVAS_FONT}`;
    ctx.fillText(customerMobile, 68, cardsY + 104);
  }

  // Right Card: MACHINE & LOADING DETAILS (NO METER READINGS)
  const rightCardX = 48 + cardW + 20;
  if (isLoadingBill) {
    drawRoundedRect(ctx, rightCardX, cardsY, cardW, cardH, 14, '#FFFBEB', '#FDE68A', 1.5); // Amber tinted
    ctx.fillStyle = '#B45309';
    ctx.font = `800 14px ${CANVAS_FONT}`;
    if (!isTamil) ctx.letterSpacing = '0.5px';
    ctx.fillText(isTamil ? 'இயந்திரம் & லோடு விவரங்கள்' : 'EQUIPMENT & LOADING', rightCardX + 20, cardsY + 30);
    ctx.letterSpacing = '0px';

    ctx.fillStyle = '#0F172A';
    ctx.font = `700 20px ${CANVAS_FONT}`;
    ctx.fillText(isTamil ? 'JCB & டிராக்டர் லோடு பணி' : `${jcbModel} & Tractors`, rightCardX + 20, cardsY + 64);

    ctx.fillStyle = '#475569';
    ctx.font = `600 17px ${CANVAS_FONT}`;
    const regLabel = isTamil ? 'பதிவு எண்: ' : 'Reg: ';
    const regText = registrationNumber ? `${regLabel}${registrationNumber}` : '';
    const loadText = isTamil ? `மொத்த லோடு: ${totalLoads} லோடு` : `Total Loads: ${totalLoads} Loads`;
    const machineMetaText = [regText, loadText].filter(Boolean).join('  •  ');
    ctx.fillText(machineMetaText, rightCardX + 20, cardsY + 102);
  } else {
    drawRoundedRect(ctx, rightCardX, cardsY, cardW, cardH, 14, '#FFFBEB', '#FDE68A', 1.5); // Amber tinted
    ctx.fillStyle = '#B45309';
    ctx.font = `800 14px ${CANVAS_FONT}`;
    if (!isTamil) ctx.letterSpacing = '0.5px';
    ctx.fillText(isTamil ? 'இயந்திர விவரங்கள்' : 'MACHINE DETAILS', rightCardX + 20, cardsY + 30);
    ctx.letterSpacing = '0px';

    ctx.fillStyle = '#0F172A';
    ctx.font = `700 20px ${CANVAS_FONT}`;
    ctx.fillText(jcbModel, rightCardX + 20, cardsY + 64);

    // Machine Reg No and Working Hours Row
    ctx.fillStyle = '#475569';
    ctx.font = `600 17px ${CANVAS_FONT}`;
    const regLabel = isTamil ? 'பதிவு எண்: ' : 'Reg: ';
    const hoursLabel = isTamil ? 'பணி நேரம்: ' : 'Working Hours: ';
    const regText = registrationNumber ? `${regLabel}${registrationNumber}` : '';
    const hoursVal = parsedHours > 0 
      ? (isTamil ? `${hoursLabel}${parsedHours.toFixed(2)} மணி` : `${hoursLabel}${parsedHours.toFixed(2)} Hrs`)
      : `${hoursLabel}-`;
    const machineMetaText = [regText, hoursVal].filter(Boolean).join('  •  ');
    ctx.fillText(machineMetaText, rightCardX + 20, cardsY + 102);
  }

  // 6. Billing Calculation Table (Section 9)
  const tableW = width - 96;

  // Table Header
  drawRoundedRect(ctx, 48, tableY, tableW, 44, 10, '#0F172A', '#0F172A', 1);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold 15px ${CANVAS_FONT}`;
  if (!isTamil) ctx.letterSpacing = '0.5px';

  ctx.textAlign = 'left';
  ctx.fillText(isTamil ? 'விவரம்' : 'DESCRIPTION', 68, tableY + 27);

  ctx.textAlign = 'right';
  ctx.fillText(isLoadingBill ? (isTamil ? 'லோடுகள்' : 'LOADS') : (isTamil ? 'மணி நேரம்' : 'HOURS'), 680, tableY + 27);
  ctx.fillText(isLoadingBill ? (isTamil ? 'கட்டணம்' : 'RATE') : (isTamil ? 'மணி நேரக் கட்டணம்' : 'RATE'), 870, tableY + 27);
  ctx.fillText(isTamil ? 'தொகை' : 'AMOUNT', width - 68, tableY + 27);
  ctx.letterSpacing = '0px';

  let calcRowY = tableY + 74;

  if (isLoadingBill) {
    const tractorsList: any[] = loadingDetails?.tractors || [];
    const hasMultipleTractors = tractorsList.length > 1;

    if (hasMultipleTractors) {
      tractorsList.forEach((tr, idx) => {
        if (idx > 0) calcRowY += 36;
        ctx.textAlign = 'left';
        ctx.fillStyle = '#0F172A';
        ctx.font = `700 20px ${CANVAS_FONT}`;
        const trTitle = tr.vehicleNo ? `${tr.name} (${tr.vehicleNo})` : tr.name;
        ctx.fillText(trTitle, 68, calcRowY);

        ctx.textAlign = 'right';
        ctx.font = `600 20px ${CANVAS_FONT}`;
        ctx.fillStyle = '#334155';
        ctx.fillText(isTamil ? `${tr.loads} லோடு` : `${tr.loads} Loads`, 680, calcRowY);
        ctx.fillText(isTamil ? `₹${tractorRate}/லோடு` : `₹${tractorRate}/Load`, 870, calcRowY);

        ctx.fillStyle = '#0F172A';
        ctx.font = `bold 20px ${CANVAS_FONT}`;
        ctx.fillText(formatCurrencyWithDecimals(tr.loads * tractorRate), width - 68, calcRowY);
      });

      // Tractor Total row
      calcRowY += 34;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#475569';
      ctx.font = `700 18px ${CANVAS_FONT}`;
      ctx.fillText(isTamil ? 'டிராக்டர் மொத்தம்' : 'Total Tractor Loading', 68, calcRowY);

      ctx.textAlign = 'right';
      ctx.font = `700 18px ${CANVAS_FONT}`;
      ctx.fillStyle = '#475569';
      ctx.fillText(isTamil ? `${totalTractorLoads} லோடு` : `${totalTractorLoads} Loads`, 680, calcRowY);
      ctx.fillText(isTamil ? `₹${tractorRate}/லோடு` : `₹${tractorRate}/Load`, 870, calcRowY);
      ctx.fillText(formatCurrencyWithDecimals(tractorTotal), width - 68, calcRowY);
    } else {
      const tr0 = tractorsList[0];
      const singleName = tr0?.vehicleNo 
        ? (isTamil ? `டிராக்டர் லோடு பணி (${tr0.vehicleNo})` : `Tractor Loading (${tr0.vehicleNo})`)
        : (isTamil ? 'டிராக்டர் லோடு பணி' : 'Tractor Loading');
      ctx.textAlign = 'left';
      ctx.fillStyle = '#0F172A';
      ctx.font = `700 22px ${CANVAS_FONT}`;
      ctx.fillText(singleName, 68, calcRowY);

      ctx.textAlign = 'right';
      ctx.font = `600 21px ${CANVAS_FONT}`;
      ctx.fillStyle = '#334155';
      ctx.fillText(isTamil ? `${totalTractorLoads} லோடு` : `${totalTractorLoads} Loads`, 680, calcRowY);
      ctx.fillText(isTamil ? `₹${tractorRate}/லோடு` : `₹${tractorRate}/Load`, 870, calcRowY);

      ctx.fillStyle = '#0F172A';
      ctx.font = `bold 22px ${CANVAS_FONT}`;
      ctx.fillText(formatCurrencyWithDecimals(tractorTotal), width - 68, calcRowY);
    }

    // JCB Loading Row
    calcRowY += 38;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0F172A';
    ctx.font = `700 22px ${CANVAS_FONT}`;
    ctx.fillText(isTamil ? 'JCB லோடு பணி' : 'JCB Loading', 68, calcRowY);

    ctx.textAlign = 'right';
    ctx.font = `600 21px ${CANVAS_FONT}`;
    ctx.fillStyle = '#334155';
    ctx.fillText(isTamil ? `${jcbLoads} லோடு` : `${jcbLoads} Loads`, 680, calcRowY);
    ctx.fillText(isTamil ? `₹${jcbRate}/லோடு` : `₹${jcbRate}/Load`, 870, calcRowY);

    ctx.fillStyle = '#0F172A';
    ctx.font = `bold 22px ${CANVAS_FONT}`;
    ctx.fillText(formatCurrencyWithDecimals(jcbTotal), width - 68, calcRowY);

    // Total Loads Note Line
    calcRowY += 34;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#B45309';
    ctx.font = `600 16px ${CANVAS_FONT}`;
    const pairNote = isTamil 
      ? `★ மொத்த லோடு: ${totalLoads} லோடு • ஒரு லோடு கட்டணம்: ₹${combinedRate} (டிராக்டர் ₹${tractorRate} + JCB ₹${jcbRate})`
      : `★ Total Loads: ${totalLoads} Loads • Combined Rate: ₹${combinedRate}/Load (Tractor ₹${tractorRate} + JCB ₹${jcbRate})`;
    ctx.fillText(pairNote, 68, calcRowY);
  } else {
    // Table Row 1: JCB Machine Work
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0F172A';
    ctx.font = `700 22px ${CANVAS_FONT}`;
    ctx.fillText(isTamil ? 'JCB இயந்திரப் பணி' : 'JCB Machine Work', 68, calcRowY);

    ctx.textAlign = 'right';
    ctx.font = `600 21px ${CANVAS_FONT}`;
    ctx.fillStyle = '#334155';
    const hoursDisplay = isTamil ? `${parsedHours.toFixed(2)} மணி` : `${parsedHours.toFixed(2)} Hrs`;
    const rateDisplay = isTamil 
      ? (hourlyRate ? `₹${hourlyRate}/மணி` : '-') 
      : (hourlyRate ? `₹${hourlyRate}/Hr` : '-');
    ctx.fillText(hoursDisplay, 680, calcRowY);
    ctx.fillText(rateDisplay, 870, calcRowY);

    ctx.fillStyle = '#0F172A';
    ctx.font = `bold 22px ${CANVAS_FONT}`;
    const workAmount = parsedHours > 0 && hourlyRate ? parsedHours * hourlyRate : totalAmount;
    ctx.fillText(formatCurrencyWithDecimals(workAmount), width - 68, calcRowY);
  }

  // Extra Charges (if any)
  if (extraCharges > 0) {
    calcRowY += 36;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#475569';
    ctx.font = `500 19px ${CANVAS_FONT}`;
    ctx.fillText(isTamil ? 'கூடுதல் கட்டணம்' : 'Extra Charges', 68, calcRowY);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#0F172A';
    ctx.font = `600 19px ${CANVAS_FONT}`;
    ctx.fillText(`+${formatCurrencyWithDecimals(extraCharges)}`, width - 68, calcRowY);
  }

  // Discount (if any)
  if (discount > 0) {
    calcRowY += 36;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#047857';
    ctx.font = `500 19px ${CANVAS_FONT}`;
    ctx.fillText(isTamil ? 'தள்ளுபடி' : 'Discount', 68, calcRowY);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#047857';
    ctx.font = `600 19px ${CANVAS_FONT}`;
    ctx.fillText(`-${formatCurrencyWithDecimals(discount)}`, width - 68, calcRowY);
  }

  // Divider above Total
  calcRowY += 24;
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(48, calcRowY);
  ctx.lineTo(width - 48, calcRowY);
  ctx.stroke();

  // Table Total Row
  calcRowY += 34;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0F172A';
  ctx.font = `900 24px ${CANVAS_FONT}`;
  ctx.fillText(isTamil ? 'மொத்த தொகை' : 'TOTAL AMOUNT', 68, calcRowY);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#0F172A';
  ctx.font = `900 28px ${CANVAS_FONT}`;
  ctx.fillText(formatCurrencyWithDecimals(totalAmount), width - 68, calcRowY);

  // 7. Payment Summary & Status Badge (Section 10 & 11)
  drawRoundedRect(
    ctx,
    48,
    paySummaryY,
    width - 96,
    paySummaryH,
    16,
    '#F8FAFC',
    '#CBD5E1',
    2
  );

  // 4 Column Grid inside Payment Summary Box:
  // TOTAL AMOUNT | AMOUNT PAID | BALANCE DUE | PAYMENT STATUS
  const colW = (width - 96) / 4;
  const metricsTextY = paySummaryY + 44;
  const metricsValY = paySummaryY + 95;

  // Col 1: Total Amount
  ctx.textAlign = 'center';
  ctx.fillStyle = '#64748B';
  ctx.font = `800 15px ${CANVAS_FONT}`;
  ctx.fillText(isTamil ? 'மொத்த தொகை' : 'TOTAL AMOUNT', 48 + colW * 0.5, metricsTextY);

  ctx.fillStyle = '#0F172A';
  ctx.font = `900 26px ${CANVAS_FONT}`;
  ctx.fillText(formatCurrencyWithDecimals(totalAmount), 48 + colW * 0.5, metricsValY);

  // Col 2: Amount Paid
  ctx.fillStyle = '#047857'; // Emerald
  ctx.font = `800 15px ${CANVAS_FONT}`;
  ctx.fillText(isTamil ? 'செலுத்திய தொகை' : 'AMOUNT PAID', 48 + colW * 1.5, metricsTextY);

  ctx.fillStyle = '#047857';
  ctx.font = `900 26px ${CANVAS_FONT}`;
  ctx.fillText(formatCurrencyWithDecimals(paidAmount), 48 + colW * 1.5, metricsValY);

  // Col 3: Balance Due
  ctx.fillStyle = hasBalance ? '#BE123C' : '#047857';
  ctx.font = `800 15px ${CANVAS_FONT}`;
  ctx.fillText(isTamil ? 'செலுத்த வேண்டிய தொகை' : 'BALANCE DUE', 48 + colW * 2.5, metricsTextY);

  ctx.fillStyle = hasBalance ? '#BE123C' : '#047857';
  ctx.font = `900 28px ${CANVAS_FONT}`;
  ctx.fillText(formatCurrencyWithDecimals(balanceAmount), 48 + colW * 2.5, metricsValY);

  // Col 4: Payment Status Badge/Pill
  ctx.fillStyle = '#64748B';
  ctx.font = `800 15px ${CANVAS_FONT}`;
  ctx.fillText(isTamil ? 'கட்டண நிலை' : 'PAYMENT STATUS', 48 + colW * 3.5, metricsTextY);

  const isPaid = paymentStatus.includes('PAID') && !paymentStatus.includes('PARTIAL') && !paymentStatus.includes('UNPAID');
  const isPartial = paymentStatus.includes('PARTIAL');

  const badgeBg = isPaid ? '#ECFDF5' : isPartial ? '#FFFBEB' : '#FFF1F2';
  const badgeBorder = isPaid ? '#10B981' : isPartial ? '#F59E0B' : '#F43F5E';
  const badgeText = isPaid ? '#065F46' : isPartial ? '#92400E' : '#9F1239';
  const badgeLabel = isPaid 
    ? (isTamil ? '✓ செலுத்தப்பட்டது' : '✓ PAID') 
    : isPartial 
    ? (isTamil ? '◐ பகுதி செலுத்தப்பட்டது' : '◐ PARTIALLY PAID') 
    : (isTamil ? '● செலுத்தப்படவில்லை' : '● UNPAID');

  const badgeW = colW - 24;
  const badgeH = 44;
  const badgeX = 48 + colW * 3 + 12;
  const badgeY = metricsValY - 32;

  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 10, badgeBg, badgeBorder, 1.8);
  ctx.fillStyle = badgeText;
  ctx.font = `900 ${isTamil ? 15 : 16}px ${CANVAS_FONT}`;
  ctx.fillText(badgeLabel, 48 + colW * 3.5, badgeY + 28);

  // Vertical dividers between the 4 columns
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(48 + colW * i, paySummaryY + 20);
    ctx.lineTo(48 + colW * i, paySummaryY + paySummaryH - 20);
    ctx.stroke();
  }

  // 8. UPI Payment Section (Section 12)
  // Case A: UPI ON + balance > 0 + uploaded QR image -> QR Card (356px)
  // Case B: UPI ON + balance > 0 + no QR image + valid UPI ID -> Clean UPI ID Card (110px, strictly NO synthetic QR, NO payment link!)
  // Case C: UPI OFF or balance <= 0 -> Omit completely
  if (paymentSectionType === 'QR' && (uploadedQr || qrImg)) {
    const cardW = 600;
    const cardH = 356;
    const cardX = (width - cardW) / 2;
    const cardY = paySummaryBottom + 20;

    // Card Container
    drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 16, '#F8FAFC', '#CBD5E1', 1.5);

    // 1. Heading: UPI PAYMENT
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0F172A';
    ctx.font = `900 15px ${CANVAS_FONT}`;
    if (!isTamil) ctx.letterSpacing = '1.2px';
    ctx.fillText(isTamil ? 'UPI கட்டணம்' : 'UPI PAYMENT', width / 2, cardY + 24);
    ctx.letterSpacing = '0px';

    // 2. QR inside clean white square backdrop (230 × 230)
    const boxSize = 230;
    const boxX = (width - boxSize) / 2;
    const boxY = cardY + 34;
    drawRoundedRect(ctx, boxX, boxY, boxSize, boxSize, 12, '#FFFFFF', '#CBD5E1', 1.2);

    if (qrImg) {
      const maxDim = 206;
      const imgW = qrImg.naturalWidth || qrImg.width || 1;
      const imgH = qrImg.naturalHeight || qrImg.height || 1;
      const imgAspect = imgW / imgH;
      let drawW = maxDim;
      let drawH = maxDim;
      if (imgAspect > 1) {
        drawH = Math.round(maxDim / imgAspect);
      } else {
        drawW = Math.round(maxDim * imgAspect);
      }
      const drawX = (width - drawW) / 2;
      const drawY = boxY + (boxSize - drawH) / 2;
      ctx.drawImage(qrImg, drawX, drawY, drawW, drawH);
    }

    // 3. "Scan to Pay"
    ctx.fillStyle = '#0F172A';
    ctx.font = `900 18px ${CANVAS_FONT}`;
    const scanPayText = isTamil ? 'செலுத்த ஸ்கேன் செய்யவும்' : 'Scan to Pay';
    ctx.fillText(scanPayText, width / 2, cardY + 292);

    // 4. "Payable Amount: ₹10,000" (Balance only!)
    ctx.fillStyle = '#047857';
    ctx.font = `800 17px ${CANVAS_FONT}`;
    const payableAmtText = isTamil
      ? `செலுத்த வேண்டிய தொகை: ₹${Math.round(balanceAmount).toLocaleString('en-IN')}`
      : `Payable Amount: ₹${Math.round(balanceAmount).toLocaleString('en-IN')}`;
    ctx.fillText(payableAmtText, width / 2, cardY + 320);

    // Strictly NO UPI ID, NO payee name, NO payment link text under QR!
  } else if (paymentSectionType === 'UPI_LINK') {
    const cardW = 600;
    const cardH = 110;
    const cardX = (width - cardW) / 2;
    const cardY = paySummaryBottom + 20;

    // Card Container
    drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 14, '#F8FAFC', '#CBD5E1', 1.5);

    // 1. Heading: UPI PAYMENT
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0F172A';
    ctx.font = `900 15px ${CANVAS_FONT}`;
    if (!isTamil) ctx.letterSpacing = '1.2px';
    ctx.fillText(isTamil ? 'UPI கட்டணம்' : 'UPI PAYMENT', width / 2, cardY + 25);
    ctx.letterSpacing = '0px';

    // 2. UPI ID
    ctx.fillStyle = '#1E293B';
    ctx.font = `bold 16px ${CANVAS_FONT}`;
    const upiIdLabel = isTamil ? 'UPI ஐடி' : 'UPI ID';
    ctx.fillText(`${upiIdLabel}: ${upiId}`, width / 2, cardY + 56);

    // 3. Payable Amount (Balance)
    ctx.fillStyle = '#047857';
    ctx.font = `800 16px ${CANVAS_FONT}`;
    const payableAmtText = isTamil
      ? `செலுத்த வேண்டிய தொகை: ₹${Math.round(balanceAmount).toLocaleString('en-IN')}`
      : `Payable Amount: ₹${Math.round(balanceAmount).toLocaleString('en-IN')}`;
    ctx.fillText(payableAmtText, width / 2, cardY + 84);

    // Strictly NO payment link box, NO upi://pay text, NO synthetic QR!
  }

  // 9. Dual Signature Section (Placed strictly BELOW payment section with dynamic spacing)
  const sigLineW = 340;
  const leftSigX = 68;
  const rightSigX = width - 68 - sigLineW;

  // Left: Customer Signature Line & Label (strictly line for physical pen signature, 70px empty space above)
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(leftSigX, sigLineY);
  ctx.lineTo(leftSigX + sigLineW, sigLineY);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#475569';
  ctx.font = `bold 16px ${CANVAS_FONT}`;
  ctx.fillText(isTamil ? 'வாடிக்கையாளர் கையொப்பம்' : 'Customer Signature', leftSigX + sigLineW / 2, sigLineY + 24);

  // Right: Authorized Signature Line & Label
  ctx.beginPath();
  ctx.moveTo(rightSigX, sigLineY);
  ctx.lineTo(rightSigX + sigLineW, sigLineY);
  ctx.stroke();

  // If owner signature uploaded and enabled: render strictly ABOVE the Authorized Signature line on the RIGHT side
  if (showSignature && signatureImg) {
    const maxSigW = 240;
    const maxSigH = 58;
    const imgW = signatureImg.naturalWidth || signatureImg.width || 1;
    const imgH = signatureImg.naturalHeight || signatureImg.height || 1;
    const aspect = imgW / imgH;
    let drawSigW = maxSigW;
    let drawSigH = Math.round(maxSigW / aspect);
    if (drawSigH > maxSigH) {
      drawSigH = maxSigH;
      drawSigW = Math.round(maxSigH * aspect);
    }
    const drawSigX = rightSigX + (sigLineW - drawSigW) / 2;
    const drawSigY = sigLineY - drawSigH - 6;
    ctx.drawImage(signatureImg, drawSigX, drawSigY, drawSigW, drawSigH);
  }

  ctx.fillStyle = '#475569';
  ctx.font = `bold 16px ${CANVAS_FONT}`;
  ctx.fillText(isTamil ? 'அங்கீகரிக்கப்பட்ட கையொப்பம்' : 'Authorized Signature', rightSigX + sigLineW / 2, sigLineY + 24);

  // 10. Footer & Developer Credit (Section 14)
  ctx.textAlign = 'center';
  ctx.fillStyle = '#475569';
  ctx.font = `700 16px ${CANVAS_FONT}`;
  ctx.fillText(isTamil ? 'எங்கள் சேவையைத் தேர்ந்தெடுத்ததற்கு நன்றி!' : 'Thank you for your business!', width / 2, footerTop);

  ctx.fillStyle = '#94A3B8';
  ctx.font = `500 13px ${CANVAS_FONT}`;
  ctx.fillText(isTamil ? 'JCB Bill Generator மூலம் உருவாக்கப்பட்டது' : 'Generated by JCB Bill Generator', width / 2, footerTop + 22);

  if (showDeveloperCredit) {
    ctx.fillStyle = '#64748B'; // Neutral dark gray / charcoal
    ctx.font = `600 15px ${CANVAS_FONT}`;
    ctx.fillText('Developed By "Gowcik"', width / 2, footerTop + 52);
  }

  // Export Canvas to PNG Blob & Data URL
  const dataUrl = canvas.toDataURL('image/png', 1.0);
  const fileName = sanitizeFileName(billNumber);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to generate image blob from canvas.'));
          return;
        }
        resolve({
          blob,
          dataUrl,
          fileName,
          width: canvas.width,
          height: canvas.height,
        });
      },
      'image/png',
      1.0
    );
  });
};

/**
 * Share the generated bill PNG file using the native Android share sheet (FileProvider + ACTION_SEND)
 */
export const shareBillImage = async (
  blob: Blob,
  billNumber: string,
  existingDataUrl?: string,
  lang?: Language
): Promise<{ success: boolean; fallbackDownloaded?: boolean; error?: string }> => {
  const fileName = sanitizeFileName(billNumber);
  const text = `JCB Bill: ${billNumber}`;
  const res = await shareImageGeneral(blob, fileName, text, existingDataUrl, lang);
  return {
    success: res.success,
    fallbackDownloaded: res.fallbackDownloaded,
    error: res.error,
  };
};

/**
 * Share the generated bill PNG file specifically formatted for WhatsApp.
 * Opens native WhatsApp directly with the actual PNG file attached and concise bill summary text.
 */
export const shareToWhatsApp = async (
  blob: Blob,
  bill: DbBill | Bill,
  lang?: Language,
  existingDataUrl?: string,
  ownerDetails?: OwnerDetails | null
): Promise<{ success: boolean; whatsappInstalled?: boolean; fallbackDownloaded?: boolean; message?: string; error?: string }> => {
  const currentLang: Language = lang || getStoredLanguage();
  const raw = bill as any;
  const billNumber = raw.bill_number || raw.billNumber || 'JCB-BILL';
  const totalAmount = Number(raw.total_amount ?? raw.totalAmount ?? 0);
  const paidAmount = Number(raw.paid_amount ?? raw.paidAmount ?? 0);
  const balanceAmount = Number(raw.balance_amount ?? raw.balanceAmount ?? 0);

  const formatAmt = (amt: number) => {
    return amt % 1 === 0 ? `₹${amt.toLocaleString('en-IN')}` : `₹${amt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  let shareText = currentLang === 'ta'
    ? `JCB பில் - பில் எண்: ${billNumber}\nமொத்தம்: ${formatAmt(totalAmount)}\nசெலுத்தியது: ${formatAmt(paidAmount)}\nமீதம்: ${formatAmt(balanceAmount)}`
    : `JCB Bill - Bill No: ${billNumber}\nTotal: ${formatAmt(totalAmount)}\nPaid: ${formatAmt(paidAmount)}\nBalance: ${formatAmt(balanceAmount)}`;

  // Include direct clickable UPI payment link when Balance > 0 and valid UPI ID exists
  const upiId = (ownerDetails?.upi_id || '').trim();
  if (balanceAmount > 0 && isValidUpiId(upiId)) {
    const upiUri = generateUpiPaymentUri({
      upiId,
      payeeName: ownerDetails?.upi_display_name || ownerDetails?.business_name,
      amount: balanceAmount,
      billNumber,
      businessName: ownerDetails?.business_name,
    });
    const payLabel = currentLang === 'ta' ? 'UPI மூலம் செலுத்த:' : 'Pay via UPI:';
    shareText += `\n\n${payLabel}\n${upiUri}`;
  }

  const fileName = sanitizeFileName(billNumber);

  const res = await shareImageToWhatsApp(blob, fileName, shareText, existingDataUrl, currentLang);
  return {
    success: res.success,
    whatsappInstalled: res.whatsappInstalled,
    fallbackDownloaded: res.fallbackDownloaded,
    message: res.message,
    error: res.error,
  };
};

/**
 * Save/download the generated bill PNG file locally
 */
export const saveBillImage = (blob: Blob, billNumber: string): void => {
  const fileName = sanitizeFileName(billNumber);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 200);
};
