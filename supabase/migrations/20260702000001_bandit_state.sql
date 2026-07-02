-- Migration for ML Bandit State
CREATE TABLE public.bandit_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dynamic_weights JSONB NOT NULL DEFAULT {}::jsonb,
    bandit_arms JSONB NOT NULL DEFAULT {}::jsonb,
    user_feedback_history JSONB NOT NULL DEFAULT []::jsonb,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE(utc::text, NOW()) NOT NULL
);

-- Insert initial empty row
INSERT INTO public.bandit_state (id) VALUES (gen_random_uuid());

-- Allow read access for authenticated users
ALTER TABLE public.bandit_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read bandit state" ON public.bandit_state FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role manages bandit state" ON public.bandit_state FOR ALL TO service_role USING (true) WITH CHECK (true);
