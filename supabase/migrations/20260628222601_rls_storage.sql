-- ============================================================
-- Migration 02: Row Level Security (RLS) + Storage Bucket Policies
-- ============================================================

-- ==========================================
-- SECTION 1: Enable RLS on all public tables
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blind_votes ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- SECTION 2: RLS Policies - Profiles
-- ==========================================

-- Users can read any profile (needed for match cards)
CREATE POLICY "Allow authenticated read all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (true);

-- Users can only insert/update their own profile
CREATE POLICY "Allow users to upsert own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

CREATE POLICY "Allow users to update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Service role (FastAPI) bypasses RLS automatically

-- ==========================================
-- SECTION 3: RLS Policies - Matches
-- ==========================================

-- Users can only see their own matches
CREATE POLICY "Users see own matches"
ON public.matches FOR SELECT TO authenticated
USING (user_p = auth.uid() OR user_q = auth.uid());

-- Only server (service_role) can insert/update/delete matches
-- (FastAPI handles match creation and deletion via Blind Vote)
CREATE POLICY "Service role manages matches"
ON public.matches FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- ==========================================
-- SECTION 4: RLS Policies - Messages
-- ==========================================

-- Users can read messages from matches they belong to
CREATE POLICY "Users read messages in their matches"
ON public.messages FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.matches m
        WHERE m.id = match_id
          AND (m.user_p = auth.uid() OR m.user_q = auth.uid())
    )
);

-- Users can insert messages only in their own matches, as themselves
CREATE POLICY "Users send messages in their matches"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.matches m
        WHERE m.id = match_id
          AND (m.user_p = auth.uid() OR m.user_q = auth.uid())
    )
);

-- ==========================================
-- SECTION 5: RLS Policies - Blind Votes
-- ==========================================

-- Users can see their own votes
CREATE POLICY "Users see own blind votes"
ON public.blind_votes FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Users can insert their own vote for their match
CREATE POLICY "Users submit own blind vote"
ON public.blind_votes FOR INSERT TO authenticated
WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.matches m
        WHERE m.id = match_id
          AND (m.user_p = auth.uid() OR m.user_q = auth.uid())
    )
);

-- ==========================================
-- SECTION 6: Supabase Storage - Voice Messages Bucket
-- ==========================================

-- Create the private storage bucket for voice messages
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-messages', 'voice-messages', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Allow match members to upload voice messages to their match directory
CREATE POLICY "Match members upload voice messages"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'voice-messages' AND
    (storage.foldername(name))[1] = 'matches' AND
    EXISTS (
        SELECT 1 FROM public.matches
        WHERE id = (storage.foldername(name))[2]::uuid
          AND (user_p = auth.uid() OR user_q = auth.uid())
          AND status = 'active'
    )
);

-- Allow match members to read/download voice messages from their matches
CREATE POLICY "Match members read voice messages"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'voice-messages' AND
    (storage.foldername(name))[1] = 'matches' AND
    EXISTS (
        SELECT 1 FROM public.matches
        WHERE id = (storage.foldername(name))[2]::uuid
          AND (user_p = auth.uid() OR user_q = auth.uid())
    )
);
