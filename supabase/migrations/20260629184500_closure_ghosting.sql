-- ============================================================
-- Migration 06: Closure Protocol & Ghosting Detector Schema
-- ============================================================

-- 1. Add ghosting_count and avoidant_bias to profiles table
ALTER TABLE public.profiles 
ADD COLUMN ghosting_count INT NOT NULL DEFAULT 0,
ADD COLUMN avoidant_bias FLOAT4 NOT NULL DEFAULT 0.0;

-- 2. Update matches table status constraints and add columns to track last interaction
-- First, drop the old check constraint on status
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_status_check;

-- Add new columns for tracking idle time efficiently
ALTER TABLE public.matches 
ADD COLUMN last_interaction_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
ADD COLUMN last_sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN closure_reason TEXT;

-- Re-apply check constraint to include 'closed' status
ALTER TABLE public.matches 
ADD CONSTRAINT matches_status_check CHECK (status IN ('active', 'deleted', 'closed'));
