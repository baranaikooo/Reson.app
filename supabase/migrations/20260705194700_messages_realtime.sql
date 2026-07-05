-- 1. Modify public.messages table to support both voice and text chat
ALTER TABLE public.messages ALTER COLUMN media_url DROP NOT NULL;
ALTER TABLE public.messages ALTER COLUMN duration DROP NOT NULL;
ALTER TABLE public.messages ADD COLUMN message_text TEXT;

-- 2. Update public.matches RLS policies to allow authenticated clients to create and update their matches
DROP POLICY IF EXISTS "Users can insert own matches" ON public.matches;
CREATE POLICY "Users can insert own matches" 
ON public.matches FOR INSERT TO authenticated 
WITH CHECK (user_p = auth.uid() OR user_q = auth.uid());

DROP POLICY IF EXISTS "Users can update own matches" ON public.matches;
CREATE POLICY "Users can update own matches" 
ON public.matches FOR UPDATE TO authenticated 
USING (user_p = auth.uid() OR user_q = auth.uid())
WITH CHECK (user_p = auth.uid() OR user_q = auth.uid());

-- 3. Create a trigger on blind_votes to automatically set matches.is_unlocked = true when both vote 'unlock'
CREATE OR REPLACE FUNCTION public.handle_blind_vote_inserted()
RETURNS TRIGGER AS $$
BEGIN
    IF (
        SELECT COUNT(*) 
        FROM public.blind_votes 
        WHERE match_id = NEW.match_id AND vote = 'unlock'
    ) = 2 THEN
        UPDATE public.matches 
        SET is_unlocked = TRUE 
        WHERE id = NEW.match_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_blind_vote_inserted ON public.blind_votes;
CREATE TRIGGER on_blind_vote_inserted
    AFTER INSERT OR UPDATE ON public.blind_votes
    FOR EACH ROW EXECUTE FUNCTION public.handle_blind_vote_inserted();

-- 4. Enable Supabase Realtime for messages, matches, and blind_votes tables
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.blind_votes;
