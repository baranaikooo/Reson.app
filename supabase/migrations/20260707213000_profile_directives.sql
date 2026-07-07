-- Add life directives fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS directive_goal TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS directive_redflags TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS directive_lifestyle TEXT DEFAULT '';
