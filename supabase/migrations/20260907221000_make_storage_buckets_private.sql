-- Migration: 20260907221000_make_storage_buckets_private.sql
-- Description: Make media-snippets and voice-messages storage buckets private (requires signed URLs)

UPDATE storage.buckets
SET public = FALSE
WHERE id IN ('media-snippets', 'voice-messages');
