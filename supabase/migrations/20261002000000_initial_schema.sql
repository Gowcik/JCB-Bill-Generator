-- ====================================================================
-- JCB Bill Generator: Phase 3 Supabase PostgreSQL Database Schema
-- Tables: profiles, owner_details, bills
-- Features: Row Level Security (RLS), Strict Check Constraints, Indexes
-- ====================================================================

-- Enable pgcrypto / uuid extension if not enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================
-- TABLE 1: public.profiles
-- User profile linked to Supabase auth.users
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  mobile_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ====================================================================
-- TABLE 2: public.owner_details
-- One-to-one owner and JCB machine profile associated with auth.users
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.owner_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT,
  owner_name TEXT,
  mobile_number TEXT,
  address TEXT,
  jcb_model TEXT,
  registration_number TEXT,
  hourly_rate NUMERIC(10,2),
  upi_id TEXT,
  gst_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ====================================================================
-- TABLE 3: public.bills
-- Minimal JCB bills with calculated historical working_hours
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bill_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_mobile TEXT NOT NULL,
  bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  balance_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL,
  working_hours NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Payment status validation (Allowed: 'Paid', 'Partially Paid', 'Unpaid')
  CONSTRAINT bills_payment_status_check CHECK (
    payment_status IN ('Paid', 'Partially Paid', 'Unpaid')
  ),

  -- Non-negative monetary amounts
  CONSTRAINT bills_amounts_non_negative CHECK (
    total_amount >= 0 AND
    paid_amount >= 0 AND
    balance_amount >= 0
  ),

  -- Balance calculation rule: balance_amount = total_amount - paid_amount
  CONSTRAINT bills_balance_calculation CHECK (
    balance_amount = (total_amount - paid_amount)
  ),

  -- Paid amount cannot exceed total amount
  CONSTRAINT bills_paid_not_exceed_total CHECK (
    paid_amount <= total_amount
  ),

  -- Strict consistency between payment_status and paid/total amounts
  CONSTRAINT bills_status_consistency CHECK (
    (payment_status = 'Paid' AND paid_amount = total_amount) OR
    (payment_status = 'Partially Paid' AND paid_amount > 0 AND paid_amount < total_amount) OR
    (payment_status = 'Unpaid' AND paid_amount = 0)
  )
);

-- ====================================================================
-- INDEXES
-- Optimize querying bills and owner details per user
-- ====================================================================
-- Bills Indexes
CREATE INDEX IF NOT EXISTS idx_bills_user_id ON public.bills (user_id);
CREATE INDEX IF NOT EXISTS idx_bills_bill_date ON public.bills (bill_date);
CREATE INDEX IF NOT EXISTS idx_bills_customer_mobile ON public.bills (customer_mobile);
CREATE INDEX IF NOT EXISTS idx_bills_bill_number ON public.bills (bill_number);

-- Owner Details Index
CREATE INDEX IF NOT EXISTS idx_owner_details_user_id ON public.owner_details (user_id);

-- ====================================================================
-- AUTOMATIC updated_at TRIGGER FOR owner_details
-- ====================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_owner_details_updated_at ON public.owner_details;
CREATE TRIGGER trigger_owner_details_updated_at
  BEFORE UPDATE ON public.owner_details
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ====================================================================
-- ROW LEVEL SECURITY (RLS)
-- Authenticated users only access their own records (auth.uid())
-- ====================================================================

-- 1. Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

-- 2. Policies for public.profiles (id = auth.uid())
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own" ON public.profiles
  FOR DELETE TO authenticated
  USING (id = auth.uid());

-- 3. Policies for public.owner_details (user_id = auth.uid())
DROP POLICY IF EXISTS "owner_details_select_own" ON public.owner_details;
CREATE POLICY "owner_details_select_own" ON public.owner_details
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "owner_details_insert_own" ON public.owner_details;
CREATE POLICY "owner_details_insert_own" ON public.owner_details
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "owner_details_update_own" ON public.owner_details;
CREATE POLICY "owner_details_update_own" ON public.owner_details
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "owner_details_delete_own" ON public.owner_details;
CREATE POLICY "owner_details_delete_own" ON public.owner_details
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 4. Policies for public.bills (user_id = auth.uid())
DROP POLICY IF EXISTS "bills_select_own" ON public.bills;
CREATE POLICY "bills_select_own" ON public.bills
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "bills_insert_own" ON public.bills;
CREATE POLICY "bills_insert_own" ON public.bills
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "bills_update_own" ON public.bills;
CREATE POLICY "bills_update_own" ON public.bills
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "bills_delete_own" ON public.bills;
CREATE POLICY "bills_delete_own" ON public.bills
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
