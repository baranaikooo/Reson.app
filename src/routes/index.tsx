import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Send, Phone, ChevronRight, Sparkles, Play, Pause, Check, X, Camera, MessageCircle, MapPin, ArrowLeft, Home, Brain, Trash2, Settings as SettingsIcon, Sun, Moon, Shield, FileText, Cookie, Mail, Trash, Paperclip, Image as ImageIcon, User, MoreVertical, AlertTriangle } from "lucide-react";
import {
  pickScenarios, MOCK_MATCHES, calcResonance, resonanceBreakdown, catalystFor,
  orbSeedFor, rankMatches, partnerContinueDecision, mockReply, archetypeOf,
  type Scenario,
  type Answer, type Answers, type FullAnswers,
  type UserProfile, type Gender, type Orientation, type RankedMatch,
  type Conversation, type ChatMessage, type Archetype,
} from "@/lib/resonance";

import { SonarScan } from "@/components/SonarScan";
import { GoogleSignInButton, type GoogleProfile } from "@/components/GoogleSignInButton";
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
import { getCurrentUser, onAuthStateChange, supabase } from "@/lib/supabase";
import { SemanticMirror } from "@/components/SemanticMirror";
import { ValueBankroll } from "@/components/ValueBankroll";
import { PressureChat, SCENARIOS } from "@/components/PressureChat";
import { IcebreakerDilemma } from "@/components/IcebreakerDilemma";
import { BlindVote } from "@/components/BlindVote";
import { RadarChart } from "@/components/RadarChart";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Reson — Nájdi svoju kognitívnu rezonanciu" },
      { name: "description", content: "Zoznamovacia aplikácia bez swipovania. Overenie tváre a telefónom, párovanie cez 6-otázkový psychologický test, komunikácia výhradne cez hlasovky." },
      { property: "og:title", content: "Reson — Nájdi svoju kognitívnu rezonanciu" },
      { property: "og:description", content: "Žiadne swipovanie. Iba psychológia." },
    ],
  }),
  component: ResonApp,
});

// ============ Shared UI ============
function Wave({ size = 280, intense = false }: { size?: number; intense?: boolean }) {
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      {[0, 0.6, 1.2].map((d, i) => (
        <span key={i} className="absolute rounded-full border animate-wave"
          style={{ width: size * 0.5, height: size * 0.5, borderColor: "#67e8f9", borderWidth: 1, animationDelay: `${d}s`, opacity: intense ? 0.9 : 0.6 }} />
      ))}
      <span className="absolute rounded-full animate-resonance"
        style={{ width: size * 0.32, height: size * 0.32, background: "radial-gradient(circle, rgba(0,242,254,0.55), rgba(127,0,255,0.15) 60%, transparent 70%)" }} />
      <span className="absolute rounded-full" style={{ width: 14, height: 14, background: "#67e8f9", boxShadow: "0 0 28px #67e8f9" }} />
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-[100dvh] w-full overflow-hidden">
      <div className="mx-auto h-full max-w-2xl overflow-y-auto overscroll-contain px-5 pb-28 pt-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{children}</div>
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
  | "landing" | "verify" | "liveness" | "profile" | "briefing" | "mirror" | "bankroll" | "pressure"
  | "test" | "processing" | "autoMatch" | "chamber" | "noOne"
  | "messages" | "thread"
  | "settings" | "legal-terms" | "legal-privacy" | "legal-cookies" | "legal-contact"
  | "profile-dossier";

type ThemeMode = "dark" | "light";
function useTheme(): [ThemeMode, (m: ThemeMode) => void] {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem("reson:theme") as ThemeMode) || "dark";
  });
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(mode);
    try { localStorage.setItem("reson:theme", mode); } catch { /* ignore */ }
  }, [mode]);
  return [mode, setMode];
}

function ResonApp() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [phone, setPhone] = useState("");
  const [googleProfile, setGoogleProfile] = useState<GoogleProfile | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [livenessVideoUrl, setLivenessVideoUrl] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  
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
    setRedemptionQuota(prev => {
      const next = Math.max(0, prev - 1);
      if (profile) {
        setProfile({
          ...profile,
          redemptionQuota: next
        });
      }
      return next;
    });
  };

  const userAnswers = answers as FullAnswers;
  const haptic = useHaptic();

  // Handle Supabase auth state changes
  useEffect(() => {
    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      console.log('[auth] auth state changed:', event, session?.user?.email);

      if (event === 'SIGNED_IN' && session?.user) {
        const user = session.user;
        const metadata = user.user_metadata;
        const profileData: GoogleProfile = {
          name: metadata?.name || metadata?.full_name || user.email?.split('@')[0] || 'Používateľ',
          email: user.email || '',
          picture: metadata?.avatar_url || metadata?.picture,
        };
        setGoogleProfile(profileData);
        haptic('success');
        setScreen('liveness');
      } else if (event === 'SIGNED_OUT') {
        setGoogleProfile(null);
        setScreen('landing');
      }
    });

    // Check for existing session on mount
    getCurrentUser().then(user => {
      if (user) {
        const metadata = user.user_metadata;
        const profileData: GoogleProfile = {
          name: metadata?.name || metadata?.full_name || user.email?.split('@')[0] || 'Používateľ',
          email: user.email || '',
          picture: metadata?.avatar_url || metadata?.picture,
        };
        setGoogleProfile(profileData);
        // Don't auto-navigate, let user decide
      }
    });

    return () => subscription.unsubscribe();
  }, [haptic]);

  const rankedMatches = useMemo(
    () => profile ? rankMatches(profile, MOCK_MATCHES) : [],
    [profile]
  );

  const inConversation = useMemo(() => new Set(conversations.map(c => c.matchId)), [conversations]);

  function pickNextMatch(): RankedMatch | null {
    return rankedMatches.find(m => !excluded.has(m.id) && !inConversation.has(m.id)) ?? null;
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
    setConversations(cs => [conv, ...cs]);
    setActiveConversationId(conv.id);
    setScreen("thread");
  }

  function onChamberDiscard(matchId: string) {
    setExcluded(s => new Set(s).add(matchId));
    setActiveMatchId(null);
    setScreen("noOne");
    setRedemptionQuota(3);
    if (profile) {
      setProfile({
        ...profile,
        redemptionQuota: 3
      });
    }
    haptic("warning");
  }

  function updateConversation(id: string, patch: (c: Conversation) => Conversation) {
    setConversations(cs => cs.map(c => c.id === id ? patch(c) : c));
  }

  function endConversation(id: string) {
    const c = conversations.find(x => x.id === id);
    if (c) setExcluded(s => new Set(s).add(c.matchId));
    setConversations(cs => cs.filter(x => x.id !== id));
    setActiveConversationId(null);
    setScreen("messages");
  }

  const activeMatch = activeMatchId ? rankedMatches.find(m => m.id === activeMatchId) ?? null : null;
  const activeConversation = activeConversationId ? conversations.find(c => c.id === activeConversationId) ?? null : null;
  const activeConversationMatch = activeConversation ? MOCK_MATCHES.find(m => m.id === activeConversation.matchId) ?? null : null;

  const hasAnswers = profile?.cognitiveDepth !== undefined;
  const onboardingScreens: Screen[] = ["landing", "verify", "liveness", "profile", "briefing", "mirror", "bankroll", "pressure"];
  const focusScreens: Screen[] = ["test", "chamber", "thread"];
  const showNav = profile !== null && !onboardingScreens.includes(screen) && !focusScreens.includes(screen);
  const unreadCount = conversations.filter(c => c.unread).length;
  const [theme, setTheme] = useTheme();

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
    if (!profile) { setScreen("landing"); return; }
    // Once the cognitive test is complete, lock re-entry — the user keeps
    // their original Cognitive DNA and the Test icon is hidden from the nav.
    if (hasAnswers) {
      goToNextMatch();
      return;
    }
    setAnswers({});
    setScreen("briefing");
  }
  function goMessages() { haptic("tap"); setScreen("messages"); }
  function goSettings() { haptic("tap"); setScreen("settings"); }
  function goProfile() { haptic("tap"); setScreen("profile-dossier"); }

  const navActive: "home" | "test" | "messages" | "settings" | "profile" =
    screen === "messages" ? "messages"
    : screen === "profile-dossier" ? "profile"
    : (["settings","legal-terms","legal-privacy","legal-cookies","legal-contact"] as Screen[]).includes(screen) ? (hasAnswers ? "profile" : "settings")
    : "home";

  return (
    <Shell>
      {screen === "landing" && (
        <Landing
          phone={phone}
          setPhone={setPhone}
          theme={theme}
          onTheme={setTheme}
          onNext={() => { haptic("tap"); setGoogleProfile(null); setScreen("verify"); }}
          onGoogle={(profile) => { haptic("success"); setGoogleProfile(profile); setScreen("liveness"); }}
        />
      )}
      {screen === "verify" && <Verify phone={phone} onBack={() => setScreen("landing")} onVerified={() => { haptic("success"); setScreen("liveness"); }} />}
      {screen === "liveness" && <Liveness onDone={(url) => { haptic("success"); setLivenessVideoUrl(url); setScreen("profile"); }} />}
      {screen === "profile" && (
        <ProfileForm
          initialName={googleProfile?.name.split(/\s+/)[0] ?? ""}
          onSubmit={(p) => {
            haptic("success");
            getCurrentUser().then(user => {
              setProfile({ ...p, id: user?.id || "00000000-0000-0000-0000-000000000001" });
            }).catch(() => {
              setProfile({ ...p, id: "00000000-0000-0000-0000-000000000001" });
            });
            setScreen("briefing");
          }}
        />
      )}
      {screen === "briefing" && <Briefing onBegin={() => { haptic("tap"); setScreen("mirror"); }} />}
      
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
                setPriorities(pList);
                
                const sloboda = pList?.sloboda ?? 0;
                const rodina = pList?.rodina ?? 0;
                const kariera = pList?.kariera ?? 0;
                const kreativita = pList?.kreativita ?? 0;
                const stabilita = pList?.stabilita ?? 0;

                const derivedExtraversion = (sloboda * 0.8 + rodina * 0.6 + kariera * 0.5 + kreativita * 0.4 + stabilita * 0.2) / 100;
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
          onDone={(style, rt, isHesitated, scenarioId) => {
            try {
              setAttachmentStyle(style);
              setAvgResponseTime(rt);
              setHesitated(isHesitated);
              
              // Build the final UserProfile
              if (profile) {
                const updated: UserProfile = {
                  ...profile,
                  cognitiveDepth: cognitiveDepth || 0.5,
                  conscientiousness: conscientiousness || 0.5,
                  extraversion: extraversion || 0.5,
                  attachmentStyle: style,
                  avgResponseTime: rt,
                  topPriority: topPriority || "rodina",
                  hesitated: isHesitated,
                  completedPressureScenarios: [scenarioId]
                };
                setProfile(updated);
              }
              
              // Generate mock legacy answers for the orb seed
              const derivedAnswers: FullAnswers = {
                q1: rt < 2.5 ? "A" : "B",
                q2: (cognitiveDepth || 0.5) > 0.6 ? "A" : "B",
                q3: (priorities?.stabilita ?? 0) > (priorities?.sloboda ?? 0) ? "A" : "B",
                q4: (priorities?.rodina ?? 0) > (priorities?.kariera ?? 0) ? "A" : "B",
                q5: (cognitiveDepth || 0.5) > 0.8 ? "A" : "B",
                q6: (conscientiousness || 0.5) > 0.6 ? "A" : "B"
              };
              setAnswers(derivedAnswers);
              setScreen("processing");
            } catch (err) {
              console.error("[pressure] onDone failed, falling back:", err);
              // Fallback to bypass crash
              setScreen("processing");
            }
          }}
        />
      )}

      {screen === "processing" && (
        <Processing seed={orbSeedFor(userAnswers)} archetype={archetypeOf(userAnswers)} onDone={() => { setScreen("noOne"); }} />
      )}
      {screen === "autoMatch" && (
        <AutoMatch nextName={pickNextMatch()?.name ?? null} hasNext={pickNextMatch() !== null} onReady={() => goToNextMatch()} />
      )}
      {screen === "chamber" && activeMatch && (
        <Chamber
          user={profile}
          match={activeMatch}
          myVideoUrl={livenessVideoUrl}
          onSuccess={(blurLevel) => onChamberSuccess(activeMatch, blurLevel)}
          onDiscard={() => onChamberDiscard(activeMatch.id)}
          onFairInteraction={reduceRedemptionQuota}
        />
      )}
      {screen === "noOne" && profile && (
        <Dashboard
          profile={profile}
          matches={rankedMatches}
          onSelectMatch={(id) => { setActiveMatchId(id); setScreen("chamber"); }}
          onMessages={() => setScreen("messages")}
          hasMessages={conversations.length > 0}
        />
      )}
      {screen === "messages" && (
        <MessagesList
          conversations={conversations}
          onOpen={(id) => { haptic("tap"); setActiveConversationId(id); setConversations(cs => cs.map(c => c.id === id ? { ...c, unread: false } : c)); setScreen("thread"); }}
          onFindNew={() => { haptic("tap"); goToNextMatch(); }}
        />
      )}
      {screen === "thread" && activeConversation && activeConversationMatch && profile && (
        <MessageThread
          conversation={activeConversation}
          match={activeConversationMatch}
          myVideoUrl={livenessVideoUrl}
          user={profile}
          onUpdateUser={setProfile}
          onBack={() => setScreen("messages")}
          onEnd={() => endConversation(activeConversation.id)}
          onUpdate={(patch) => updateConversation(activeConversation.id, patch)}
        />
      )}

      {screen === "settings" && (
        <Settings
          theme={theme}
          onTheme={(m) => { haptic("tap"); setTheme(m); }}
          onOpenTerms={() => setScreen("legal-terms")}
          onOpenPrivacy={() => setScreen("legal-privacy")}
          onOpenCookies={() => setScreen("legal-cookies")}
          onOpenContact={() => setScreen("legal-contact")}
        />
      )}
      {screen === "legal-terms" && <LegalPage title="Podmienky používania" onBack={() => setScreen("settings")} body={TERMS_BODY} />}
      {screen === "legal-privacy" && <LegalPage title="Ochrana súkromia (GDPR)" onBack={() => setScreen("settings")} body={PRIVACY_BODY} />}
      {screen === "legal-cookies" && <LegalPage title="Cookies" onBack={() => setScreen("settings")} body={COOKIES_BODY} />}
      {screen === "legal-contact" && <LegalPage title="Kontakt" onBack={() => setScreen("settings")} body={CONTACT_BODY} />}
      {screen === "profile-dossier" && profile && (
        <UserProfileDossier
          user={profile}
          onBack={() => setScreen("settings")}
          onUpdateUser={setProfile}
        />
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

function BottomNav({ active, unread, testDone, onHome, onTest, onMessages, onSettings, onProfile }: {
  active: "home" | "test" | "messages" | "settings" | "profile";
  unread: number;
  testDone: boolean;
  onHome: () => void;
  onTest: () => void;
  onMessages: () => void;
  onSettings: () => void;
  onProfile: () => void;
}) {
  const Item = ({ id, icon, label, onClick, badge }: { id: string; icon: React.ReactNode; label: string; onClick: () => void; badge?: number }) => {
    const is = id === active;
    return (
      <button onClick={onClick} className="relative flex flex-1 flex-col items-center gap-0.5 py-1.5 transition-all active:scale-90">
        <span className={`relative grid size-11 place-items-center transition-all ${is ? "bg-foreground" : ""}`}>
          <span className={is ? "text-background" : "text-foreground/55"}>{icon}</span>
        </span>
        <span className={`font-mono text-[9px] font-bold tracking-widest uppercase ${is ? "text-foreground" : "text-foreground/45"}`}>{label}</span>
        {!!badge && badge > 0 && (
          <span className="absolute right-[22%] top-0 grid size-4 place-items-center text-[9px] font-bold text-background bg-foreground ring-2 ring-card font-mono">{badge}</span>
        )}
      </button>
    );
  };
  return (
    <nav className="fixed inset-x-0 bottom-3 z-40 px-4">
      <div className="mx-auto flex max-w-md items-stretch border border-border bg-card px-2 py-2">
        <Item id="home" icon={<Home className="size-5" />} label={testDone ? "Matche" : "Domov"} onClick={onHome} />
        {!testDone && <Item id="test" icon={<Brain className="size-5" />} label="Test" onClick={onTest} />}
        <Item id="messages" icon={<MessageCircle className="size-5" />} label="Správy" onClick={onMessages} badge={unread} />
        {testDone
          ? <Item id="profile" icon={<User className="size-5" />} label="DNA" onClick={onProfile} />
          : <Item id="settings" icon={<SettingsIcon className="size-5" />} label="Nastav." onClick={onSettings} />}
      </div>
    </nav>
  );
}


function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid place-items-center"><Wave size={48} /></div>
      <span className="text-2xl font-light tracking-[0.3em]">RESON</span>
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled, className }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) {
  return (
    <button disabled={disabled} onClick={onClick}
      className={`cta-gradient cta-gradient-hover py-4 text-xs tracking-widest uppercase font-mono font-bold active:scale-[0.97] hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed ${className ?? ""}`}>
      <span className="relative z-10 inline-flex items-center justify-center gap-2">{children}</span>
    </button>
  );
}

function Landing({ phone, setPhone, theme, onTheme, onNext, onGoogle }: {
  phone: string;
  setPhone: (v: string) => void;
  theme: ThemeMode;
  onTheme: (m: ThemeMode) => void;
  onNext: () => void;
  onGoogle: (profile: GoogleProfile) => void;
}) {
  const valid = phone.replace(/\D/g, "").length >= 8;
  const haptic = useHaptic();
  return (
    <div className="relative flex min-h-[88vh] flex-col items-center justify-center px-4 text-center animate-fade-up">
      <div className="relative z-10 flex flex-col items-center max-w-sm w-full">
        
        {/* Terminal Header */}
        <div className="border border-foreground/20 px-4 py-2 font-mono text-[10px] tracking-widest text-foreground/50 mb-4 uppercase">
          RESON // SECURE COGNITIVE
        </div>

        {/* Theme Toggle option */}
        <div className="mb-6 flex items-center justify-center gap-2">
          <button
            onClick={() => { haptic("tap"); onTheme("light"); }}
            className={`px-3 py-1 font-mono text-[9px] tracking-wider uppercase border transition-all ${
              theme === "light" 
                ? "bg-foreground text-background border-foreground font-bold" 
                : "border-foreground/10 text-foreground/45 hover:text-foreground"
            }`}
          >
            LIGHT
          </button>
          <button
            onClick={() => { haptic("tap"); onTheme("dark"); }}
            className={`px-3 py-1 font-mono text-[9px] tracking-wider uppercase border transition-all ${
              theme === "dark" 
                ? "bg-foreground text-background border-foreground font-bold" 
                : "border-foreground/10 text-foreground/45 hover:text-foreground"
            }`}
          >
            DARK
          </button>
        </div>

        <h1 className="font-sans text-5xl font-black uppercase tracking-tighter text-foreground">
          Reson
        </h1>
        <p className="mt-4 text-sm font-medium leading-relaxed text-foreground/75 font-mono">
          SPOZNAJ DRUHÝCH SKÔR, NEŽ ICH UVIDÍŠ.
          <span className="block mt-1 text-foreground/50">ŽIADNE SWIPOVANIE. IBA HLAS.</span>
          <span className="block mt-3 text-[9px] text-foreground/35 uppercase tracking-wider">
            // EV(Compatibility) = 0.6 * Similarity(depth, conscientiousness) + 0.4 * Complementarity(extraversion)
          </span>
        </p>

        <div className="mt-10 w-full">
          <div className="flex items-center gap-3 border border-foreground/20 bg-card px-4 py-3.5">
            <span className="text-xs font-mono text-foreground/40">TEL //</span>
            <input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="+421 900 000 000"
              className="w-full bg-transparent text-sm font-mono outline-none placeholder:text-foreground/30 text-foreground" />
          </div>
          
          <button 
            onClick={onNext} 
            disabled={!valid} 
            className="mt-4 w-full bg-foreground text-background font-mono font-bold text-xs tracking-widest uppercase py-4 hover:bg-foreground/90 disabled:opacity-20 transition-all"
          >
            POKRAČOVAŤ
          </button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-foreground/15" />
            <span className="text-[10px] font-mono tracking-widest text-foreground/40">ALEBO</span>
            <div className="h-px flex-1 bg-foreground/15" />
          </div>

          <GoogleSignInButton onSuccess={onGoogle} />

          <div className="mt-5 text-[10px] font-mono tracking-wider text-foreground/40 uppercase">
            // LEN OVERENÍ ĽUDIA · DECENTRALIZOVANÁ KVALITA
          </div>
        </div>
      </div>
    </div>
  );
}

function Verify({ phone, onBack, onVerified }: { phone: string; onBack: () => void; onVerified: () => void }) {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const haptic = useHaptic();
  const ok = code.every(c => c !== "");
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center text-center animate-fade-up">
      <div className="border border-foreground/20 p-8 max-w-sm w-full bg-card">
        <h2 className="font-mono text-lg tracking-widest uppercase font-bold text-foreground mb-2">AUTENTIKÁCIA</h2>
        <p className="text-xs text-foreground/50 leading-relaxed mb-8">Kód bol odoslaný na <span className="font-mono text-foreground/90">{phone || "tvoj telefón"}</span></p>
        
        <div className="flex justify-between gap-2 mb-6">
          {code.map((c, i) => (
            <input key={i} value={c} maxLength={1} id={`otp-${i}`}
              onChange={(e) => {
                haptic("tap");
                const next = [...code]; next[i] = e.target.value.replace(/\D/g, ""); setCode(next);
                const el = document.getElementById(`otp-${i+1}`);
                if (next[i] && el) (el as HTMLInputElement).focus();
              }}
              className="h-12 w-10 border border-foreground/20 bg-foreground/5 text-center text-lg font-mono outline-none text-foreground focus:border-foreground" />
          ))}
        </div>

        <button onClick={() => { haptic("tap"); setCode(["1","2","3","4","5","6"]); }}
          className="text-[10px] font-mono text-foreground/45 tracking-wider hover:text-foreground mb-8 block mx-auto uppercase">
          // DOPLNIŤ DEMO KÓD [123456]
        </button>

        <div className="flex gap-2">
          <button onClick={onBack} className="flex-1 border border-foreground/20 py-3 text-xs tracking-widest text-foreground/60 hover:bg-foreground/5 font-semibold font-mono uppercase">
            SPÄŤ
          </button>
          <button onClick={onVerified} disabled={!ok} className="flex-1 bg-foreground text-background py-3 text-xs tracking-widest hover:bg-foreground/90 disabled:opacity-20 font-bold font-mono uppercase">
            OVERIŤ
          </button>
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
  const [phase, setPhase] = useState<"idle" | "countdown" | "recording" | "verifying" | "ready" | "error">("idle");
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
        await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface@0.0.7/dist/blazeface.min.js");

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
    return () => { active = false; };
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
    el.play().catch(() => { /* autoplay policy */ });
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
        const g = data[i+1];
        const b = data[i+2];
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
        const g = data[i+1];
        const b = data[i+2];
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
      const s = await openCamera({ video: { facingMode: "user" }, audio: false });
      streamRef.current = s;
      setStream(s);
      await new Promise(r => setTimeout(r, 150));

      for (let n = 3; n >= 1; n--) {
        setCountdown(n);
        await new Promise(r => setTimeout(r, 800));
        haptic("tap");
      }

      setPhase("recording");
      const { blob } = await recordStreamForMs(streamRef.current, 3000, "video");
      haptic("phase");

      if (blob.size > 100) {
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        setPhase("verifying");
        await new Promise(r => setTimeout(r, 1800));

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
          setErrMsg("Overenie zlyhalo. Na videu sa nepodarilo nájsť reálnu ľudskú tvár. Uisti sa, že tvoj objektív nie je zakrytý, je v miestnosti dostatok svetla a tvoju tvár je jasne vidieť.");
          setPhase("error");
        }
      } else {
        setErrMsg("Nahrávanie sa nepodarilo. Skús znovu.");
        setPhase("error");
      }
    } catch (err) {
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
        <h2 className="font-mono text-lg tracking-widest uppercase font-bold text-foreground mb-2">LIVE SNIPPET</h2>
        <p className="text-xs text-foreground/50 leading-relaxed mb-6">
          Krátky 3-sekundový video-snippet, ktorý slúži ako verifikácia vašej reálnej identity.
        </p>

        <div className="relative my-6 grid place-items-center">
          <div className="relative size-56 overflow-hidden border border-foreground/25">
            {phase !== "ready" && stream && (
              <video ref={videoRef} playsInline muted className="size-full object-cover" style={{ transform: "scaleX(-1)" }} />
            )}
            {phase !== "ready" && !stream && (
              <div className="absolute inset-0 grid place-items-center bg-foreground/5 text-foreground/20">
                {modelLoading ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="size-6 animate-spin border border-foreground border-t-transparent" />
                    <span className="text-[9px] tracking-wider text-foreground/80 font-mono uppercase">ANALYZÁTOR...</span>
                  </div>
                ) : (
                  <User className="size-16 animate-pulse" />
                )}
              </div>
            )}
            {phase === "ready" && recordedUrl && (
              <video ref={previewRef} src={recordedUrl} autoPlay loop muted playsInline
                className="size-full object-cover" style={{ transform: "scaleX(-1)" }} />
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
                <span className="text-[9px] font-mono tracking-widest text-foreground animate-pulse font-bold">OVERUJEM...</span>
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
              onClick={() => { if (phase === "error") retake(); else runScan(); }} 
              className="w-full bg-foreground text-background font-mono font-bold text-xs tracking-widest uppercase py-4 hover:bg-foreground/90 disabled:opacity-20 transition-all flex items-center justify-center gap-2"
            >
              <Camera className="size-4" /> 
              {modelLoading ? "ČAKAJTE..." : (phase === "error" ? "SKÚSIŤ ZNOVU" : "NAHRAŤ SNIPPET")}
            </button>
          )}
          {phase === "ready" && (
            <>
              <button onClick={() => onDone(recordedUrl)} className="w-full bg-foreground text-background font-mono font-bold text-xs tracking-widest uppercase py-4 hover:bg-foreground/90 transition-all">POKRAČOVAŤ</button>
              <button onClick={retake} className="w-full border border-foreground/20 py-3 text-xs tracking-widest text-foreground/60 hover:bg-foreground/5 font-semibold font-mono uppercase">
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
        <div className="font-mono text-[9px] tracking-widest text-foreground/45 uppercase mb-4">
          // PSYCHOMETRICKÁ KALIBRÁCIA · ~2 MIN
        </div>
        <h2 className="font-sans text-2xl font-black uppercase tracking-tight text-foreground mb-4">
          Kalibrácia profilu
        </h2>
        <p className="text-xs leading-relaxed text-foreground/70 mb-6">
          Prejdi 3 zážitkovými testami: dopĺňanie metafor, alokácia životných hodnôt a reakcia na náhlu konfliktnú situáciu.
        </p>
        <p className="text-[10px] text-foreground/40 leading-relaxed font-mono mb-8 uppercase">
          Tento proces vypočíta tvoju rezonančnú kompatibilitu na základe psychologického očakávania.
        </p>
        <button 
          onClick={onBegin}
          className="w-full bg-foreground text-background font-mono font-bold text-xs tracking-widest uppercase py-4 hover:bg-foreground/90 transition-all"
        >
          ZAČAŤ KALIBRÁCIU
        </button>
      </div>
    </div>
  );
}

function Dashboard({
  profile,
  matches,
  onSelectMatch,
  onMessages,
  hasMessages
}: {
  profile: UserProfile;
  matches: RankedMatch[];
  onSelectMatch: (matchId: string) => void;
  onMessages: () => void;
  hasMessages: boolean;
}) {
  const haptic = useHaptic();
  
  // Filter matches that are active/available
  const availableMatches = matches.slice(0, 3); // limit to 3 curated daily matches

  return (
    <div className="mx-auto w-full max-w-md px-4 py-8 animate-fade-up">
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
            Uff, to bolo rýchle. V reálnom živote tlačidlo na reštart konfliktu nie je. Systém zaznamenal váš útek a dočasne vám znížil skóre dôveryhodnosti. Môžete si ho však odpracovať späť – stačí, ak zvládnete ďalšie interakcie bez toho, aby ste ušli.
          </p>
          <div className="mt-3 flex items-center justify-between text-[9px] tracking-widest text-red-500/80 uppercase font-mono border-t border-red-500/10 pt-3">
            <span>Zostávajúce čestné interakcie:</span>
            <span className="font-bold bg-red-500/20 px-2 py-0.5 text-red-400">
              {profile.redemptionQuota} / 3
            </span>
          </div>
        </div>
      ) : null}

      <div className="space-y-2 mb-8">
        <p className="font-mono text-[9px] tracking-widest text-foreground/45 uppercase">// Tvoje dnešné spojenia</p>
        <h2 className="font-sans text-3xl font-black tracking-tight text-foreground leading-tight uppercase">
          Algoritmus pre teba vybral
        </h2>
        <p className="text-xs text-foreground/50 leading-relaxed font-mono">
          Uzavretý trh s maximálnou kompatibilitou. Žiadne nekonečné swajpovanie, iba vybrané profily s najvyššou EV na základe tvojej kognitívnej DNA.
        </p>
      </div>

      {availableMatches.length === 0 ? (
        <div className="border border-foreground/10 bg-card p-10 text-center space-y-4">
          <Brain className="mx-auto size-12 text-foreground/30 animate-pulse" />
          <h4 className="text-base font-semibold text-foreground/90 uppercase">Žiadne nové matches</h4>
          <p className="text-xs text-foreground/50 leading-relaxed font-mono">
            Momentálne sme pre teba nenašli ďalšie profily spĺňajúce prísne psychometrické kritériá. Skús to neskôr alebo zmeň nastavenia okruhu.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {availableMatches.map(match => {
            const similarityPct = Math.round(
              (1.0 - Math.sqrt(
                Math.pow((profile.cognitiveDepth ?? 0.5) - match.cognitive_depth, 2) + 
                Math.pow((profile.conscientiousness ?? 0.5) - match.conscientiousness, 2)
              ) / Math.sqrt(2.0)) * 100
            );

            const extSum = (profile.extraversion ?? 0.5) + match.extraversion;
            let extLabel = "Vyvážená komplementarita";
            if (extSum < 0.6) extLabel = "Tichá harmónia (Introvert + Introvert)";
            else if (extSum > 1.4) extLabel = "Dynamická energia (Extrovert + Extrovert)";

            const isSecureMatch = profile.attachmentStyle === "Secure" && match.attachment_style === "Secure";
            const attachmentLabel = isSecureMatch ? "Maximálne bezpečné" : "Štandardné spojenie";

            return (
              <div
                key={match.id}
                className="border border-foreground/10 bg-card p-6 transition-all duration-300 relative overflow-hidden hover:border-foreground/30"
              >
                {/* Match Score Badge */}
                <div className="absolute top-4 right-4 bg-foreground/10 border border-foreground/20 px-2.5 py-1 font-mono text-[10px] font-bold text-foreground tracking-widest">
                  EV {Math.round(match.score)}%
                </div>

                <div className="flex gap-4 items-start mb-6">
                  {/* Blurred video avatar with CCTV aesthetics */}
                  <div className="relative size-16 shrink-0 overflow-hidden border border-foreground/25 rounded-none bg-black">
                    {match.videoUrls && match.videoUrls.length > 0 ? (
                      <video
                        src={match.videoUrls[0]}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="size-full object-cover blur-[5px] scale-110"
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
                      {match.name}, <span className="text-foreground/60 font-light">{match.age}</span>
                    </h3>
                    <p className="font-mono text-[9px] tracking-widest text-foreground/45 uppercase mt-0.5">
                      {match.city}
                    </p>
                  </div>
                </div>

                {/* Micro-bio */}
                <p className="text-xs text-foreground/70 leading-relaxed mb-6 italic bg-foreground/[0.02] border border-foreground/10 p-3 font-mono">
                  &ldquo;{match.bio}&rdquo;
                </p>

                {/* Compatibility Metrics */}
                <div className="space-y-3.5 mb-6 border-t border-foreground/10 pt-5">
                  {/* Similarity metric */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] uppercase font-mono tracking-wider text-foreground/50">
                      <span>Kognitívna Podoba</span>
                      <span className="text-foreground font-bold">{similarityPct}%</span>
                    </div>
                    <div className="h-[3px] w-full bg-foreground/10 overflow-hidden">
                      <div className="h-full bg-foreground transition-all duration-500" style={{ width: `${similarityPct}%` }} />
                    </div>
                  </div>

                  {/* Complementarity metric */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] uppercase font-mono tracking-wider text-foreground/50">
                      <span>Komplementarita</span>
                      <span className="text-foreground font-bold">OPTIMÁLNA</span>
                    </div>
                    <p className="text-[10px] text-foreground/45 font-mono">{extLabel}</p>
                  </div>

                  {/* Attachment style metric */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] uppercase font-mono tracking-wider text-foreground/50">
                      <span>Citové Bezpečie</span>
                      <span className={`${isSecureMatch ? "text-foreground" : "text-foreground/70"} font-bold`}>
                        {isSecureMatch ? "BEZPEČNÉ" : "STABILNÉ"}
                      </span>
                    </div>
                    <p className="text-[10px] text-foreground/45 font-mono">{attachmentLabel}</p>
                  </div>
                </div>

                {/* Action button */}
                <button
                  type="button"
                  onClick={() => { haptic("medium"); onSelectMatch(match.id); }}
                  className="w-full flex items-center justify-center gap-2 bg-foreground text-background font-mono font-bold py-3.5 active:scale-[0.99] transition-all text-xs tracking-widest uppercase hover:bg-foreground/90"
                >
                  <MessageCircle className="size-4" />
                  <span>Vstúpiť do hlasového četu</span>
                </button>
              </div>
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
        <span className="font-mono text-xs tracking-widest text-foreground/45">{String(idx + 1).padStart(2, "0")} / 06</span>
        <span className="font-mono text-[10px] tracking-widest text-foreground/45">
          {phase === "read" ? "ČÍTAJ · DILEMA" : "VYBER · A alebo B"}
        </span>
        <span className={`font-mono text-xs tracking-widest font-bold ${danger ? "text-red-500" : "text-foreground"}`}>
          {timeLeft}s
        </span>
      </div>

      <div className="mb-3 h-[3px] w-full overflow-hidden bg-foreground/10">
        <div className="h-full transition-all duration-500 bg-foreground"
          style={{ width: `${((idx + 1) / scenarios.length) * 100}%` }} />
      </div>

      {/* Phase countdown bar */}
      <div className="mb-6 h-[6px] w-full overflow-hidden bg-foreground/10">
        <div className={`h-full transition-all duration-1000 ease-linear ${danger ? "bg-red-500" : "bg-foreground"}`}
          style={{ width: `${pct * 100}%` }} />
      </div>

      <div className="bento-card-glow p-7">
        <p className="font-sans text-xl leading-relaxed text-foreground/95 uppercase" style={{ letterSpacing: "-0.005em" }}>{s.text}</p>
      </div>

      {phase === "read" ? (
        <p className="mt-6 text-center font-mono text-[10px] tracking-widest text-foreground/45 uppercase">
          MOŽNOSTI SA ODOMKNÚ O {timeLeft}s
        </p>
      ) : (
        <div className="mt-5 grid gap-3 animate-fade-up">
          {(["a","b"] as const).map((k) => (
            <button key={k}
              onClick={() => pick(k.toUpperCase() as Answer)}
              className="group border border-foreground/10 bg-foreground/[0.02] p-5 text-left transition-all active:scale-[0.98] hover:border-foreground/30 hover:bg-foreground/5 cursor-pointer"
            >
              <div className="mb-2 flex items-center gap-3">
                <span className="grid size-7 place-items-center font-mono text-xs font-bold text-background bg-foreground">
                  {k.toUpperCase()}
                </span>
                <div className="h-px flex-1 bg-foreground/10" />
              </div>
              <p className="text-sm font-medium leading-relaxed text-foreground/80 group-hover:text-foreground">{s[k]}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


// ============ Processing ============
function Processing({ seed, archetype, onDone }: { seed: ReturnType<typeof orbSeedFor>; archetype: Archetype; onDone: () => void }) {
  void archetype;
  const isMobile = useIsMobile();
  const scanSize = isMobile ? 240 : 360;
  const seedNum = useMemo(() => {
    const s = JSON.stringify(seed);
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }, [seed]);
  useEffect(() => { const t = setTimeout(onDone, 3600); return () => clearTimeout(t); }, [onDone]);

  return (
    <div className="flex min-h-[72vh] flex-col items-center justify-center px-4 text-center sm:min-h-[80vh]">
      <SonarScan size={scanSize} seed={seedNum} period={2200} />
      <p className="mt-7 font-mono text-[10px] tracking-[0.32em] text-foreground/45 sm:mt-10">SKENUJEM REZONANČNÉ POLE</p>
      <p className="mt-2 font-mono text-[10px] tracking-[0.28em] text-foreground/30">HĽADÁM KOGNITÍVNE PROFILY</p>
    </div>
  );
}


// ============ Profile form ============
type LocStatus = "idle" | "loading" | "ok" | "denied" | "error";

function ProfileForm({ onSubmit, initialName = "" }: { onSubmit: (p: UserProfile) => void; initialName?: string }) {
  const haptic = useHaptic();
  const [name, setName] = useState(initialName);
  const [age, setAge] = useState<string>("");
  const [city, setCity] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [orientation, setOrientation] = useState<Orientation | "">("");
  const [loc, setLoc] = useState<LocStatus>("idle");
  const coordsRef = useRef<{ lat: number; lon: number } | null>(null);

  const ageNum = Number(age);
  const nameTrim = name.trim();
  const valid =
    nameTrim.length >= 2 && nameTrim.length <= 30 &&
    ageNum >= 16 && ageNum <= 99 &&
    city.trim().length > 1 && city.length <= 60 &&
    gender && orientation;

  async function useMyLocation() {
    if (!("geolocation" in navigator)) { setLoc("error"); return; }
    haptic("tap");
    setLoc("loading");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        coordsRef.current = { lat: latitude, lon: longitude };

        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 7000);
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=sk`,
            { headers: { Accept: "application/json" }, signal: ctrl.signal },
          );
          if (!r.ok) throw new Error("bad status");
          const data = await r.json();
          const a = data?.address ?? {};
          const guess: string = a.city || a.town || a.village || a.municipality || a.county || "";
          if (guess) {
            setCity(guess.slice(0, 60));
            setLoc("ok");
            haptic("success");
          } else {
            throw new Error("empty guess");
          }
        } catch {
          // Robust coordinate fallback to bypass rate limits or offline states
          let fallbackCity = "Bratislava";
          if (latitude > 47 && latitude < 50 && longitude > 16 && longitude < 235) {
            if (longitude < 18.5) fallbackCity = "Bratislava";
            else if (longitude < 20.5) fallbackCity = "Banská Bystrica";
            else fallbackCity = "Košice";
          } else {
            fallbackCity = "Praha";
          }
          setCity(fallbackCity);
          setLoc("ok");
          haptic("success");
        } finally {
          clearTimeout(tid);
        }
      },
      (err) => {
        setLoc(err.code === err.PERMISSION_DENIED ? "denied" : "error");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  const Pill = ({ active, label, sub, onClick }: { active: boolean; label: string; sub?: string; onClick: () => void }) => (
    <button onClick={() => { haptic("tap"); onClick(); }}
      className={`flex flex-col items-center justify-center border px-3 py-3 text-center transition-all active:scale-[0.97] ${
        active
          ? "border-foreground bg-foreground/10 text-foreground font-bold"
          : "border-foreground/10 bg-foreground/[0.02] text-foreground/75 hover:bg-foreground/5"
      }`}>
      <span className="text-sm font-semibold tracking-wide">{label}</span>
      {sub && <span className="mt-0.5 text-[9px] font-mono text-foreground/50">{sub}</span>}
    </button>
  );

  const locText: Record<LocStatus, string> = {
    idle:    "Použiť moju polohu",
    loading: "Zisťujem polohu…",
    ok:      "Doplnené z polohy ✓",
    denied:  "Povoľ prístup k polohe v prehliadači",
    error:   "Nepodarilo sa — napíš mesto ručne",
  };

  return (
    <div className="relative flex min-h-[88vh] flex-col items-center justify-center px-4 text-center animate-fade-up">
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-5 flex justify-center">
          <div className="border border-foreground/20 px-3 py-1 font-mono text-[9px] tracking-widest text-foreground/50 uppercase">
            // FÁZA 1 // IDENTIFIKÁCIA
          </div>
        </div>
        <h2 className="font-sans text-3xl font-black uppercase tracking-tight text-foreground">
          Základné Údaje
        </h2>
        <p className="mx-auto mt-3 max-w-md text-xs text-foreground/60 leading-relaxed font-mono uppercase">
          Tieto informácie slúžia pre potreby prvotnej sociometrickej filtrácie.
        </p>

        <div className="mt-8 text-left border border-foreground/20 bg-card p-6">
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-foreground/60 font-mono">
                Meno <span className="text-[9px] text-foreground/35 font-normal ml-1.5">// Primárny sémantický trigger</span>
              </label>
              <input value={name}
                onChange={(e) => setName(e.target.value.slice(0, 30))}
                placeholder="ako ti hovoria"
                className="w-full border border-foreground/10 bg-foreground/5 px-4 py-3 text-sm text-foreground outline-none focus:border-foreground placeholder:text-foreground/30 font-mono" />
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-foreground/60 font-mono">
                Vek <span className="text-[9px] text-foreground/35 font-normal ml-1.5">// Kognitívne zrenie a neuroplasticita</span>
              </label>
              <input inputMode="numeric" value={age}
                onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 2))}
                placeholder="napr. 27"
                className="w-full border border-foreground/10 bg-foreground/5 px-4 py-3 text-sm text-foreground outline-none focus:border-foreground placeholder:text-foreground/30 font-mono" />
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-foreground/60 font-mono">
                Mesto <span className="text-[9px] text-foreground/35 font-normal ml-1.5">// Teritoriálne a sociometrické pole</span>
              </label>
              <div className="flex items-center gap-3 border border-foreground/10 bg-foreground/5 px-4 py-3">
                <MapPin className="size-4 text-foreground/50" />
                <input value={city}
                  onChange={(e) => { setCity(e.target.value.slice(0, 60)); if (loc !== "idle") setLoc("idle"); }}
                  placeholder="napr. Bratislava"
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-foreground/30 font-mono" />
              </div>
              <button onClick={useMyLocation} disabled={loc === "loading"}
                className="mt-2 inline-flex items-center gap-2 border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-[9px] font-bold text-foreground hover:bg-foreground/10 disabled:opacity-60 font-mono uppercase tracking-wider">
                <MapPin className="size-3" /> {locText[loc]}
              </button>
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-foreground/60 font-mono">
                Identita <span className="text-[9px] text-foreground/35 font-normal ml-1.5">// Rodová polarizácia</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <Pill active={gender === "male"}   label="Muž"  onClick={() => setGender("male")} />
                <Pill active={gender === "female"} label="Žena" onClick={() => setGender("female")} />
                <Pill active={gender === "other"}  label="Iné"  onClick={() => setGender("other")} />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-foreground/60 font-mono">
                Orientácia <span className="text-[9px] text-foreground/35 font-normal ml-1.5">// Sexuálna komplementarita</span>
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Pill active={orientation === "hetero"} label="Hetero" sub="opačné" onClick={() => setOrientation("hetero")} />
                <Pill active={orientation === "homo"}   label="Homo"   sub="rovnaké" onClick={() => setOrientation("homo")} />
                <Pill active={orientation === "bi"}     label="Bi"     sub="obe"     onClick={() => setOrientation("bi")} />
              </div>
            </div>
          </div>
        </div>

        <button
          disabled={!valid}
          onClick={() => valid && onSubmit({ name: nameTrim, age: ageNum, city: city.trim(), gender: gender as Gender, orientation: orientation as Orientation, coords: coordsRef.current ?? undefined, radiusKm: 250 })}
          className="mt-6 w-full bg-foreground text-background font-mono font-bold text-xs tracking-widest uppercase py-4 hover:bg-foreground/90 disabled:opacity-20 transition-all"
        >
          POKRAČOVAŤ
        </button>
      </div>
    </div>
  );
}


// ============ AutoMatch (algoritmus vyberá) ============
function AutoMatch({ nextName, hasNext, onReady }: { nextName: string | null; hasNext: boolean; onReady: () => void }) {
  const haptic = useHaptic();
  useEffect(() => {
    haptic("phase");
    const t = setTimeout(onReady, 2400);
    return () => clearTimeout(t);
  }, [onReady, haptic]);
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center animate-fade-up">
      <Wave size={220} intense />
      <p className="mt-8 font-mono text-xs tracking-widest text-foreground/70 uppercase">ALGORITMUS HĽADÁ TVOJU REZONANCIU</p>
      <p className="mt-4 text-sm font-light text-foreground/60 font-mono">{hasNext ? `Pripravujem priestor s ${nextName ?? "tvojím partnerom"}…` : "Hľadám ďalej…"}</p>
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
          Algoritmus zvažuje vek, pohlavie aj orientáciu. Nikto nový momentálne nesadol —
          skús sa stavit o chvíľu, ľudia pribúdajú celý deň.
        </p>
        {onMessages && (
          <div className="mt-7 w-full max-w-xs">
            <PillButton onClick={onMessages} variant="ghost">Otvoriť správy 💬</PillButton>
          </div>
        )}
        <HandNote className="mt-4">občas nás prekvapí, kto sa zjaví ✨</HandNote>
      </div>
    </div>
  );
}


// ============ Chamber (voice 5 min → ContinueGate) ============
type VoiceMsg = { id: string; from: "me" | "them"; duration: number; audioUrl?: string };

const BLUR_START = 24;
const BLUR_STEP = 3;
const MAX_REC_SECONDS = 60;

function Chamber({ user, match, myVideoUrl, onSuccess, onDiscard, onFairInteraction }: {
  user: UserProfile; match: RankedMatch; myVideoUrl: string | null;
  onSuccess: (blurLevel: number) => void;
  onDiscard: () => void;
  onFairInteraction: () => void;
}) {
  const [recording, setRecording] = useState(false);
  const [recLen, setRecLen] = useState(0);
  const [messages, setMessages] = useState<VoiceMsg[]>(() => [
    { id: "m0", from: "them", duration: 15, audioUrl: makeMockToneWavUrl(15) },
  ]);
  const [playing, setPlaying] = useState<string | null>(null);
  const [stage, setStage] = useState<"voice" | "blindVote" | "waiting" | "result-no">("voice");
  const [myChoice, setMyChoice] = useState<"unlock" | "cancel" | null>(null);
  const [theirChoice, setTheirChoice] = useState<"unlock" | "cancel" | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  // Real recording infra.
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recStartRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);
  const pendingStopRef = useRef<null | { send: boolean }>(null);

  const haptic = useHaptic();

  // Voice progress details
  const totalVoiceDuration = messages.reduce((sum, msg) => sum + msg.duration, 0);
  const progressPct = Math.min(100, Math.round((totalVoiceDuration / 180) * 100));

  // Clamped progressive blur: reduces from 40px down to minimum 15px before Unlock
  const blurPx = Math.max(15, 40 * (1.0 - (totalVoiceDuration / 180)));

  // Check if cumulative voice limit of 180s is reached
  useEffect(() => {
    if (totalVoiceDuration >= 180 && stage === "voice") {
      haptic("warning");
      setStage("blindVote");
    }
  }, [totalVoiceDuration, stage, haptic]);

  // Cleanup mic + object URLs on unmount.
  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      try { mediaRecRef.current?.state !== "inactive" && mediaRecRef.current?.stop(); } catch { /* ignore */ }
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      setMessages((m) => {
        m.forEach((x) => { if (x.audioUrl) URL.revokeObjectURL(x.audioUrl); });
        return m;
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickMime(): string {
    return pickAudioMime();
  }

  async function startRec() {
    if (stage !== "voice" || recording) return;
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      const msg = "Tento prehliadač nepodporuje nahrávanie z mikrofónu.";
      console.warn("[voice]", msg);
      setMicError(msg);
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      const msg = "Tvoj prehliadač nepodporuje MediaRecorder API.";
      console.warn("[voice]", msg);
      setMicError(msg);
      return;
    }

    pendingStopRef.current = null;
    cancelledRef.current = false;
    setMicError(null);
    setRecLen(0);
    setRecording(true);
    recStartRef.current = performance.now();

    try {
      const perms = (navigator as Navigator & { permissions?: Permissions }).permissions;
      if (perms?.query) {
        const status = await perms.query({ name: "microphone" as PermissionName });
        if (status.state === "denied") {
          console.warn("[voice] microphone permission denied");
          setMicError("Mikrofón je zablokovaný. Klikni na ikonu zámku v adresnom riadku a povoľ mikrofón.");
          setRecording(false);
          return;
        }
      }
    } catch { /* Safari throws for unknown name — ignore */ }

    let stream: MediaStream;
    try {
      stream = await openMic();
    } catch (err) {
      console.error("[voice] getUserMedia failed:", err);
      setMicError(micErrorMessage(err));
      setRecording(false);
      pendingStopRef.current = null;
      return;
    }
    micStreamRef.current = stream;

    const mime = pickMime();
    let rec: MediaRecorder;
    try {
      rec = createMediaRecorder(stream, mime);
    } catch (err2) {
      console.error("[voice] MediaRecorder unavailable:", err2);
      setMicError("Nahrávanie zlyhalo — prehliadač nepodporuje žiadny audio formát.");
      stopStream(stream);
      micStreamRef.current = null;
      setRecording(false);
      pendingStopRef.current = null;
      return;
    }

    chunksRef.current = [];

    rec.onstart = () => { console.info("[voice] recording started", rec.mimeType || mime || "browser-default"); };
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onerror = (e) => {
      console.error("[voice] MediaRecorder error:", e);
      setMicError("Nahrávanie narazilo na chybu prehliadača. Skús nahrávku zopakovať.");
      stopStream(micStreamRef.current);
      micStreamRef.current = null;
      mediaRecRef.current = null;
      chunksRef.current = [];
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      setRecording(false);
      setRecLen(0);
    };
    rec.onstop = () => {
      const elapsed = Math.max(1, Math.round((performance.now() - recStartRef.current) / 1000));
      stopStream(micStreamRef.current);
      micStreamRef.current = null;

      void (async () => {
        try {
          if (cancelledRef.current) {
            chunksRef.current = [];
            return;
          }

          const type = rec.mimeType || mime || "audio/webm";
          const parts = chunksRef.current.slice();
          chunksRef.current = [];
          const blob = parts.length ? new Blob(parts, { type }) : new Blob([], { type });

          console.info("[voice] recording stopped", { elapsed, size: blob.size, type, chunks: parts.length });

          if (blob.size <= 32) {
            console.warn("[voice] empty recording detected, using fallback");
          }

          const url = await blobToPlayableAudioUrl(blob, elapsed);

          haptic("send");
          const msg: VoiceMsg = { id: `m${Date.now()}`, from: "me", duration: elapsed, audioUrl: url };
          onFairInteraction();
          
          setMessages((m) => {
            const next = [...m, msg];
            const nextSum = next.reduce((sum, x) => sum + x.duration, 0);
            
            // Simulating reply only if total voice duration is less than 180 seconds
            if (nextSum < 180) {
              setTimeout(() => {
                const dur = Math.floor(Math.random() * 25) + 15;
                setMessages((prev) => [...prev, {
                  id: `r${Date.now()}`,
                  from: "them",
                  duration: dur,
                  audioUrl: makeMockToneWavUrl(dur),
                }]);
              }, 1400);
            }
            return next;
          });
        } catch (err) {
          console.error("[voice] error processing recording:", err);
          setMicError("Spracovanie nahrávky zlyhalo. Skús znova.");
        } finally {
          setRecording(false);
          setRecLen(0);
        }
      })();
    };

    mediaRecRef.current = rec;
    haptic("recording");
    try {
      rec.start(250);
    } catch (err) {
      console.error("[voice] MediaRecorder.start failed:", err);
      setMicError("Nahrávanie sa nepodarilo spustiť.");
      stopStream(stream);
      micStreamRef.current = null;
      mediaRecRef.current = null;
      setRecording(false);
      pendingStopRef.current = null;
      return;
    }
    recStartRef.current = performance.now();
    tickRef.current = setInterval(() => {
      setRecLen((v) => {
        const next = v + 1;
        if (next >= MAX_REC_SECONDS) { stopRec(true); return MAX_REC_SECONDS; }
        return next;
      });
    }, 1000);

    if (pendingStopRef.current) {
      const { send } = pendingStopRef.current;
      pendingStopRef.current = null;
      stopRec(send);
    }
  }

  function stopRec(send = true) {
    if (!mediaRecRef.current && recording) {
      pendingStopRef.current = { send };
      return;
    }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    const rec = mediaRecRef.current;
    if (!rec) {
      setRecording(false);
      setRecLen(0);
      return;
    }
    cancelledRef.current = !send;
    try { if (rec.state === "recording") rec.requestData(); } catch (err) { console.warn("[voice] requestData error:", err); }
    try { if (rec.state !== "inactive") rec.stop(); } catch (err) { console.warn("[voice] stop error:", err); }
    mediaRecRef.current = null;
  }

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <span className="text-xs tracking-widest text-foreground/70">
          {match.name.toUpperCase()} <span className="text-foreground/40">· {match.age}</span>
        </span>
        <span className="text-xs tracking-widest text-foreground/40 font-mono">HLASOVÁ KOMUNIKÁCIA</span>
      </div>

      {/* Progress & Blurry Profile Frame */}
      <div className="mb-6 border border-foreground/10 bg-foreground/[0.02] p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] tracking-widest text-foreground/40">SPOLOČNÁ REZONANCIA</p>
            <p className="mt-1 text-sm font-light text-foreground/80">
              Nahrajte {180 - totalVoiceDuration > 0 ? `${180 - totalVoiceDuration}s` : "0s"} audia pre odomknutie a voľbu.
            </p>
          </div>
          <span className="font-mono text-[10px] tracking-widest text-foreground shrink-0 font-bold">
            {totalVoiceDuration}s / 180s
          </span>
        </div>
        <div className="mt-4 flex items-center gap-3">
          {/* Heavy blur for profiles initially */}
          <div className="relative size-14 shrink-0 overflow-hidden border border-foreground/20 rounded-none bg-black">
            {match.videoUrls && match.videoUrls.length > 0 ? (
              <video src={match.videoUrls[0]} autoPlay loop muted playsInline className="size-full object-cover scale-110" style={{ filter: `blur(${blurPx}px)` }} />
            ) : (
              <img src={match.img} alt={match.name} className="size-full object-cover scale-125" style={{ filter: `blur(${blurPx}px)` }} />
            )}
            <div className="absolute top-0.5 left-0.5 flex items-center gap-0.5 bg-black/65 px-1 py-0.5">
              <span className="size-1 animate-pulse rounded-full bg-red-500" />
              <span className="font-mono text-[5px] tracking-tighter text-white">LIVE</span>
            </div>
          </div>
          {myVideoUrl && (
            <div className="relative size-14 shrink-0 overflow-hidden border border-foreground/20 rounded-none bg-black">
              <video src={myVideoUrl} autoPlay loop muted playsInline className="size-full object-cover scale-110" style={{ transform: "scaleX(-1)", filter: `blur(${blurPx}px)` }} />
              <span className="absolute bottom-0.5 right-0.5 bg-background/60 px-1 font-mono text-[6px] tracking-widest text-foreground/70 uppercase">TY</span>
              <div className="absolute top-0.5 left-0.5 flex items-center gap-0.5 bg-black/65 px-1 py-0.5">
                <span className="size-1 animate-pulse rounded-full bg-red-500" />
                <span className="font-mono text-[5px] tracking-tighter text-white">LIVE</span>
              </div>
            </div>
          )}
          <div className="ml-auto h-[4px] flex-1 overflow-hidden rounded-full bg-foreground/5">
            <div className="h-full transition-all duration-500"
              style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, #67e8f9, #a78bfa)" }} />
          </div>
        </div>
      </div>

      {/* Icebreaker Dilemma Card */}
      <div className="mb-6">
        <IcebreakerDilemma 
          similarity={1.0 - Math.sqrt(Math.pow((user.cognitiveDepth ?? 0.5) - match.cognitive_depth, 2) + Math.pow((user.conscientiousness ?? 0.5) - match.conscientiousness, 2)) / Math.sqrt(2.0)}
          complementarity={Math.max(0, 1.0 - Math.min(1.0, Math.max(0.0, ((user.extraversion ?? 0.5) + match.extraversion) < 1.0 ? 0.5 * (1.0 - ((user.extraversion ?? 0.5) + match.extraversion)) : 1.0 * (((user.extraversion ?? 0.5) + match.extraversion) - 1.0))))}
          userStyle={user.attachmentStyle ?? "Secure"}
          matchStyle={match.attachment_style}
          userTopPriority={user.topPriority ?? "rodina"}
          matchTopPriority={match.top_priority}
        />
      </div>

      {/* Wave Visualizer */}
      <div className="grid place-items-center py-6">
        <Wave size={180} intense={recording || playing !== null} />
      </div>

      {micError && (
        <div className="mb-3 border border-foreground/30 bg-foreground/[0.06] px-4 py-3 text-xs text-foreground">
          {micError}
          <button onClick={() => setMicError(null)} className="ml-2 underline opacity-70 hover:opacity-100">zavrieť</button>
        </div>
      )}

      {/* Voice Messages Bubbles */}
      <div className="space-y-3 py-2">
        {messages.map((m) => (
          <VoiceBubble key={m.id} msg={m} playing={playing === m.id}
            onToggle={() => { haptic("tap"); setPlaying(playing === m.id ? null : m.id); }}
            onEnded={() => setPlaying(null)} />
        ))}
      </div>

      {stage === "voice" && (
        <>
          <div className="h-40" aria-hidden />
          <RecordButton recording={recording} recLen={recLen} disabled={false}
            onStart={startRec} onCommit={() => stopRec(true)} onCancel={() => stopRec(false)} />
        </>
      )}

      {stage === "blindVote" && (
        <BlindVote 
          onVote={(vote) => {
            haptic(vote === "unlock" ? "success" : "warning");
            setMyChoice(vote);
            setStage("waiting");
            onFairInteraction();
            
            // Simulating game theory partner choice
            setTimeout(() => {
              const partnerCooperates = Math.random() < (match.score > 70 ? 0.9 : 0.6);
              const partnerChoice = partnerCooperates ? "unlock" : "cancel";
              setTheirChoice(partnerChoice);
              
              if (vote === "unlock" && partnerChoice === "unlock") {
                haptic("success");
                onSuccess(0); // transition to normal text thread with blur = 0!
              } else {
                haptic("warning");
                setStage("result-no");
              }
            }, 2500);
          }}
        />
      )}

      {stage === "waiting" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/90 backdrop-blur-md p-6">
          <div className="w-full max-w-md border border-foreground/10 bg-card p-10 text-center animate-fade-up">
            <Wave size={140} intense />
            <h3 className="mt-6 text-xl font-light tracking-wider uppercase">Vyhodnocovanie voľby</h3>
            <p className="mt-3 text-sm text-foreground/60 font-light">
              Tvoj hlas: <span className="text-foreground font-bold">{myChoice === "unlock" ? "ODOMKNÚŤ" : "ZRUŠIŤ"}</span>
            </p>
            <p className="mt-2 text-xs text-foreground/40 font-light">
              Čaká sa na rozhodnutie od {match.name}…
            </p>
          </div>
        </div>
      )}

      {stage === "result-no" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/95 backdrop-blur-md p-6">
          <div className="w-full max-w-md border border-foreground/10 bg-card p-10 text-center animate-fade-up">
            <X className="mx-auto size-12 text-foreground mb-4" />
            <h3 className="text-2xl font-light tracking-wider text-foreground">SPÁROVANIE ZLYHALO</h3>
            <p className="mt-4 text-sm text-foreground/60 font-light leading-relaxed">
              {myChoice === "cancel" 
                ? "Rozhodol/a si sa nepokračovať a match zrušiť." 
                : `${match.name} sa rozhodol/a nepokračovať v komunikácii.`}
            </p>
            <p className="mt-2 text-xs text-foreground/45 font-light">
              Tento match bol permanentne odstránený. Žiadna história, žiadne stopy.
            </p>
            <button
              onClick={onDiscard}
              className="mt-8 w-full bg-foreground/5 border border-foreground/10 py-4 text-xs font-bold tracking-[0.2em] text-foreground hover:bg-foreground/10 transition-all uppercase"
            >
              Späť na Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Messages list ============
function MessagesList({ conversations, onOpen, onFindNew }: {
  conversations: Conversation[];
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
          <p className="mt-4 text-sm font-light text-foreground/60">Zatiaľ žiadne uložené konverzácie.</p>
          <p className="mt-2 text-xs text-foreground/40">Po úspešnom hlasovom priestore sa tu objaví textový dialóg.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {conversations.map((c) => {
            const m = MOCK_MATCHES.find(x => x.id === c.matchId);
            if (!m) return null;
            const last = c.messages[c.messages.length - 1];
            const blurPx = Math.round((c.blurLevel / 100) * BLUR_START);
            return (
              <button key={c.id} onClick={() => onOpen(c.id)}
                className="group flex items-center gap-4 border border-foreground/10 bg-foreground/[0.02] p-4 text-left transition-all hover:border-foreground/40 hover:bg-foreground/[0.04]">
                <div className="relative size-14 shrink-0 overflow-hidden">
                  <img src={m.img} alt={m.name} className="size-full object-cover"
                    style={{ filter: `blur(${blurPx}px) saturate(0.9)`, transform: "scale(1.15)", transition: "filter 500ms ease" }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className={`truncate text-base ${c.unread ? "font-medium text-foreground" : "font-light text-foreground/90"}`}>{m.name}</h3>
                    <span className="font-mono text-[10px] text-foreground/40">{m.age}</span>
                    <span className="text-[10px] text-foreground/40">· {m.city}</span>
                    {c.unread && <span className="size-2 rounded-full bg-foreground" />}
                  </div>
                  <p className="mt-1 truncate text-sm font-light text-foreground/60">
                    {last ? (last.from === "me" ? "Ty: " : "") + last.text : "Nový dialóg — napíš prvú správu."}
                  </p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-foreground/30 group-hover:text-foreground" />
              </button>
            );
          })}
        </div>
      )}

      <button onClick={onFindNew} className="mt-8 w-full border border-foreground/30 bg-foreground/[0.05] py-4 text-xs tracking-[0.3em] text-foreground hover:bg-foreground/[0.1]">
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

function MessageThread({ conversation, match, myVideoUrl, user, onUpdateUser, onBack, onEnd, onUpdate }: {
  conversation: Conversation;
  match: typeof MOCK_MATCHES[number];
  myVideoUrl: string | null;
  user: UserProfile;
  onUpdateUser: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  onBack: () => void;
  onEnd: () => void;
  onUpdate: (patch: (c: Conversation) => Conversation) => void;
}) {
  const haptic = useHaptic();
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [closureOpen, setClosureOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  
  // In-Chat Pressure Trigger (Landmines) states
  const [pressureTriggerAt] = useState(() => Math.floor(Math.random() * 6) + 10); // Between 10 and 15 messages
  const [pressureActive, setPressureActive] = useState(false);
  const [pressureCompleted, setPressureCompleted] = useState(false);
  const [waitingForPartner, setWaitingForPartner] = useState(false);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const blurPx = Math.round((conversation.blurLevel / 100) * BLUR_START);

  function handleClosure(reason: string) {
    haptic("success");
    onUpdate(c => ({
      ...c,
      status: "closed",
      closureReason: reason,
      messages: [
        ...c.messages,
        { 
          id: `sys-${Date.now()}`, 
          from: "them", 
          text: `Systémová správa: Používateľ uzavrel toto spojenie. Dôvod: ${reason}.`, 
          ts: Date.now() 
        }
      ]
    }));
    setClosureOpen(false);
  }

  function handleReport(reason: string) {
    haptic("warning");
    alert(`Spojenie zablokované a nahlásené pre: ${reason}.`);
    onEnd(); // delete match permanently
    setReportOpen(false);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation.messages.length, typing]);

  // Monitor message count for In-Chat Pressure triggers
  useEffect(() => {
    if (!pressureCompleted && !pressureActive && conversation.messages.length >= pressureTriggerAt) {
      haptic("warning");
      setPressureActive(true);
    }
  }, [conversation.messages.length, pressureTriggerAt, pressureCompleted, pressureActive, haptic]);

  function sendMedia(media: { kind: "image" | "gif"; url: string }) {
    haptic("send");
    const myMsg: ChatMessage = { id: `mt-${Date.now()}`, from: "me", text: "", ts: Date.now(), media };
    onUpdate(c => ({ ...c, messages: [...c.messages, myMsg], blurLevel: Math.max(0, c.blurLevel - THREAD_BLUR_STEP) }));
    setMediaOpen(false);
    setGifPickerOpen(false);
  }

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    sendMedia({ kind: "image", url });
    e.target.value = "";
  }

  function send() {
    const text = input.trim();
    if (!text) return;
    haptic("send");
    const myMsg: ChatMessage = { id: `mt-${Date.now()}`, from: "me", text, ts: Date.now() };
    onUpdate(c => ({
      ...c,
      messages: [...c.messages, myMsg],
      blurLevel: Math.max(0, c.blurLevel - THREAD_BLUR_STEP),
    }));
    setInput("");
    setTyping(true);
    setTimeout(() => {
      const reply: ChatMessage = {
        id: `tt-${Date.now()}`,
        from: "them",
        text: mockReply(match.id, text),
        ts: Date.now(),
      };
      setTyping(false);
      haptic("reveal");
      onUpdate(c => ({ ...c, messages: [...c.messages, reply] }));
    }, REPLY_TYPING_MS + Math.random() * 1200);
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-6 flex items-center justify-between gap-3">
        <button onClick={onBack} className="flex items-center gap-1 text-xs tracking-widest text-foreground/40 hover:text-foreground">
          <ArrowLeft className="size-4" /> SPRÁVY
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-3">
          <div className="relative size-10 shrink-0 overflow-hidden rounded-full">
            <img src={match.img} alt={match.name} className="size-full object-cover"
              style={{ filter: `blur(${blurPx}px) saturate(0.9)`, transform: "scale(1.2)", transition: "filter 500ms ease" }} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-light text-foreground">{match.name} <span className="text-foreground/40">· {match.age}</span></p>
            <p className="font-mono text-[10px] tracking-widest text-foreground/40">{match.city.toUpperCase()}</p>
          </div>
        </div>
        
        <div className="relative flex items-center gap-1.5">
          {conversation.status !== "closed" && (
            <button 
              onClick={() => { haptic("tap"); setClosureOpen(true); }}
              className="rounded-full border border-foreground/30 bg-foreground/10 px-3 py-1 text-[10px] tracking-widest text-foreground hover:bg-foreground/20 transition-all font-semibold"
            >
              UZAVRIEŤ
            </button>
          )}
          
          <div className="relative">
            <button 
              onClick={() => { haptic("tap"); setMenuOpen(!menuOpen); }}
              className="rounded-full border border-foreground/10 p-1.5 text-foreground/60 hover:bg-foreground/5 transition-all"
            >
              <MoreVertical className="size-3.5" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 border border-foreground/10 bg-card p-1.5 z-50">
                <button
                  onClick={() => { haptic("warning"); setMenuOpen(false); setReportOpen(true); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
                >
                  <AlertTriangle className="size-3" /> Nahlásiť a Zablokovať
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-3 border border-foreground/10 bg-foreground/[0.02] p-3">
        <div className="flex -space-x-3">
          {myVideoUrl && (
            <div className="relative size-12 overflow-hidden rounded-full ring-2 ring-[#11151B]">
              <video src={myVideoUrl} autoPlay loop muted playsInline className="size-full object-cover"
                style={{ transform: "scaleX(-1)", filter: `blur(${blurPx}px)`, transition: "filter 500ms ease" }} />
            </div>
          )}
          <div className="relative size-12 overflow-hidden rounded-full ring-2 ring-[#11151B]">
            <img src={match.img} alt={match.name} className="size-full object-cover"
              style={{ filter: `blur(${blurPx}px) saturate(0.9)`, transform: "scale(1.2)", transition: "filter 500ms ease" }} />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] tracking-widest text-foreground/40">ODHAĽOVANIE</p>
          <div className="mt-1 h-[2px] w-full overflow-hidden bg-foreground/5">
            <div className="h-full transition-all duration-500"
              style={{ width: `${100 - conversation.blurLevel}%`, background: "linear-gradient(90deg, #67e8f9, #a78bfa)" }} />
          </div>
          <p className="mt-1 text-[10px] text-foreground/40">Každá tvoja správa odhalí o niečo viac.</p>
        </div>
      </div>

      <div className="border border-foreground/10 bg-foreground/[0.02]">
        <div className="max-h-[55vh] min-h-[40vh] space-y-3 overflow-auto p-5">
          {conversation.messages.length === 0 && (
            <p className="text-center text-sm font-light text-foreground/40 py-12">
              Začni rozhovor — už ste sa počuli, teraz píšte.
            </p>
          )}
          {conversation.messages.map((m) => (
            <div key={m.id} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
              {m.media ? (
                <div className="max-w-[78%] overflow-hidden border border-foreground/30"
                  style={{ boxShadow: "0 0 24px -8px rgba(167,139,250,0.5)" }}>
                  <img src={m.media.url} alt={m.media.kind} className="block max-h-72 w-full object-cover" />
                </div>
              ) : (
                <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.id.startsWith("sys-")
                    ? "bg-foreground/[0.02] border border-foreground/5 text-center text-foreground/40 text-xs italic w-full mx-auto"
                    : m.from === "me"
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "text-foreground/90"
                }`}>
                  {m.text}
                </div>
              )}
            </div>
          ))}
          {conversation.status === "closed" && (
            <div className="rounded-2xl border border-[#f87171]/10 bg-[#f87171]/[0.02] px-5 py-4 text-center my-4 animate-fade-in">
              <p className="text-xs text-foreground/60 leading-relaxed font-mono">
                Táto konverzácia bola uzavretá.
                {conversation.closureReason && (
                  <span className="block mt-1 text-rose-400 font-semibold uppercase tracking-wider text-[10px]">
                    DÔVOD: {conversation.closureReason}
                  </span>
                )}
              </p>
            </div>
          )}
          {typing && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 px-3 py-2 text-foreground/50">
                <span className="size-1.5 animate-pulse rounded-full bg-foreground/60" style={{ animationDelay: "0ms" }} />
                <span className="size-1.5 animate-pulse rounded-full bg-foreground/60" style={{ animationDelay: "200ms" }} />
                <span className="size-1.5 animate-pulse rounded-full bg-foreground/60" style={{ animationDelay: "400ms" }} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {gifPickerOpen && (
          <div className="border-t border-foreground/5 bg-background/40 p-3 animate-fade-up">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-mono text-[10px] tracking-widest text-foreground/50">VYBER GIF</p>
              <button onClick={() => setGifPickerOpen(false)} className="text-[10px] tracking-widest text-foreground/40 hover:text-foreground">ZAVRIEŤ</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {MOCK_GIFS.map((g) => (
                <button key={g} onClick={() => sendMedia({ kind: "gif", url: g })}
                  className="overflow-hidden rounded-xl border border-foreground/10 transition-all hover:border-foreground/60 active:scale-95">
                  <img src={g} alt="gif" className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="relative flex items-end gap-2 border-t border-foreground/5 p-3">
          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={onPickImage} />
          <div className="relative">
            <button
              onClick={() => { haptic("tap"); setMediaOpen((v) => !v); setGifPickerOpen(false); }}
              disabled={pressureActive || conversation.status === "closed"}
              aria-label="Pripojiť"
              className="grid size-10 shrink-0 place-items-center rounded-xl border border-foreground/10 bg-foreground/5 text-foreground/70 hover:bg-foreground/10 disabled:opacity-50">
              <Paperclip className="size-4" />
            </button>
            {mediaOpen && (
              <div className="absolute bottom-12 left-0 z-20 w-48 overflow-hidden border border-foreground/10 bg-card animate-fade-up">
                <button onClick={() => { setMediaOpen(false); fileInputRef.current?.click(); }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-foreground hover:bg-foreground/5">
                  <ImageIcon className="size-4 text-foreground" /> Poslať obrázok
                </button>
                <button onClick={() => { setMediaOpen(false); setGifPickerOpen(true); }}
                  className="flex w-full items-center gap-3 border-t border-foreground/5 px-4 py-3 text-left text-sm text-foreground hover:bg-foreground/5">
                  <Sparkles className="size-4 text-foreground" /> Poslať GIF
                </button>
              </div>
            )}
          </div>
          <textarea
            value={input}
            disabled={pressureActive || conversation.status === "closed"}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            placeholder={pressureActive ? "Tlakový test je aktívny..." : conversation.status === "closed" ? "Táto konverzácia je uzavretá." : "Napíš správu…"}
            className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-foreground/10 bg-foreground/5 px-3 py-2 text-sm outline-none focus:border-foreground disabled:opacity-50 disabled:pointer-events-none"
          />
          <button onClick={send} disabled={pressureActive || !input.trim() || conversation.status === "closed"}
            className="grid size-10 shrink-0 place-items-center rounded-xl disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #67e8f9, #a78bfa)" }}>
            <Send className="size-4 text-background" />
          </button>
        </div>
      </div>

      {/* In-Chat Pressure Test Overlay */}
      {pressureActive && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-md z-[110] flex flex-col justify-center items-center p-4">
          <div className="w-full max-w-md border border-foreground/20 bg-card p-6 relative">
            <div className="mb-4 flex items-center justify-between font-mono text-[9px] tracking-widest text-red-500 font-bold uppercase animate-pulse">
              <span>⚠️ NÁŠĽAPNÁ MÍNA DETEKOVANÁ · KRITICKÁ SITUÁCIA</span>
              <span>TLAKOVÝ TEST</span>
            </div>
            
            {waitingForPartner ? (
              <div className="text-center py-12 space-y-4">
                <div className="size-8 mx-auto border-2 border-foreground border-t-transparent animate-spin" />
                <h4 className="font-mono text-xs tracking-widest text-foreground font-bold uppercase">ČAKÁM NA ODPOVEĎ PARTNERA...</h4>
                <p className="text-[11px] text-foreground/50 leading-relaxed font-mono">
                  Odoslal si svoju odpoveď. Druhá strana má 5 sekúnd na reakciu. Čet sa následne prepočíta a odomkne.
                </p>
              </div>
            ) : (
              <PressureChat
                isOnboarding={false}
                excludeScenarioIds={user.completedPressureScenarios || []}
                onDone={async (style, rt, isHesitated, scenarioId) => {
                  haptic("success");
                  setSelectedScenarioId(scenarioId);
                  setWaitingForPartner(true);
                  
                  // Update user profile completed pressure list locally
                  const oldScenarios = user.completedPressureScenarios || [];
                  const nextScenarios = oldScenarios.includes(scenarioId) ? oldScenarios : [...oldScenarios, scenarioId];
                  onUpdateUser({
                    ...user,
                    attachmentStyle: style,
                    avgResponseTime: ( (user.avgResponseTime || 3.0) + rt ) / 2.0,
                    hesitated: isHesitated,
                    completedPressureScenarios: nextScenarios
                  });

                  // Try to call backend FastAPI server if active, otherwise bypass safely (robust hybrid approach)
                  try {
                    await fetch("http://localhost:8000/api/matches/pressure-submit", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        match_id: match.id,
                        user_id: user.id || "00000000-0000-0000-0000-000000000001",
                        scenario_id: scenarioId,
                        style: style,
                        response_time: rt,
                        hesitated: isHesitated
                      })
                    });
                  } catch (e) {
                    console.info("[pressure-chat] Backend offline or skipped, running client mock logic.");
                  }

                  // Simulate partner response after a short random delay
                  setTimeout(() => {
                    haptic("reveal");
                    setWaitingForPartner(false);
                    setPressureActive(false);
                    setPressureCompleted(true);

                    // Recalculate compatibility score
                    const partnerStyles = ["Secure", "Anxious", "Avoidant"];
                    const partnerStyle = partnerStyles[Math.floor(Math.random() * partnerStyles.length)];
                    
                    const userCDepth = user.cognitiveDepth ?? 0.5;
                    const userCons = user.conscientiousness ?? 0.5;
                    const userExt = user.extraversion ?? 0.5;
                    
                    const partnerCDepth = match.cognitive_depth;
                    const partnerCons = match.conscientiousness;
                    const partnerExt = match.extraversion;
                    
                    const dist = Math.sqrt(Math.pow(userCDepth - partnerCDepth, 2) + Math.pow(userCons - partnerCons, 2));
                    const sim = 1.0 - (dist / Math.sqrt(2.0));
                    const comp = 1.0 - Math.min(1.0, Math.max(0.0, Math.abs(userExt + partnerExt - 1.0)));
                    
                    const matrix: Record<string, Record<string, number>> = {
                      sec: { sec: 0.0, anx: -0.15, avo: -0.20, fea: -0.25 },
                      anx: { sec: -0.15, anx: -0.40, avo: -1.00, fea: -0.60 },
                      avo: { sec: -0.20, anx: -1.00, avo: -0.50, fea: -0.60 },
                      fea: { sec: -0.25, anx: -0.60, avo: -0.60, fea: -0.70 }
                    };
                    const pNorm = style.substring(0, 3).toLowerCase();
                    const qNorm = partnerStyle.substring(0, 3).toLowerCase();
                    const penalty = (matrix[pNorm] ? matrix[pNorm][qNorm] : 0.0) || 0.0;
                    const tox_mult = Math.max(0.0, 1.0 + penalty);
                    
                    const newScoreRaw = ((0.6 * sim) + (0.4 * comp)) * tox_mult;
                    const newScore = Math.min(100, Math.round(newScoreRaw * 1000) / 10);
                    
                    match.score = newScore;

                    const systemMsg: ChatMessage = {
                      id: `sys-pressure-${Date.now()}`,
                      from: "them",
                      text: `Systémová správa: Tlakový test ukončený. Vaša reakcia: ${style}. Partnerova reakcia: ${partnerStyle}. Vzájomná Expected Value (EV) kompatibilita prehodnotená na: ${newScore}%. Čet je opäť odomknutý.`,
                      ts: Date.now()
                    };

                    onUpdate(c => ({
                      ...c,
                      messages: [...c.messages, systemMsg]
                    }));
                  }, 3000);
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Closure Protocol Reason Selection Modal overlay */}
      {closureOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] grid place-items-center p-4">
          <div className="w-full max-w-sm border border-foreground/20 bg-card p-6 animate-fade-up">
            <h3 className="font-sans font-black text-lg text-foreground mb-2 uppercase">Uzavrieť spojenie</h3>
            <p className="text-xs text-foreground/50 leading-relaxed mb-6 font-mono">
              Vyberte čestný a slušný dôvod uzavretia konverzácie. Druhej strane sa odošle systémová správa a čet sa bezpečne uzamkne. Nenesie to žiadnu penalizáciu.
            </p>
            <div className="space-y-2 mb-6">
              {[
                "Necítim romantickú chémiu",
                "Hľadám niečo iné",
                "Nenašli sme spoločnú reč",
                "Výrazný hodnotový nesúlad"
              ].map((reason, idx) => (
                <button
                  key={idx}
                  onClick={() => handleClosure(reason)}
                  className="w-full text-left border border-foreground/10 bg-foreground/[0.02] px-4 py-3 hover:bg-foreground/5 hover:border-foreground/30 text-xs font-mono text-foreground/80 transition-all active:scale-[0.99]"
                >
                  {reason}
                </button>
              ))}
            </div>
            <button
              onClick={() => setClosureOpen(false)}
              className="w-full border border-foreground/20 py-3 text-xs tracking-widest text-foreground/60 hover:bg-foreground/5 font-mono font-bold uppercase transition-all"
            >
              ZRUŠIŤ
            </button>
          </div>
        </div>
      )}

      {/* Block & Report Compliance Modal overlay */}
      {reportOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] grid place-items-center p-4">
          <div className="w-full max-w-sm border border-red-500/20 bg-card p-6 animate-fade-up">
            <div className="flex items-center gap-2 text-red-500 font-mono font-bold text-xs tracking-widest uppercase mb-3">
              <AlertTriangle className="size-5" />
              <span>Nahlásiť a Zablokovať</span>
            </div>
            
            <div className="mb-5 border border-red-500/25 bg-red-500/5 p-4 text-xs text-red-400 leading-relaxed font-mono">
              ⚠️ Varovanie: Zneužitie tohto tlačidla na zrušenie matchu namiesto &ldquo;Uzavrieť&rdquo; vedie k trvalému zablokovaniu vášho účtu. Nahlásenia slúžia výhradne pre prípady spamu, zneužívania alebo obťažovania.
            </div>

            <div className="space-y-2 mb-6">
              {[
                "Obťažovanie / Nevhodné správanie",
                "Spam / Falošný profil",
                "Propagácia / Reklama"
              ].map((reason, idx) => (
                <button
                  key={idx}
                  onClick={() => handleReport(reason)}
                  className="w-full text-left border border-foreground/10 bg-foreground/[0.02] px-4 py-3 hover:bg-red-500/10 hover:border-red-500/20 text-xs font-mono text-foreground/80 transition-all active:scale-[0.99]"
                >
                  {reason}
                </button>
              ))}
            </div>
            <button
              onClick={() => setReportOpen(false)}
              className="w-full border border-foreground/20 py-3 text-xs tracking-widest text-foreground/60 hover:bg-foreground/5 font-mono font-bold uppercase transition-all"
            >
              SPÄŤ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Voice helpers ============
// Mobile-friendly: tap once to record, tap again to send, trash to cancel.

function RecordButton({ recording, recLen, disabled, onStart, onCommit, onCancel }:
  { recording: boolean; recLen: number; disabled: boolean; onStart: () => void; onCommit: () => void; onCancel: () => void }) {
  const progress = Math.min(1, recLen / 60);

  function handleMainAction() {
    if (disabled) return;
    if (!recording) onStart();
    else onCommit();
  }

  return (
    <div className="fixed inset-x-0 bottom-3 z-40 select-none px-4">
      <div className="mx-auto grid max-w-md place-items-center border border-foreground/10 bg-card px-4 py-3">
        <div className="mb-2 h-4 text-center">
          {recording ? (
            <p className="font-mono text-[10px] tracking-widest text-foreground/70">
              NAHRÁVAM · {recLen}s / 60s · KLEPNI PRE ODOSLANIE
            </p>
          ) : (
            <p className="font-mono text-[10px] tracking-widest text-foreground/45">KLEPNI PRE NAHRÁVANIE · MAX 60s</p>
          )}
        </div>

        <div className="relative grid w-full grid-cols-[64px_1fr_64px] items-center" style={{ minHeight: 72 }}>
          {recording && (
            <button
              type="button"
              onClick={() => onCancel()}
              aria-label="Zrušiť hlasovku"
              className="grid size-12 place-items-center border border-red-500/30 bg-red-500/10 text-red-500 active:scale-95">
              <Trash2 className="size-5" />
            </button>
          )}
          <button
            type="button"
            onClick={handleMainAction}
            disabled={disabled}
            aria-label={recording ? "Klepnutím odošleš hlasovku" : "Klepnutím začneš nahrávanie"}
            className={`relative col-start-2 mx-auto grid size-16 place-items-center disabled:opacity-30 active:scale-95 ${recording ? "bg-red-500" : "bg-foreground"}`}
            style={{ touchAction: "manipulation" }}>
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.18" />
              {recording && (
                <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="3"
                  strokeDasharray={2 * Math.PI * 36}
                  strokeDashoffset={2 * Math.PI * 36 * (1 - progress)}
                  className="transition-all duration-1000 ease-linear" />
              )}
            </svg>
            {recording ? (
              <Send className="size-6 text-white" />
            ) : (
              <Mic className="size-6 text-background" />
            )}
          </button>
          <div aria-hidden />
        </div>
      </div>
    </div>
  );
}


function VoiceBubble({ msg, playing, onToggle, onEnded }: { msg: VoiceMsg; playing: boolean; onToggle: () => void; onEnded: () => void }) {
  const mine = msg.from === "me";
  void calcResonance; void resonanceBreakdown;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.currentTime = 0;
      void el.play().catch(() => onEndedRef.current());
    } else {
      el.pause();
      el.currentTime = 0;
      setProgress(0);
    }
  }, [playing]);

  const hasAudio = !!msg.audioUrl;
  const canPlay = hasAudio;

  function handleToggle() {
    if (!canPlay) return;
    onToggle();
  }

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className="flex max-w-[80%] items-center gap-3 rounded-2xl px-4 py-3"
        style={{ background: mine ? "linear-gradient(135deg, rgba(0,242,254,0.18), rgba(127,0,255,0.18))" : "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.06)" }}>
        <button
          onClick={handleToggle}
          disabled={!canPlay}
          aria-label={playing ? "Pauznúť" : "Prehrať"}
          className="grid size-9 place-items-center rounded-full disabled:opacity-50"
          style={{ background: mine ? "#67e8f9" : "rgba(255,255,255,0.08)" }}>
          {playing ? <Pause className="size-4" style={{ color: mine ? "#0D0F12" : "#fff" }} /> :
            <Play className="size-4" style={{ color: mine ? "#0D0F12" : "#fff" }} />}
        </button>
        <div className="flex items-end gap-[2px]">
          {Array.from({ length: 22 }).map((_, i) => {
            const lit = playing ? (i / 22) <= progress : false;
            return (
              <span key={i} className="w-[2px] rounded-full"
                style={{
                  height: 6 + Math.abs(Math.sin(i * 0.6 + msg.duration)) * 18,
                  background: lit ? (mine ? "#67e8f9" : "#a78bfa") : "rgba(255,255,255,0.6)",
                  opacity: playing || lit ? 1 : 0.5,
                }} />
            );
          })}
        </div>
        <span className="font-mono text-xs text-white/60">{msg.duration}s</span>
        {hasAudio && (
          <audio
            ref={audioRef}
            src={msg.audioUrl}
            preload="auto"
            playsInline
            onTimeUpdate={(e) => {
              const a = e.currentTarget;
              if (a.duration && Number.isFinite(a.duration)) setProgress(a.currentTime / a.duration);
            }}
            onEnded={() => { setProgress(0); onEndedRef.current(); }}
            onError={() => onEndedRef.current()}
          />
        )}
      </div>
    </div>
  );
}

// ============ Settings + Legal ============

function Settings({ theme, onTheme, onOpenTerms, onOpenPrivacy, onOpenCookies, onOpenContact }: {
  theme: ThemeMode;
  onTheme: (m: ThemeMode) => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
  onOpenCookies: () => void;
  onOpenContact: () => void;
}) {
  const Row = ({ icon, label, sub, onClick }: { icon: React.ReactNode; label: string; sub?: string; onClick: () => void }) => (
    <button onClick={onClick}
      className="group flex w-full items-center gap-4 border border-foreground/10 bg-card p-4 text-left transition-all hover:border-foreground/35 hover:bg-card active:scale-[0.99] rounded-none">
      <span className="grid size-10 shrink-0 place-items-center bg-foreground/5 border border-foreground/10 rounded-none">{icon}</span>
      <span className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground uppercase tracking-wide">{label}</p>
        {sub && <p className="mt-0.5 text-[9px] font-mono text-foreground/45 uppercase tracking-wide">{sub}</p>}
      </span>
      <ChevronRight className="size-4 text-foreground/60 group-hover:text-foreground" />
    </button>
  );

  return (
    <div className="animate-fade-up">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-sans text-3xl tracking-tight text-foreground font-black uppercase">Nastavenia</h1>
        <span className="font-mono text-xs tracking-widest text-muted-foreground">RESON</span>
      </div>

      <div className="mb-6 border border-foreground/10 bg-card p-4 rounded-none">
        <p className="mb-3 font-mono text-[9px] tracking-widest text-foreground/45 uppercase">VZHĽAD</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => onTheme("dark")}
            className={`flex items-center justify-center gap-2 border py-3 text-xs tracking-widest transition-all rounded-none font-mono ${
              theme === "dark"
                ? "border-foreground bg-foreground text-background font-bold"
                : "border-foreground/10 bg-transparent text-foreground/65 hover:bg-foreground/[0.02]"
            }`}>
            <Moon className="size-4" /> TMAVÝ
          </button>
          <button onClick={() => onTheme("light")}
            className={`flex items-center justify-center gap-2 border py-3 text-xs tracking-widest transition-all rounded-none font-mono ${
              theme === "light"
                ? "border-foreground bg-foreground text-background font-bold"
                : "border-foreground/10 bg-transparent text-foreground/65 hover:bg-foreground/[0.02]"
            }`}>
            <Sun className="size-4" /> SVETLÝ
          </button>
        </div>
      </div>

      <div className="mb-3 grid gap-3">
        <Row icon={<FileText className="size-5 text-violet-600 dark:text-violet-400" />} label="Podmienky používania" sub="Zmluvný rámec a pravidlá služby" onClick={onOpenTerms} />
        <Row icon={<Shield className="size-5 text-cyan-600 dark:text-cyan-400" />} label="Ochrana súkromia (GDPR)" sub="Aké dáta zbierame a tvoje práva" onClick={onOpenPrivacy} />
        <Row icon={<Cookie className="size-5 text-pink-600 dark:text-pink-400" />} label="Cookies" sub="Aké technológie ukladáme v zariadení" onClick={onOpenCookies} />
        <Row icon={<Mail className="size-5 text-indigo-600 dark:text-indigo-400" />} label="Kontakt" sub="Napíš nám s otázkou alebo sťažnosťou" onClick={onOpenContact} />
      </div>

      <div className="mt-6 border border-red-500/25 bg-red-500/5 p-4 rounded-none">
        <div className="flex items-start gap-3">
          <Trash className="mt-0.5 size-5 shrink-0 text-red-500" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground uppercase tracking-wide">Vymazať lokálne dáta</p>
            <p className="mt-1 text-[9px] font-mono text-foreground/45 uppercase leading-relaxed">Profil aj rozhovory sú uložené iba v tomto zariadení. Tlačidlo nižšie ich okamžite vyčistí.</p>
            <button
              onClick={() => { if (confirm("Naozaj vymazať všetky lokálne dáta? Túto akciu nemožno vrátiť.")) { try { localStorage.clear(); } catch { /* ignore */ } location.reload(); } }}
              className="mt-3 border border-red-500/40 px-3 py-2 text-xs tracking-widest text-red-500 hover:bg-red-500/10 font-mono rounded-none">
              VYMAZAŤ A REŠTARTOVAŤ
            </button>
          </div>
        </div>
      </div>

      <p className="mt-8 text-center font-mono text-[10px] tracking-widest text-muted-foreground">VERZIA 0.9 · RESON © 2026</p>
    </div>
  );
}

function UserProfileDossier({ user, onBack, onUpdateUser }: {
  user: UserProfile;
  onBack: () => void;
  onUpdateUser: React.Dispatch<React.SetStateAction<UserProfile | null>>;
}) {
  const haptic = useHaptic();
  const [snippets, setSnippets] = useState<string[]>(() => {
    return user.completedPressureScenarios ? [ "https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-sign-cyberpunk-look-39891-large.mp4" ] : [];
  });
  
  // Camera/Recording state
  const [recordingIndex, setRecordingIndex] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [recordingState, setRecordingState] = useState<"idle" | "countdown" | "recording" | "saving">("idle");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Profile Editor state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editAge, setEditAge] = useState(user.age);
  const [editCity, setEditCity] = useState(user.city || "");
  const [editBio, setEditBio] = useState(user.bio || "");
  const [editRadius, setEditRadius] = useState(user.radiusKm || 250);

  function handleSaveProfile() {
    haptic("success");
    onUpdateUser((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        name: editName,
        age: Number(editAge),
        city: editCity,
        bio: editBio,
        radiusKm: Number(editRadius),
      };
    });
    setIsEditing(false);
  }

  // Initialize with any existing snippets (e.g. liveness video)
  useEffect(() => {
    setSnippets([
      "https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-sign-cyberpunk-look-39891-large.mp4",
      "https://assets.mixkit.co/videos/preview/mixkit-woman-close-up-under-neon-light-40409-large.mp4",
    ]);
  }, []);

  async function startRecording(index: number) {
    haptic("tap");
    setRecordingIndex(index);
    setRecordingState("countdown");
    setCountdown(3);

    let stream: MediaStream;
    try {
      stream = await openCamera();
      setCameraStream(stream);
    } catch (err) {
      console.error("[dossier] openCamera failed:", err);
      alert("Nepodarilo sa spustiť kameru. Skontrolujte povolenia.");
      cancelRecording();
      return;
    }

    setTimeout(() => {
      if (videoRef.current) {
        attachStreamToVideo(videoRef.current, stream);
      }
    }, 100);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          triggerRecord(stream, index);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function triggerRecord(stream: MediaStream, index: number) {
    haptic("warning");
    setRecordingState("recording");

    try {
      const blob = await recordStreamForMs(stream, 3000);
      setRecordingState("saving");
      
      const videoUrl = URL.createObjectURL(blob);
      setSnippets((prev) => {
        const next = [...prev];
        next[index] = videoUrl;
        return next;
      });

      haptic("success");
    } catch (err) {
      console.error("[dossier] recordStreamForMs failed:", err);
      alert("Nahrávanie zlyhalo.");
    } finally {
      stopStream(stream);
      setCameraStream(null);
      setRecordingIndex(null);
      setRecordingState("idle");
    }
  }

  function cancelRecording() {
    if (cameraStream) {
      stopStream(cameraStream);
      setCameraStream(null);
    }
    setRecordingIndex(null);
    setRecordingState("idle");
  }

  function deleteSnippet(index: number) {
    haptic("warning");
    setSnippets((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  }

  // Pure mathematical metrics for ALGORITHMIC DIAGNOSTICS
  const primaryMarker = `[${(user.attachmentStyle || "Secure").toUpperCase()}]`;
  const decisionLatency = `${(user.avgResponseTime || 2.45).toFixed(2)}s`;
  const redemptionQuota = `${user.redemptionQuota ?? 0}`;
  const closureRate = "85%";
  const cognitiveDepth = `${(user.cognitiveDepth || 0.55).toFixed(2)}`;
  const conscientiousness = `${(user.conscientiousness || 0.50).toFixed(2)}`;
  const extraversion = `${(user.extraversion || 0.50).toFixed(2)}`;
  const searchRadius = `${user.radiusKm || 250}km`;
  const hesitationFlag = `[${user.hesitated ? "TRUE" : "FALSE"}]`;

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-sans text-2xl tracking-tight text-foreground font-black uppercase">ASSET DOSSIER // KOGNITÍVNA DNA</h1>
        <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">{user.name}</span>
      </div>

      {/* CCTV Live Snippets Grid (Redesign Slot grid) */}
      <div className="mb-6">
        <p className="mb-3 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">MULTIPLE LIVE SNIPPETS (3s CCTV LOOPS)</p>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, idx) => {
            const url = snippets[idx];
            return (
              <div key={idx} className="relative aspect-video w-full border border-foreground/20 rounded-none bg-black overflow-hidden group">
                {url ? (
                  <>
                    <video
                      src={url}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="size-full object-cover rounded-none"
                    />
                    {/* Corner CCTV Indicator */}
                    <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/70 px-1.5 py-0.5 rounded-none border border-white/5">
                      <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
                      <span className="font-mono text-[7px] text-white tracking-widest uppercase">LIVE</span>
                    </div>
                    {/* Pulsing overlay timestamp */}
                    <div className="absolute bottom-1.5 left-1.5 bg-black/70 px-1.5 py-0.5 rounded-none">
                      <span className="font-mono text-[7px] text-white tracking-widest uppercase">00:03:00</span>
                    </div>
                    {/* Delete button */}
                    <button
                      onClick={() => deleteSnippet(idx)}
                      className="absolute top-1.5 right-1.5 bg-red-600/90 text-white p-1 rounded-none border border-red-500 hover:bg-red-700 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <X className="size-3" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => startRecording(idx)}
                    className="size-full flex flex-col items-center justify-center p-3 text-center hover:bg-foreground/[0.04] transition-all border border-dashed border-foreground/20 rounded-none text-[9px] font-mono text-foreground/45"
                  >
                    <span>[ RECORD LIVE SNIPPET ]</span>
                    <span className="mt-1 text-[7px] text-foreground/30">SLOT {idx + 1} // 3 SECONDS</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pure Data Algorithmic Diagnostics (Brutalist Key: Value) */}
      <div className="mb-6">
        <p className="mb-3 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">ALGORITHMIC DIAGNOSTICS</p>
        <div className="border border-foreground/15 bg-card p-5 font-mono text-xs text-foreground/90 space-y-2.5 rounded-none select-none">
          <div className="flex justify-between border-b border-foreground/5 pb-2">
            <span className="text-foreground/45 uppercase">Primary_Marker</span>
            <span className="font-bold text-foreground">{primaryMarker}</span>
          </div>
          <div className="flex justify-between border-b border-foreground/5 pb-2">
            <span className="text-foreground/45 uppercase">Decision_Latency</span>
            <span className="font-bold text-foreground">{decisionLatency}</span>
          </div>
          <div className="flex justify-between border-b border-foreground/5 pb-2">
            <span className="text-foreground/45 uppercase">Redemption_Quota</span>
            <span className="font-bold text-foreground">{redemptionQuota}</span>
          </div>
          <div className="flex justify-between border-b border-foreground/5 pb-2">
            <span className="text-foreground/45 uppercase">Closure_Rate</span>
            <span className="font-bold text-foreground">{closureRate}</span>
          </div>
          <div className="flex justify-between border-b border-foreground/5 pb-2">
            <span className="text-foreground/45 uppercase">Cognitive_Depth</span>
            <span className="font-bold text-foreground">{cognitiveDepth}</span>
          </div>
          <div className="flex justify-between border-b border-foreground/5 pb-2">
            <span className="text-foreground/45 uppercase">Conscientiousness</span>
            <span className="font-bold text-foreground">{conscientiousness}</span>
          </div>
          <div className="flex justify-between border-b border-foreground/5 pb-2">
            <span className="text-foreground/45 uppercase">Extraversion</span>
            <span className="font-bold text-foreground">{extraversion}</span>
          </div>
          <div className="flex justify-between border-b border-foreground/5 pb-2">
            <span className="text-foreground/45 uppercase">Search_Radius</span>
            <span className="font-bold text-foreground">{searchRadius}</span>
          </div>
          <div className="flex justify-between border-b border-foreground/5 pb-2">
            <span className="text-foreground/45 uppercase">Hesitation_Flag</span>
            <span className="font-bold text-foreground">{hesitationFlag}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground/45 uppercase">Active_Dossier_Status</span>
            <span className="font-bold text-green-500 uppercase">CALIBRATED</span>
          </div>
        </div>
      </div>

      {/* Profile Settings (Editor Section) */}
      <div className="mb-6 border border-foreground/15 bg-card p-5 rounded-none">
        <div className="flex items-center justify-between mb-4 border-b border-foreground/10 pb-3">
          <p className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">NASTAVENIE PROFILU // ATRIBÚTY</p>
          <button
            onClick={() => {
              haptic("tap");
              if (isEditing) {
                handleSaveProfile();
              } else {
                setIsEditing(true);
              }
            }}
            className="border border-foreground/20 px-3 py-1 font-mono text-[9px] font-bold text-foreground hover:bg-foreground/5 transition-all rounded-none uppercase"
          >
            {isEditing ? "[ 💾 ULOŽIŤ ]" : "[ ✎ UPRAVIŤ ]"}
          </button>
        </div>

        {isEditing ? (
          <div className="space-y-4 font-mono text-xs">
            <div>
              <label className="block text-[8px] text-muted-foreground uppercase mb-1">Meno</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full border border-foreground/20 bg-background p-2 font-mono text-xs text-foreground focus:border-foreground focus:outline-none rounded-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[8px] text-muted-foreground uppercase mb-1">Vek</label>
                <input
                  type="number"
                  value={editAge}
                  onChange={(e) => setEditAge(Number(e.target.value))}
                  className="w-full border border-foreground/20 bg-background p-2 font-mono text-xs text-foreground focus:border-foreground focus:outline-none rounded-none"
                />
              </div>
              <div>
                <label className="block text-[8px] text-muted-foreground uppercase mb-1">Mesto</label>
                <input
                  type="text"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  className="w-full border border-foreground/20 bg-background p-2 font-mono text-xs text-foreground focus:border-foreground focus:outline-none rounded-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-[8px] text-muted-foreground uppercase mb-1">Hľadaný rádius (km)</label>
              <input
                type="number"
                value={editRadius}
                onChange={(e) => setEditRadius(Number(e.target.value))}
                className="w-full border border-foreground/20 bg-background p-2 font-mono text-xs text-foreground focus:border-foreground focus:outline-none rounded-none"
              />
            </div>
            <div>
              <label className="block text-[8px] text-muted-foreground uppercase mb-1">Krátke bio</label>
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                rows={3}
                className="w-full border border-foreground/20 bg-background p-2 font-mono text-xs text-foreground focus:border-foreground focus:outline-none rounded-none resize-none"
              />
            </div>
          </div>
        ) : (
          <div className="font-mono text-xs text-foreground/80 space-y-2.5">
            <div className="flex justify-between border-b border-foreground/5 pb-2">
              <span className="text-foreground/45 uppercase text-[9px]">Meno</span>
              <span className="font-bold">{user.name}</span>
            </div>
            <div className="flex justify-between border-b border-foreground/5 pb-2">
              <span className="text-foreground/45 uppercase text-[9px]">Vek</span>
              <span className="font-bold">{user.age} rokov</span>
            </div>
            <div className="flex justify-between border-b border-foreground/5 pb-2">
              <span className="text-foreground/45 uppercase text-[9px]">Mesto</span>
              <span className="font-bold">{user.city || "Neuvedené"}</span>
            </div>
            <div className="flex justify-between border-b border-foreground/5 pb-2">
              <span className="text-foreground/45 uppercase text-[9px]">Rádius</span>
              <span className="font-bold">{user.radiusKm || 250} km</span>
            </div>
            <div>
              <span className="text-foreground/45 uppercase text-[9px] block mb-1">Bio</span>
              <p className="italic text-[10px] text-foreground/75 leading-relaxed bg-foreground/[0.01] p-2 border border-foreground/5 font-sans">
                {user.bio || "Tento profil zatiaľ nemá žiadne vyplnené bio."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Actions */}
      <div className="space-y-3">
        <button
          onClick={onBack}
          className="w-full border border-foreground/20 py-3 text-xs tracking-widest text-foreground font-mono font-bold uppercase hover:bg-foreground/5 transition-all rounded-none"
        >
          [ SPÄŤ ]
        </button>
      </div>

      {/* Recording Overlay Modal */}
      {recordingIndex !== null && (
        <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-[150] flex flex-col justify-center items-center p-4">
          <div className="w-full max-w-sm border border-foreground/20 bg-card p-6 rounded-none relative">
            <div className="mb-4 font-mono text-[9px] tracking-widest text-red-500 font-bold uppercase animate-pulse">
              [ CCTV CAMERA RECORDER INTERFACE ]
            </div>
            
            <div className="relative aspect-video w-full border border-foreground/20 rounded-none bg-black overflow-hidden mb-6">
              <video ref={videoRef} playsInline muted className="size-full object-cover scale-110" style={{ transform: "scaleX(-1)" }} />
              
              {recordingState === "countdown" && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                  <span className="font-mono text-4xl text-white font-bold animate-ping">{countdown}</span>
                  <span className="font-mono text-[9px] text-white/50 tracking-widest uppercase mt-2">Príprava...</span>
                </div>
              )}

              {recordingState === "recording" && (
                <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/70 px-2 py-0.5 border border-red-500">
                  <span className="size-1.5 rounded-full bg-red-500 animate-ping" />
                  <span className="font-mono text-[7px] text-white tracking-widest uppercase">REC (3s)</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={cancelRecording}
                className="flex-1 border border-foreground/20 py-3 text-xs tracking-widest text-foreground/60 font-mono font-bold uppercase hover:bg-foreground/5 transition-all rounded-none"
              >
                [ ZRUŠIŤ ]
              </button>
              {recordingState === "countdown" && (
                <div className="flex-1 grid place-items-center font-mono text-[10px] tracking-widest text-foreground font-bold uppercase">
                  Priprav sa...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LegalPage({ title, onBack, body }: { title: string; onBack: () => void; body: Array<{ h: string; p: string[] }> }) {
  return (
    <div className="animate-fade-up">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1 text-xs tracking-widest text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> NASTAVENIA
        </button>
      </div>
      <h1 className="mb-2 font-sans text-2xl tracking-tight text-foreground font-black uppercase">{title}</h1>
      <p className="mb-6 font-mono text-[10px] tracking-widest text-muted-foreground">POSLEDNÁ AKTUALIZÁCIA · JÚN 2026</p>

      <div className="space-y-5">
        {body.map((s, i) => (
          <section key={i} className="border border-border bg-card p-5">
            <h2 className="mb-3 font-sans text-base text-foreground font-bold uppercase">{s.h}</h2>
            <div className="space-y-3">
              {s.p.map((line, j) => (
                <p key={j} className="text-sm leading-relaxed text-muted-foreground">{line}</p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Toto je informatívne zhrnutie pravidiel. V prípade nejasností nás kontaktuj cez sekciu <span className="text-foreground">Kontakt</span>.
      </p>
    </div>
  );
}

const TERMS_BODY: Array<{ h: string; p: string[] }> = [
  { h: "1. O službe", p: [
    "Reson je aplikácia na zoznamovanie založené na psychologickej rezonancii. Namiesto swipovania ťa páruje cez krátky test a hlasovú konverzáciu.",
    "Používaním aplikácie potvrdzuješ, že máš aspoň 16 rokov a že údaje o sebe poskytuješ pravdivo.",
  ]},
  { h: "2. Tvoje povinnosti", p: [
    "Zaväzuješ sa nepoužívať aplikáciu na obťažovanie, spam, podvody, propagáciu nenávisti či komerčné účely.",
    "Tvoje overenie tváre slúži výhradne na potvrdenie, že si reálny človek. Vydávanie sa za iného je dôvodom na okamžité ukončenie účtu.",
  ]},
  { h: "3. Obsah a komunikácia", p: [
    "Hlasovky aj textové správy sú medzi tebou a tvojím partnerom v rozhovore. Ukončením konverzácie sa obsah natrvalo zmaže z oboch zariadení.",
    "Zakazuje sa zdieľať obsah, ktorý je nezákonný, urážlivý, sexuálne explicitný bez súhlasu druhej strany alebo porušuje práva tretích osôb.",
  ]},
  { h: "4. Ukončenie účtu", p: [
    "Účet môžeš kedykoľvek zrušiť v sekcii Nastavenia. Po zrušení sú tvoje dáta odstránené v zákonných lehotách.",
    "Vyhradzujeme si právo ukončiť účet, ktorý porušuje tieto podmienky, bez nároku na náhradu.",
  ]},
  { h: "5. Zodpovednosť", p: [
    "Aplikácia je poskytovaná „tak, ako je\". Snažíme sa o jej spoľahlivosť, ale nezodpovedáme za rozhodnutia, ktoré urobíš na základe interakcií s inými používateľmi.",
    "Za bezpečnosť pri osobných stretnutiach mimo aplikácie nesieš plnú zodpovednosť ty.",
  ]},
  { h: "6. Zmeny podmienok", p: [
    "Tieto podmienky môžeme aktualizovať. O podstatných zmenách ťa upozorníme v aplikácii a budeš mať možnosť ich prijať alebo účet zrušiť.",
  ]},
];

const PRIVACY_BODY: Array<{ h: string; p: string[] }> = [
  { h: "1. Kto sme", p: [
    "Prevádzkovateľom služby Reson je tím vývojárov so sídlom v Slovenskej republike. V zmysle Nariadenia (EÚ) 2016/679 (GDPR) sme prevádzkovateľom tvojich osobných údajov.",
  ]},
  { h: "2. Aké údaje spracúvame", p: [
    "Identifikačné: telefónne číslo, krstné meno alebo prezývka, vek, mesto, pohlavie, orientácia.",
    "Overovacie: krátky 3-sekundový videoklip tváre slúžiaci na potvrdenie, že si reálny človek.",
    "Behaviorálne: odpovede na 6 testových otázok, hodnotenia rezonancie, história rozhovorov (uložené iba v tvojom zariadení).",
  ]},
  { h: "3. Účely spracúvania", p: [
    "Poskytovanie služby — párovanie, komunikácia, bezpečnosť účtu.",
    "Zlepšovanie kvality (v agregovanej, anonymizovanej forme).",
    "Plnenie zákonných povinností.",
  ]},
  { h: "4. Doba uchovania", p: [
    "Profilové údaje: po dobu existencie účtu.",
    "Overovacie video: maximálne 30 dní, alebo do úspešného overenia.",
    "Konverzácie: ukladajú sa lokálne v tvojom zariadení. Ukončením rozhovoru sú natrvalo zmazané.",
  ]},
  { h: "5. Tvoje práva (GDPR)", p: [
    "Právo na prístup, opravu, výmaz, obmedzenie spracúvania, prenosnosť a námietku.",
    "Právo podať sťažnosť na Úrade na ochranu osobných údajov SR.",
    "Žiadosti adresuj cez sekciu Kontakt — odpovieme do 30 dní.",
  ]},
  { h: "6. Bezpečnosť", p: [
    "Údaje sú šifrované pri prenose (TLS) aj v pokoji. K osobným údajom má prístup len obmedzený okruh autorizovaných osôb.",
  ]},
];

const COOKIES_BODY: Array<{ h: string; p: string[] }> = [
  { h: "Aké cookies používame", p: [
    "Nevyhnutné: udržiavajú tvoje prihlásenie a preferenciu vzhľadu (tmavý/svetlý režim). Bez nich aplikácia nefunguje.",
    "Funkčné: zapamätajú si jazyk a nastavenia.",
    "Nepoužívame reklamné ani trackingové cookies tretích strán.",
  ]},
  { h: "Lokálne úložisko", p: [
    "Tvoje rozhovory ukladáme do localStorage tvojho zariadenia. Nemáme k nim na našom serveri prístup.",
    "Údaje môžeš kedykoľvek zmazať v Nastaveniach.",
  ]},
];

const CONTACT_BODY: Array<{ h: string; p: string[] }> = [
  { h: "Napíš nám", p: [
    "Pre otázky, sťažnosti a uplatnenie GDPR práv: hello@reson.app",
    "Odpovedáme v pracovných dňoch zvyčajne do 48 hodín.",
  ]},
  { h: "Bezpečnostné incidenty", p: [
    "Ak narazíš na bezpečnostnú chybu, prosím nahlás ju na: security@reson.app",
  ]},
];

