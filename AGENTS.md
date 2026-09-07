# Agent Guidelines for Reson

Reson is a next-generation cognitive resonance dating application built with React, TanStack Start, Supabase, and Capacitor for Android.

## Architecture Overview
- **Frontend**: React, TanStack Start, Tailwind CSS, Vite.
- **Backend & Database**: Supabase (PostgreSQL, Auth, Storage, Edge Functions).
  - Storage buckets `media-snippets` and `voice-messages` are private, accessed via time-limited signed URLs.
  - Authentication via Google OAuth and Supabase Auth.
  - Database functions enforce strict RLS and cascading deletion on `delete_own_user()`.
- **Mobile**: Capacitor Android with hardware permissions for camera, microphone, and network state.
- **Production Hosting**: Vercel (`https://resonapp.vercel.app`).

## Development Rules
- Maintain linear git history. Changes must be committed and pushed through Pull Requests to `main`.
- Never commit private credentials, service role keys, or compiled binaries (`.apk`, `.aab`) into the git repository.
- Keep the working tree clean and verify deployments on Vercel after merges.

