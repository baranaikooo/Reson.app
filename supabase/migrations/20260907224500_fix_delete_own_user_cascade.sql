-- Migration: 20260907224500_fix_delete_own_user_cascade.sql
-- Description: Ensure profile and all cascading records (matches, messages, blind_votes, media_snippets)
-- are deleted when a user requests account deletion, preventing orphaned data in public.profiles.

CREATE OR REPLACE FUNCTION public.delete_own_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NOT NULL THEN
    -- 1. Explicitly delete from profiles (cascades to matches, messages, blind_votes, media_snippets, psychometric_ledger)
    DELETE FROM public.profiles WHERE id = v_uid;
    -- 2. Delete the user from auth.users
    DELETE FROM auth.users WHERE id = v_uid;
  END IF;
END;
$$;
