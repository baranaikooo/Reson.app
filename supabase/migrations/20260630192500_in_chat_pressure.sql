-- Migration 07: In-Chat Pressure Triggers (Landmines) Schema

-- 1. Add completed_pressure_scenarios to profiles table to track which ones the user has faced
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS completed_pressure_scenarios TEXT[] NOT NULL DEFAULT '{}';

-- 2. Add in-chat pressure tracking columns to matches table
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS pressure_trigger_at INT NOT NULL DEFAULT (floor(random() * 6) + 10)::int, -- random number between 10 and 15
ADD COLUMN IF NOT EXISTS pressure_scenario_id TEXT,
ADD COLUMN IF NOT EXISTS user_p_pressure_response TEXT,
ADD COLUMN IF NOT EXISTS user_q_pressure_response TEXT,
ADD COLUMN IF NOT EXISTS user_p_pressure_rt FLOAT4,
ADD COLUMN IF NOT EXISTS user_q_pressure_rt FLOAT4,
ADD COLUMN IF NOT EXISTS user_p_pressure_hesitated BOOLEAN,
ADD COLUMN IF NOT EXISTS user_q_pressure_hesitated BOOLEAN,
ADD COLUMN IF NOT EXISTS pressure_test_status TEXT NOT NULL DEFAULT 'pending' 
  CONSTRAINT matches_pressure_test_status_check CHECK (pressure_test_status IN ('pending', 'active', 'completed'));
