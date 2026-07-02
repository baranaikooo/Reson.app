import { createClient } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

const sanitize = (val: string) => {
  return (val || "").trim().replace(/[^\x20-\x7E]/g, "");
};

const supabaseUrl = sanitize(import.meta.env.VITE_SUPABASE_URL as string);
const supabaseAnonKey = sanitize(import.meta.env.VITE_SUPABASE_ANON_KEY as string);

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");

const checkIsNative = () => {
  if (typeof window === "undefined") return false;
  return Capacitor.isNativePlatform() || window.navigator?.userAgent?.includes("ResonMobile");
};

if (checkIsNative()) {
  App.addListener("appUrlOpen", (event) => {
    if (event.url.includes("reson://auth")) {
      const hashPos = event.url.indexOf("#");
      if (hashPos !== -1) {
        const hashParams = new URLSearchParams(event.url.substring(hashPos + 1));
        const access_token = hashParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token");
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
if (typeof window !== "undefined") {
  try {
    const url = new URL(window.location.href);

    // 1. Handle PKCE flow (?code=...)
    const code = url.searchParams.get("code");
    if (code) {
      addSupabaseLog("Found code in URL, exchanging for session...");
      supabase.auth
        .exchangeCodeForSession(code)
        .then(({ data, error }) => {
          if (error) {
            addSupabaseLog(`Error exchanging code: ${error.message}`);
          } else {
            addSupabaseLog(`Successfully exchanged code for user: ${data.user?.email}`);
          }
        })
        .catch((err) => addSupabaseLog(`Exception during code exchange: ${err.message || err}`));
    }

    // 2. Handle Implicit flow (#access_token=...)
    const hash = url.hash;
    if (hash && (hash.includes("access_token") || hash.includes("error"))) {
      const hashParams = new URLSearchParams(hash.substring(1));
      const errorParam = hashParams.get("error");
      const errorDesc = hashParams.get("error_description");

      if (errorParam) {
        addSupabaseLog(`OAuth error in hash: ${errorParam} - ${errorDesc}`);
      }

      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      if (accessToken && refreshToken) {
        addSupabaseLog("Found access_token in hash, setting session...");
        supabase.auth
          .setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          .then(({ data, error }) => {
            if (error) {
              addSupabaseLog(`Error setting session: ${error.message}`);
            } else {
              addSupabaseLog(`Successfully set session for user: ${data.user?.email}`);
            }
          })
          .catch((err) => addSupabaseLog(`Exception during setSession: ${err.message || err}`));
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
  const isNative =
    typeof window !== "undefined" &&
    (Capacitor.isNativePlatform() || window.navigator?.userAgent?.includes("ResonMobile"));
  const redirectTo = isNative ? "reson://auth" : window.location.origin;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) {
    console.error("Google sign-in error:", error);
    throw error;
  }

  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Sign-out error:", error);
    throw error;
  }
}

export async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) {
    console.error("Get用户 error:", error);
    return null;
  }
  return user;
}

export function onAuthStateChange(callback: (event: string, session: any) => void) {
  return supabase.auth.onAuthStateChange(callback);
}

export async function uploadSnippetVideo(
  userId: string,
  slotIndex: number,
  blob: Blob,
): Promise<string | null> {
  if (userId === "00000000-0000-0000-0000-000000000001") {
    console.warn(`[Supabase] Skipping video upload for Demo User (slot ${slotIndex})`);
    return null;
  }

  const fileName = `${userId}/snippet_${slotIndex}_${Date.now()}.webm`;

  const { data, error } = await supabase.storage.from("media-snippets").upload(fileName, blob, {
    contentType: blob.type || "video/webm",
    upsert: true,
  });

  if (error) {
    console.error(`[Supabase] Upload failed for slot ${slotIndex}:`, error);
    return null; // Return null instead of throwing to prevent Promise.all from failing entirely
  }

  const { data: publicUrlData } = supabase.storage.from("media-snippets").getPublicUrl(data.path);

  return publicUrlData.publicUrl;
}

export async function loadBanditState() {
  const { data, error } = await supabase.from("bandit_state").select("*").limit(1).single();

  if (error) {
    console.error("[Supabase] Failed to load bandit state:", error);
    return null;
  }
  return data;
}

export async function saveBanditState(weights: any, arms: any, history: any[]) {
  const { error } = await supabase.rpc("record_bandit_feedback", {
    new_weights: weights,
    new_arms: arms,
    new_history: history,
  });

  if (error) {
    console.error("[Supabase] Failed to save bandit state via RPC:", error);
  }
}

export async function saveUserProfile(
  userId: string,
  profileData: any,
  videoUrls: (string | null)[],
): Promise<void> {
  if (userId === "00000000-0000-0000-0000-000000000001") {
    console.warn("[Supabase] Skipping saveUserProfile for Demo User");
    return;
  }

  // 1. Upsert Profile
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      name: profileData.name || "Používateľ",
      age: profileData.age || 18,
      city: profileData.city || "",
      gender: profileData.gender || "other",
      orientation: profileData.orientation || "bi",
      liveness_verified: true,
      // Optional psychometric metrics if present
      cognitive_depth: profileData.cognitiveDepth,
      conscientiousness: profileData.conscientiousness,
      extraversion: profileData.extraversion,
      attachment_style: profileData.attachmentStyle,
      avg_response_time: profileData.avgResponseTime,
      top_priority: profileData.topPriority,
    })
    .eq("id", userId);

  if (profileError) {
    console.error("[Supabase] Profile update failed:", profileError);
    throw profileError;
  }

  // 2. Upsert Psychometric Ledger
  const { error: ledgerError } = await supabase
    .from("psychometric_ledger")
    .update({
      primary_marker: (profileData.attachmentStyle || "UNTESTED").toUpperCase(),
      avg_decision_latency: profileData.avgResponseTime || 0,
      ev_score: profileData.extraversion ? profileData.extraversion * 100 : 50,
    })
    .eq("user_id", userId);

  if (ledgerError) {
    console.error("[Supabase] Ledger update failed:", ledgerError);
    throw ledgerError;
  }

  // 3. Upsert Media Snippets
  for (let i = 0; i < videoUrls.length; i++) {
    const url = videoUrls[i];
    if (!url || url.startsWith("blob:")) continue; // Skip if it's still a local blob

    const { error: snippetError } = await supabase.from("media_snippets").upsert(
      {
        user_id: userId,
        slot_index: i + 1,
        video_url: url,
      },
      { onConflict: "user_id, slot_index" },
    );

    if (snippetError) {
      console.error(`[Supabase] Snippet ${i + 1} insert failed:`, snippetError);
      throw snippetError;
    }
  }
}

export async function fetchUserProfile(userId: string): Promise<any | null> {
  if (!userId || userId === "00000000-0000-0000-0000-000000000001") return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error || !data || !data.liveness_verified) {
    return null; // Return null if user doesn't exist or hasn't finished onboarding
  }

  return {
    id: data.id,
    name: data.name,
    age: data.age,
    city: data.city,
    gender: data.gender,
    orientation: data.orientation,
    cognitiveDepth: data.cognitive_depth,
    conscientiousness: data.conscientiousness,
    extraversion: data.extraversion,
    attachmentStyle: data.attachment_style,
    avgResponseTime: data.avg_response_time,
    topPriority: data.top_priority,
    hesitated: data.hesitated,
    redemptionQuota: data.redemption_quota,
    completedPressureScenarios: data.completed_pressure_scenarios || [],
  };
}
