-- Migration: 20260907185000_lockdown_liveness_and_ledger.sql
-- Description: Lock down liveness_verified and psychometric_ledger against direct client manipulation

-- 1. Protect psychometric_ledger:
-- Drop insecure client-write policies; only service_role or SECURITY DEFINER functions can write
DROP POLICY IF EXISTS insert_ledger ON public.psychometric_ledger;
DROP POLICY IF EXISTS update_ledger ON public.psychometric_ledger;
DROP POLICY IF EXISTS delete_ledger ON public.psychometric_ledger;
DROP POLICY IF EXISTS write_ledger_owner ON public.psychometric_ledger;
DROP POLICY IF EXISTS update_ledger_owner ON public.psychometric_ledger;

-- Keep SELECT policy so users can read their own verified scores
DROP POLICY IF EXISTS select_ledger ON public.psychometric_ledger;
CREATE POLICY select_ledger ON public.psychometric_ledger
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- 2. Protect profiles.liveness_verified:
-- Prevent authenticated clients from bypassing biometrics by sending liveness_verified: true
CREATE OR REPLACE FUNCTION public.protect_liveness_verified()
RETURNS TRIGGER AS $$
DECLARE
  claim_role text;
BEGIN
  IF NEW.liveness_verified IS DISTINCT FROM OLD.liveness_verified THEN
    claim_role := auth.role();
    IF claim_role IS NOT NULL AND claim_role <> 'service_role' THEN
      RAISE EXCEPTION 'Direct modification of liveness_verified is forbidden for role %', claim_role;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_liveness_verified ON public.profiles;
CREATE TRIGGER trg_protect_liveness_verified
BEFORE UPDATE OF liveness_verified ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_liveness_verified();
