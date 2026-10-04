-- ====================================================================
-- Migration: Add UPI display name and UPI QR code to public.owner_details
-- Supports dynamic bill-specific payment QR and uploaded owner QR fallback
-- ====================================================================

ALTER TABLE public.owner_details 
  ADD COLUMN IF NOT EXISTS upi_display_name TEXT,
  ADD COLUMN IF NOT EXISTS upi_qr_code TEXT;
