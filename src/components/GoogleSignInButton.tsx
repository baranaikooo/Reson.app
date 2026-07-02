import { useEffect, useRef } from "react";
import { signInWithGoogle, supabase } from "@/lib/supabase";

export type GoogleProfile = { name: string; email: string; picture?: string };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: string;
              theme?: string;
              size?: string;
              text?: string;
              width?: number;
              locale?: string;
            },
          ) => void;
        };
      };
    };
  }
}

function parseGoogleCredential(credential: string): GoogleProfile {
  const payload = JSON.parse(
    atob(credential.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/")),
  ) as { name?: string; given_name?: string; email?: string; picture?: string };
  return {
    name: payload.name || payload.given_name || "Používateľ",
    email: payload.email || "",
    picture: payload.picture,
  };
}

function GoogleMark() {
  return (
    <svg className="size-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function GoogleSignInButton({
  onSuccess,
  disabled,
}: {
  onSuccess: (profile: GoogleProfile) => void;
  disabled?: boolean;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const useSupabase = !!SUPABASE_URL;
  const useRealGoogle = !!CLIENT_ID;

  // Use Supabase OAuth if configured
  const handleSupabaseSignIn = async () => {
    if (disabled) return;
    try {
      await signInWithGoogle();
      // Supabase will handle the redirect and session
      // The user will be redirected back to the app
    } catch (err) {
      console.error("Supabase Google sign-in error:", err);
    }
  };

  useEffect(() => {
    if (!useRealGoogle || typeof window === "undefined" || !overlayRef.current) return;

    let cancelled = false;
    const mount = overlayRef.current;

    const init = () => {
      if (cancelled || !window.google || !mount) return;
      try {
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID!,
          callback: (response) => {
            try {
              onSuccess(parseGoogleCredential(response.credential));
            } catch (err) {
              console.error("Google sign-in callback error:", err);
            }
          },
          auto_select: false,
        });
        window.google.accounts.id.renderButton(mount, {
          type: "standard",
          theme: "filled_black",
          size: "large",
          text: "continue_with",
          width: Math.min(360, mount.parentElement?.clientWidth ?? 320),
          locale: "sk",
        });
      } catch (err) {
        console.error("Google sign-in initialization error:", err);
      }
    };

    if (window.google) {
      init();
      return () => {
        cancelled = true;
        mount.innerHTML = "";
      };
    }

    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener("load", init);
      existing.addEventListener("error", () => console.error("Google script failed to load"));
      return () => {
        cancelled = true;
        existing.removeEventListener("load", init);
        mount.innerHTML = "";
      };
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = init;
    script.onerror = () => console.error("Google script failed to load");
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      mount.innerHTML = "";
    };
  }, [onSuccess, useRealGoogle]);

  // Use Supabase button if configured
  if (useSupabase) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={handleSupabaseSignIn}
        className="flex w-full items-center justify-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-xl transition-all hover:bg-white/10 active:scale-[0.98] disabled:opacity-40"
      >
        <GoogleMark />
        <span className="text-base font-medium">Pokračovať cez Google</span>
      </button>
    );
  }

  if (useRealGoogle) {
    return (
      <div className={`relative w-full ${disabled ? "pointer-events-none opacity-40" : ""}`}>
        <div
          className="flex w-full items-center justify-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-xl"
          aria-hidden
        >
          <GoogleMark />
          <span className="text-base font-medium">Pokračovať cez Google</span>
        </div>
        <div
          ref={overlayRef}
          className="absolute inset-0 overflow-hidden opacity-[0.015]"
          aria-label="Prihlásiť sa cez Google"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSuccess({ name: "Google Demo", email: "demo@gmail.com" })}
      className="flex w-full items-center justify-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-xl transition-all hover:bg-white/10 active:scale-[0.98] disabled:opacity-40"
    >
      <GoogleMark />
      <span className="text-base font-medium">Pokračovať cez Google</span>
    </button>
  );
}
