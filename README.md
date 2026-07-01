# Reson

**No swiping. Just psychology.**

Reson is a next-generation dating and matching application focused on cognitive resonance, deep psychological alignment, and authentic interactions. It replaces superficial swiping with a 6-question psychometric test, voice-only communication, and strict liveness verification.

## 📱 Download the App

**[Download the latest Android APK (reson-alpha.apk)](https://github.com/baranaikooo/Reson/raw/main/releases/reson-alpha.apk)**

*Note: You may need to enable "Install from unknown sources" in your Android settings to install the APK.*

## 🌟 Key Features

- **No Swiping**: Matches are generated based on psychological alignment (Cognitive Depth, Conscientiousness, Extraversion).
- **Liveness Verification**: A mandatory 3-second live video snippet using on-device face detection ensures everyone is a real human. No catfish, no AI bots.
- **Voice-Only Communication**: The "Voice Chamber" and messaging threads enforce voice-only communication to build deeper, more authentic connections.
- **Brutalist Dark Theme**: A sleek, strict, distraction-free "CCTV" dark mode aesthetic that prioritizes focus and immersion.
- **Value Bankroll**: Users define their core priorities (Freedom, Family, Career, Creativity, Stability) via an interactive radar chart.
- **Google OAuth**: Fast and secure one-tap login without SMS costs or passwords.

## 🛠 Tech Stack

- **Frontend**: React, TanStack Start, Tailwind CSS
- **Native Wrapper**: Capacitor (Android WebView with deep integration)
- **Backend/Auth/DB**: Supabase (PostgreSQL, Edge Functions, Auth)
- **AI/ML**: TensorFlow.js (BlazeFace for on-device liveness verification)

## 🚀 Running Locally

1. Clone the repository
2. Install dependencies: `npm install`
3. Run the development server: `npm run dev`
4. Build the web app: `npm run build`

**For Android (Capacitor):**
1. Sync web assets: `npx cap sync android`
2. Open Android Studio: `npx cap open android`
3. Or build the APK via Gradle: `cd android && ./gradlew assembleDebug`

## 🔒 Branch Protection

To ensure the stability of the `main` branch, we recommend enabling Branch Protection on GitHub:
1. Go to **Settings** > **Branches** in this repository.
2. Click **Add branch ruleset** or **Add rule** for the `main` branch.
3. Require pull request reviews before merging.
4. Require status checks to pass before merging.
5. Do not allow bypassing the above settings.

---
*Built by baranaikooo & Antigravity AI.*
