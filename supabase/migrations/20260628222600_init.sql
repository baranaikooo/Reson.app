-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Profiles Table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    age INT NOT NULL CHECK (age >= 18),
    city TEXT NOT NULL,
    gender TEXT NOT NULL,
    orientation TEXT NOT NULL,
    
    -- Psychometric metrics
    cognitive_depth FLOAT4 NOT NULL DEFAULT 0.5,
    conscientiousness FLOAT4 NOT NULL DEFAULT 0.5,
    extraversion FLOAT4 NOT NULL DEFAULT 0.5,
    attachment_style TEXT NOT NULL DEFAULT 'Secure',
    avg_response_time FLOAT4 NOT NULL DEFAULT 3.0,
    top_priority TEXT NOT NULL,
    
    -- 2D Vector representing Similarity Space: [cognitive_depth, conscientiousness]
    similarity_vector vector(2) NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. HNSW Index for L2 (Euclidean) Distance nearest-neighbor search
CREATE INDEX idx_profiles_similarity_vector 
ON public.profiles 
USING hnsw (similarity_vector vector_l2_ops);

-- 4. Matches Table (Closed Market Pairs)
CREATE TABLE public.matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_p UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_q UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    ev_score FLOAT4 NOT NULL,
    is_unlocked BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_user_pairs UNIQUE (user_p, user_q),
    CONSTRAINT different_users CHECK (user_p <> user_q)
);

-- 5. Chat Messages (Voice Chambers)
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL, -- Link to Supabase Storage voice-messages bucket
    duration FLOAT4 NOT NULL, -- Precise duration in seconds
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 6. Prisoner's Dilemma Blind Votes
CREATE TABLE public.blind_votes (
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    vote TEXT NOT NULL CHECK (vote IN ('unlock', 'cancel')),
    voted_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    PRIMARY KEY (match_id, user_id)
);

-- 7. PL/pgSQL Function for Nearest Neighbors Proximity filtering
CREATE OR REPLACE FUNCTION get_recommended_matches(
    caller_id UUID,
    caller_gender TEXT,
    caller_orientation TEXT,
    caller_vector vector(2),
    max_limit INT DEFAULT 10
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
        (p.similarity_vector <-> caller_vector) AS distance
    FROM public.profiles p
    WHERE p.id <> caller_id
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
