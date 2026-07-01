import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

const sanitize = (val: string) => {
  return (val || '').trim().replace(/[^\x20-\x7E]/g, '');
};

const supabaseUrl = sanitize(import.meta.env.VITE_SUPABASE_URL as string);
const supabaseAnonKey = sanitize(import.meta.env.VITE_SUPABASE_ANON_KEY as string);

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

const checkIsNative = () => {
  if (typeof window === 'undefined') return false;
  return Capacitor.isNativePlatform() || window.navigator?.userAgent?.includes('ResonMobile');
};

if (checkIsNative()) {
  App.addListener('appUrlOpen', (event) => {
    if (event.url.includes('reson://auth')) {
      const hashPos = event.url.indexOf('#');
      if (hashPos !== -1) {
        const hashParams = new URLSearchParams(event.url.substring(hashPos + 1));
        const access_token = hashParams.get('access_token');
        const refresh_token = hashParams.get('refresh_token');
        if (access_token && refresh_token) {
          supabase.auth.setSession({ access_token, refresh_token });
        }
      }
    }
  });
}

export const supabaseLogs: string[] = [];
let logListener: ((msg: string) => void) | null = null;

export function addSupabaseLog(msg: string) {
  const formatted = `${new Date().toLocaleTimeString()}: ${msg}`;
  supabaseLogs.push(formatted);
  if (logListener) {
    logListener(msg); // Send unformatted, let subscriber format if needed, or format here
  }
  console.log(`[SupabaseLog] ${msg}`);
}

export function subscribeToSupabaseLogs(listener: (msg: string) => void) {
  logListener = listener;
  return () => {
    logListener = null;
  };
}

// Capture query parameters and hash before routers (like TanStack Router) strip them
if (typeof window !== 'undefined') {
  try {
    const url = new URL(window.location.href);
    
    // 1. Handle PKCE flow (?code=...)
    const code = url.searchParams.get('code');
    if (code) {
      addSupabaseLog('Found code in URL, exchanging for session...');
      supabase.auth.exchangeCodeForSession(code)
        .then(({ data, error }) => {
          if (error) {
            addSupabaseLog(`Error exchanging code: ${error.message}`);
          } else {
            addSupabaseLog(`Successfully exchanged code for user: ${data.user?.email}`);
          }
        })
        .catch(err => addSupabaseLog(`Exception during code exchange: ${err.message || err}`));
    }

    // 2. Handle Implicit flow (#access_token=...)
    const hash = url.hash;
    if (hash && (hash.includes('access_token') || hash.includes('error'))) {
      const hashParams = new URLSearchParams(hash.substring(1));
      const errorParam = hashParams.get('error');
      const errorDesc = hashParams.get('error_description');
      
      if (errorParam) {
        addSupabaseLog(`OAuth error in hash: ${errorParam} - ${errorDesc}`);
      }

      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      if (accessToken && refreshToken) {
        addSupabaseLog('Found access_token in hash, setting session...');
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        })
          .then(({ data, error }) => {
            if (error) {
              addSupabaseLog(`Error setting session: ${error.message}`);
            } else {
              addSupabaseLog(`Successfully set session for user: ${data.user?.email}`);
            }
          })
          .catch(err => addSupabaseLog(`Exception during setSession: ${err.message || err}`));
      }
    }
  } catch (err: any) {
    addSupabaseLog(`Error parsing URL: ${err.message || err}`);
  }
}

export type AuthError = {
  message: string;
};

export async function signInWithGoogle() {
  const isNative = typeof window !== 'undefined' && (Capacitor.isNativePlatform() || window.navigator?.userAgent?.includes('ResonMobile'));
  const redirectTo = isNative ? 'reson://auth' : window.location.origin;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) {
    console.error('Google sign-in error:', error);
    throw error;
  }

  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Sign-out error:', error);
    throw error;
  }
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Get用户 error:', error);
    return null;
  }
  return user;
}

export function onAuthStateChange(callback: (event: string, session: any) => void) {
  return supabase.auth.onAuthStateChange(callback);
}
