-- Drop existing restrictive ALL policies
DROP POLICY IF EXISTS profiles_owner_policy ON public.profiles;
DROP POLICY IF EXISTS write_ledger_owner ON public.psychometric_ledger;
DROP POLICY IF EXISTS snippets_owner_policy ON public.media_snippets;

-- 1. Profiles Table Policies
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

-- 2. Psychometric Ledger Policies
CREATE POLICY insert_ledger ON public.psychometric_ledger
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY update_ledger ON public.psychometric_ledger
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 3. Media Snippets Policies
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

-- 4. Recreate Dependent Foreign Keys with ON DELETE CASCADE
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
