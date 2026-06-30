-- ============================================================
-- Migration 05: Add redemption_quota column to profiles table
-- ============================================================

ALTER TABLE public.profiles 
ADD COLUMN redemption_quota INT NOT NULL DEFAULT 0;
