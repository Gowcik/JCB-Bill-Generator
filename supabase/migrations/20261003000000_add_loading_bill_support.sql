-- ====================================================================
-- Migration: Add Loading Bill support to public.bills
-- Adds bill_type ('meter' | 'loading') and loading_details (JSONB)
-- ====================================================================

-- 1. Add bill_type column with default 'meter'
ALTER TABLE public.bills 
  ADD COLUMN IF NOT EXISTS bill_type TEXT DEFAULT 'meter',
  ADD COLUMN IF NOT EXISTS loading_details JSONB;

-- 2. Ensure all existing rows have bill_type = 'meter'
UPDATE public.bills 
  SET bill_type = 'meter' 
  WHERE bill_type IS NULL;

-- 3. Add CHECK constraint for bill_type ('meter', 'loading') safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bills_bill_type_check'
  ) THEN
    ALTER TABLE public.bills 
      ADD CONSTRAINT bills_bill_type_check CHECK (bill_type IN ('meter', 'loading'));
  END IF;
END $$;

-- 4. Create index for faster querying by bill_type
CREATE INDEX IF NOT EXISTS idx_bills_bill_type ON public.bills (user_id, bill_type);

-- 5. Notify PostgREST to immediately refresh its schema cache
NOTIFY pgrst, 'reload schema';
