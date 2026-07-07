import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Mic,
  Send,
  Phone,
  ChevronRight,
  Sparkles,
  Play,
  Pause,
  Check,
  X,
  Camera,
  MessageCircle,
  MapPin,
  ArrowLeft,
  Home,
  Brain,
  Trash2,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Shield,
  FileText,
  Cookie,
  Mail,
  Trash,
  Paperclip,
  Image as ImageIcon,
  User,
  MoreVertical,
  AlertTriangle,
} from "lucide-react";
import {
  pickScenarios,
  calcResonance,
  resonanceBreakdown,
  catalystFor,
  orbSeedFor,
  rankMatches,
  partnerContinueDecision,
  mockReply,
  archetypeOf,
  type Scenario,
  type Answer,
  type Answers,
  type FullAnswers,
  type UserProfile,
  type Gender,
  type Orientation,
  type RankedMatch,
  type Conversation,
  type ChatMessage,
  type Archetype,
  haversineKm,
} from "@/lib/resonance";

import { SonarScan } from "@/components/SonarScan";
import { GoogleSignInButton, type GoogleProfile } from "@/components/GoogleSignInButton";
import { EncryptedText } from "@/components/ui/encrypted-text";
import { Blobs, Chip, PillButton, SoftCard, HandNote } from "@/components/Playful";
import { useHaptic } from "@/hooks/use-haptics";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  attachStreamToVideo,
  cameraErrorMessage,
  createMediaRecorder,
  micErrorMessage,
  openCamera,
  openMic,
  pickAudioMime,
  recordStreamForMs,
  stopStream,
  makeMockToneWavUrl,
  blobToPlayableAudioUrl,
} from "@/lib/media";
import {
  getCurrentUser,
  onAuthStateChange,
  supabase,
  uploadSnippetVideo,
  saveUserProfile,
  fetchUserProfile,
} from "@/lib/supabase";
import { initializeBanditState } from "@/lib/resonance";
import { SemanticMirror } from "@/components/SemanticMirror";
import { ValueBankroll } from "@/components/ValueBankroll";
import { PressureChat, SCENARIOS } from "@/components/PressureChat";
import { IcebreakerDilemma } from "@/components/IcebreakerDilemma";
import { BlindVote } from "@/components/BlindVote";
import { VoiceBubble, VoiceMsg } from "@/components/chat/VoiceBubble";
import { Chamber } from "@/components/chat/VoiceChamber";
import { MessageThread } from "@/components/chat/MessageThread";
import {
  LegalPage,
  TERMS_BODY,
  PRIVACY_BODY,
  COOKIES_BODY,
  CONTACT_BODY,
} from "@/components/settings/LegalAndSettings";
import { RadarChart } from "@/components/RadarChart";
import { AssetDossier } from "@/components/AssetDossier";
import { SystemConfig } from "@/components/SystemConfig";
import { SnippetsOnboarding } from "@/components/SnippetsOnboarding";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Reson — Nájdi svoju kognitívnu rezonanciu" },
      {
        name: "description",
        content:
          "Zoznamovacia aplikácia bez swipovania. Overenie tváre a telefónom, párovanie cez 6-otázkový psychologický test, komunikácia výhradne cez hlasovky.",
      },
      { property: "og:title", content: "Reson — Nájdi svoju kognitívnu rezonanciu" },
      { property: "og:description", content: "Žiadne swipovanie. Iba psychológia." },
    ],
  }),
  component: ResonApp,
});

// ============ Shared UI ============
function Wave({ size = 280, intense = false }: { size?: number; intense?: boolean }) {
  return (
    <div
      className="relative grid place-items-center animate-fade-in"
      style={{ width: size, height: size }}
    >
      {[0, 0.6, 1.2].map((d, i) => (
        <span
          key={i}
          className="absolute rounded-full border animate-wave"
          style={{
            width: size * 0.5,
            height: size * 0.5,
            borderColor: "currentColor",
            borderWidth: 1,
            animationDelay: `${d}s`,
            opacity: intense ? 0.8 : 0.4,
          }}
        />
      ))}
      <span
        className="absolute rounded-full animate-resonance"
        style={{
          width: size * 0.32,
          height: size * 0.32,
          background:
            "radial-gradient(circle, rgba(255,255,255,0.15), rgba(255,255,255,0.03) 60%, transparent 70%)",
        }}
      />
      <span className="absolute rounded-full bg-foreground" style={{ width: 12, height: 12 }} />
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-[100dvh] w-full overflow-hidden">
      <div className="mx-auto h-full max-w-2xl overflow-y-auto overscroll-contain px-5 pb-28 pt-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </div>
  );
}

function AppSplash() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center text-center animate-fade-in">
      <div className="size-16 rounded-full border border-foreground/10 bg-foreground/[0.02] flex items-center justify-center animate-pulse">
        <span className="size-4 rounded-full bg-foreground/40 animate-ping" />
      </div>
      <p className="mt-6 font-mono text-[9px] tracking-[0.32em] text-foreground/45 uppercase">
        RESON // SYSTÉM SA INICIALIZUJE
      </p>
    </div>
  );
}

// Proactively triggers the browser's native mic permission prompt so the
// microphone shows up in the site's permissions list long before the user
// reaches the voice chamber. Safe to call multiple times — the result is
// cached and tracks are torn down immediately so no recording happens.
let micPrimed: Promise<void> | null = null;
function primeMicPermission(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (micPrimed) return micPrimed;
  if (!navigator.mediaDevices?.getUserMedia) return Promise.resolve();
  micPrimed = (async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // We only wanted the permission grant — release the mic right away.
      stream.getTracks().forEach((t) => t.stop());
      console.info("[voice] microphone permission granted (primed)");
    } catch (err) {
      const e = err as DOMException;
      console.warn("[voice] mic prime skipped:", e?.name, e?.message);
      // Reset so a later explicit start attempt can re-prompt the user.
      micPrimed = null;
    }
  })();
  return micPrimed;
}

// ============ Screens ============
type Screen =
  | "landing"
  | "liveness"
  | "profile"
  | "snippets-onboarding"
  | "briefing"
  | "mirror"
  | "bankroll"
  | "pressure"
  | "test"
  | "processing"
  | "autoMatch"
  | "chamber"
  | "noOne"
  | "messages"
  | "thread"
  | "settings"
  | "legal-terms"
  | "legal-privacy"
  | "legal-cookies"
  | "legal-contact"
  | "profile-dossier";

type ThemeMode = "system" | "dark" | "light";
function useTheme(): [ThemeMode, (m: ThemeMode) => void] {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem("reson:theme") as ThemeMode) || "system";
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.remove("dark", "light");
    if (mode === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.add(isDark ? "dark" : "light");
    } else {
      document.documentElement.classList.add(mode);
    }
    try {
      localStorage.setItem("reson:theme", mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== "system" || typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.remove("dark", "light");
      document.documentElement.classList.add(e.matches ? "dark" : "light");
    };
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [mode]);

  return [mode, setMode];
}

function ResonApp() {
  const [theme, setTheme] = useTheme();
  const themeLoadedRef = useRef(false);
  const themeRef = useRef(theme);

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  const [screen, setScreen] = useState<Screen>("landing");
  const [googleProfile, setGoogleProfile] = useState<GoogleProfile | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [livenessVideoUrl, setLivenessVideoUrl] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"ev" | "distance">("ev");

  // Psychometric EV variables
  const [cognitiveDepth, setCognitiveDepth] = useState<number>(0.5);
  const [conscientiousness, setConscientiousness] = useState<number>(0.5);
  const [extraversion, setExtraversion] = useState<number>(0.5);
  const [attachmentStyle, setAttachmentStyle] = useState<string>("Secure");
  const [avgResponseTime, setAvgResponseTime] = useState<number>(3.0);
  const [topPriority, setTopPriority] = useState<string>("");
  const [previewC, setPreviewC] = useState<number>(0.5);
  const [previewE, setPreviewE] = useState<number>(0.5);
  const [hesitated, setHesitated] = useState<boolean>(false);
  const [redemptionQuota, setRedemptionQuota] = useState<number>(0);

  const reduceRedemptionQuota = () => {
    setRedemptionQuota((prev) => {
      const next = Math.max(0, prev - 1);
      if (profile) {
        setProfile({
          ...profile,
          redemptionQuota: next,
        });
      }
      return next;
    });
  };

  const userAnswers = answers as FullAnswers;
  const haptic = useHaptic();

  // Initialize ML Bandit
  useEffect(() => {
    initializeBanditState().catch((err) => console.error("Failed to init bandit state:", err));
  }, []);

  // Handle Supabase auth state changes and initial session check
  useEffect(() => {
    let initialized = false;

    // Helper to process session user (load profile, sync theme, etc.)
    async function processSessionUser(user: any) {
      const metadata = user.user_metadata;

      // Sync theme from Supabase metadata if exists, otherwise upload current theme
      const savedTheme = metadata?.theme;
      if (savedTheme === "light" || savedTheme === "dark") {
        setTheme(savedTheme);
        themeLoadedRef.current = true;
      } else {
        themeLoadedRef.current = true;
        supabase.auth
          .updateUser({
            data: { theme: themeRef.current },
          })
          .catch((err) => console.warn("[theme] failed to sync to Supabase:", err));
      }

      const profileData: GoogleProfile = {
        name: metadata?.name || metadata?.full_name || user.email?.split("@")[0] || "Používateľ",
        email: user.email || "",
        picture: metadata?.avatar_url || metadata?.picture,
      };
      setGoogleProfile(profileData);
      haptic("success");

      try {
        setAuthUserId(user.id);
        const existingProfile = await fetchUserProfile(user.id);
        if (existingProfile) {
          setProfile(existingProfile);
          setScreen("autoMatch");
        } else {
          setScreen("liveness");
        }
      } catch (err: any) {
        console.error("[Auth Debug] fetchUserProfile crashed:", err);
        setScreen("liveness");
      } finally {
        setIsAuthenticating(false);
      }
    }

    // 1. Initial auth check on mount (prevents landing flash)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const user = await getCurrentUser();
        if (user) {
          await processSessionUser(user);
        } else {
          setScreen("landing");
          setIsAuthenticating(false);
        }
      } else {
        setScreen("landing");
        setIsAuthenticating(false);
      }
      initialized = true;
    });

    // 2. Auth changes subscription for subsequent updates
    const {
      data: { subscription },
    } = onAuthStateChange(async (event, session) => {
      console.log("[auth] auth state changed:", event, session?.user?.email);

      if (event === "USER_UPDATED") {
        return; // Ignore metadata updates (e.g. theme sync) to prevent accidental logouts
      }

      if (!initialized) return; // Skip initial events, getSession handles the mount logic!

      if (session?.user) {
        const user = await getCurrentUser();
        if (user) {
          await processSessionUser(user);
        } else {
          setGoogleProfile(null);
          setProfile(null);
          setAuthUserId(null);
          setScreen("landing");
          themeLoadedRef.current = false;
        }
      } else {
        setGoogleProfile(null);
        setProfile(null);
        setAuthUserId(null);
        setScreen("landing");
        themeLoadedRef.current = false;
      }
    });

    return () => subscription.unsubscribe();
  }, [haptic]);

  // Synchronize theme changes to Supabase user metadata when selected by user
  useEffect(() => {
    if (!themeLoadedRef.current) return;
    getCurrentUser().then((user) => {
      if (user && user.user_metadata?.theme !== theme) {
        supabase.auth
          .updateUser({
            data: { theme: theme },
          })
          .then(() => {
            console.log("[theme] synced to Supabase metadata:", theme);
          })
          .catch((err) => {
            console.warn("[theme] failed to sync to Supabase:", err);
          });
      }
    });
  }, [theme]);

  // Real-time Geolocation watchPosition Stream
  useEffect(() => {
    if (!profile || !authUserId || authUserId === "00000000-0000-0000-0000-000000000001") return;
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;

    let lastSavedCoords: { lat: number; lon: number } | null = profile.coords ?? null;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const currentCoords = { lat: latitude, lon: longitude };

        // Distance filter check based on geo_density setting
        let shouldUpdate = false;
        if (!lastSavedCoords) {
          shouldUpdate = true;
        } else {
          const distanceDiff = haversineKm(lastSavedCoords, currentCoords);
          const density = profile.geo_density || "BALANCED_2KM";
          let thresholdKm = 2.0; // default 2km
          if (density === "ECO_5KM") thresholdKm = 5.0;
          else if (density === "HIGH_FREQ_500M") thresholdKm = 0.5;

          if (distanceDiff >= thresholdKm) {
            shouldUpdate = true;
          }
        }

        if (shouldUpdate) {
          console.info(`[Geolocation Stream] Location changed. Updating to: [Lat: ${latitude}, Lon: ${longitude}]`);
          lastSavedCoords = currentCoords;

          // Update local state reactively
          setProfile((prev) => prev ? { ...prev, coords: currentCoords } : null);

          // Update database asynchronously
          const { error } = await supabase
            .from("profiles")
            .update({
              latitude,
              longitude,
            })
            .eq("id", authUserId);

          if (error) {
            console.error("[Geolocation Stream] failed to update location in database:", error);
          }
        }
      },
      (err) => {
        console.warn("[Geolocation Stream] watchPosition error:", err);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [authUserId, profile?.id, profile?.geo_density]);

  // Real-time Supabase Profile Channel Subscription
  useEffect(() => {
    if (!authUserId || authUserId === "00000000-0000-0000-0000-000000000001") return;

    const channel = supabase
      .channel(`profile-updates:${authUserId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${authUserId}`,
        },
        (payload) => {
          console.log("[Supabase Realtime] User profile updated dynamically:", payload.new);
          const p = payload.new;
          setProfile((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              coords: p.latitude && p.longitude ? { lat: p.latitude, lon: p.longitude } : prev.coords,
              haptic_profile: p.haptic_profile || prev.haptic_profile,
              geo_density: p.geo_density || prev.geo_density,
              ui_speed: p.ui_speed || prev.ui_speed,
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authUserId]);

  // Automatic Geolocation Request & Initial Sync on Login/Auth
  useEffect(() => {
    if (!authUserId || authUserId === "00000000-0000-0000-0000-000000000001") return;
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;

    console.log("[Onboarding GPS] Requesting native geolocation permission on startup...");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        console.log("[Onboarding GPS] Initial coordinates resolved:", latitude, longitude);

        let resolvedCity = "Bratislava";
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=sk`
          );
          if (r.ok) {
            const data = await r.json();
            const a = data?.address ?? {};
            resolvedCity = a.city || a.town || a.village || a.municipality || "Bratislava";
          }
        } catch (e) {
          console.warn("[Onboarding GPS] Reverse geocoding failed, using fallback:", e);
        }

        // Update local state reactively if profile exists
        setProfile((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            coords: { lat: latitude, lon: longitude },
            city: resolvedCity,
          };
        });

        // Update database asynchronously
        const { error } = await supabase
          .from("profiles")
          .update({
            latitude,
            longitude,
            city: resolvedCity,
          })
          .eq("id", authUserId);

        if (error) {
          console.error("[Onboarding GPS] Failed to save initial coordinates:", error);
        } else {
          console.log("[Onboarding GPS] Initial coordinates and city saved successfully.");
        }
      },
      (err) => {
        console.warn("[Onboarding GPS] Initial location prompt rejected/failed:", err);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [authUserId]);

  const [liveCandidates, setLiveCandidates] = useState<RankedMatch[]>([]);
  const [initiatedMatchIds, setInitiatedMatchIds] = useState<Set<string>>(new Set());
  const [isLoadingMarket, setIsLoadingMarket] = useState(false);

  useEffect(() => {
    if (!profile) return;

    // CACHE FLUSH FOR THIS DEPLOYMENT
    if (!localStorage.getItem("reson_cache_flushed_v3")) {
      localStorage.clear();
      localStorage.setItem("reson_cache_flushed_v3", "true");
    }

    async function fetchLiveMarket() {
      const p = profile;
      if (!p) return;
      setIsLoadingMarket(true);
      try {
        const { data, error } = await supabase.rpc("get_recommended_matches", {
          caller_id: p.id,
          caller_gender: p.gender || "other",
          caller_orientation: p.orientation || "bi",
          caller_vector: `[${p.cognitiveDepth || 0.5},${p.conscientiousness || 0.5}]`,
          max_limit: 100,
        });

        if (error) throw error;

        // Map Supabase rows to RankedMatch interface
        const mapped: RankedMatch[] = (data || []).map((row: any) => ({
          id: row.id,
          name: row.name,
          age: row.age,
          city: row.city,
          gender: row.gender as Gender,
          orientation: row.orientation as Orientation,
          bio: "",
          img: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&q=80",
          answers: { q1: "A", q2: "A", q3: "A", q4: "A", q5: "A", q6: "A" },
          cognitive_depth: row.cognitive_depth,
          conscientiousness: row.conscientiousness,
          extraversion: row.extraversion,
          attachment_style: row.attachment_style || "Secure",
          avg_response_time: row.avg_response_time || 3.0,
          top_priority: row.top_priority || "",
          distanceKm: row.distance ? Math.round(row.distance * 100) : undefined,
          coords: row.latitude && row.longitude ? { lat: row.latitude, lon: row.longitude } : undefined,
        }));

        setLiveCandidates(mapped);

        // Fetch matches where user is a participant to check for sent messages
        const { data: myMatches } = await supabase
          .from("matches")
          .select("id, user_p, user_q")
          .or(`user_p.eq.${p.id},user_q.eq.${p.id}`);

        const matchIdToPartnerId = new Map<string, string>();
        if (myMatches) {
          myMatches.forEach((m: any) => {
            const partnerId = m.user_p === p.id ? m.user_q : m.user_p;
            matchIdToPartnerId.set(m.id, partnerId);
          });
        }

        const matchIds = Array.from(matchIdToPartnerId.keys());
        const initiatedPartners = new Set<string>();

        if (matchIds.length > 0) {
          const { data: sentMessages } = await supabase
            .from("messages")
            .select("match_id")
            .in("match_id", matchIds)
            .eq("sender_id", p.id);

          if (sentMessages) {
            sentMessages.forEach((msg: any) => {
              const partnerId = matchIdToPartnerId.get(msg.match_id);
              if (partnerId) {
                initiatedPartners.add(partnerId);
              }
            });
          }
        }
        setInitiatedMatchIds(initiatedPartners);
      } catch (err) {
        console.error("Market fetch failed:", err);
      } finally {
        setIsLoadingMarket(false);
      }
    }
    fetchLiveMarket();
  }, [profile]);

  const rankedMatches = useMemo(() => {
    if (!profile) return [];
    const baseMatches = rankMatches(profile, liveCandidates);
    if (sortBy === "distance") {
      return [...baseMatches].sort((a, b) => {
        const distA = a.distanceKm ?? 9999;
        const distB = b.distanceKm ?? 9999;
        return distA - distB;
      });
    }
    return baseMatches;
  }, [profile, sortBy, liveCandidates]);

  const inConversation = useMemo(
    () => new Set(conversations.map((c) => c.matchId)),
    [conversations],
  );

  function pickNextMatch(): RankedMatch | null {
    return rankedMatches.find((m) => !excluded.has(m.id) && !inConversation.has(m.id)) ?? null;
  }

  function goToNextMatch() {
    setScreen("noOne");
  }

  function onChamberSuccess(match: RankedMatch, blurLevel: number) {
    const conv: Conversation = {
      id: `c-${match.id}-${Date.now()}`,
      matchId: match.id,
      blurLevel,
      messages: [],
      unread: false,
      createdAt: Date.now(),
    };
    setConversations((cs) => [conv, ...cs]);
    setActiveConversationId(conv.id);
    setScreen("thread");
  }

  function onChamberDiscard(matchId: string) {
    setExcluded((s) => new Set(s).add(matchId));
    setActiveMatchId(null);
    setScreen("noOne");
    setRedemptionQuota(3);
    if (profile) {
      setProfile({
        ...profile,
        redemptionQuota: 3,
      });
    }
    haptic("warning");
  }

  function updateConversation(id: string, patch: (c: Conversation) => Conversation) {
    setConversations((cs) => cs.map((c) => (c.id === id ? patch(c) : c)));
  }

  function endConversation(id: string) {
    const c = conversations.find((x) => x.id === id);
    if (c) setExcluded((s) => new Set(s).add(c.matchId));
    setConversations((cs) => cs.filter((x) => x.id !== id));
    setActiveConversationId(null);
    setScreen("messages");
  }

  const activeMatch = activeMatchId
    ? (rankedMatches.find((m) => m.id === activeMatchId) ?? null)
    : null;
  const activeConversation = activeConversationId
    ? (conversations.find((c) => c.id === activeConversationId) ?? null)
    : null;
  const activeConversationMatch = activeConversation
    ? (liveCandidates.find((m) => m.id === activeConversation.matchId) ?? null)
    : null;

  const hasAnswers = profile?.cognitiveDepth !== undefined;
  const onboardingScreens: Screen[] = [
    "landing",
    "liveness",
    "profile",
    "snippets-onboarding",
    "briefing",
    "mirror",
    "bankroll",
    "pressure",
  ];
  const focusScreens: Screen[] = ["test", "chamber", "thread"];
  const showNav =
    profile !== null && !onboardingScreens.includes(screen) && !focusScreens.includes(screen);
  const unreadCount = conversations.filter((c) => c.unread).length;

  // Removed proactive mic priming on startup to support Just-in-Time (JIT) permissions

  function goHome() {
    haptic("tap");
    if (profile && hasAnswers) {
      goToNextMatch();
    } else if (profile) {
      setScreen("briefing");
    } else {
      setScreen("landing");
    }
  }
  function goTest() {
    haptic("tap");
    if (!profile) {
      setScreen("landing");
      return;
    }
    // Once the cognitive test is complete, lock re-entry — the user keeps
    // their original Cognitive DNA and the Test icon is hidden from the nav.
    if (hasAnswers) {
      goToNextMatch();
      return;
    }
    setAnswers({});
    setScreen("briefing");
  }
  function goMessages() {
    haptic("tap");
    setScreen("messages");
  }
  function goSettings() {
    haptic("tap");
    setScreen("settings");
  }
  function goProfile() {
    haptic("tap");
    setScreen("profile-dossier");
  }

  const navActive: "home" | "test" | "messages" | "settings" | "profile" =
    screen === "messages"
      ? "messages"
      : screen === "profile-dossier"
        ? "profile"
        : (
              [
                "settings",
                "legal-terms",
                "legal-privacy",
                "legal-cookies",
                "legal-contact",
              ] as Screen[]
            ).includes(screen)
          ? "settings"
          : "home";

  if (isAuthenticating) {
    return (
      <Shell>
        <AppSplash />
      </Shell>
    );
  }

  return (
    <Shell>
      {screen === "landing" && (
        <Landing
          onGoogle={(profile) => {
            haptic("success");
            setGoogleProfile(profile);
            setScreen("liveness");
          }}
        />
      )}
      {screen === "liveness" && (
        <Liveness
          onDone={(url) => {
            haptic("success");
            setLivenessVideoUrl(url);
            setScreen("profile");
          }}
        />
      )}
      {screen === "profile" && (
        <ProfileForm
          initialName={googleProfile?.name.split(/\s+/)[0] ?? ""}
          onSubmit={(p) => {
            haptic("success");
            setProfile({ ...p, id: authUserId || "00000000-0000-0000-0000-000000000001" });
            setScreen("snippets-onboarding");
          }}
        />
      )}
      {screen === "snippets-onboarding" && (
        <SnippetsOnboarding
          onDone={(urls) => {
            setProfile((prev) => {
              if (!prev) return null;
              return { ...prev, videoUrls: urls };
            });
            setScreen("briefing");
          }}
        />
      )}
      {screen === "briefing" && (
        <Briefing
          onBegin={() => {
            haptic("tap");
            setScreen("mirror");
          }}
        />
      )}

      {screen === "mirror" && (
        <SemanticMirror
          onDone={(depth) => {
            setCognitiveDepth(depth);
            setScreen("bankroll");
          }}
        />
      )}

      {screen === "bankroll" && (
        <div className="flex flex-col items-center">
          <div className="mt-6 flex justify-center h-40 items-center">
            <RadarChart conscientiousness={previewC} extraversion={previewE} size={165} />
          </div>
          <ValueBankroll
            onSliderChange={(c, e) => {
              setPreviewC(c);
              setPreviewE(e);
            }}
            onDone={(c, pList) => {
              try {
                setConscientiousness(c);

                const sloboda = pList?.sloboda ?? 0;
                const rodina = pList?.rodina ?? 0;
                const kariera = pList?.kariera ?? 0;
                const kreativita = pList?.kreativita ?? 0;
                const stabilita = pList?.stabilita ?? 0;

                const derivedExtraversion =
                  (sloboda * 0.8 +
                    rodina * 0.6 +
                    kariera * 0.5 +
                    kreativita * 0.4 +
                    stabilita * 0.2) /
                  100;
                setExtraversion(Math.max(0.1, Math.min(0.9, derivedExtraversion || 0.5)));

                let maxVal = -1;
                let topKey = "rodina";
                Object.entries(pList || {}).forEach(([k, v]) => {
                  const val = Number(v) || 0;
                  if (val > maxVal) {
                    maxVal = val;
                    topKey = k;
                  }
                });
                setTopPriority(topKey);
                setScreen("pressure");
              } catch (err) {
                console.error("[bankroll] onDone failed:", err);
                setScreen("pressure");
              }
            }}
          />
        </div>
      )}

      {screen === "pressure" && (
        <PressureChat
          isOnboarding={true}
          onDone={async (style, rt, isHesitated, scenarioId) => {
            try {
              setAttachmentStyle(style);
              setAvgResponseTime(rt);
              setHesitated(isHesitated);

              if (!profile) throw new Error("Profile not initialized");

              // Build the final UserProfile
              const updated: UserProfile = {
                ...profile,
                cognitiveDepth: cognitiveDepth || 0.5,
                conscientiousness: conscientiousness || 0.5,
                extraversion: extraversion || 0.5,
                attachmentStyle: style,
                avgResponseTime: rt,
                topPriority: topPriority || "rodina",
                hesitated: isHesitated,
                completedPressureScenarios: [scenarioId],
              };
              setProfile(updated);

              // Backend Sync: Batch Upload Videos
              let publicVideoUrls: string[] = [];

              if (updated.id !== "00000000-0000-0000-0000-000000000001") {
                if (updated.videoUrls && updated.videoUrls.length > 0) {
                  const uploadPromises = updated.videoUrls.map(async (url, idx) => {
                    if (!url || !url.startsWith("blob:")) return { slot: idx + 1, url };
                    try {
                      const res = await fetch(url);
                      const blob = await res.blob();
                      const uploadedUrl = await uploadSnippetVideo(updated.id as string, idx + 1, blob);
                      return { slot: idx + 1, url: uploadedUrl };
                    } catch (fetchErr) {
                      console.error(`[Onboarding] Failed to upload snippet ${idx + 1}:`, fetchErr);
                      return { slot: idx + 1, url: null };
                    }
                  });
                  const results = await Promise.all(uploadPromises);

                  const failedCount = results.filter((r) => r.url === null).length;
                  if (failedCount > 0) {
                    console.warn(`[Onboarding] ${failedCount} video snippet uploads failed.`);
                    alert(
                      "Niektoré videá sa nepodarilo nahrať. Budete ich môcť pridať neskôr vo vašom profile.",
                    );
                  }

                  // Collect only the successful URLs
                  publicVideoUrls = results
                    .filter((r) => r.url !== null)
                    .map((r) => r.url as string);

                  // Update local profile with public URLs so they don't break on reload
                  updated.videoUrls = publicVideoUrls;
                  setProfile(updated);
                }

                // Backend Sync: Save Profile
                await saveUserProfile(updated.id as string, updated, publicVideoUrls);
              } else {
                console.warn("[Demo Mode] Skipping backend upload because user is not signed in.");
              }

              // Generate mock legacy answers for the orb seed
              const derivedAnswers: FullAnswers = {
                q1: rt < 2.5 ? "A" : "B",
                q2: (cognitiveDepth || 0.5) > 0.6 ? "A" : "B",
                q3: topPriority === "stabilita" ? "A" : "B",
                q4: topPriority === "rodina" ? "A" : "B",
                q5: (cognitiveDepth || 0.5) > 0.8 ? "A" : "B",
                q6: (conscientiousness || 0.5) > 0.6 ? "A" : "B",
              };
              setAnswers(derivedAnswers);
              setScreen("processing");
            } catch (err: any) {
              console.error("[UPLOAD_FAILED]: CONNECTION_SEVERED", err);
              alert(
                `[ UPLOAD_FAILED ]: CONNECTION_SEVERED\n\nDetail: ${err?.message || JSON.stringify(err)}\n\nOdoslanie zlyhalo. Skús znova.`,
              );
            }
          }}
        />
      )}

      {screen === "processing" && (
        <Processing
          seed={orbSeedFor(userAnswers)}
          archetype={archetypeOf(userAnswers)}
          onDone={() => {
            setScreen("noOne");
          }}
        />
      )}
      {screen === "autoMatch" && (
        <div className="animate-kinetic-fade">
          <AutoMatch
            nextName={pickNextMatch()?.name ?? null}
            hasNext={pickNextMatch() !== null}
            isInitiated={pickNextMatch() ? initiatedMatchIds.has(pickNextMatch()!.id) : false}
            onReady={() => goToNextMatch()}
          />
        </div>
      )}
      {screen === "chamber" && activeMatch && profile && (
        <Chamber
          user={profile}
          match={activeMatch}
          myVideoUrl={livenessVideoUrl ?? undefined}
          onSuccess={(blurLevel) => onChamberSuccess(activeMatch, blurLevel)}
          onDiscard={() => onChamberDiscard(activeMatch.id)}
          onFairInteraction={reduceRedemptionQuota}
        />
      )}
      {screen === "noOne" && profile && (
        <div className="animate-kinetic-fade">
          <Dashboard
            profile={profile}
            matches={rankedMatches}
            sortBy={sortBy}
            onSortChange={setSortBy}
            onSelectMatch={(id) => {
              setActiveMatchId(id);
              setScreen("chamber");
            }}
            onMessages={() => setScreen("messages")}
            hasMessages={conversations.length > 0}
            initiatedMatchIds={initiatedMatchIds}
          />
        </div>
      )}
      {screen === "messages" && (
        <div className="animate-kinetic-fade">
          <MessagesList
            conversations={conversations}
            matches={liveCandidates}
            onOpen={(id) => {
              haptic("tap");
              setActiveConversationId(id);
              setConversations((cs) => cs.map((c) => (c.id === id ? { ...c, unread: false } : c)));
              setScreen("thread");
            }}
            onFindNew={() => {
              haptic("tap");
              goToNextMatch();
            }}
          />
        </div>
      )}
      {screen === "thread" && activeConversation && activeConversationMatch && profile && (
        <MessageThread
          conversation={activeConversation}
          match={activeConversationMatch}
          myVideoUrl={livenessVideoUrl ?? undefined}
          user={profile}
          onUpdateUser={(update) => setProfile(prev => prev ? { ...prev, ...update } : null)}
          onBack={() => setScreen("messages")}
          onEnd={() => endConversation(activeConversation.id)}
          onUpdate={(patch) => updateConversation(activeConversation.id, patch)}
        />
      )}

      {screen === "settings" && profile && (
        <div className="animate-kinetic-fade">
          <SystemConfig
            user={profile!}
            onUpdateUser={setProfile as React.Dispatch<React.SetStateAction<UserProfile | null>>}
            theme={theme}
            onTheme={(m) => {
              haptic("tap");
              setTheme(m);
            }}
            onOpenTerms={() => setScreen("legal-terms")}
            onOpenPrivacy={() => setScreen("legal-privacy")}
            onOpenCookies={() => setScreen("legal-cookies")}
            onOpenContact={() => setScreen("legal-contact")}
          />
        </div>
      )}
      {screen === "legal-terms" && (
        <LegalPage
          title="Podmienky používania"
          onBack={() => setScreen("settings")}
          body={TERMS_BODY}
        />
      )}
      {screen === "legal-privacy" && (
        <LegalPage
          title="Ochrana súkromia (GDPR)"
          onBack={() => setScreen("settings")}
          body={PRIVACY_BODY}
        />
      )}
      {screen === "legal-cookies" && (
        <LegalPage title="Cookies" onBack={() => setScreen("settings")} body={COOKIES_BODY} />
      )}
      {screen === "legal-contact" && (
        <LegalPage title="Kontakt" onBack={() => setScreen("settings")} body={CONTACT_BODY} />
      )}
      {screen === "profile-dossier" && profile && (
        <div className="animate-kinetic-fade">
          <AssetDossier
            user={profile}
            onBack={() => setScreen("autoMatch")}
            onUpdateUser={setProfile}
          />
        </div>
      )}

      {showNav && (
        <BottomNav
          active={navActive}
          unread={unreadCount}
          testDone={hasAnswers}
          onHome={goHome}
          onTest={goTest}
          onMessages={goMessages}
          onSettings={goSettings}
          onProfile={goProfile}
        />
      )}
    </Shell>
  );
}

function BottomNav({
  active,
  unread,
  testDone,
  onHome,
  onTest,
  onMessages,
  onSettings,
  onProfile,
}: {
  active: "home" | "test" | "messages" | "settings" | "profile";
  unread: number;
  testDone: boolean;
  onHome: () => void;
  onTest: () => void;
  onMessages: () => void;
  onSettings: () => void;
  onProfile: () => void;
}) {
  const Item = ({
    id,
    icon,
    label,
    onClick,
    badge,
  }: {
    id: string;
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    badge?: number;
  }) => {
    const is = id === active;
    return (
      <button
        onClick={onClick}
        className="relative flex flex-1 flex-col items-center gap-0.5 py-1.5 transition-all active:scale-90"
      >
        <span
          className={`relative grid size-11 place-items-center transition-all ${is ? "bg-foreground" : ""}`}
        >
          <span className={is ? "text-background" : "text-foreground/55"}>{icon}</span>
        </span>
        <span
          className={`font-mono text-[9px] font-bold tracking-widest uppercase ${is ? "text-foreground" : "text-foreground/45"}`}
        >
          {label}
        </span>
        {!!badge && badge > 0 && (
          <span className="absolute right-[22%] top-0 grid size-4 place-items-center text-[9px] font-bold text-background bg-foreground ring-2 ring-card font-mono">
            {badge}
          </span>
        )}
      </button>
    );
  };
  return (
    <nav className="fixed inset-x-0 bottom-3 z-40 px-4">
      <div className="mx-auto flex max-w-md items-stretch border border-border bg-card px-2 py-2">
        <Item
          id="home"
          icon={<Home className="size-5" />}
          label={testDone ? "Matche" : "Domov"}
          onClick={onHome}
        />
        {!testDone && (
          <Item id="test" icon={<Brain className="size-5" />} label="Test" onClick={onTest} />
        )}
        <Item
          id="messages"
          icon={<MessageCircle className="size-5" />}
          label="Správy"
          onClick={onMessages}
          badge={unread}
        />

        {testDone && (
          <>
            <div className="w-[1px] bg-foreground/15 self-stretch my-1.5 mx-1" />
            <Item id="profile" icon={<User className="size-5" />} label="DNA" onClick={onProfile} />
            <Item
              id="settings"
              icon={<SettingsIcon className="size-5" />}
              label="Nastav."
              onClick={onSettings}
            />
          </>
        )}
        {!testDone && (
          <>
            <div className="w-[1px] bg-foreground/15 self-stretch my-1.5 mx-1" />
            <Item
              id="settings"
              icon={<SettingsIcon className="size-5" />}
              label="Nastav."
              onClick={onSettings}
            />
          </>
        )}
      </div>
    </nav>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid place-items-center">
        <Wave size={48} />
      </div>
      <span className="text-2xl font-light tracking-[0.3em]">RESON</span>
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`cta-gradient cta-gradient-hover py-4 text-xs tracking-widest uppercase font-mono font-bold active:scale-[0.97] hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed ${className ?? ""}`}
    >
      <span className="relative z-10 inline-flex items-center justify-center gap-2">
        {children}
      </span>
    </button>
  );
}

function Landing({
  onGoogle,
}: {
  onGoogle: (profile: GoogleProfile) => void;
}) {
  const haptic = useHaptic();
  return (
    <div className="relative flex min-h-[88vh] flex-col items-center justify-center px-4 text-center animate-fade-up overflow-hidden">
      {/* Background Liquid Sonar */}
      <div className="absolute inset-0 pointer-events-none grid place-items-center opacity-[0.06] dark:opacity-[0.03] overflow-hidden">
        <div className="animate-liquid-sonar scale-[2] md:scale-[2.4]">
          <Wave size={400} intense />
        </div>
      </div>
      <div className="relative z-10 flex flex-col items-center max-w-sm w-full">
        {/* Terminal Header */}
        <div className="border border-foreground/20 px-4 py-2 font-mono text-[10px] tracking-widest text-foreground/50 mb-4 uppercase">
          RESON // SECURE COGNITIVE
        </div>

        <h1 className="font-sans text-5xl font-black uppercase tracking-tighter text-foreground">
          Reson
        </h1>
        <div className="mt-4 text-sm font-medium leading-relaxed text-foreground/75 font-mono min-h-[75px]">
          <EncryptedText
            text="SPOZNAJ DRUHÝCH SKÔR, NEŽ ICH UVIDÍŠ."
            encryptedClassName="text-foreground/30"
            revealedClassName="text-foreground font-bold"
            revealDelayMs={40}
          />
          <span className="block mt-1 text-foreground/50">
            <EncryptedText
              text="ŽIADNE SWIPOVANIE. IBA HLAS."
              encryptedClassName="text-foreground/20"
              revealedClassName="text-foreground/70"
              revealDelayMs={60}
            />
          </span>
          <span className="block mt-3 text-[9px] text-foreground/35 uppercase tracking-wider">
            // EV(Compatibility) = 0.6 * Similarity(depth, conscientiousness) + 0.4 *
            Complementarity(extraversion)
          </span>
        </div>

        <div className="mt-10 w-full">
          <GoogleSignInButton onSuccess={onGoogle} />

          <div className="mt-5 text-[10px] font-mono tracking-wider text-foreground/40 uppercase">
            // LEN OVERENÍ ĽUDIA · DECENTRALIZOVANÁ KVALITA
          </div>
        </div>
      </div>
    </div>
  );
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
}

function Liveness({ onDone }: { onDone: (videoUrl: string | null) => void }) {
  const haptic = useHaptic();
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [phase, setPhase] = useState<
    "idle" | "countdown" | "recording" | "verifying" | "ready" | "error"
  >("idle");
  const [countdown, setCountdown] = useState(3);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState("");
  const [faceModel, setFaceModel] = useState<any>(null);
  const [modelLoading, setModelLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function initModel() {
      try {
        await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js");
        await loadScript(
          "https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface@0.0.7/dist/blazeface.min.js",
        );

        // @ts-ignore
        const model = await window.blazeface.load();
        if (active) {
          setFaceModel(model);
          setModelLoading(false);
          console.info("[liveness] BlazeFace neural network initialized.");
        }
      } catch (err) {
        console.error("[liveness] Failed to load BlazeFace from CDN:", err);
        if (active) {
          setModelLoading(false);
        }
      }
    }
    initModel();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        stopStream(streamRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream || phase === "ready") return;
    attachStreamToVideo(el, stream);
  }, [stream, phase]);

  useEffect(() => {
    if (phase !== "ready" || !recordedUrl) return;
    const el = previewRef.current;
    if (!el) return;
    el.load();
    el.play().catch(() => {
      /* autoplay policy */
    });
  }, [phase, recordedUrl]);

  function checkCameraFeedQuality(video: HTMLVideoElement): boolean {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d");
      if (!ctx) return true;
      ctx.drawImage(video, 0, 0, 64, 64);
      const imgData = ctx.getImageData(0, 0, 64, 64);
      const data = imgData.data;

      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        sum += brightness;
      }
      const avgBrightness = sum / (data.length / 4);

      if (avgBrightness < 15 || avgBrightness > 245) {
        console.warn("[liveness] extreme brightness check fallback triggered:", avgBrightness);
        return false;
      }

      let varianceSum = 0;
      const pixelCount = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        varianceSum += Math.abs(brightness - avgBrightness);
      }
      const avgVariance = varianceSum / pixelCount;
      if (avgVariance < 10) {
        console.warn("[liveness] flat detail fallback trigger:", avgVariance);
        return false;
      }
      return true;
    } catch (e) {
      return true;
    }
  }

  async function runScan() {
    haptic("tap");
    setPhase("countdown");

    try {
      const s = await openCamera({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = s;
      setStream(s);
      await new Promise((r) => setTimeout(r, 150));

      for (let n = 3; n >= 1; n--) {
        setCountdown(n);
        await new Promise((r) => setTimeout(r, 800));
        haptic("tap");
      }

      setPhase("recording");
      const { blob } = await recordStreamForMs(streamRef.current, 3000, "video");
      haptic("phase");

      if (blob.size > 100) {
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        setPhase("verifying");
        await new Promise((r) => setTimeout(r, 1800));

        let faceDetected = false;

        if (faceModel && videoRef.current) {
          try {
            const predictions = await faceModel.estimateFaces(videoRef.current, false);
            faceDetected = predictions.length > 0;
          } catch (detErr) {
            faceDetected = checkCameraFeedQuality(videoRef.current);
          }
        } else {
          if (videoRef.current) faceDetected = checkCameraFeedQuality(videoRef.current);
          else faceDetected = true;
        }

        stopStream(streamRef.current);
        streamRef.current = null;
        setStream(null);

        if (faceDetected) {
          haptic("success");
          setPhase("ready");
        } else {
          setErrMsg(
            "Overenie zlyhalo. Na videu sa nepodarilo nájsť reálnu ľudskú tvár. Uisti sa, že tvoj objektív nie je zakrytý, je v miestnosti dostatok svetla a tvoju tvár je jasne vidieť.",
          );
          setPhase("error");
        }
      } else {
        if (streamRef.current) stopStream(streamRef.current);
        setErrMsg("Nahrávanie sa nepodarilo. Skús znovu.");
        setPhase("error");
      }
    } catch (err) {
      if (streamRef.current) stopStream(streamRef.current);
      setErrMsg("Nahrávanie sa nepodarilo. Skús znova.");
      setPhase("error");
    }
  }

  function retake() {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    setErrMsg("");
    setPhase("idle");
    stopStream(streamRef.current);
    streamRef.current = null;
    setStream(null);
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center text-center animate-fade-up">
      <div className="border border-foreground/20 p-8 max-w-sm w-full bg-card flex flex-col items-center">
        <h2 className="font-mono text-lg tracking-widest uppercase font-bold text-foreground mb-2">
          LIVE SNIPPET
        </h2>
        <p className="text-sm text-foreground/60 leading-relaxed mb-6">
          Krátky 3-sekundový video-snippet, ktorý slúži ako verifikácia vašej reálnej identity.
        </p>

        <div className="relative my-6 grid place-items-center">
          <div className="relative w-56 aspect-[3/4] overflow-hidden border border-foreground/25 bg-black">
            {phase !== "ready" && stream && (
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-contain"
                style={{ transform: "scaleX(-1)" }}
              />
            )}
            {phase !== "ready" && !stream && (
              <div className="absolute inset-0 grid place-items-center bg-foreground/5 text-foreground/20">
                {modelLoading ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="size-6 animate-spin border border-foreground border-t-transparent" />
                    <span className="text-[9px] tracking-wider text-foreground/80 font-mono uppercase">
                      ANALYZÁTOR...
                    </span>
                  </div>
                ) : (
                  <User className="size-16 animate-pulse" />
                )}
              </div>
            )}
            {phase === "ready" && recordedUrl && (
              <video
                ref={previewRef}
                src={recordedUrl}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-contain"
                style={{ transform: "scaleX(-1)" }}
              />
            )}
            {phase === "countdown" && (
              <div className="absolute inset-0 grid place-items-center bg-foreground/10 backdrop-blur-sm">
                <span className="font-mono text-5xl text-foreground font-black">{countdown}</span>
              </div>
            )}
            {phase === "recording" && (
              <div className="absolute inset-x-0 top-3 mx-auto w-fit bg-red-600 px-3 py-1 font-mono text-[9px] tracking-widest text-white uppercase font-bold">
                ● REC
              </div>
            )}
            {phase === "verifying" && (
              <div className="absolute inset-0 bg-foreground/10 pointer-events-none grid place-items-center">
                <span className="text-[9px] font-mono tracking-widest text-foreground animate-pulse font-bold">
                  OVERUJEM...
                </span>
              </div>
            )}
          </div>
        </div>

        <p className="font-mono text-xs tracking-widest text-foreground/50 uppercase mb-4">
          {phase === "idle" && "[ NEAKTÍVNY ]"}
          {phase === "countdown" && "[ PRIPRAV SA ]"}
          {phase === "recording" && "[ NAHRÁVAM ]"}
          {phase === "verifying" && "[ VERIFIKÁCIA ]"}
          {phase === "ready" && "[ PRIPRAVENÝ ]"}
          {phase === "error" && "[ CHYBA OVERENIA ]"}
        </p>

        {phase === "error" && <p className="text-xs text-red-500 mb-6 leading-relaxed">{errMsg}</p>}

        <div className="w-full space-y-2">
          {(phase === "idle" || phase === "error") && (
            <button
              disabled={modelLoading}
              onClick={() => {
                if (phase === "error") retake();
                else runScan();
              }}
              className="w-full bg-foreground text-background font-mono font-bold text-lg tracking-wider uppercase py-4.5 hover:bg-foreground/90 disabled:opacity-20 transition-all flex items-center justify-center gap-2"
            >
              <Camera className="size-5" />
              {modelLoading ? "ČAKAJTE..." : phase === "error" ? "SKÚSIŤ ZNOVU" : "NAHRAŤ SNIPPET"}
            </button>
          )}
          {phase === "ready" && (
            <>
              <button
                onClick={() => onDone(recordedUrl)}
                className="w-full bg-foreground text-background font-mono font-bold text-lg tracking-wider uppercase py-4.5 hover:bg-foreground/90 transition-all"
              >
                POKRAČOVAŤ
              </button>
              <button
                onClick={retake}
                className="w-full border border-foreground/20 py-3.5 text-sm tracking-widest text-foreground/60 hover:bg-foreground/5 font-bold font-mono uppercase"
              >
                ZRUŠIŤ
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Briefing({ onBegin }: { onBegin: () => void }) {
  return (
    <div className="relative flex min-h-[80vh] flex-col items-center justify-center px-4 text-center animate-fade-up">
      <div className="border border-foreground/20 p-8 max-w-sm w-full bg-card flex flex-col items-center">
        <div className="font-mono text-[11px] tracking-widest text-foreground/50 uppercase mb-4">
          // PSYCHOMETRICKÁ KALIBRÁCIA · ~2 MIN
        </div>
        <h2 className="font-sans text-2xl font-black uppercase tracking-tight text-foreground mb-4">
          Kalibrácia profilu
        </h2>
        <p className="text-sm leading-relaxed text-foreground/80 mb-6">
          Prejdi 3 zážitkovými testami: dopĺňanie metafor, alokácia životných hodnôt a reakcia na
          náhlu konfliktnú situáciu.
        </p>
        <p className="text-xs leading-relaxed text-foreground/50 font-mono mb-8 uppercase">
          Tento proces vypočíta tvoju rezonančnú kompatibilitu na základe psychologického
          očakávania.
        </p>
        <button
          onClick={onBegin}
          className="w-full bg-foreground text-background font-mono font-bold text-lg tracking-wider uppercase py-4.5 hover:bg-foreground/90 transition-all"
        >
          ZAČAŤ KALIBRÁCIU
        </button>
      </div>
    </div>
  );
}

interface MatchCardProps {
  match: RankedMatch;
  profile: UserProfile;
  similarityPct: number;
  extLabel: string;
  attachmentLabel: string;
  isSecureMatch: boolean;
  initiatedMatchIds?: Set<string>;
  onSelectMatch: (id: string) => void;
}

function MatchCard({
  match,
  profile,
  similarityPct,
  extLabel,
  attachmentLabel,
  isSecureMatch,
  initiatedMatchIds,
  onSelectMatch,
}: MatchCardProps) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const haptic = useHaptic();

  const handleStart = (clientX: number) => {
    startX.current = clientX;
    setIsDragging(true);
  };

  const handleMove = (clientX: number) => {
    if (!isDragging) return;
    const diff = clientX - startX.current;
    const clampedDiff = Math.max(-140, Math.min(140, diff));
    setDragX(clampedDiff);
  };

  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (dragX < -100) {
      haptic("warning");
      // Snap back on release
      setDragX(0);
    } else {
      setDragX(0);
    }
  };

  return (
    <div
      onTouchStart={(e) => handleStart(e.touches[0].clientX)}
      onTouchMove={(e) => handleMove(e.touches[0].clientX)}
      onTouchEnd={handleEnd}
      onMouseDown={(e) => handleStart(e.clientX)}
      onMouseMove={(e) => {
        if (e.buttons === 1) handleMove(e.clientX);
      }}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      style={{
        transform: `translate3d(${dragX}px, 0, 0) translateZ(0)`,
        transition: isDragging
          ? "none"
          : "transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        cursor: isDragging ? "grabbing" : "grab",
        touchAction: "pan-y",
      }}
      className="border border-foreground/10 bg-card p-6 relative overflow-hidden hover:border-foreground/30 select-none will-change-transform"
    >
      {/* Match Score Badge */}
      <div className="absolute top-4 right-4 bg-foreground/10 border border-foreground/20 px-2.5 py-1 font-mono text-[10px] font-bold text-foreground tracking-widest pointer-events-none">
        ZHODA {Math.round(match.score)}%
      </div>

      <div className="flex gap-4 items-start mb-6 pointer-events-none">
        {/* Blurred video avatar with CCTV aesthetics */}
        <div className="relative size-16 shrink-0 overflow-hidden border border-foreground/25 rounded-none bg-black">
          {match.videoUrls && match.videoUrls.length > 0 ? (
            <video
              src={match.videoUrls[0]}
              autoPlay
              loop
              muted
              playsInline
              className="size-full object-contain bg-black blur-[5px]"
            />
          ) : (
            <img
              src={match.img}
              alt={match.name}
              className="size-full object-cover blur-md scale-125"
            />
          )}
          {/* CCTV Overlay Indicator */}
          <div className="absolute top-0.5 left-0.5 flex items-center gap-0.5 bg-black/65 px-1 py-0.5">
            <span className="size-1 animate-pulse rounded-full bg-red-500" />
            <span className="font-mono text-[6px] tracking-tighter text-white">LIVE</span>
          </div>
        </div>
        <div className="min-w-0 pr-16">
          <h3 className="text-lg font-bold text-foreground leading-tight">
            {match.name},{" "}
            <span className="text-foreground/60 font-light">{match.age}</span>
          </h3>
          <p className="font-mono text-[9px] tracking-widest text-foreground/45 uppercase mt-0.5 flex flex-wrap items-center gap-1.5">
            <span>{match.city}</span>
            {match.distanceKm !== undefined && (
              <>
                <span>•</span>
                <span>{Math.round(match.distanceKm)} km</span>
              </>
            )}
            {match.isAutoExpanded && (
              <span className="bg-amber-500/15 border border-amber-500/30 px-1 py-0.5 text-[8px] font-bold text-amber-600 dark:text-amber-500 rounded-none tracking-normal">
                [ROZŠÍRENÝ OKRUH]
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Micro-bio */}
      <p className="text-xs text-foreground/70 leading-relaxed mb-6 italic bg-foreground/[0.02] border border-foreground/10 p-3 font-mono pointer-events-none">
        &ldquo;{match.bio}&rdquo;
      </p>

      {/* Compatibility Metrics */}
      <div className="space-y-3.5 mb-6 border-t border-foreground/10 pt-5 pointer-events-none">
        {/* Similarity metric */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] uppercase font-mono tracking-wider text-foreground/50">
            <span>Kognitívna zhoda</span>
            <span className="text-foreground font-bold">{similarityPct}%</span>
          </div>
          <div className="h-[3px] w-full bg-foreground/10 overflow-hidden">
            <div
              className="h-full bg-foreground transition-all duration-500"
              style={{ width: `${similarityPct}%` }}
            />
          </div>
        </div>

        {/* Complementarity metric */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] uppercase font-mono tracking-wider text-foreground/50">
            <span>Energia</span>
            <span className="text-foreground font-bold">OPTIMÁLNA</span>
          </div>
          <p className="text-[10px] text-foreground/45 font-mono">{extLabel}</p>
        </div>

        {/* Attachment style metric */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] uppercase font-mono tracking-wider text-foreground/50">
            <span>Vzťahová väzba</span>
            <span
              className={`${isSecureMatch ? "text-foreground" : "text-foreground/70"} font-bold`}
            >
              {isSecureMatch ? "KOMPATIBILNÁ" : "ŠTANDARDNÁ"}
            </span>
          </div>
          <p className="text-[10px] text-foreground/45 font-mono">{attachmentLabel}</p>
        </div>
      </div>

      {/* Action button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          haptic("medium");
          onSelectMatch(match.id);
        }}
        className="w-full flex items-center justify-center gap-2 bg-foreground text-background font-mono font-bold py-3.5 active:scale-[0.99] transition-all text-xs tracking-widest uppercase hover:bg-foreground/90 cursor-pointer"
      >
        <MessageCircle className="size-4" />
        <span>
          {initiatedMatchIds?.has(match.id)
            ? "Pokračovať v hlasovom čete"
            : "Vstúpiť do hlasového četu"}
        </span>
      </button>
    </div>
  );
}

function Dashboard({
  profile,
  matches,
  sortBy,
  onSortChange,
  onSelectMatch,
  onMessages,
  hasMessages,
  initiatedMatchIds,
}: {
  profile: UserProfile;
  matches: RankedMatch[];
  sortBy: "ev" | "distance";
  onSortChange: (sort: "ev" | "distance") => void;
  onSelectMatch: (matchId: string) => void;
  onMessages: () => void;
  hasMessages: boolean;
  initiatedMatchIds?: Set<string>;
}) {
  const haptic = useHaptic();

  // Filter matches that are active/available
  const availableMatches = matches.slice(0, 3); // limit to 3 curated daily matches

  return (
    <div className="mx-auto w-full max-w-md px-4 py-8 animate-fade-up relative overflow-hidden">
      {/* Background Liquid Sonar */}
      <div className="absolute inset-0 pointer-events-none grid place-items-center opacity-[0.06] dark:opacity-[0.03] overflow-hidden">
        <div className="animate-liquid-sonar scale-[1.8] md:scale-[2.2]">
          <Wave size={400} intense />
        </div>
      </div>

      {/* Top Header */}
      <div className="mb-8 flex items-center justify-between">
        <Logo />
        <span className="font-mono text-xs tracking-widest text-foreground/45">DASHBOARD</span>
      </div>

      {profile.redemptionQuota && profile.redemptionQuota > 0 ? (
        <div className="mb-6 border border-red-500/30 bg-red-500/5 p-5 relative overflow-hidden animate-fade-in">
          <div className="flex items-center gap-2 mb-2 text-red-500 font-mono font-bold text-xs tracking-widest uppercase">
            <AlertTriangle className="size-4 animate-pulse" />
            <span>Máte aktívnu penalizáciu za predčasný odchod</span>
          </div>
          <p className="text-xs text-foreground/80 leading-relaxed font-mono">
            Uff, to bolo rýchle. V reálnom živote tlačidlo na reštart konfliktu nie je. Systém
            zaznamenal váš útek a dočasne vám znížil skóre dôveryhodnosti. Môžete si ho však
            odpracovať späť – stačí, ak zvládnete ďalšie interakcie bez toho, aby ste ušli.
          </p>
          <div className="mt-3 flex items-center justify-between text-[9px] tracking-widest text-red-500/80 uppercase font-mono border-t border-red-500/10 pt-3">
            <span>Zostávajúce čestné interakcie:</span>
            <span className="font-bold bg-red-500/20 px-2 py-0.5 text-red-400">
              {profile.redemptionQuota} / 3
            </span>
          </div>
        </div>
      ) : null}

      {/* Sort options */}
      <div className="mb-6 flex justify-between items-center border border-foreground/10 bg-card p-3 rounded-none font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
        <span>Zoradiť podľa:</span>
        <div className="flex gap-2">
          <button
            onClick={() => {
              haptic("tap");
              onSortChange("ev");
            }}
            className={`px-2 py-1 border transition-all rounded-none font-bold ${
              sortBy === "ev"
                ? "border-foreground bg-foreground text-background"
                : "border-foreground/15 text-foreground hover:bg-foreground/5"
            }`}
          >
            ZHODA
          </button>
          <button
            onClick={() => {
              haptic("tap");
              onSortChange("distance");
            }}
            className={`px-2 py-1 border transition-all rounded-none font-bold ${
              sortBy === "distance"
                ? "border-foreground bg-foreground text-background"
                : "border-foreground/15 text-foreground hover:bg-foreground/5"
            }`}
          >
            VZDIALENOSŤ
          </button>
        </div>
      </div>

      <div className="space-y-2 mb-8">
        <p className="font-mono text-[9px] tracking-widest text-foreground/45 uppercase">
          // Tvoje dnešné spojenia
        </p>
        <h2 className="font-sans text-3xl font-black tracking-tight text-foreground leading-tight uppercase">
          Algoritmus pre teba vybral
        </h2>
        <p className="text-xs text-foreground/50 leading-relaxed font-mono">
          Profily s najvyššou kompatibilitou vybrané na základe tvojej kognitívnej rezonancie.
        </p>
      </div>

      {availableMatches.length === 0 ? (
        <div className="border border-foreground/10 bg-card p-10 text-center space-y-4">
          <Brain className="mx-auto size-12 text-foreground/30 animate-pulse" />
          <h4 className="text-base font-semibold text-foreground/90 uppercase">
            Žiadne nové matches
          </h4>
          <p className="text-xs text-foreground/50 leading-relaxed font-mono">
            Momentálne sme pre teba nenašli ďalšie profily spĺňajúce prísne kognitívne kritériá.
            Skús to neskôr alebo zmeň nastavenia okruhu.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {availableMatches.map((match) => {
            const similarityPct = Math.round(
              (1.0 -
                Math.sqrt(
                  Math.pow((profile.cognitiveDepth ?? 0.5) - match.cognitive_depth, 2) +
                    Math.pow((profile.conscientiousness ?? 0.5) - match.conscientiousness, 2),
                ) /
                  Math.sqrt(2.0)) *
                100,
            );

            const extSum = (profile.extraversion ?? 0.5) + match.extraversion;
            let extLabel = "Vyvážená energia";
            if (extSum < 0.6) extLabel = "Introvertný súlad";
            else if (extSum > 1.4) extLabel = "Extrovertný súlad";

            const isSecureMatch =
              profile.attachmentStyle === "Secure" && match.attachment_style === "Secure";
            const attachmentLabel = isSecureMatch ? "Bezpečný štýl väzby" : "Bežný štýl väzby";

            return (
              <MatchCard
                key={match.id}
                match={match}
                profile={profile}
                similarityPct={similarityPct}
                extLabel={extLabel}
                attachmentLabel={attachmentLabel}
                isSecureMatch={isSecureMatch}
                initiatedMatchIds={initiatedMatchIds}
                onSelectMatch={onSelectMatch}
              />
            );
          })}
        </div>
      )}

      {hasMessages && (
        <button
          type="button"
          onClick={onMessages}
          className="mt-6 w-full border border-foreground/20 bg-foreground/[0.02] py-4 text-xs tracking-widest text-foreground/70 hover:bg-foreground/5 transition-all uppercase font-mono"
        >
          Zobraziť uložené konverzácie
        </button>
      )}
    </div>
  );
}

// ============ Test ============
// Each question runs as a two-phase staggered timer:
//   PHASE 1 "read"   — 10s, only the scenario is visible (answers hidden).
//   PHASE 2 "choose" — 15s, answers fade in and the user must pick (else random).
const READ_TIME = 10;
const CHOOSE_TIME = 15;

function Test({ onComplete }: { onComplete: (a: FullAnswers) => void }) {
  const scenariosRef = useRef<Scenario[]>(pickScenarios());
  const scenarios = scenariosRef.current;
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [phase, setPhase] = useState<"read" | "choose">("read");
  const [timeLeft, setTimeLeft] = useState(READ_TIME);
  const haptic = useHaptic();
  const s = scenarios[idx];
  const answersRef = useRef(answers);
  answersRef.current = answers;

  // Reset both phases on new question.
  useEffect(() => {
    setPhase("read");
    setTimeLeft(READ_TIME);
  }, [idx]);

  // Subtle warning haptic in the last 3 seconds of the choice phase.
  useEffect(() => {
    if (phase === "choose" && timeLeft <= 3 && timeLeft > 0) haptic("warning");
  }, [phase, timeLeft, haptic]);

  function advance(choice: Answer) {
    const next = { ...answersRef.current, [s.id]: choice } as Answers;
    setAnswers(next);
    if (idx === scenarios.length - 1) onComplete(next as FullAnswers);
    else setIdx(idx + 1);
  }

  // Single 1Hz ticker that drives both phases.
  useEffect(() => {
    const t = setInterval(() => {
      setTimeLeft((v) => {
        if (v > 1) return v - 1;
        // Phase transition.
        if (phase === "read") {
          haptic("phase");
          setPhase("choose");
          return CHOOSE_TIME;
        }
        // Phase 2 timeout — force-pick a random answer.
        const pick: Answer = Math.random() < 0.5 ? "A" : "B";
        advance(pick);
        return 0;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, phase]);

  function pick(choice: Answer) {
    haptic("success");
    advance(choice);
  }

  const total = phase === "read" ? READ_TIME : CHOOSE_TIME;
  const pct = timeLeft / total;
  const danger = phase === "choose" && timeLeft <= 3;

  return (
    <div className="animate-screen-in">
      <div className="mb-5 flex items-center justify-between">
        <span className="font-mono text-xs tracking-widest text-foreground/45">
          {String(idx + 1).padStart(2, "0")} / 06
        </span>
        <span className="font-mono text-[10px] tracking-widest text-foreground/45">
          {phase === "read" ? "ČÍTAJ · DILEMA" : "VYBER · A alebo B"}
        </span>
        <span
          className={`font-mono text-xs tracking-widest font-bold ${danger ? "text-red-500" : "text-foreground"}`}
        >
          {timeLeft}s
        </span>
      </div>

      <div className="mb-3 h-[3px] w-full overflow-hidden bg-foreground/10">
        <div
          className="h-full transition-all duration-500 bg-foreground"
          style={{ width: `${((idx + 1) / scenarios.length) * 100}%` }}
        />
      </div>

      {/* Phase countdown bar */}
      <div className="mb-6 h-[6px] w-full overflow-hidden bg-foreground/10">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${danger ? "bg-red-500" : "bg-foreground"}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>

      <div className="bento-card-glow p-7">
        <p
          className="font-sans text-xl leading-relaxed text-foreground/95 uppercase"
          style={{ letterSpacing: "-0.005em" }}
        >
          {s.text}
        </p>
      </div>

      {phase === "read" ? (
        <p className="mt-6 text-center font-mono text-[10px] tracking-widest text-foreground/45 uppercase">
          MOŽNOSTI SA ODOMKNÚ O {timeLeft}s
        </p>
      ) : (
        <div className="mt-5 grid gap-3 animate-fade-up">
          {(["a", "b"] as const).map((k) => (
            <button
              key={k}
              onClick={() => pick(k.toUpperCase() as Answer)}
              className="group border border-foreground/10 bg-foreground/[0.02] p-5 text-left transition-all active:scale-[0.98] hover:border-foreground/30 hover:bg-foreground/5 cursor-pointer"
            >
              <div className="mb-2 flex items-center gap-3">
                <span className="grid size-7 place-items-center font-mono text-xs font-bold text-background bg-foreground">
                  {k.toUpperCase()}
                </span>
                <div className="h-px flex-1 bg-foreground/10" />
              </div>
              <p className="text-sm font-medium leading-relaxed text-foreground/80 group-hover:text-foreground">
                {s[k]}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ Processing ============
function Processing({
  seed,
  archetype,
  onDone,
}: {
  seed: ReturnType<typeof orbSeedFor>;
  archetype: Archetype;
  onDone: () => void;
}) {
  void archetype;
  const isMobile = useIsMobile();
  const scanSize = isMobile ? 240 : 360;
  const seedNum = useMemo(() => {
    const s = JSON.stringify(seed);
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }, [seed]);
  useEffect(() => {
    const t = setTimeout(onDone, 3600);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="flex min-h-[72vh] flex-col items-center justify-center px-4 text-center sm:min-h-[80vh]">
      <SonarScan size={scanSize} seed={seedNum} period={2200} />
      <p className="mt-7 font-mono text-[10px] tracking-[0.32em] text-foreground/45 sm:mt-10">
        SKENUJEM REZONANČNÉ POLE
      </p>
      <p className="mt-2 font-mono text-[10px] tracking-[0.28em] text-foreground/30">
        HĽADÁM KOGNITÍVNE PROFILY
      </p>
    </div>
  );
}

// ============ Profile form ============
type LocStatus = "idle" | "loading" | "ok" | "denied" | "error";

function ProfileForm({
  onSubmit,
  initialName = "",
}: {
  onSubmit: (p: UserProfile) => void;
  initialName?: string;
}) {
  const haptic = useHaptic();
  const [step, setStep] = useState<
    "SYSTEM_IDENTIFICATION" | "TEMPORAL_MATRIX" | "AGE_VERIFICATION" | "MARKET_ALIGNMENT"
  >("SYSTEM_IDENTIFICATION");

  const [name, setName] = useState(initialName.toUpperCase());
  const [birthDate, setBirthDate] = useState<string>("");
  const [age, setAge] = useState<number | null>(null);
  const [gender, setGender] = useState<Gender | "">("");
  const [targetMarket, setTargetMarket] = useState<"male" | "female" | "all" | "">("");

  // Error flash state
  const [errorFlash, setErrorFlash] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const nameInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Autofocus input fields on step transitions
  useEffect(() => {
    if (step === "SYSTEM_IDENTIFICATION" && nameInputRef.current) {
      nameInputRef.current.focus();
    } else if (step === "TEMPORAL_MATRIX" && dateInputRef.current) {
      dateInputRef.current.focus();
    }
  }, [step]);

  function calculateAge(birthDateString: string): number {
    if (!birthDateString) return 0;
    const today = new Date();
    const birth = new Date(birthDateString);
    let calculatedAge = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      calculatedAge--;
    }
    return calculatedAge;
  }

  function handleBirthDateChange(dateString: string) {
    setBirthDate(dateString);
    const calculatedAge = calculateAge(dateString);
    setAge(calculatedAge);
    if (errorMessage) setErrorMessage("");
  }

  function triggerError(msg: string) {
    haptic("warning");
    setErrorMessage(msg);
    setErrorFlash(true);
    setTimeout(() => setErrorFlash(false), 200);
  }

  const nameTrim = name.trim();
  const isNameValid = nameTrim.length >= 2;
  const isDateValid = !!birthDate;
  const isAgeValid = age !== null && age >= 18 && age <= 99;
  const isAlignmentValid = !!gender && !!targetMarket;

  const progressMap = {
    SYSTEM_IDENTIFICATION: { bar: "■□□□", percent: "25%" },
    TEMPORAL_MATRIX: { bar: "■■□□", percent: "50%" },
    AGE_VERIFICATION: { bar: "■■■□", percent: "75%" },
    MARKET_ALIGNMENT: { bar: "■■■■", percent: "100%" },
  };

  return (
    <div 
      className={`relative flex min-h-[88vh] flex-col items-center justify-center px-4 text-center transition-colors duration-100 ${
        errorFlash ? "bg-red-950/40 border-2 border-red-500" : ""
      }`}
    >
      {/* ASCII Progress Indicator */}
      <div className="absolute top-4 right-4 font-mono text-[10px] tracking-widest text-foreground/45">
        STEP: [{progressMap[step].bar}] {progressMap[step].percent}
      </div>

      {step === "SYSTEM_IDENTIFICATION" && (
        <form 
          key="step-1" 
          onSubmit={(e) => {
            e.preventDefault();
            if (isNameValid) {
              haptic("tap");
              setStep("TEMPORAL_MATRIX");
              setErrorMessage("");
            } else {
              triggerError("ERROR: INVALID_DATA - Name too short");
            }
          }}
          className="animate-kinetic-fade w-full max-w-md"
        >
          <div className="mb-5 flex justify-center">
            <div className="border-2 border-foreground p-4 mb-4 uppercase text-xl font-bold tracking-wider font-mono">
              SYSTEM_IDENTIFICATION
            </div>
          </div>
          <p className="mb-6 font-mono text-xs text-foreground/50 uppercase tracking-widest leading-relaxed">
            Zadajte svoje meno pre systémovú identifikáciu rozhrania.
          </p>

          <div className="text-left border border-foreground/20 bg-card p-6">
            <label className="mb-2 block text-lg font-bold uppercase tracking-wider text-foreground/75 font-mono">
              Meno (Username)
            </label>
            <input
              ref={nameInputRef}
              value={name}
              onChange={(e) => {
                setName(e.target.value.toUpperCase().slice(0, 30));
                if (errorMessage) setErrorMessage("");
              }}
              placeholder="MENO / PREZÝVKA"
              className="w-full border-2 border-foreground bg-foreground/5 p-3 text-lg text-foreground outline-none focus:bg-foreground/10 font-mono uppercase"
            />
          </div>

          {errorMessage && (
            <div className="mt-4 border-2 border-red-500 bg-red-500/10 p-3 text-center font-mono text-xs text-red-500 font-bold uppercase tracking-wider animate-pulse">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            className="mt-6 w-full bg-foreground text-background font-mono font-bold text-lg tracking-wider uppercase py-4.5 hover:bg-foreground/90 transition-all cursor-pointer"
          >
            CONTINUE
          </button>
        </form>
      )}

      {step === "TEMPORAL_MATRIX" && (
        <form 
          key="step-2" 
          onSubmit={(e) => {
            e.preventDefault();
            if (isDateValid) {
              haptic("tap");
              setStep("AGE_VERIFICATION");
              setErrorMessage("");
            } else {
              triggerError("ERROR: INVALID_DATA - Date required");
            }
          }}
          className="animate-kinetic-fade w-full max-w-md"
        >
          <div className="mb-5 flex justify-center">
            <div className="border-2 border-foreground p-4 mb-4 uppercase text-xl font-bold tracking-wider font-mono">
              TEMPORAL_MATRIX
            </div>
          </div>
          <p className="mb-6 font-mono text-xs text-foreground/50 uppercase tracking-widest leading-relaxed">
            Zadajte dátum svojho narodenia na kalibráciu časového indexu.
          </p>

          <div className="text-left border border-foreground/20 bg-card p-6">
            <label className="mb-2 block text-lg font-bold uppercase tracking-wider text-foreground/75 font-mono">
              Dátum narodenia (DD / MM / RRRR)
            </label>
            <input
              ref={dateInputRef}
              type="date"
              value={birthDate}
              onChange={(e) => handleBirthDateChange(e.target.value)}
              className="w-full border-2 border-foreground bg-foreground/5 p-3 text-lg text-foreground outline-none focus:bg-foreground/10 font-mono uppercase"
            />
          </div>

          {errorMessage && (
            <div className="mt-4 border-2 border-red-500 bg-red-500/10 p-3 text-center font-mono text-xs text-red-500 font-bold uppercase tracking-wider animate-pulse">
              {errorMessage}
            </div>
          )}

          <div className="flex gap-2 mt-6">
            <button
              type="button"
              onClick={() => {
                haptic("tap");
                setStep("SYSTEM_IDENTIFICATION");
                setErrorMessage("");
              }}
              className="w-1/3 border border-foreground/20 bg-card text-foreground font-mono font-bold py-4.5 hover:bg-foreground/5 transition-all cursor-pointer uppercase text-sm"
            >
              Späť
            </button>
            <button
              type="submit"
              className="w-2/3 bg-foreground text-background font-mono font-bold text-lg tracking-wider uppercase py-4.5 hover:bg-foreground/90 transition-all cursor-pointer"
            >
              PROCESS_DATES
            </button>
          </div>
        </form>
      )}

      {step === "AGE_VERIFICATION" && (
        <form 
          key="step-3" 
          onSubmit={(e) => {
            e.preventDefault();
            if (isAgeValid) {
              haptic("success");
              setStep("MARKET_ALIGNMENT");
              setErrorMessage("");
            } else {
              triggerError("ERROR: INVALID_DATA - Age criteria failure");
            }
          }}
          className="animate-kinetic-fade w-full max-w-md"
        >
          <div className="mb-5 flex justify-center">
            <div className="border-2 border-foreground p-4 mb-4 uppercase text-xl font-bold tracking-wider font-mono">
              AGE_VERIFICATION
            </div>
          </div>
          <p className="mb-6 font-mono text-xs text-foreground/50 uppercase tracking-widest leading-relaxed">
            Systém preveril časové údaje a určil váš vek.
          </p>

          <div className="text-left border border-foreground/20 bg-card p-6 space-y-4">
            <div className="border-2 border-foreground p-6 bg-foreground/5 font-mono text-center">
              <p className="text-sm text-foreground/50 uppercase tracking-widest mb-2">// DETECTED_AGE</p>
              <div className="text-3xl font-black tracking-tight text-foreground uppercase">
                DETECTED_AGE: [ {age ?? "?"} ]
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="mt-4 border-2 border-red-500 bg-red-500/10 p-3 text-center font-mono text-xs text-red-500 font-bold uppercase tracking-wider animate-pulse">
              {errorMessage}
            </div>
          )}

          <div className="flex gap-2 mt-6">
            <button
              type="button"
              onClick={() => {
                haptic("tap");
                setStep("TEMPORAL_MATRIX");
                setErrorMessage("");
              }}
              className="w-1/3 border border-foreground/20 bg-card text-foreground font-mono font-bold py-4.5 hover:bg-foreground/5 transition-all cursor-pointer uppercase text-sm"
            >
              Späť
            </button>
            <button
              type="submit"
              className="w-2/3 bg-foreground text-background font-mono font-bold text-lg tracking-wider uppercase py-4.5 hover:bg-foreground/90 transition-all cursor-pointer"
            >
              ACKNOWLEDGE_AND_SECURE
            </button>
          </div>
        </form>
      )}

      {step === "MARKET_ALIGNMENT" && (
        <form 
          key="step-4" 
          onSubmit={(e) => {
            e.preventDefault();
            if (isAlignmentValid) {
              haptic("success");

              // Calculate orientation based on gender & targetMarket mapping
              let calculatedOrientation: Orientation = "bi";
              if (targetMarket === "all" || gender === "other") {
                calculatedOrientation = "bi";
              } else if (gender === targetMarket) {
                calculatedOrientation = "homo";
              } else {
                calculatedOrientation = "hetero";
              }

              onSubmit({
                name: nameTrim,
                age: age || 18,
                birthDate: birthDate,
                city: "Bratislava", // Default city fallback (updated in real-time by WatchPosition)
                gender: gender as Gender,
                orientation: calculatedOrientation,
                radiusKm: 250,
              });
            } else {
              triggerError("ERROR: INVALID_DATA - Missing alignment settings");
            }
          }}
          className="animate-kinetic-fade w-full max-w-md"
        >
          <div className="mb-5 flex justify-center">
            <div className="border-2 border-foreground p-4 mb-4 uppercase text-xl font-bold tracking-wider font-mono">
              MARKET_ALIGNMENT
            </div>
          </div>
          <p className="mb-6 font-mono text-xs text-foreground/50 uppercase tracking-widest leading-relaxed">
            Nastavte rezonančné parametre pre matchmaking trh.
          </p>

          <div className="text-left border border-foreground/20 bg-card p-6 space-y-6">
            <div>
              <label className="mb-2 block text-lg font-bold uppercase tracking-wider text-foreground/75 font-mono">
                MY_GENDER
              </label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: "male", label: "MALE" },
                  { value: "female", label: "FEMALE" },
                  { value: "other", label: "NON_BINARY" },
                ] as const).map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => {
                      haptic("tap");
                      setGender(g.value);
                      if (errorMessage) setErrorMessage("");
                    }}
                    className={`border-2 py-3.5 text-xs font-bold tracking-widest font-mono cursor-pointer transition-all ${
                      gender === g.value
                        ? "border-foreground bg-foreground text-background"
                        : "border-foreground/10 bg-transparent text-foreground/60 hover:bg-foreground/5"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-lg font-bold uppercase tracking-wider text-foreground/75 font-mono">
                TARGET_MARKET
              </label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: "male", label: "MALE" },
                  { value: "female", label: "FEMALE" },
                  { value: "all", label: "ALL" },
                ] as const).map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      haptic("tap");
                      setTargetMarket(t.value);
                      if (errorMessage) setErrorMessage("");
                    }}
                    className={`border-2 py-3.5 text-xs font-bold tracking-widest font-mono cursor-pointer transition-all ${
                      targetMarket === t.value
                        ? "border-foreground bg-foreground text-background"
                        : "border-foreground/10 bg-transparent text-foreground/60 hover:bg-foreground/5"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="mt-4 border-2 border-red-500 bg-red-500/10 p-3 text-center font-mono text-xs text-red-500 font-bold uppercase tracking-wider animate-pulse">
              {errorMessage}
            </div>
          )}

          <div className="flex gap-2 mt-6">
            <button
              type="button"
              onClick={() => {
                haptic("tap");
                setStep("AGE_VERIFICATION");
                setErrorMessage("");
              }}
              className="w-1/3 border border-foreground/20 bg-card text-foreground font-mono font-bold py-4.5 hover:bg-foreground/5 transition-all cursor-pointer uppercase text-sm"
            >
              Späť
            </button>
            <button
              type="submit"
              className="w-2/3 bg-foreground text-background font-mono font-bold text-lg tracking-wider uppercase py-4.5 hover:bg-foreground/90 transition-all cursor-pointer"
            >
              INITIALIZE_ALGORITHM
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ============ AutoMatch (algoritmus vyberá) ============
function AutoMatch({
  nextName,
  hasNext,
  isInitiated,
  onReady,
}: {
  nextName: string | null;
  hasNext: boolean;
  isInitiated: boolean;
  onReady: () => void;
}) {
  const haptic = useHaptic();
  useEffect(() => {
    haptic("phase");
    const t = setTimeout(onReady, 2400);
    return () => clearTimeout(t);
  }, [onReady, haptic]);
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center animate-fade-up">
      <Wave size={220} intense />
      <p className="mt-8 font-mono text-xs tracking-widest text-foreground/70 uppercase">
        ALGORITMUS HĽADÁ TVOJU REZONANCIU
      </p>
      <p className="mt-4 text-sm font-light text-foreground/60 font-mono">
        {hasNext
          ? isInitiated
            ? `Pokračujem v hlasovom čete s ${nextName ?? "tvojím partnerom"}…`
            : `Pripravujem priestor s ${nextName ?? "tvojím partnerom"}…`
          : "Hľadám ďalej…"}
      </p>
    </div>
  );
}

// ============ NoOne ============
function NoOne({ onMessages }: { onMessages: (() => void) | null }) {
  return (
    <div className="relative flex min-h-[80vh] flex-col items-center justify-center px-4 text-center animate-fade-up">
      <Blobs variant="warm" />
      <div className="relative z-10 flex flex-col items-center">
        <span className="text-5xl">🌌</span>
        <h3 className="mt-4 font-sans text-2xl font-black tracking-tight text-foreground uppercase">
          Zatiaľ tu pre teba nikto nie je
        </h3>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">
          Algoritmus zvažuje vek, pohlavie aj orientáciu. Nikto nový momentálne nesadol — skús sa
          stavit o chvíľu, ľudia pribúdajú celý deň.
        </p>
        {onMessages && (
          <div className="mt-7 w-full max-w-xs">
            <PillButton onClick={onMessages} variant="ghost">
              Otvoriť správy 💬
            </PillButton>
          </div>
        )}
        <HandNote className="mt-4">občas nás prekvapí, kto sa zjaví ✨</HandNote>
      </div>
    </div>
  );
}

// ============ Chamber (voice 5 min → ContinueGate) ============
const BLUR_START = 24;
const BLUR_STEP = 3;
const MAX_REC_SECONDS = 60;

// ============ Messages list ============
function MessagesList({
  conversations,
  matches,
  onOpen,
  onFindNew,
}: {
  conversations: Conversation[];
  matches: RankedMatch[];
  onOpen: (id: string) => void;
  onFindNew: () => void;
}) {
  return (
    <div className="animate-fade-up">
      <div className="mb-8 flex items-center justify-between">
        <Logo />
        <span className="font-mono text-xs tracking-widest text-foreground/40">SPRÁVY</span>
      </div>

      {conversations.length === 0 ? (
        <div className="border border-foreground/10 bg-foreground/[0.02] p-10 text-center">
          <MessageCircle className="mx-auto size-10 text-foreground/30" />
          <p className="mt-4 text-sm font-light text-foreground/60">
            Zatiaľ žiadne uložené konverzácie.
          </p>
          <p className="mt-2 text-xs text-foreground/40">
            Po úspešnom hlasovom priestore sa tu objaví textový dialóg.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {conversations.map((c) => {
            const m = matches.find((x) => x.id === c.matchId);
            if (!m) return null;
            const last = c.messages[c.messages.length - 1];
            const blurPx = Math.round((c.blurLevel / 100) * BLUR_START);
            return (
              <button
                key={c.id}
                onClick={() => onOpen(c.id)}
                className="group flex items-center gap-4 border border-foreground/10 bg-foreground/[0.02] p-4 text-left transition-all hover:border-foreground/40 hover:bg-foreground/[0.04]"
              >
                <div className="relative size-14 shrink-0 overflow-hidden">
                  <img
                    src={m.img}
                    alt={m.name}
                    className="size-full object-cover"
                    style={{
                      filter: `blur(${blurPx}px) saturate(0.9)`,
                      transform: "scale(1.15)",
                      transition: "filter 500ms ease",
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3
                      className={`truncate text-base ${c.unread ? "font-medium text-foreground" : "font-light text-foreground/90"}`}
                    >
                      {m.name}
                    </h3>
                    <span className="font-mono text-[10px] text-foreground/40">{m.age}</span>
                    <span className="text-[10px] text-foreground/40">· {m.city}</span>
                    {c.unread && <span className="size-2 rounded-full bg-foreground" />}
                  </div>
                  <p className="mt-1 truncate text-sm font-light text-foreground/60">
                    {last
                      ? (last.from === "me" ? "Ty: " : "") + last.text
                      : "Nový dialóg — napíš prvú správu."}
                  </p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-foreground/30 group-hover:text-foreground" />
              </button>
            );
          })}
        </div>
      )}

      <button
        onClick={onFindNew}
        className="mt-8 w-full border border-foreground/30 bg-foreground/[0.05] py-4 text-xs tracking-[0.3em] text-foreground hover:bg-foreground/[0.1]"
      >
        NÁJSŤ ĎALŠIU REZONANCIU
      </button>
    </div>
  );
}

// ============ Message thread (1-na-1 textový chat) ============
const THREAD_BLUR_STEP = 8; // 100 → 0 v ~13 vlastných správach

// Mock GIF search results — small, loopable preview GIFs hosted on a CDN.
const MOCK_GIFS: string[] = [
  "https://media.tenor.com/x8v1oNUOmg4AAAAi/heart-love.gif",
  "https://media.tenor.com/Mxv-AaTHraEAAAAi/wave-hello.gif",
  "https://media.tenor.com/I6kN-6X2HgAAAAAi/sparkle-stars.gif",
  "https://media.tenor.com/CzZjqUyVx8gAAAAi/cat-laptop.gif",
  "https://media.tenor.com/sj7y9LDsQ_kAAAAi/dance-party.gif",
  "https://media.tenor.com/L4Yh1c6jw7AAAAAi/cool-sunglasses.gif",
];
const REPLY_TYPING_MS = 1400;

// ============ Settings + Legal ============
