-- 1. Create ENUM Types
DO $$ BEGIN
    CREATE TYPE attachment_style AS ENUM ('SECURE', 'AVOIDANT', 'ANXIOUS', 'UNTESTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE market_status AS ENUM ('ACTIVE', 'FROZEN', 'BANNED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Drop existing dependent tables if they exist to apply clean production schema
DROP TABLE IF EXISTS public.media_snippets CASCADE;
DROP TABLE IF EXISTS public.psychometric_ledger CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 3. Create public.profiles
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Používateľ',
    birth_date DATE NOT NULL DEFAULT '2000-01-01',
    target_demographic VARCHAR(50) NOT NULL DEFAULT 'hetero',
    non_negotiable VARCHAR(60) NOT NULL DEFAULT '',
    current_thesis VARCHAR(100) NOT NULL DEFAULT '',
    liveness_verified BOOLEAN DEFAULT FALSE NOT NULL,
    status market_status DEFAULT 'ACTIVE' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Create public.psychometric_ledger
CREATE TABLE public.psychometric_ledger (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    primary_marker attachment_style DEFAULT 'UNTESTED' NOT NULL,
    avg_decision_latency FLOAT DEFAULT 0.0 NOT NULL,
    redemption_quota INT DEFAULT 0 NOT NULL,
    ev_score FLOAT DEFAULT 50.0 NOT NULL,
    ghosting_penalties INT DEFAULT 0 NOT NULL
);

-- 5. Create public.media_snippets
CREATE TABLE public.media_snippets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    video_url TEXT NOT NULL,
    slot_index INT NOT NULL CHECK (slot_index BETWEEN 1 AND 4),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_user_slot UNIQUE (user_id, slot_index)
);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psychometric_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_snippets ENABLE ROW LEVEL SECURITY;

-- 7. Define RLS Policies

-- Profiles Policies (Owner only ALL)
CREATE POLICY profiles_owner_policy ON public.profiles
    FOR ALL TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Psychometric Ledger Policies (Owner read-only, no write/update from client)
CREATE POLICY select_ledger_owner ON public.psychometric_ledger
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- Media Snippets Policies (Owner complete CRUD)
CREATE POLICY snippets_owner_policy ON public.media_snippets
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 8. Automated Profile and Ledger Creation Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, name, birth_date, target_demographic)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'Používateľ'),
        COALESCE((new.raw_user_meta_data->>'birth_date')::DATE, '2000-01-01'::DATE),
        COALESCE(new.raw_user_meta_data->>'target_demographic', 'hetero')
    );

    INSERT INTO public.psychometric_ledger (user_id)
    VALUES (new.id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
