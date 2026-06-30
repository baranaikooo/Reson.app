-- ============================================================
-- Migration 04: Add hesitated column to profiles for Gyroscopic Anti-Cheat
-- ============================================================

ALTER TABLE public.profiles 
ADD COLUMN hesitated BOOLEAN DEFAULT FALSE;
