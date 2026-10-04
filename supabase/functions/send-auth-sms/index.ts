// Supabase Auth Edge Function: send-auth-sms
// Implements the Supabase Auth Send SMS Hook with MSG91 SMS Provider
// Receives: { user: { phone: "+91..." }, sms: { otp: "123456" } }
// Calls MSG91 securely on server-side and returns HTTP 200 on success.

// Standard CORS headers allowing web and Capacitor mobile clients
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, webhook-id, webhook-timestamp, webhook-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Normalizes Indian mobile number to MSG91 format (91XXXXXXXXXX)
 * Accepts:
 *  - 10 digits: "9876543210" -> "919876543210"
 *  - 12 digits with 91: "+919876543210" -> "919876543210"
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
 * Constant-time string equality check to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Verifies Supabase Auth Hook Standard Webhook signature
 * Spec: HMAC-SHA256 signature of `${webhookId}.${webhookTimestamp}.${rawBody}`
 */
async function verifyWebhookSignature(
  rawBody: string,
  headers: Headers,
  secret: string
): Promise<{ valid: boolean; reason?: string }> {
  const webhookId = headers.get('webhook-id');
  const webhookTimestamp = headers.get('webhook-timestamp');
  const webhookSignature = headers.get('webhook-signature');

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    return { valid: false, reason: 'Missing standard webhook headers (webhook-id, webhook-timestamp, webhook-signature).' };
  }

  // Tolerance check (5 minutes = 300 seconds)
  const timestampNum = parseInt(webhookTimestamp, 10);
  if (isNaN(timestampNum)) {
    return { valid: false, reason: 'Invalid webhook timestamp.' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timestampNum) > 300) {
    return { valid: false, reason: 'Webhook timestamp expired or clock skew exceeds 300 seconds.' };
  }

  // Decode secret (handle whsec_ base64 prefix if provided)
  let keyBytes: Uint8Array;
  if (secret.startsWith('whsec_')) {
    const base64Part = secret.substring(6);
    try {
      const binaryStr = atob(base64Part);
      keyBytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        keyBytes[i] = binaryStr.charCodeAt(i);
      }
    } catch {
      keyBytes = new TextEncoder().encode(secret);
    }
  } else {
    keyBytes = new TextEncoder().encode(secret);
  }

  try {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signedPayload = `${webhookId}.${webhookTimestamp}.${rawBody}`;
    const signedPayloadBytes = new TextEncoder().encode(signedPayload);
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, signedPayloadBytes);
    const computedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

    // Parse signatures list (e.g. "v1,abc v1,def")
    const signatures = webhookSignature.split(' ');
    for (const sig of signatures) {
      const [version, signatureValue] = sig.split(',');
      if (version === 'v1' && signatureValue) {
        if (timingSafeEqual(signatureValue, computedSignature)) {
          return { valid: true };
        }
      }
    }

    return { valid: false, reason: 'Webhook signature does not match computed HMAC.' };
  } catch (err: any) {
    return { valid: false, reason: `Crypto error: ${err?.message || err}` };
  }
}

Deno.serve(async (req: Request) => {
  // 1. CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 2. HTTP POST only
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: { message: 'Method not allowed. Use POST.' } }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 3. Read Raw Request Body for Signature Verification
    const rawBody = await req.text();

    // 4. Verify Webhook Signature if Hook Secret is Configured
    const hookSecret = (
      Deno.env.get('SEND_SMS_HOOK_SECRET') ||
      Deno.env.get('HOOK_SECRET')
    )?.trim();

    if (hookSecret) {
      const verification = await verifyWebhookSignature(rawBody, req.headers, hookSecret);
      if (!verification.valid) {
        console.error('[send-auth-sms] Webhook signature rejected:', verification.reason);
        return new Response(
          JSON.stringify({ error: { message: 'Unauthorized: Invalid webhook signature.' } }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      console.warn('[send-auth-sms] SEND_SMS_HOOK_SECRET is not configured in Edge Function secrets. Skipping signature verification.');
    }

    // 5. Parse Payload
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ error: { message: 'Invalid JSON request body.' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Extract User Phone and Supabase-Generated OTP
    // Supabase Send SMS Hook payload schema:
    // { user: { phone: "+91..." }, sms: { otp: "123456" } }
    const rawPhone: string = payload?.user?.phone || payload?.phone || '';
    const otp: string = payload?.sms?.otp || payload?.otp || '';

    if (!rawPhone || !otp) {
      console.error('[send-auth-sms] Missing phone or otp in payload:', { hasPhone: Boolean(rawPhone), hasOtp: Boolean(otp) });
      return new Response(
        JSON.stringify({ error: { message: 'Invalid request: phone and otp are required.' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Validate & Normalize Indian Mobile Number
    const mobileCheck = normalizeIndianMobile(rawPhone);
    if (!mobileCheck.valid || !mobileCheck.normalized) {
      console.error('[send-auth-sms] Invalid Indian mobile number format.');
      return new Response(
        JSON.stringify({ error: { message: 'Invalid mobile number. Must be a valid 10-digit Indian phone number.' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. Read MSG91 Credentials from Edge Function Secrets
    const msg91AuthKey = (
      Deno.env.get('MSG91_AUTH_KEY') ||
      Deno.env.get('MSG91_AUTHKEY')
    )?.trim();

    const msg91TemplateId = (
      Deno.env.get('MSG91_OTP_TEMPLATE_ID') ||
      Deno.env.get('MSG91_TEMPLATE_ID')
    )?.trim();

    const msg91SenderId = Deno.env.get('MSG91_SENDER_ID')?.trim();
    const smsMode = (Deno.env.get('SMS_MODE') || '').toLowerCase().trim();

    // 9. Safe Mode / Configuration Check (Rule 13: Do not pretend OTP is working if unconfigured)
    if (!msg91AuthKey || !msg91TemplateId) {
      console.error('[send-auth-sms] Missing MSG91_AUTH_KEY or MSG91_OTP_TEMPLATE_ID in Edge Function secrets.');
      return new Response(
        JSON.stringify({
          error: {
            message: 'SMS provider not configured. Please set MSG91_AUTH_KEY and MSG91_OTP_TEMPLATE_ID in Supabase Edge Function secrets.',
          },
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Optional Mock Mode for dry testing without credit usage
    if (smsMode === 'mock') {
      console.log(`[send-auth-sms] [MOCK MODE] Validated OTP request for recipient ${mobileCheck.normalized}. (Zero credits used)`);
      return new Response(
        JSON.stringify({}),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 10. Call MSG91 API Securely
    // Supports MSG91 Flow API (default, matches DLT campaigns) or Send OTP API
    const apiType = (Deno.env.get('MSG91_API_TYPE') || 'flow').toLowerCase().trim();

    if (apiType === 'otp') {
      // MSG91 Send OTP API: https://control.msg91.com/api/v5/otp
      const otpUrl = new URL('https://control.msg91.com/api/v5/otp');
      otpUrl.searchParams.set('template_id', msg91TemplateId);
      otpUrl.searchParams.set('mobile', mobileCheck.normalized);
      otpUrl.searchParams.set('authkey', msg91AuthKey);
      otpUrl.searchParams.set('otp', otp);
      if (msg91SenderId) {
        otpUrl.searchParams.set('sender', msg91SenderId);
      }

      const msg91Res = await fetch(otpUrl.toString(), {
        method: 'POST',
        headers: { 'accept': 'application/json' },
      });

      if (!msg91Res.ok) {
        console.error(`[send-auth-sms] MSG91 OTP API returned HTTP status ${msg91Res.status}`);
        return new Response(
          JSON.stringify({ error: { message: 'Unable to send OTP via SMS provider. Please try again.' } }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const resJson = await msg91Res.json().catch(() => ({}));
      if (resJson?.type === 'error') {
        console.error('[send-auth-sms] MSG91 OTP API rejected request:', resJson?.message || 'Unknown error');
        return new Response(
          JSON.stringify({ error: { message: 'SMS provider rejected OTP request. Please check template configuration.' } }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // MSG91 Flow API (Recommended for DLT templates): https://control.msg91.com/api/v5/flow
      const flowPayload: any = {
        template_id: msg91TemplateId,
        short_url: '0',
        recipients: [
          {
            mobiles: mobileCheck.normalized,
            // Supply common variable names for OTP template mapping:
            otp: otp,
            OTP: otp,
            VAR1: otp,
            code: otp,
          },
        ],
      };

      if (msg91SenderId) {
        flowPayload.sender = msg91SenderId;
      }

      const msg91Res = await fetch('https://control.msg91.com/api/v5/flow', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'authkey': msg91AuthKey,
        },
        body: JSON.stringify(flowPayload),
      });

      if (!msg91Res.ok) {
        console.error(`[send-auth-sms] MSG91 Flow API returned HTTP status ${msg91Res.status}`);
        return new Response(
          JSON.stringify({ error: { message: 'Unable to send OTP via SMS provider. Please try again.' } }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const resJson = await msg91Res.json().catch(() => ({}));
      if (resJson?.type === 'error') {
        console.error('[send-auth-sms] MSG91 Flow API rejected request:', resJson?.message || 'Unknown error');
        return new Response(
          JSON.stringify({ error: { message: 'SMS provider rejected OTP request. Please check template configuration.' } }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 11. Return HTTP 200 to Supabase Auth Hook (Indicates SMS was submitted successfully)
    return new Response(
      JSON.stringify({}),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[send-auth-sms] Unhandled exception:', err?.message || err);
    return new Response(
      JSON.stringify({ error: { message: 'Internal server error while processing SMS OTP.' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
