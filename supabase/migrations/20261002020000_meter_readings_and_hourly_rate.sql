-- ====================================================================
-- Migration: Add meter readings, rate per hour, and registration number to bills
-- Enables meter-reading carry-forward and historical hourly rate preservation
-- ====================================================================

ALTER TABLE public.bills 
  ADD COLUMN IF NOT EXISTS previous_meter_reading NUMERIC,
  ADD COLUMN IF NOT EXISTS current_meter_reading NUMERIC,
  ADD COLUMN IF NOT EXISTS rate_per_hour NUMERIC,
  ADD COLUMN IF NOT EXISTS registration_number TEXT;

-- Create index for faster lookups by registration number and user
CREATE INDEX IF NOT EXISTS idx_bills_user_registration ON public.bills (user_id, registration_number);
