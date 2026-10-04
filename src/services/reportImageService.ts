import type { OwnerDetails, DbBill } from '../types';
import type { ReportKPIs } from './reportService';
import type { Language } from '../i18n/types';
import { getStoredLanguage } from '../i18n/I18nContext';
import { getJCBMachineSvgString } from '../components/common/JCBMachineIcon';
import { formatCurrency, formatDate } from '../utils/formatters';
import { shareImageToWhatsApp, type ShareImageResult } from './nativeShareService';
import { isNativeApp, blobToBase64, type SaveGalleryResult } from './galleryService';
import { GalleryPlugin } from './galleryService';

export const CANVAS_FONT = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Mukta Malar", "Latha", "Noto Sans Tamil", sans-serif';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface GeneratedReportImage {
  blob: Blob;
  dataUrl: string;
  fileName: string;
  width: number;
  height: number;
}

/**
 * Asynchronously loads an SVG string into an HTMLImageElement for Canvas rendering
 */
const loadSvgImage = (svgString: string): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      const svgBase64 = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = svgBase64;
    } catch {
      resolve(null);
    }
  });
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
 * Sanitizes report period label for safe filename
 */
export const sanitizeReportFileName = (periodLabel: string): string => {
  const clean = (periodLabel || 'Report').replace(/[^a-zA-Z0-9-_]/g, '_');
  return `JCB-Report-${clean}.png`;
};

/**
 * Generates a high-resolution, commercial-grade JCB Working & Turnover Report PNG image.
 * Dynamic height accommodates financial metrics and full bills breakdown table.
 */
export const generateReportImage = async (
  kpis: ReportKPIs,
  periodLabel: string,
  bills: DbBill[] = [],
  ownerDetails?: OwnerDetails | null,
  lang?: Language
): Promise<GeneratedReportImage> => {
  const currentLang = lang || getStoredLanguage();

  const width = 1080;
  const margin = 44;
  const contentWidth = width - margin * 2;

  // Calculate table rows count (draw up to 35 rows)
  const maxBillsToDraw = Math.min(bills.length, 35);
  const rowHeight = 38;
  const tableHeaderHeight = 44;
  const tableCardPadding = 60;
  const billsTableHeight = maxBillsToDraw > 0
    ? tableHeaderHeight + (maxBillsToDraw * rowHeight) + (bills.length > maxBillsToDraw ? 36 : 0) + tableCardPadding
    : 0;

  // Base section heights
  const headerHeight = 250;
  const summaryHeight = 420;
  const statusHeight = 230;
  const ratioHeight = 110;
  const footerHeight = 160;
  const gap = 20;

  // Calculate total canvas height
  const height =
    40 + // top margin
    headerHeight +
    gap +
    summaryHeight +
    gap +
    statusHeight +
    gap +
    ratioHeight +
    (billsTableHeight > 0 ? gap + billsTableHeight : 0) +
    gap +
    footerHeight +
    40; // bottom margin

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is not supported.');
  }

  // Preload JCB Machine SVG illustration
  const machineSvg = await loadSvgImage(getJCBMachineSvgString());

  // 1. Overall Background
  ctx.fillStyle = '#f8fafc'; // slate-50
  ctx.fillRect(0, 0, width, height);

  // Outer safety border
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  // 2. HEADER CARD (Dark Navy #0f172a with JCB Gold accent)
  let currentY = 40;
  drawRoundedRect(ctx, margin, currentY, contentWidth, headerHeight, 20, '#0f172a');

  // Top Yellow Accent Line
  drawRoundedRect(ctx, margin, currentY, contentWidth, 8, 4, '#f59e0b');

  // Excavator Machine Icon
  if (machineSvg) {
    ctx.drawImage(machineSvg, margin + 28, currentY + 32, 110, 75);
  }

  // Header Title & Business Name
  const businessName = (ownerDetails?.business_name || 'JCB SERVICES').toUpperCase();
  const ownerSub = [
    ownerDetails?.owner_name ? `Proprietor: ${ownerDetails.owner_name}` : '',
    ownerDetails?.mobile_number ? `Ph: ${ownerDetails.mobile_number}` : '',
  ].filter(Boolean).join('  •  ');

  const machineSub = [
    ownerDetails?.jcb_model ? `Model: ${ownerDetails.jcb_model}` : '',
    ownerDetails?.registration_number ? `Reg No: ${ownerDetails.registration_number}` : '',
  ].filter(Boolean).join('  •  ');

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 32px ${CANVAS_FONT}`;
  ctx.fillText(businessName, margin + 155, currentY + 62);

  ctx.fillStyle = '#f59e0b';
  ctx.font = `bold 18px ${CANVAS_FONT}`;
  const reportHeaderTitle = currentLang === 'ta'
    ? 'JCB வேலை மற்றும் வருவாய் அறிக்கை'
    : 'JCB WORKING & TURNOVER REPORT';
  ctx.fillText(reportHeaderTitle, margin + 155, currentY + 92);

  if (ownerSub) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = `normal 15px ${CANVAS_FONT}`;
    ctx.fillText(ownerSub, margin + 155, currentY + 118);
  }

  if (machineSub) {
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `bold 14px ${CANVAS_FONT}`;
    ctx.fillText(machineSub, margin + 155, currentY + 142);
  }

  // Period / Date Range Badge
  const badgeY = currentY + 168;
  drawRoundedRect(ctx, margin + 20, badgeY, contentWidth - 40, 60, 12, '#1e293b', '#334155', 1);

  ctx.fillStyle = '#94a3b8';
  ctx.font = `bold 15px ${CANVAS_FONT}`;
  const periodTag = currentLang === 'ta' ? 'அறிக்கை காலம்:' : 'REPORT PERIOD:';
  ctx.fillText(periodTag, margin + 38, badgeY + 36);

  ctx.fillStyle = '#fbbf24';
  ctx.font = `bold 22px ${CANVAS_FONT}`;
  ctx.fillText(periodLabel.toUpperCase(), margin + 200, badgeY + 37);

  currentY += headerHeight + gap;

  // 3. SECTION 1: SUMMARY KPI METRICS CARD
  drawRoundedRect(ctx, margin, currentY, contentWidth, summaryHeight, 20, '#ffffff', '#e2e8f0', 2);

  // Summary Section Title Bar
  drawRoundedRect(ctx, margin, currentY, contentWidth, 50, 16, '#f1f5f9');
  ctx.fillStyle = '#334155';
  ctx.font = `bold 17px ${CANVAS_FONT}`;
  const summaryTitle = currentLang === 'ta' ? 'செயல்பாட்டு சுருக்கம் (FINANCIAL SUMMARY)' : 'FINANCIAL & OPERATIONAL SUMMARY';
  ctx.fillText(summaryTitle, margin + 26, currentY + 32);

  // Row 1: Total Bills & Working Hours
  const row1Y = currentY + 74;
  const colHalfWidth = (contentWidth - 60) / 2;
  drawRoundedRect(ctx, margin + 20, row1Y, colHalfWidth, 76, 12, '#f8fafc', '#e2e8f0', 1);
  drawRoundedRect(ctx, margin + 40 + colHalfWidth, row1Y, colHalfWidth, 76, 12, '#f8fafc', '#e2e8f0', 1);

  // Total Bills item
  ctx.fillStyle = '#64748b';
  ctx.font = `bold 14px ${CANVAS_FONT}`;
  ctx.fillText(currentLang === 'ta' ? 'மொத்த பில்கள்' : 'TOTAL BILLS', margin + 38, row1Y + 28);
  ctx.fillStyle = '#0f172a';
  ctx.font = `bold 30px ${CANVAS_FONT}`;
  ctx.fillText(String(kpis.totalBills), margin + 38, row1Y + 62);

  // Working Hours item
  const rightBoxX = margin + 40 + colHalfWidth;
  ctx.fillStyle = '#64748b';
  ctx.font = `bold 14px ${CANVAS_FONT}`;
  ctx.fillText(currentLang === 'ta' ? 'வேலை நேரம்' : 'WORKING HOURS', rightBoxX + 18, row1Y + 28);
  ctx.fillStyle = '#0f172a';
  ctx.font = `bold 30px ${CANVAS_FONT}`;
  ctx.fillText(`${kpis.totalHours.toFixed(2)} hrs`, rightBoxX + 18, row1Y + 62);

  // Row 2: Total Turnover
  const row2Y = currentY + 166;
  drawRoundedRect(ctx, margin + 20, row2Y, contentWidth - 40, 72, 12, '#fffbeb', '#fde68a', 1.5);
  ctx.fillStyle = '#92400e';
  ctx.font = `bold 16px ${CANVAS_FONT}`;
  ctx.fillText(currentLang === 'ta' ? 'மொத்த விற்றுமுதல் (TOTAL TURNOVER)' : 'TOTAL TURNOVER', margin + 38, row2Y + 43);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.font = `bold 32px ${CANVAS_FONT}`;
  ctx.fillText(formatCurrency(kpis.totalTurnover), margin + contentWidth - 38, row2Y + 46);
  ctx.textAlign = 'left';

  // Row 3: Amount Collected
  const row3Y = currentY + 248;
  drawRoundedRect(ctx, margin + 20, row3Y, contentWidth - 40, 72, 12, '#ecfdf5', '#a7f3d0', 1.5);
  ctx.fillStyle = '#065f46';
  ctx.font = `bold 16px ${CANVAS_FONT}`;
  ctx.fillText(currentLang === 'ta' ? 'வசூலான தொகை (AMOUNT COLLECTED)' : 'AMOUNT COLLECTED', margin + 38, row3Y + 43);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#047857';
  ctx.font = `bold 32px ${CANVAS_FONT}`;
  ctx.fillText(formatCurrency(kpis.totalCollected), margin + contentWidth - 38, row3Y + 46);
  ctx.textAlign = 'left';

  // Row 4: Total Outstanding Balance
  const row4Y = currentY + 330;
  drawRoundedRect(ctx, margin + 20, row4Y, contentWidth - 40, 72, 12, '#fff1f2', '#fecdd3', 1.5);
  ctx.fillStyle = '#9f1239';
  ctx.font = `bold 16px ${CANVAS_FONT}`;
  ctx.fillText(currentLang === 'ta' ? 'நிலுவைத் தொகை (BALANCE OUTSTANDING)' : 'BALANCE OUTSTANDING', margin + 38, row4Y + 43);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#be123c';
  ctx.font = `bold 32px ${CANVAS_FONT}`;
  ctx.fillText(formatCurrency(kpis.totalOutstanding), margin + contentWidth - 38, row4Y + 46);
  ctx.textAlign = 'left';

  currentY += summaryHeight + gap;

  // 4. SECTION 2: PAYMENT STATUS BREAKDOWN
  drawRoundedRect(ctx, margin, currentY, contentWidth, statusHeight, 20, '#ffffff', '#e2e8f0', 2);

  // Status Title Bar
  drawRoundedRect(ctx, margin, currentY, contentWidth, 50, 16, '#f1f5f9');
  ctx.fillStyle = '#334155';
  ctx.font = `bold 17px ${CANVAS_FONT}`;
  const statusTitle = currentLang === 'ta' ? 'கட்டண நிலை விபரம்' : 'PAYMENT STATUS BREAKDOWN';
  ctx.fillText(statusTitle, margin + 26, currentY + 32);

  // 3 Columns: Paid, Partially Paid, Unpaid
  const colWidth = (contentWidth - 64) / 3;
  const colY = currentY + 68;
  const colHeight = 142;

  // Col 1: Paid
  drawRoundedRect(ctx, margin + 20, colY, colWidth, colHeight, 14, '#ecfdf5', '#a7f3d0', 1);
  ctx.fillStyle = '#065f46';
  ctx.font = `bold 14px ${CANVAS_FONT}`;
  ctx.fillText(currentLang === 'ta' ? 'செலுத்தியவை' : 'PAID', margin + 34, colY + 28);
  ctx.fillStyle = '#047857';
  ctx.font = `bold 36px ${CANVAS_FONT}`;
  ctx.fillText(String(kpis.paidCount), margin + 34, colY + 72);
  ctx.fillStyle = '#059669';
  ctx.font = `bold 16px ${CANVAS_FONT}`;
  ctx.fillText(formatCurrency(kpis.paidAmount), margin + 34, colY + 110);

  // Col 2: Partially Paid
  const col2X = margin + 20 + colWidth + 12;
  drawRoundedRect(ctx, col2X, colY, colWidth, colHeight, 14, '#fffbeb', '#fde68a', 1);
  ctx.fillStyle = '#92400e';
  ctx.font = `bold 14px ${CANVAS_FONT}`;
  ctx.fillText(currentLang === 'ta' ? 'பகுதி செலுத்தியவை' : 'PARTIAL', col2X + 16, colY + 28);
  ctx.fillStyle = '#b45309';
  ctx.font = `bold 36px ${CANVAS_FONT}`;
  ctx.fillText(String(kpis.partiallyPaidCount), col2X + 16, colY + 72);
  ctx.fillStyle = '#d97706';
  ctx.font = `bold 16px ${CANVAS_FONT}`;
  ctx.fillText(formatCurrency(kpis.partiallyPaidAmount), col2X + 16, colY + 110);

  // Col 3: Unpaid
  const col3X = col2X + colWidth + 12;
  drawRoundedRect(ctx, col3X, colY, colWidth, colHeight, 14, '#fff1f2', '#fecdd3', 1);
  ctx.fillStyle = '#9f1239';
  ctx.font = `bold 14px ${CANVAS_FONT}`;
  ctx.fillText(currentLang === 'ta' ? 'செலுத்தாதவை' : 'UNPAID', col3X + 16, colY + 28);
  ctx.fillStyle = '#be123c';
  ctx.font = `bold 36px ${CANVAS_FONT}`;
  ctx.fillText(String(kpis.unpaidCount), col3X + 16, colY + 72);
  ctx.fillStyle = '#e11d48';
  ctx.font = `bold 16px ${CANVAS_FONT}`;
  ctx.fillText(formatCurrency(kpis.unpaidAmount), col3X + 16, colY + 110);

  currentY += statusHeight + gap;

  // 5. SECTION 3: COLLECTION RATIO PROGRESS CARD
  drawRoundedRect(ctx, margin, currentY, contentWidth, ratioHeight, 16, '#ffffff', '#e2e8f0', 2);

  ctx.fillStyle = '#475569';
  ctx.font = `bold 15px ${CANVAS_FONT}`;
  ctx.fillText(currentLang === 'ta' ? 'வசூல் விகிதம் (COLLECTION RATE)' : 'COLLECTION EFFICIENCY RATIO', margin + 26, currentY + 34);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.font = `bold 22px ${CANVAS_FONT}`;
  ctx.fillText(`${kpis.collectionRate.toFixed(1)}%`, margin + contentWidth - 26, currentY + 34);
  ctx.textAlign = 'left';

  // Progress Bar
  const pBarX = margin + 26;
  const pBarY = currentY + 52;
  const pBarWidth = contentWidth - 52;
  drawRoundedRect(ctx, pBarX, pBarY, pBarWidth, 22, 11, '#f1f5f9', '#cbd5e1', 1);

  const fillWidth = Math.max(12, Math.min(pBarWidth, (kpis.collectionRate / 100) * pBarWidth));
  const fillColor = kpis.collectionRate >= 80 ? '#10b981' : kpis.collectionRate >= 50 ? '#f59e0b' : '#ef4444';
  drawRoundedRect(ctx, pBarX, pBarY, fillWidth, 22, 11, fillColor);

  currentY += ratioHeight + gap;

  // 6. SECTION 4: BILLS BREAKDOWN TABLE (Optional if bills exist)
  if (billsTableHeight > 0) {
    drawRoundedRect(ctx, margin, currentY, contentWidth, billsTableHeight, 20, '#ffffff', '#e2e8f0', 2);

    // Table Title Bar
    drawRoundedRect(ctx, margin, currentY, contentWidth, 50, 16, '#0f172a');
    ctx.fillStyle = '#fbbf24';
    ctx.font = `bold 16px ${CANVAS_FONT}`;
    const tableTitle = currentLang === 'ta'
      ? `பில்கள் விவர பட்டியல் (${bills.length} பில்கள்)`
      : `BILLS BREAKDOWN SUMMARY (${bills.length} INVOICES)`;
    ctx.fillText(tableTitle, margin + 26, currentY + 32);

    // Table Header Row
    let tableRowY = currentY + 50;
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(margin, tableRowY, contentWidth, tableHeaderHeight);

    ctx.fillStyle = '#475569';
    ctx.font = `bold 13px ${CANVAS_FONT}`;

    const colXDate = margin + 16;
    const colXBillNo = margin + 110;
    const colXCust = margin + 240;
    const colXHours = margin + 460;
    const colXTotal = margin + 630;
    const colXPaid = margin + 760;
    const colXBal = margin + 890;
    const colXStatus = margin + 920;

    ctx.fillText(currentLang === 'ta' ? 'தேதி' : 'Date', colXDate, tableRowY + 28);
    ctx.fillText(currentLang === 'ta' ? 'பில் எண்' : 'Bill No', colXBillNo, tableRowY + 28);
    ctx.fillText(currentLang === 'ta' ? 'வாடிக்கையாளர்' : 'Customer', colXCust, tableRowY + 28);
    ctx.fillText(currentLang === 'ta' ? 'மணி' : 'Hours', colXHours, tableRowY + 28);

    ctx.textAlign = 'right';
    ctx.fillText(currentLang === 'ta' ? 'மொத்தம்' : 'Total', colXTotal, tableRowY + 28);
    ctx.fillText(currentLang === 'ta' ? 'செலுத்தியது' : 'Paid', colXPaid, tableRowY + 28);
    ctx.fillText(currentLang === 'ta' ? 'நிலுவை' : 'Balance', colXBal, tableRowY + 28);
    ctx.textAlign = 'left';

    ctx.fillText(currentLang === 'ta' ? 'நிலை' : 'Status', colXStatus, tableRowY + 28);

    tableRowY += tableHeaderHeight;

    // Draw Bill Rows
    for (let i = 0; i < maxBillsToDraw; i++) {
      const b = bills[i];
      const isEven = i % 2 === 0;

      if (!isEven) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(margin, tableRowY, contentWidth, rowHeight);
      }

      // Bottom border for each row
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(margin, tableRowY + rowHeight);
      ctx.lineTo(margin + contentWidth, tableRowY + rowHeight);
      ctx.stroke();

      ctx.fillStyle = '#334155';
      ctx.font = `normal 12px ${CANVAS_FONT}`;

      // Date
      const dateStr = b.bill_date ? formatDate(b.bill_date, currentLang).slice(0, 10) : '-';
      ctx.fillText(dateStr, colXDate, tableRowY + 24);

      // Bill Number
      ctx.font = `bold 12px ${CANVAS_FONT}`;
      ctx.fillStyle = '#0f172a';
      ctx.fillText(b.bill_number || '-', colXBillNo, tableRowY + 24);

      // Customer
      ctx.font = `normal 12px ${CANVAS_FONT}`;
      ctx.fillStyle = '#1e293b';
      const custText = (b.customer_name || '-').slice(0, 20);
      ctx.fillText(custText, colXCust, tableRowY + 24);

      // Hours / Loads Metric
      const isLoadBill = b.bill_type === 'loading' || Boolean(b.loading_details) || Boolean(b.bill_number?.startsWith('LOAD'));
      const hrsText = isLoadBill
        ? `${b.loading_details?.totalLoads ?? (b.loading_details?.totalTractorLoads ?? (b.working_hours ?? 0))} Loads`
        : (b.working_hours != null ? `${Number(b.working_hours).toFixed(1)}h` : '-');
      ctx.fillText(hrsText, colXHours, tableRowY + 24);

      // Total
      ctx.textAlign = 'right';
      ctx.font = `bold 12px ${CANVAS_FONT}`;
      ctx.fillStyle = '#0f172a';
      ctx.fillText(formatCurrency(b.total_amount || 0), colXTotal, tableRowY + 24);

      // Paid
      ctx.fillStyle = '#059669';
      ctx.fillText(formatCurrency(b.paid_amount || 0), colXPaid, tableRowY + 24);

      // Balance
      const bal = Number(b.balance_amount || 0);
      ctx.fillStyle = bal > 0 ? '#e11d48' : '#64748b';
      ctx.fillText(formatCurrency(bal), colXBal, tableRowY + 24);
      ctx.textAlign = 'left';

      // Status Badge
      const isPaid = (b.payment_status as string) === 'Paid' || (b.payment_status as string) === 'PAID';
      const isPartial = (b.payment_status as string) === 'Partially Paid' || (b.payment_status as string) === 'PARTIALLY_PAID';
      const badgeBg = isPaid ? '#ecfdf5' : isPartial ? '#fffbeb' : '#fff1f2';
      const badgeText = isPaid ? '#047857' : isPartial ? '#b45309' : '#be123c';
      const badgeLabel = isPaid ? 'Paid' : isPartial ? 'Part.' : 'Unpaid';

      drawRoundedRect(ctx, colXStatus - 4, tableRowY + 8, 54, 22, 6, badgeBg);
      ctx.fillStyle = badgeText;
      ctx.font = `bold 10px ${CANVAS_FONT}`;
      ctx.fillText(badgeLabel, colXStatus + 8, tableRowY + 23);

      tableRowY += rowHeight;
    }

    if (bills.length > maxBillsToDraw) {
      ctx.fillStyle = '#64748b';
      ctx.font = `italic 12px ${CANVAS_FONT}`;
      ctx.fillText(
        `+ ${bills.length - maxBillsToDraw} ${currentLang === 'ta' ? 'கூடுதல் பில்கள் தரவுத்தளத்தில் உள்ளன' : 'more bills recorded in database'}`,
        margin + 26,
        tableRowY + 24
      );
    }

    currentY += billsTableHeight + gap;
  }

  // 7. FOOTER
  drawRoundedRect(ctx, margin, currentY, contentWidth, footerHeight, 18, '#0f172a');

  // Decorative yellow left accent bar
  drawRoundedRect(ctx, margin, currentY, 8, footerHeight, 4, '#f59e0b');

  ctx.fillStyle = '#fbbf24';
  ctx.font = `bold 18px ${CANVAS_FONT}`;
  ctx.fillText('JCB BILL GENERATOR', margin + 30, currentY + 40);

  ctx.fillStyle = '#94a3b8';
  ctx.font = `normal 14px ${CANVAS_FONT}`;
  const now = new Date();
  const dateFormatted = `${String(now.getDate()).padStart(2, '0')} ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  ctx.fillText(`Generated On: ${dateFormatted}`, margin + 30, currentY + 72);
  ctx.fillText('Computer Generated Financial & Machine Working Summary', margin + 30, currentY + 100);

  ctx.fillStyle = '#64748b';
  ctx.font = `normal 12px ${CANVAS_FONT}`;
  ctx.fillText('Earthmoving Equipment Account & Hour-Meter Management System', margin + 30, currentY + 132);

  // Export as PNG
  const dataUrl = canvas.toDataURL('image/png', 1.0);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Failed to generate report blob.'));
    }, 'image/png');
  });

  const fileName = sanitizeReportFileName(periodLabel);

  return {
    blob,
    dataUrl,
    fileName,
    width,
    height,
  };
};

/**
 * Saves report PNG image to device Gallery on Android or downloads in browser
 */
export const saveReportToGallery = async (
  blob: Blob,
  periodLabel: string,
  existingDataUrl?: string,
  lang?: Language
): Promise<SaveGalleryResult> => {
  const currentLang = lang || getStoredLanguage();
  const fileName = sanitizeReportFileName(periodLabel);

  if (isNativeApp()) {
    try {
      const base64Data = existingDataUrl || (await blobToBase64(blob));
      const res = await GalleryPlugin.saveImageToGallery({
        base64Data,
        fileName,
        albumName: 'JCB Reports',
      });

      return {
        success: true,
        platform: 'android',
        message: currentLang === 'ta' ? 'அறிக்கை கேலரியில் சேமிக்கப்பட்டது' : 'Report saved to Gallery',
        filePath: res.filePath || `Pictures/JCB Reports/${fileName}`,
      };
    } catch (err: any) {
      console.warn('[saveReportToGallery] Native save failed, downloading:', err);
    }
  }

  // Web Browser fallback
  try {
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

    return {
      success: true,
      platform: 'web',
      message: currentLang === 'ta' ? 'அறிக்கை பதிவிறக்கப்பட்டது' : 'Report downloaded to your device',
    };
  } catch (err: any) {
    return {
      success: false,
      platform: 'web',
      message: currentLang === 'ta' ? 'அறிக்கையை பதிவிறக்க முடியவில்லை.' : 'Unable to download report.',
      error: err?.message,
    };
  }
};

/**
 * Shares the report PNG image specifically to WhatsApp with structured summary caption
 */
export const shareReportToWhatsApp = async (
  blob: Blob,
  periodLabel: string,
  kpis: ReportKPIs,
  existingDataUrl?: string,
  lang?: Language
): Promise<ShareImageResult> => {
  const currentLang = lang || getStoredLanguage();
  const fileName = sanitizeReportFileName(periodLabel);

  const shareText = currentLang === 'ta'
    ? `*JCB வேலை மற்றும் வருவாய் அறிக்கை*\nகாலம்: ${periodLabel}\nமொத்த வருவாய்: ${formatCurrency(kpis.totalTurnover)}\nவசூலானது: ${formatCurrency(kpis.totalCollected)}\nநிலுவைத் தொகை: ${formatCurrency(kpis.totalOutstanding)}\n_JCB Bill Generator மூலம் அனுப்பப்பட்டது_`
    : `*JCB Working & Turnover Report*\nPeriod: ${periodLabel}\nTurnover: ${formatCurrency(kpis.totalTurnover)}\nCollected: ${formatCurrency(kpis.totalCollected)}\nOutstanding: ${formatCurrency(kpis.totalOutstanding)}\n_Sent via JCB Bill Generator_`;

  return shareImageToWhatsApp(blob, fileName, shareText, existingDataUrl, currentLang);
};
