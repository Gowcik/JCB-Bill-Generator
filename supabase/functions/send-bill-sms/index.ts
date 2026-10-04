// Supabase Edge Function: send-bill-sms
// Sends automated, authenticated SMS via MSG91 Flow API
// Server-side environment variables: MSG91_AUTHKEY, MSG91_TEMPLATE_ID, SMS_MODE (mock | production)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

// Standard CORS headers allowing web and Capacitor mobile apps
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Normalizes Indian mobile number to MSG91 format (91XXXXXXXXXX)
 * Accepts:
 *  - 10 digits: "9876543210" -> "919876543210"
 *  - 12 digits with 91: "919876543210" -> "919876543210"
 *  - 11 digits with 0: "09876543210" -> "919876543210"
 *  - Strips spaces, +, hyphens, brackets
 */
function normalizeIndianMobile(raw: string): { valid: boolean; normalized?: string; local?: string } {
  if (!raw || typeof raw !== 'string') return { valid: false };

  // Strip all non-digits
  const digits = raw.replace(/\D/g, '');

  let local = '';
  if (digits.length === 10) {
    local = digits;
  } else if (digits.length === 12 && digits.startsWith('91')) {
    local = digits.substring(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    local = digits.substring(1);
  } else {
    return { valid: false };
  }

  // Local Indian mobile numbers start with 6, 7, 8, or 9
  if (!/^[6-9]\d{9}$/.test(local)) {
    return { valid: false };
  }

  return {
    valid: true,
    normalized: `91${local}`,
    local,
  };
}

/**
 * Format currency without long decimal tails (e.g. Rs.7440 or Rs.7440.50)
 */
function formatSmsAmount(val: number | null | undefined): string {
  const num = Number(val ?? 0);
  if (isNaN(num)) return 'Rs.0';
  return num % 1 === 0 ? `Rs.${num}` : `Rs.${num.toFixed(2)}`;
}

Deno.serve(async (req: Request) => {
  // 1. Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 2. Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Use POST.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 3. Authenticate Caller using Supabase Auth JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing or invalid authentication token.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Missing Supabase environment variables.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client scoped to caller's JWT
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    // Verify token and derive authenticated user identity
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or expired session. Please sign in again.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Parse & Validate Request Body
    let body: { bill_id?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid request: Request body must be valid JSON.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { bill_id } = body;
    if (!bill_id || typeof bill_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid request: bill_id is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Fetch Authoritative Bill Data from PostgreSQL with strict user_id ownership
    const { data: bill, error: billError } = await supabase
      .from('bills')
      .select('*')
      .eq('id', bill_id)
      .eq('user_id', user.id)
      .single();

    if (billError || !bill) {
      return new Response(
        JSON.stringify({ error: 'Bill not found or you do not have permission to access it.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Fetch Business/Owner Profile Data
    const { data: owner } = await supabase
      .from('owner_details')
      .select('business_name, owner_name, mobile_number')
      .eq('user_id', user.id)
      .maybeSingle();

    const businessName = (owner?.business_name || 'JCB Services').trim();

    // 7. Validate Customer Mobile Number
    const mobileCheck = normalizeIndianMobile(bill.customer_mobile);
    if (!mobileCheck.valid || !mobileCheck.normalized) {
      return new Response(
        JSON.stringify({
          error: 'Invalid customer mobile number. Must be a valid 10-digit Indian mobile number (e.g., 9876543210).',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. Build Template Variables from Authoritative Database Values
    const customerName = (bill.customer_name || 'Customer').trim();
    const billNumber = (bill.bill_number || 'JCB-BILL').trim();
    const totalAmount = formatSmsAmount(bill.total_amount);
    const paidAmount = formatSmsAmount(bill.paid_amount);
    const balanceAmount = formatSmsAmount(bill.balance_amount);
    const paymentStatus = bill.payment_status || 'Unpaid';
    const workingHours = bill.working_hours != null ? `${Number(bill.working_hours).toFixed(2)} hrs` : '0 hrs';

    // 9. Check Execution Mode (Default: "mock" for zero credit usage during testing)
    const smsMode = (Deno.env.get('SMS_MODE') || 'mock').toLowerCase().trim();

    if (smsMode !== 'production') {
      // Mock / Simulated Mode
      return new Response(
        JSON.stringify({
          success: true,
          mode: 'mock',
          message: 'SMS request validated successfully (mock mode: no credits used)',
          preview: {
            recipient: mobileCheck.normalized,
            customer_name: customerName,
            bill_number: billNumber,
            total_amount: totalAmount,
            paid_amount: paidAmount,
            balance_amount: balanceAmount,
            payment_status: paymentStatus,
            working_hours: workingHours,
            business_name: businessName,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 10. Production Mode: Read MSG91 Credentials from Edge Function Secrets
    const msg91AuthKey = Deno.env.get('MSG91_AUTHKEY')?.trim();
    const msg91TemplateId = Deno.env.get('MSG91_TEMPLATE_ID')?.trim();

    if (!msg91AuthKey || !msg91TemplateId) {
      console.error('[send-bill-sms] Missing MSG91_AUTHKEY or MSG91_TEMPLATE_ID in secrets.');
      return new Response(
        JSON.stringify({
          error: 'SMS service configuration error: MSG91 credentials not configured in Edge Function secrets.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 11. Execute MSG91 Flow API Request
    // Maps both numbered variables (VAR1..VAR8) and named keys for template compatibility
    const msg91Payload = {
      template_id: msg91TemplateId,
      short_url: '0',
      recipients: [
        {
          mobiles: mobileCheck.normalized,
          VAR1: customerName,
          VAR2: billNumber,
          VAR3: totalAmount,
          VAR4: paidAmount,
          VAR5: balanceAmount,
          VAR6: paymentStatus,
          VAR7: workingHours,
          VAR8: businessName,
          // Also provide named keys in case template maps by name
          customer_name: customerName,
          bill_number: billNumber,
          total_amount: totalAmount,
          paid_amount: paidAmount,
          balance_amount: balanceAmount,
          payment_status: paymentStatus,
          working_hours: workingHours,
          business_name: businessName,
        },
      ],
    };

    const msg91Response = await fetch('https://control.msg91.com/api/v5/flow', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'authkey': msg91AuthKey,
      },
      body: JSON.stringify(msg91Payload),
    });

    if (!msg91Response.ok) {
      const status = msg91Response.status;
      console.error(`[send-bill-sms] MSG91 HTTP Error: ${status}`);
      return new Response(
        JSON.stringify({
          error: 'Unable to send SMS via provider. Please verify template or credit balance.',
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const msg91Data = await msg91Response.json().catch(() => ({}));

    // MSG91 returns { type: 'error', message: '...' } on bad template / authkey
    if (msg91Data?.type === 'error') {
      console.error('[send-bill-sms] MSG91 rejected request:', msg91Data?.message || 'Unknown error');
      return new Response(
        JSON.stringify({
          error: 'SMS provider rejected request. Please check template configuration.',
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode: 'production',
        message: 'SMS request submitted successfully to MSG91',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[send-bill-sms] Unhandled exception:', err?.message || err);
    return new Response(
      JSON.stringify({ error: 'Internal server error while processing SMS request.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
