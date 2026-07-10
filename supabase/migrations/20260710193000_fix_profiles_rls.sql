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
