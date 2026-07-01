-- 1. Truncate user tables for clean production deployment and remove any orphan/AI/mock profiles
TRUNCATE TABLE public.match_feedback, public.blind_votes, public.messages, public.matches, public.media_snippets, public.psychometric_ledger, public.profiles CASCADE;

-- 2. Make sure public.profiles has all the required columns for psychometrics and matchmaking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age INT CHECK (age >= 18);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS orientation TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cognitive_depth FLOAT4 DEFAULT 0.5;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS conscientiousness FLOAT4 DEFAULT 0.5;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS extraversion FLOAT4 DEFAULT 0.5;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS attachment_style TEXT DEFAULT 'Secure';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avg_response_time FLOAT4 DEFAULT 3.0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS top_priority TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS similarity_vector vector(2);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS radius_km INT DEFAULT 200;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hesitated BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS redemption_quota INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avoidant_bias FLOAT DEFAULT 0.0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ghosting_count INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS completed_pressure_scenarios TEXT[] DEFAULT '{}';

-- 3. Modify get_recommended_matches to strictly require auth.users record and liveness_verified = TRUE
CREATE OR REPLACE FUNCTION get_recommended_matches(
    caller_id UUID,
    caller_gender TEXT,
    caller_orientation TEXT,
    caller_vector vector(2),
    max_limit INT DEFAULT 100
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    age INT,
    city TEXT,
    gender TEXT,
    orientation TEXT,
    cognitive_depth FLOAT4,
    conscientiousness FLOAT4,
    extraversion FLOAT4,
    attachment_style TEXT,
    avg_response_time FLOAT4,
    top_priority TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    distance FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.age,
        p.city,
        p.gender,
        p.orientation,
        p.cognitive_depth,
        p.conscientiousness,
        p.extraversion,
        p.attachment_style,
        p.avg_response_time,
        p.top_priority,
        p.latitude,
        p.longitude,
        (p.similarity_vector <-> caller_vector) AS distance
    FROM public.profiles p
    WHERE p.id <> caller_id
      -- Strictly filter to auth.users (reals only) and verified liveness only
      AND p.id IN (SELECT au.id FROM auth.users au)
      AND p.liveness_verified = TRUE
      -- Orientation / Gender filtering logic matches client-side compatibility rules
      AND (
        (caller_orientation = 'bi') OR
        (caller_orientation = 'hetero' AND p.gender <> caller_gender) OR
        (caller_orientation = 'homo' AND p.gender = caller_gender)
      )
    ORDER BY p.similarity_vector <-> caller_vector ASC
    LIMIT max_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
