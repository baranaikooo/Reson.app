-- ============================================================
-- Migration 03: Match Feedback Table for Adaptive Toxicity Loop
-- ============================================================

CREATE TABLE public.match_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL,
    style_p TEXT NOT NULL,
    style_q TEXT NOT NULL,
    cooperated BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS (Service role FastAPI only)
ALTER TABLE public.match_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages feedback"
ON public.match_feedback FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Index for style matching queries
CREATE INDEX idx_match_feedback_styles 
ON public.match_feedback (style_p, style_q);
