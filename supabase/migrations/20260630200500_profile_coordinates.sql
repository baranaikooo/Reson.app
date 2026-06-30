-- Add coordinates support to profiles for Dynamic Liquidity Protocol
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Update get_recommended_matches SQL function to return latitude and longitude
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
