-- Migration: 20260907223000_fix_blind_votes_upsert_and_trigger.sql
-- Description: Allow authenticated users to update their blind votes on conflict (upsert) and update match unlock trigger

-- 1. Allow users to update their own blind vote
DROP POLICY IF EXISTS "Users update own blind vote" ON public.blind_votes;
CREATE POLICY "Users update own blind vote"
ON public.blind_votes FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 2. Enhanced function to unlock match if both users vote 'unlock'
CREATE OR REPLACE FUNCTION public.handle_blind_vote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- 3. Replace INSERT-only trigger with INSERT OR UPDATE trigger
DROP TRIGGER IF EXISTS on_blind_vote_inserted ON public.blind_votes;
DROP TRIGGER IF EXISTS trg_handle_blind_vote ON public.blind_votes;

CREATE TRIGGER trg_handle_blind_vote
AFTER INSERT OR UPDATE OF vote ON public.blind_votes
FOR EACH ROW EXECUTE FUNCTION public.handle_blind_vote();
