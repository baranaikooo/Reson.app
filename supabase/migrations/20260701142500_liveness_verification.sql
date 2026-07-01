-- Add biometric verification fields to public.profiles table
ALTER TABLE public.profiles
ADD COLUMN liveness_verified BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN verified_at TIMESTAMPTZ;
