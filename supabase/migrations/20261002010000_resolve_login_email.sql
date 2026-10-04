-- ====================================================================
-- Migration: Resolve Login Email from Mobile Number & Profile Sync
-- Enables Mobile Number + Password Login using Supabase Email/Password
-- ====================================================================

-- 1. Create SECURITY DEFINER function to securely resolve email from mobile
CREATE OR REPLACE FUNCTION public.resolve_login_email(phone_input text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  resolved_email text;
  canonical_phone text;
BEGIN
  IF phone_input IS NULL OR trim(phone_input) = '' THEN
    RETURN NULL;
  END IF;

  -- Strip all non-digit characters
  canonical_phone := regexp_replace(phone_input, '\D', '', 'g');

  -- Normalize: If 12 digits starting with 91, extract 10 digits
  IF length(canonical_phone) = 12 AND canonical_phone LIKE '91%' THEN
    canonical_phone := substring(canonical_phone from 3);
  END IF;

  -- Normalize: If 11 digits starting with 0, extract 10 digits
  IF length(canonical_phone) = 11 AND canonical_phone LIKE '0%' THEN
    canonical_phone := substring(canonical_phone from 2);
  END IF;

  IF length(canonical_phone) < 10 THEN
    RETURN NULL;
  END IF;

  -- Search canonical phone across public.profiles, auth.users.phone, and metadata
  SELECT u.email INTO resolved_email
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE (
    regexp_replace(COALESCE(p.mobile_number, ''), '\D', '', 'g') = canonical_phone
    OR regexp_replace(COALESCE(p.mobile_number, ''), '\D', '', 'g') = ('91' || canonical_phone)
    OR regexp_replace(COALESCE(u.phone, ''), '\D', '', 'g') = canonical_phone
    OR regexp_replace(COALESCE(u.phone, ''), '\D', '', 'g') = ('91' || canonical_phone)
    OR regexp_replace(COALESCE(u.raw_user_meta_data->>'mobile_number', ''), '\D', '', 'g') = canonical_phone
    OR regexp_replace(COALESCE(u.raw_user_meta_data->>'mobile_number', ''), '\D', '', 'g') = ('91' || canonical_phone)
  )
  AND u.email IS NOT NULL
  ORDER BY u.created_at DESC
  LIMIT 1;

  RETURN resolved_email;
END;
$$;

-- Allow anon and authenticated clients to invoke this function for login resolution
REVOKE ALL ON FUNCTION public.resolve_login_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO anon, authenticated, service_role;

-- 2. Automatically sync new auth users to public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, mobile_number, created_at)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', 'User'),
    COALESCE(new.raw_user_meta_data->>'mobile_number', new.phone),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    username = COALESCE(EXCLUDED.username, public.profiles.username),
    mobile_number = COALESCE(EXCLUDED.mobile_number, public.profiles.mobile_number);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Backfill public.profiles for any existing auth.users missing in profiles
INSERT INTO public.profiles (id, username, mobile_number, created_at)
SELECT 
  id,
  COALESCE(raw_user_meta_data->>'username', 'User'),
  COALESCE(raw_user_meta_data->>'mobile_number', phone),
  created_at
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET
  username = COALESCE(EXCLUDED.username, public.profiles.username),
  mobile_number = COALESCE(EXCLUDED.mobile_number, public.profiles.mobile_number)
WHERE public.profiles.mobile_number IS NULL;
