# Reson

Ultra-premium, mathematically grounded mobile ecosystem for data-driven trading, value betting, lyric writing, and real-time chat.

> ⚠️ This is a **React Native (Expo)** project. It does NOT run inside the Lovable web preview. Copy this `reson-app/` folder out of the workspace and run it locally.

## Stack

- Expo SDK 51 + Expo Router (file-based)
- React Native + TypeScript
- NativeWind (Tailwind for RN)
- Supabase (auth, Postgres, realtime)
- Zustand (state)

## Run locally

```bash
cd reson-app
npm install
cp .env.example .env   # fill in EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY
npx expo start
```

Press `i` (iOS sim), `a` (Android), or scan the QR with the Expo Go app.

## Supabase schema

Run `supabase/schema.sql` against your Supabase project. It provisions:

- `profiles` (auto-created on signup via trigger)
- `trades` (analytical dashboard log)
- `value_bets` (EV+ betting log)
- `lyrics` (Creative Forge documents)
- `chat_channels`, `chat_messages` (realtime chat)

All tables have RLS enabled.

## Modules

- **Dashboard** — quantitative trade log + value-bet ledger, live KPIs (win rate, profit factor, Sharpe, ROI, max drawdown).
- **Creative Forge** — distraction-free lyric editor with rhyme-scheme analyzer and multi-syllable rhyme engine.
- **Chat** — realtime channels (general / quant / writing).
- **Settings** — profile, theme lock, sign out.

## Theme

Hardcoded deep-dark. Pitch black `#000000` base, charcoal surfaces `#0A0A0B` / `#111114`, electric accents (`#00E5FF`, `#39FF14`, `#FFD60A`). Monospace (`JetBrainsMono`) for all numeric cells.
