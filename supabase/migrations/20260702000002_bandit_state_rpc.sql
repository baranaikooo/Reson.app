-- Fix ML Bandit state RLS for edge functions and admin usage only
DROP POLICY IF EXISTS "Service role manages bandit state" ON public.bandit_state;

-- Create an RPC function to allow authenticated users to record feedback safely
-- without exposing direct table access.
CREATE OR REPLACE FUNCTION record_bandit_feedback(
    new_weights JSONB,
    new_arms JSONB,
    new_history JSONB
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.bandit_state
    SET
        dynamic_weights = new_weights,
        bandit_arms = new_arms,
        user_feedback_history = new_history,
        updated_at = NOW()
    WHERE id = (SELECT id FROM public.bandit_state LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
