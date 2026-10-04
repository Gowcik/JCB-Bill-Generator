-- ====================================================================
-- Migration: Add show_upi_qr setting to public.owner_details
-- Allows JCB owner to toggle bill payment QR ON / OFF (Default: TRUE)
-- ====================================================================

ALTER TABLE public.owner_details 
  ADD COLUMN IF NOT EXISTS show_upi_qr BOOLEAN DEFAULT TRUE;
