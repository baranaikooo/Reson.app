# Reson - Setup Guide

## Prerequisites
- Node.js (v18 or higher)
- npm or bun
- Supabase account (for Google OAuth)

## Installation

### 1. Install Dependencies
```bash
npm install
# or
bun install
```

### 2. Configure Supabase

#### Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be ready (2-3 minutes)

#### Enable Google OAuth in Supabase
1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Providers** → **Google**
3. Enable Google provider
4. Add your Google OAuth credentials:
   - Get Client ID and Client Secret from [Google Cloud Console](https://console.cloud.google.com)
   - Add authorized redirect URI: `https://[your-project-id].supabase.co/auth/v1/callback`
   - Add authorized JavaScript origin: `http://localhost:5173` (or your production URL)

#### Get Supabase Credentials
1. Go to **Project Settings** → **API**
2. Copy:
   - Project URL
   - anon/public key

### 3. Configure Environment Variables

Create a `.env` file in the project root (already created) and add:

```env
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

Example:
```env
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_GOOGLE_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
```

### 4. Run Development Server

```bash
npm run dev
# or
bun run dev
```

The app will be available at `http://localhost:5173`

## Features Implemented

### ✅ Google Login via Supabase
- Supabase OAuth integration for Google authentication
- Automatic session management
- User profile extraction from Google account
- Fallback to demo mode if Supabase is not configured

### ✅ Voice Recordings (Fixed)
- Enhanced error handling for microphone access
- Better logging for debugging
- Fallback to synthetic audio when recording fails
- Cross-browser MIME type support
- Blob size validation to prevent empty recordings

### ✅ Live Snippet Video (Fixed)
- Improved blob size validation (>100 bytes minimum)
- Better error messages for users
- Detailed logging for debugging
- MIME type tracking

## Troubleshooting

### Google Login Not Working
1. Verify Supabase URL and anon key are correct in `.env`
2. Check that Google OAuth is enabled in Supabase dashboard
3. Ensure redirect URI matches in Google Cloud Console
4. Check browser console for error messages

### Voice Recordings Not Working
1. Check browser permissions for microphone
2. Ensure HTTPS (required for microphone access in production)
3. Check browser console for `[voice]` error logs
4. Try different browser (Chrome/Firefox recommended)

### Live Video Not Recording
1. Check camera permissions
2. Ensure browser supports MediaRecorder API
3. Check browser console for `[liveness]` error logs
4. Verify camera is not being used by another application

## Development

### Project Structure
```
src/
├── components/       # React components
│   ├── GoogleSignInButton.tsx  # Google auth button
│   └── ...
├── lib/             # Utilities and helpers
│   ├── supabase.ts  # Supabase client and auth functions
│   ├── media.ts     # Media recording utilities
│   └── resonance.ts # Matching algorithm
├── routes/          # App routes
│   └── index.tsx    # Main application
└── hooks/           # Custom React hooks
```

### Key Files Modified
- `package.json` - Added `@supabase/supabase-js` dependency
- `.env` - Added Supabase configuration variables
- `src/lib/supabase.ts` - New Supabase client and auth functions
- `src/components/GoogleSignInButton.tsx` - Updated to support Supabase OAuth
- `src/routes/index.tsx` - Added Supabase auth state handling
- `src/lib/media.ts` - Enhanced voice recording error handling

## Production Deployment

### Environment Variables
Set the following environment variables in your hosting platform:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GOOGLE_CLIENT_ID`

### Build
```bash
npm run build
```

### Deploy
The build output will be in the `.output` directory. Deploy this to your hosting provider.

## Local Webhook Testing (Tunneling)
Since biometrické overenie (Liveness Verification) relies on callbacks from identity providers, you must tunnel webhook traffic to your local server in development.

Use **Stripe CLI** to tunnel events to your local FastAPI server:
```bash
stripe listen --forward-to localhost:8000/api/webhooks/identity
```
Or if using **ngrok**:
```bash
ngrok http 8000
```
Then configure the generated URL as your webhook endpoint in your provider settings (e.g. `https://your-tunnel.ngrok-free.app/api/webhooks/identity`).

## Support
For issues or questions, check the browser console for detailed error logs prefixed with:
- `[auth]` - Authentication issues
- `[voice]` - Voice recording issues
- `[liveness]` - Video recording issues
