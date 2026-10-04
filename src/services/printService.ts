import type { DbBill, Bill, OwnerDetails } from '../types';
import { formatDate } from '../utils/formatters';
import type { Language } from '../i18n/types';
import { getStoredLanguage } from '../i18n/I18nContext';
import { getJCBMachineSvgString } from '../components/common/JCBMachineIcon';
import { getStoredShowDeveloperCredit } from './billImageService';

/**
 * Format currency for printing (₹1,920.00)
 */
const formatPrintCurrency = (amount: number | null | undefined): string => {
  const clean = Number(amount ?? 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(clean);
};

/**
 * Generate clean, high-contrast, professional HTML suitable for A4 paper and receipt printing.
 * Follows exact JCB visual identity with header excavator illustration and NO meter readings.
 */
export const generatePrintHtml = (
  bill: DbBill | Bill,
  ownerDetails?: OwnerDetails | null,
  lang?: Language
): string => {
  const currentLang: Language = lang || getStoredLanguage();
  const raw = bill as any;
  const billNumber = raw.bill_number || raw.billNumber || 'JCB-BILL';
  const billDate = raw.bill_date || raw.date || '';
  const customerName = (raw.customer_name || raw.customerName || 'Customer').trim();
  const customerMobile = (raw.customer_mobile || raw.customerPhone || '').trim();
  const totalAmount = Number(raw.total_amount ?? raw.totalAmount ?? 0);
  const paidAmount = Number(raw.paid_amount ?? raw.paidAmount ?? 0);
  const balanceAmount = Number(raw.balance_amount ?? raw.balanceAmount ?? 0);
  const paymentStatus = (raw.payment_status || raw.paymentStatus || 'Unpaid').toUpperCase();
  const workingHours = raw.working_hours ?? raw.totalHours;

  const parsedHours = workingHours ? Number(workingHours) : 0;
  const hourlyRate = raw.hourly_rate || raw.hourlyRate || ownerDetails?.hourly_rate || (parsedHours > 0 ? Math.round(totalAmount / parsedHours) : 1200);
  const extraCharges = Number(raw.extra_charges || raw.extraCharges || 0);
  const discount = Number(raw.discount || 0);

  const businessName = (ownerDetails?.business_name || 'JCB BILL GENERATOR').trim();
  const ownerName = (ownerDetails?.owner_name || '').trim();
  const ownerMobile = (ownerDetails?.mobile_number || '').trim();
  const ownerAddress = (ownerDetails?.address || '').trim();
  const jcbModel = (ownerDetails?.jcb_model || 'JCB 3DX Super Backhoe Loader').trim();
  const registrationNumber = (ownerDetails?.registration_number || '').trim();
  const upiId = (ownerDetails?.upi_id || '').trim();
  const gstNumber = (ownerDetails?.gst_number || '').trim();

  const formattedDate = billDate ? formatDate(billDate, currentLang) : 'N/A';

  const isPaid = paymentStatus.includes('PAID') && !paymentStatus.includes('PARTIAL') && !paymentStatus.includes('UNPAID');
  const isPartial = paymentStatus.includes('PARTIAL');

  const badgeClass = isPaid ? 'status-paid' : isPartial ? 'status-partial' : 'status-unpaid';
  const badgeLabel = isPaid 
    ? (currentLang === 'ta' ? '✓ செலுத்தப்பட்டது' : '✓ PAID')
    : isPartial 
    ? (currentLang === 'ta' ? '◐ பகுதி செலுத்தியது' : '◐ PARTIALLY PAID')
    : (currentLang === 'ta' ? '● செலுத்தப்படவில்லை' : '● UNPAID');

  const machineSvg = getJCBMachineSvgString();

  return `<!DOCTYPE html>
<html lang="${currentLang}">
<head>
  <meta charset="utf-8">
  <title>${currentLang === 'ta' ? 'பில் ரசீது' : 'JCB Work Invoice'} - ${billNumber}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Mukta Malar", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 13px;
      line-height: 1.45;
    }
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 16px;
      border: 1px solid #cbd5e1;
    }
    /* Header Card */
    .header-card {
      background: #0f172a;
      color: #ffffff;
      border-radius: 12px;
      padding: 18px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      border-top: 4px solid #f59e0b;
    }
    .business-title {
      font-size: 24px;
      font-weight: 900;
      letter-spacing: 0.5px;
      color: #ffffff;
      margin: 0 0 2px 0;
      text-transform: uppercase;
    }
    .services-tag {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1px;
      color: #f59e0b;
      margin-bottom: 8px;
    }
    .proprietor {
      font-size: 14px;
      font-weight: 700;
      color: #f1f5f9;
      margin: 0 0 3px 0;
    }
    .contact-line {
      font-size: 12px;
      color: #94a3b8;
      margin: 0 0 2px 0;
    }
    .header-machine {
      width: 140px;
      height: 98px;
      flex-shrink: 0;
      background: #1e293b;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 6px;
    }
    .header-machine svg {
      width: 100%;
      height: auto;
    }
    /* Invoice Title Bar */
    .invoice-title-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e2e8f0;
    }
    .invoice-heading {
      font-size: 20px;
      font-weight: 900;
      color: #0f172a;
      margin: 0;
    }
    .invoice-sub {
      font-size: 12px;
      color: #64748b;
      margin: 2px 0 0 0;
    }
    .meta-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 14px;
      text-align: right;
    }
    .meta-box strong {
      font-family: monospace;
      font-size: 14px;
      color: #0f172a;
    }
    /* Details Grid */
    .details-grid {
      display: flex;
      gap: 16px;
      margin-bottom: 18px;
    }
    .details-box {
      flex: 1;
      padding: 12px 16px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .cust-box {
      background: #f8fafc;
    }
    .mach-box {
      background: #fffbeb;
      border-color: #fde68a;
    }
    .details-label {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .cust-label { color: #64748b; }
    .mach-label { color: #b45309; }
    .details-value {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 2px 0;
    }
    .details-phone {
      font-size: 13px;
      font-family: monospace;
      color: #2563eb;
      font-weight: 700;
    }
    .details-meta {
      font-size: 12px;
      color: #475569;
      font-weight: 600;
    }
    /* Financial Calculation Table */
    table.calc-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18px;
    }
    table.calc-table th {
      background: #0f172a;
      color: #ffffff;
      padding: 8px 12px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    table.calc-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 13px;
    }
    table.calc-table tr.total-row td {
      border-top: 2px solid #0f172a;
      font-size: 15px;
      font-weight: 900;
    }
    /* Payment Summary Grid */
    .summary-card {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
    }
    .summary-col {
      flex: 1;
      text-align: center;
      border-right: 1px solid #e2e8f0;
      padding: 0 8px;
    }
    .summary-col:last-child {
      border-right: none;
    }
    .summary-title {
      font-size: 10px;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .summary-val {
      font-size: 17px;
      font-weight: 900;
      font-family: monospace;
      color: #0f172a;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      border: 1px solid;
    }
    .status-paid {
      background: #ecfdf5;
      color: #065f46;
      border-color: #10b981;
    }
    .status-partial {
      background: #fffbeb;
      color: #92400e;
      border-color: #f59e0b;
    }
    .status-unpaid {
      background: #fff1f2;
      color: #9f1239;
      border-color: #f43f5e;
    }
    .upi-strip {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      padding: 8px 12px;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      margin-bottom: 24px;
    }
    .footer-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-top: 14px;
      border-top: 1px solid #cbd5e1;
      margin-top: 20px;
    }
    .footer-note {
      font-size: 11px;
      color: #64748b;
    }
    .sign-box {
      text-align: center;
      width: 180px;
    }
    .sign-line {
      border-top: 1px dashed #64748b;
      margin-bottom: 4px;
      padding-top: 34px;
    }
    .sign-title {
      font-size: 11px;
      font-weight: 700;
      color: #334155;
    }
    @media print {
      body { margin: 0; padding: 0; }
      .invoice-container { border: none; padding: 0; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    
    <!-- Header Card -->
    <div class="header-card">
      <div>
        <h1 class="business-title">${businessName}</h1>
        <div class="services-tag">JCB / EARTHMOVING SERVICES</div>
        ${ownerName ? `<div class="proprietor">${currentLang === 'ta' ? 'உரிமையாளர்' : 'Proprietor'}: ${ownerName}</div>` : ''}
        <div class="contact-line">
          ${[ownerMobile ? `${currentLang === 'ta' ? 'மொபைல்' : 'Mobile'}: ${ownerMobile}` : '', ownerAddress ? ownerAddress : ''].filter(Boolean).join('  •  ')}
        </div>
        ${gstNumber ? `<div class="contact-line">GSTIN: ${gstNumber}</div>` : ''}
      </div>

      <!-- Right Machine Illustration -->
      <div class="header-machine">
        ${machineSvg}
      </div>
    </div>

    <!-- Invoice Title Bar -->
    <div class="invoice-title-bar">
      <div>
        <h2 class="invoice-heading">JCB WORK INVOICE</h2>
        <div class="invoice-sub">${currentLang === 'ta' ? 'தொழில்முறை மணி-மீட்டர் பில் ரசீது' : 'Commercial Equipment Work Invoice'}</div>
      </div>
      <div class="meta-box">
        <div>Bill No: <strong>${billNumber}</strong></div>
        <div>Date: <strong>${formattedDate}</strong></div>
      </div>
    </div>

    <!-- Customer & Machine Details (NO METER READINGS) -->
    <div class="details-grid">
      <div class="details-box cust-box">
        <div class="details-label cust-label">CUSTOMER DETAILS</div>
        <div class="details-value">${customerName}</div>
        ${customerMobile ? `<div class="details-phone">${customerMobile}</div>` : ''}
      </div>

      <div class="details-box mach-box">
        <div class="details-label mach-label">MACHINE DETAILS</div>
        <div class="details-value">${jcbModel}</div>
        <div class="details-meta">
          ${[registrationNumber ? `Reg: ${registrationNumber}` : '', parsedHours > 0 ? `Working Hours: ${parsedHours.toFixed(2)} Hrs` : ''].filter(Boolean).join('  •  ')}
        </div>
      </div>
    </div>

    <!-- Billing Calculation Table -->
    <table class="calc-table">
      <thead>
        <tr>
          <th style="text-align: left;">DESCRIPTION</th>
          <th style="text-align: right;">HOURS</th>
          <th style="text-align: right;">RATE</th>
          <th style="text-align: right;">AMOUNT</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>JCB Machine Work</td>
          <td style="text-align: right; font-family: monospace;">${parsedHours.toFixed(2)} Hrs</td>
          <td style="text-align: right; font-family: monospace;">${hourlyRate ? `₹${hourlyRate}/Hr` : '-'}</td>
          <td style="text-align: right; font-family: monospace; font-weight: 700;">${formatPrintCurrency(parsedHours > 0 && hourlyRate ? parsedHours * hourlyRate : totalAmount)}</td>
        </tr>
        ${extraCharges > 0 ? `
          <tr>
            <td colspan="3" style="color: #64748b;">Extra Charges</td>
            <td style="text-align: right; font-family: monospace;">+${formatPrintCurrency(extraCharges)}</td>
          </tr>
        ` : ''}
        ${discount > 0 ? `
          <tr>
            <td colspan="3" style="color: #047857;">Discount</td>
            <td style="text-align: right; font-family: monospace; color: #047857;">-${formatPrintCurrency(discount)}</td>
          </tr>
        ` : ''}
        <tr class="total-row">
          <td colspan="3">TOTAL AMOUNT</td>
          <td style="text-align: right; font-family: monospace;">${formatPrintCurrency(totalAmount)}</td>
        </tr>
      </tbody>
    </table>

    <!-- Payment Summary Box -->
    <div class="summary-card">
      <div class="summary-col">
        <div class="summary-title">TOTAL AMOUNT</div>
        <div class="summary-val">${formatPrintCurrency(totalAmount)}</div>
      </div>
      <div class="summary-col">
        <div class="summary-title" style="color: #047857;">AMOUNT PAID</div>
        <div class="summary-val" style="color: #047857;">${formatPrintCurrency(paidAmount)}</div>
      </div>
      <div class="summary-col">
        <div class="summary-title" style="color: ${balanceAmount > 0 ? '#be123c' : '#047857'};">BALANCE DUE</div>
        <div class="summary-val" style="color: ${balanceAmount > 0 ? '#be123c' : '#047857'};">${formatPrintCurrency(balanceAmount)}</div>
      </div>
      <div class="summary-col">
        <div class="summary-title">PAYMENT STATUS</div>
        <div><span class="status-badge ${badgeClass}">${badgeLabel}</span></div>
      </div>
    </div>

    ${upiId ? `
      <div class="upi-strip">
        <span style="font-weight: 700; color: #166534;">QUICK PAYMENT</span>
        <span style="font-family: monospace; font-weight: 700; color: #0f172a;">UPI ID: ${upiId}</span>
      </div>
    ` : ''}

    <!-- Signatures & Footer -->
    <div class="footer-section">
      <div class="sign-box">
        <div class="sign-line"></div>
        <div class="sign-title">Customer Signature</div>
      </div>

      <div class="footer-note" style="text-align: center;">
        <div style="font-weight: 700; color: #0f172a; margin-bottom: 2px;">Thank you for your business!</div>
        <div>Generated by JCB Bill Generator</div>
        ${getStoredShowDeveloperCredit() ? '<div style="margin-top: 6px; font-size: 11px; color: #64748b; font-weight: 600;">Developed By &quot;Gowcik&quot;</div>' : ''}
      </div>

      <div class="sign-box">
        <div class="sign-line"></div>
        <div class="sign-title">Authorized Signature</div>
      </div>
    </div>

  </div>
</body>
</html>`;
};

/**
 * Print the bill invoice cleanly
 */
export const printBill = async (
  bill: DbBill | Bill,
  ownerDetails?: OwnerDetails | null,
  lang?: Language
): Promise<{ success: boolean; fallbackNeeded?: boolean }> => {
  const html = generatePrintHtml(bill, ownerDetails, lang);

  // Web Browser / Electron / Desktop printing via hidden iframe
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const existingFrame = document.getElementById('jcb-print-frame');
    if (existingFrame) existingFrame.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'jcb-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          iframe.remove();
        }, 1500);
      }, 350);

      return { success: true };
    }
  }

  return { success: false, fallbackNeeded: true };
};
