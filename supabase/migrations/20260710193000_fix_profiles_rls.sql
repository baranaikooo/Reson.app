-- 1. Dynamic Drop of ALL active policies on profiles, psychometric_ledger, and media_snippets
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename IN ('profiles', 'psychometric_ledger', 'media_snippets')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 2. Profiles Table Policies
CREATE POLICY select_profile ON public.profiles
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY insert_profile ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

CREATE POLICY update_profile ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY delete_profile ON public.profiles
    FOR DELETE
    TO authenticated
    USING (auth.uid() = id);

-- 3. Psychometric Ledger Policies
CREATE POLICY select_ledger ON public.psychometric_ledger
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY insert_ledger ON public.psychometric_ledger
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY update_ledger ON public.psychometric_ledger
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 4. Media Snippets Policies
CREATE POLICY select_snippets ON public.media_snippets
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY insert_snippets ON public.media_snippets
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY update_snippets ON public.media_snippets
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY delete_snippets ON public.media_snippets
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 5. Recreate Dependent Foreign Keys with ON DELETE CASCADE
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_user_p_fkey;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_user_q_fkey;
ALTER TABLE public.matches 
  ADD CONSTRAINT matches_user_p_fkey FOREIGN KEY (user_p) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.matches 
  ADD CONSTRAINT matches_user_q_fkey FOREIGN KEY (user_q) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE public.messages 
  ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.blind_votes DROP CONSTRAINT IF EXISTS blind_votes_user_id_fkey;
ALTER TABLE public.blind_votes 
  ADD CONSTRAINT blind_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.psychometric_ledger DROP CONSTRAINT IF EXISTS psychometric_ledger_user_id_fkey;
ALTER TABLE public.psychometric_ledger 
  ADD CONSTRAINT psychometric_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.media_snippets DROP CONSTRAINT IF EXISTS media_snippets_user_id_fkey;
ALTER TABLE public.media_snippets 
  ADD CONSTRAINT media_snippets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 6. Add secure RPC function to delete caller's auth.users account (cascades to profile)
CREATE OR REPLACE FUNCTION public.delete_own_user()
RETURNS void AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
