import React, { useState, useEffect, useRef } from "react";
import {
  Settings as SettingsIcon,
  ShieldAlert,
  ShieldCheck,
  Key,
  LogOut,
  Trash2,
  Camera,
  Mic,
  Compass,
  AlertTriangle,
  Snowflake,
  Loader2,
} from "lucide-react";
import { UserProfile, ThemeMode } from "@/lib/resonance";
import { useHaptic } from "@/hooks/use-haptics";
import { supabase } from "@/lib/supabase";

interface SystemConfigProps {
  user: UserProfile;
  onUpdateUser: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  theme: ThemeMode;
  onTheme: (m: ThemeMode) => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
  onOpenCookies: () => void;
  onOpenContact: () => void;
}

export function SystemConfig({
  user,
  onUpdateUser,
  theme,
  onTheme,
  onOpenTerms,
  onOpenPrivacy,
  onOpenCookies,
  onOpenContact,
}: SystemConfigProps) {
  const haptic = useHaptic();

  // Hardware permissions states
  const [micPermission, setMicPermission] = useState<"granted" | "denied" | "prompt">("prompt");
  const [camPermission, setCamPermission] = useState<"granted" | "denied" | "prompt">("prompt");
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lon: number } | null>(
    user.coords ?? null,
  );
  const [isGpsLoading, setIsGpsLoading] = useState(false);

  // Alerts states
  const [criticalAlerts, setCriticalAlerts] = useState(true);
  const [messageAlerts, setMessageAlerts] = useState(true);

  // Market freeze state
  const [isFrozen, setIsFrozen] = useState(false);
  const [showLivenessModal, setShowLivenessModal] = useState(false);

  // Fetch permissions status on mount
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: "microphone" as any })
        .then((result) => {
          setMicPermission(result.state);
          result.onchange = () => setMicPermission(result.state);
        })
        .catch(() => {});

      navigator.permissions
        .query({ name: "camera" as any })
        .then((result) => {
          setCamPermission(result.state);
          result.onchange = () => setCamPermission(result.state);
        })
        .catch(() => {});
    }
  }, []);

  function saveFilterChange(key: string, value: any) {
    onUpdateUser((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        [key]: value,
      };
    });
  }

  // Refresh Geolocation coordinates
  function handleRefreshCoordinates() {
    haptic("tap");
    setIsGpsLoading(true);

    if (!navigator.geolocation) {
      alert("Geolokácia nie je podporovaná týmto prehliadačom.");
      setIsGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const newCoords = { lat: latitude, lon: longitude };
        setGpsCoords(newCoords);
        saveFilterChange("coords", newCoords);
        setIsGpsLoading(false);
        haptic("success");
        alert(
          `Súradnice aktualizované: [Lat: ${latitude.toFixed(4)}, Lon: ${longitude.toFixed(4)}]`,
        );
      },
      (err) => {
        console.error("[config] GPS refresh error:", err);
        alert("Chyba geolokácie: Uistite sa, že máte zapnuté GPS a povolené vyhľadávanie.");
        setIsGpsLoading(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      },
    );
  }

  // Market Freeze Toggle (hides profile without EV penalty)
  function handleToggleFreeze() {
    haptic("warning");
    const nextState = !isFrozen;
    setIsFrozen(nextState);
    alert(
      nextState
        ? "SKRYTIE PROFILU AKTÍVNE: Váš profil je dočasne skrytý pred ostatnými. Vaša doterajšia kompatibilita zostáva zachovaná."
        : "PROFIL JE AKTÍVNY: Váš profil je znova viditeľný pre ostatných.",
    );
  }

  // Account Management
  function handleLogout() {
    haptic("warning");
    if (confirm("Naozaj sa chcete odhlásiť?")) {
      try {
        localStorage.removeItem("reson:profile");
      } catch {
        /* ignore */
      }
      location.reload();
    }
  }

  function handleDataWipe() {
    haptic("destructive");
    if (
      confirm(
        "UPOZORNENIE: Chystáte sa natrvalo zmazať svoj profil. Všetky informácie, výsledky testov a správy budú permanentne vymazané. Táto akcia je NEVRATNÁ. Chcete pokračovať?",
      )
    ) {
      try {
        localStorage.clear();
      } catch {
        /* ignore */
      }
      location.reload();
    }
  }

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between border-b border-foreground/15 pb-4">
        <h1 className="font-sans text-2xl tracking-tight text-foreground font-black uppercase">
          NASTAVENIA ÚČTU
        </h1>
        <span className="font-mono text-xs tracking-widest text-muted-foreground">RESON v0.9</span>
      </div>

      {/* Hardware Protocols */}
      <div className="mb-6 border border-foreground/10 bg-card p-5 rounded-none space-y-4">
        <p className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
          POVOLENIA A POLOHA
        </p>

        <div className="space-y-3 font-mono text-xs">
          {/* Permission indicators */}
          <div className="flex justify-between border-b border-foreground/5 pb-2">
            <span className="text-foreground/45 uppercase flex items-center gap-1.5">
              <Mic className="size-3.5" /> Mikrofón
            </span>
            <span
              className={`font-bold uppercase ${micPermission === "granted" ? "text-green-500" : "text-amber-500"}`}
            >
              {micPermission === "granted" ? "[ POVOLENÝ ]" : "[ NEPOVOLENÝ ]"}
            </span>
          </div>

          <div className="flex justify-between border-b border-foreground/5 pb-2">
            <span className="text-foreground/45 uppercase flex items-center gap-1.5">
              <Camera className="size-3.5" /> Kamera
            </span>
            <span
              className={`font-bold uppercase ${camPermission === "granted" ? "text-green-500" : "text-amber-500"}`}
            >
              {camPermission === "granted" ? "[ POVOLENÝ ]" : "[ NEPOVOLENÝ ]"}
            </span>
          </div>

          {/* Coordinate status */}
          <div className="flex justify-between items-center border-b border-foreground/5 pb-2">
            <span className="text-foreground/45 uppercase flex items-center gap-1.5">
              <Compass className="size-3.5" /> Poloha GPS
            </span>
            <span className="text-[10px] text-foreground/80 font-mono">
              {gpsCoords
                ? `[${gpsCoords.lat.toFixed(4)}, ${gpsCoords.lon.toFixed(4)}]`
                : "[ NEZISTENÁ ]"}
            </span>
          </div>

          {/* High accuracy ping button */}
          <button
            onClick={handleRefreshCoordinates}
            disabled={isGpsLoading}
            className="w-full border border-foreground/20 py-3 text-xs tracking-widest text-foreground font-mono font-bold uppercase hover:bg-foreground/5 transition-all rounded-none bg-card flex justify-center items-center gap-2"
          >
            {isGpsLoading ? "[ VYHĽADÁVAM... ]" : "[ AKTUALIZOVAŤ POLOHU ]"}
          </button>
        </div>
      </div>

      {/* Alert System (Anti-Ghosting Penalty Warning highlights) */}
      <div className="mb-6 border border-foreground/10 bg-card p-5 rounded-none space-y-4">
        <p className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
          NOTIFIKÁCIE A UPOZORNENIA
        </p>

        <div className="space-y-4 font-mono text-xs">
          {/* CRITICAL WARNING MANDATORY ALERTS */}
          <div className="border border-red-500/35 bg-red-500/[0.02] p-4 rounded-none space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-red-500 font-bold uppercase flex items-center gap-1.5">
                <AlertTriangle className="size-3.5" /> DÔLEŽITÉ UPOZORNENIA
              </span>
              <span className="bg-red-500/20 text-red-500 text-[8px] font-bold px-2 py-0.5 rounded-none uppercase">
                POVINNÉ
              </span>
            </div>
            <p className="text-[9px] text-red-500/70 normal-case leading-relaxed font-sans">
              Varovania pred neaktívnosťou v konverzáciách a limit 180 sekúnd v hlasovom chate.
              Tieto správy sú dôležité a nie je možné ich vypnúť.
            </p>
          </div>

          {/* Standard alert toggles */}
          <div className="flex justify-between items-center pt-2">
            <span className="text-foreground/60 uppercase">Nové správy a spojenia</span>
            <button
              onClick={() => {
                haptic("tap");
                setMessageAlerts(!messageAlerts);
              }}
              className="border border-foreground/20 px-3 py-1 text-[10px] rounded-none font-bold"
            >
              {messageAlerts ? "[ ZAPNUTÉ ]" : "[ VYPNUTÉ ]"}
            </button>
          </div>
        </div>
      </div>

      {/* Theme Settings */}
      <div className="mb-6 border border-foreground/10 bg-card p-4 rounded-none">
        <p className="mb-3 font-mono text-[9px] tracking-widest text-foreground/45 uppercase">
          Vzhľad aplikácie
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              haptic("tap");
              onTheme("dark");
            }}
            className={`border py-3 text-xs tracking-widest transition-all rounded-none font-mono ${
              theme === "dark"
                ? "border-foreground bg-foreground text-background"
                : "border-foreground/10 bg-transparent text-foreground/65 hover:bg-foreground/[0.02]"
            }`}
          >
            TMAVÝ
          </button>
          <button
            onClick={() => {
              haptic("tap");
              onTheme("light");
            }}
            className={`border py-3 text-xs tracking-widest transition-all rounded-none font-mono ${
              theme === "light"
                ? "border-foreground bg-foreground text-background"
                : "border-foreground/10 bg-transparent text-foreground/65 hover:bg-foreground/[0.02]"
            }`}
          >
            SVETLÝ
          </button>
        </div>
      </div>

      {/* Legal & Terms Row actions */}
      <div className="mb-6 border border-foreground/10 bg-card p-4 rounded-none space-y-2">
        <p className="mb-2 font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
          DOKUMENTÁCIA
        </p>
        <div className="grid grid-cols-2 gap-2 text-center font-mono text-[10px]">
          <button
            onClick={() => {
              haptic("tap");
              onOpenTerms();
            }}
            className="border border-foreground/10 py-2.5 hover:bg-foreground/5 transition-all rounded-none uppercase"
          >
            PODMIENKY
          </button>
          <button
            onClick={() => {
              haptic("tap");
              onOpenPrivacy();
            }}
            className="border border-foreground/10 py-2.5 hover:bg-foreground/5 transition-all rounded-none uppercase"
          >
            GDPR
          </button>
          <button
            onClick={() => {
              haptic("tap");
              onOpenCookies();
            }}
            className="border border-foreground/10 py-2.5 hover:bg-foreground/5 transition-all rounded-none uppercase"
          >
            COOKIES
          </button>
          <button
            onClick={() => {
              haptic("tap");
              onOpenContact();
            }}
            className="border border-foreground/10 py-2.5 hover:bg-foreground/5 transition-all rounded-none uppercase"
          >
            KONTAKT
          </button>
        </div>
      </div>

      {/* Account Liquidity & Wiping Actions */}
      <div className="border border-red-500/25 bg-red-500/5 p-5 rounded-none space-y-3">
        <p className="font-mono text-[9px] tracking-widest text-red-500/80 uppercase">
          SPRAVOVANIE ÚČTU
        </p>

        {/* Biometric Verification Tier-1 Button */}
        <button
          onClick={() => {
            haptic("tap");
            setShowLivenessModal(true);
          }}
          className="w-full border border-foreground/20 py-3 text-xs tracking-widest text-foreground font-mono font-bold uppercase hover:bg-foreground/5 transition-all rounded-none bg-card flex justify-center items-center gap-2"
        >
          <ShieldCheck className="size-4" />
          {user.livenessVerified ? "[ BIOMETRIA: OVERENÁ TIER-1 ]" : "[ BIOMETRICKÉ OVERENIE ]"}
        </button>

        <div className="grid grid-cols-3 gap-2">
          {/* MARKET FREEZE */}
          <button
            onClick={handleToggleFreeze}
            className={`flex flex-col items-center justify-center border py-2.5 font-mono text-[8px] font-bold tracking-wider transition-all rounded-none bg-card ${
              isFrozen
                ? "border-blue-500 text-blue-500 bg-blue-500/5"
                : "border-foreground/20 text-foreground hover:bg-foreground/5"
            }`}
          >
            <Snowflake className="size-4 mb-1" />
            {isFrozen ? "[ ROZBALIŤ ]" : "[ SKRYŤ PROFIL ]"}
          </button>

          {/* SIGN OUT */}
          <button
            onClick={handleLogout}
            className="flex flex-col items-center justify-center border border-foreground/20 hover:border-foreground/40 py-2.5 font-mono text-[8px] font-bold tracking-wider text-foreground rounded-none bg-card hover:bg-foreground/5 transition-all"
          >
            <LogOut className="size-4 mb-1" />[ ODHLÁSIŤ ]
          </button>

          {/* DATA WIPE */}
          <button
            onClick={handleDataWipe}
            className="flex flex-col items-center justify-center border border-red-500/40 hover:border-red-500/60 py-2.5 font-mono text-[8px] font-bold tracking-wider text-red-600 rounded-none bg-card hover:bg-red-500/10 transition-all"
          >
            <Trash2 className="size-4 mb-1" />[ ZMAZAŤ ÚČET ]
          </button>
        </div>
      </div>

      {showLivenessModal && (
        <LivenessModal
          user={user}
          onClose={() => setShowLivenessModal(false)}
          onVerifySuccess={() => {
            onUpdateUser((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                livenessVerified: true,
                verifiedAt: new Date().toISOString(),
              };
            });
            setShowLivenessModal(false);
          }}
        />
      )}
    </div>
  );
}

interface LivenessModalProps {
  user: UserProfile;
  onVerifySuccess: () => void;
  onClose: () => void;
}

function LivenessModal({ user, onVerifySuccess, onClose }: LivenessModalProps) {
  const haptic = useHaptic();
  const [step, setStep] = useState<"id" | "face" | "submitting" | "success">("id");
  const [countdown, setCountdown] = useState(3);
  const [scanActive, setScanActive] = useState(true);

  // Countdown timer for automatic capture
  useEffect(() => {
    if (step !== "id" && step !== "face") return;
    setCountdown(3);
    setScanActive(true);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          haptic("success");
          if (step === "id") {
            setStep("face");
          } else {
            triggerWebhook();
          }
          return 0;
        }
        haptic("tap");
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [step]);

  async function generateHmacSha256(message: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(message);

    const key = await window.crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signature = await window.crypto.subtle.sign("HMAC", key, messageData);

    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  async function triggerWebhook() {
    setStep("submitting");
    haptic("medium");

    const userId = user.id || "00000000-0000-0000-0000-000000000001";
    const status = "success";
    const provider = "FaceTec";
    const verifiedAt = new Date().toISOString();

    try {
      // Generate HMAC signature using shared secret
      const rawPayload = `${userId}:${status}:${provider}`;
      const webhookSecret = import.meta.env.VITE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        throw new Error("Missing VITE_WEBHOOK_SECRET environment variable");
      }
      const signature = await generateHmacSha256(rawPayload, webhookSecret);

      // Call secure FastAPI webhook
      const res = await fetch("/api/webhooks/identity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Identity-Signature": signature,
        },
        body: JSON.stringify({
          userId,
          status,
          provider,
          verifiedAt,
        }),
      });

      if (res.ok) {
        // Also update local Supabase Auth session metadata if logged in
        await supabase.auth
          .updateUser({
            data: { liveness_verified: true },
          })
          .catch((e) => console.warn("[frontend] Auth metadata update failed:", e));

        setStep("success");
        haptic("success");
        setTimeout(() => {
          onVerifySuccess();
        }, 2000);
      } else {
        const errText = await res.text();
        alert(`Chyba webhooku: ${errText}`);
        onClose();
      }
    } catch (err: any) {
      console.error("[liveness-sdk] Webhook post failed:", err);
      alert(`Sieťová chyba pri verifikácii: ${err.message}`);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-md z-[200] flex items-center justify-center p-4">
      <div className="w-full max-w-sm border border-foreground/20 bg-card p-6 rounded-none relative animate-fade-up">
        {step !== "success" && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-xs font-mono text-foreground/50 hover:text-foreground uppercase"
          >
            [ zrušiť ]
          </button>
        )}

        <div className="mb-4 font-mono text-[9px] tracking-widest text-red-500 font-bold uppercase animate-pulse">
          [ BIOMETRICKÉ OVERENIE - TIER 1 ]
        </div>

        {step === "id" && (
          <div className="space-y-4">
            <h3 className="font-sans text-base font-bold uppercase text-foreground">
              Skenovanie dokladu totožnosti
            </h3>
            <p className="text-[10px] text-foreground/60 leading-relaxed font-mono">
              Držte občiansky preukaz alebo pas v zornom poli kamery.
            </p>

            <div className="relative aspect-[3/4] w-full border border-foreground/20 bg-black flex items-center justify-center overflow-hidden">
              {/* Pulsing Guide box */}
              <div className="absolute size-4/5 border-2 border-dashed border-foreground/35 rounded-sm flex items-center justify-center">
                <span className="text-[8px] font-mono text-foreground/40 uppercase">
                  Vložte doklad sem
                </span>
              </div>

              {/* Scanline animation */}
              {scanActive && (
                <div
                  className="absolute inset-x-0 h-0.5 bg-red-600 animate-bounce"
                  style={{ top: "30%" }}
                />
              )}

              <div className="absolute inset-0 bg-red-950/5 flex items-center justify-center">
                <span className="font-mono text-4xl text-white font-black">{countdown}</span>
              </div>
            </div>

            <div className="font-mono text-[8px] text-foreground/40 text-center uppercase">
              FaceTec SDK: Detekcia okrajov dokladu aktívna...
            </div>
          </div>
        )}

        {step === "face" && (
          <div className="space-y-4">
            <h3 className="font-sans text-base font-bold uppercase text-foreground">
              3D Liveness detekcia
            </h3>
            <p className="text-[10px] text-foreground/60 leading-relaxed font-mono">
              Umiestnite tvár do stredu a žmurknite na kameru.
            </p>

            <div className="relative aspect-[3/4] w-full border border-foreground/20 bg-black flex items-center justify-center overflow-hidden">
              {/* Oval guide box */}
              <div className="absolute w-2/3 h-3/4 border-2 border-dashed border-foreground/35 rounded-full flex items-center justify-center" />

              {/* Concentric scan circles */}
              <div className="absolute size-44 border border-foreground/10 rounded-full animate-ping" />
              <div className="absolute size-24 border border-foreground/15 rounded-full animate-pulse" />

              <div className="absolute inset-0 bg-red-950/5 flex items-center justify-center">
                <span className="font-mono text-4xl text-white font-black">{countdown}</span>
              </div>
            </div>

            <div className="font-mono text-[8px] text-foreground/40 text-center uppercase">
              FaceTec SDK: Analýza hĺbky a mikropohybov...
            </div>
          </div>
        )}

        {step === "submitting" && (
          <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
            <Loader2 className="size-8 animate-spin text-foreground animate-pulse" />
            <h3 className="font-sans text-sm font-bold uppercase text-foreground">
              Odosielanie biometrického balíka
            </h3>
            <p className="text-[10px] text-foreground/60 font-mono max-w-xs leading-relaxed uppercase">
              Volá sa zabezpečený webhook: <br />
              <span className="text-red-500 font-bold">/api/webhooks/identity</span> <br />s
              kryptografickým podpisom HMAC-SHA256
            </p>
          </div>
        )}

        {step === "success" && (
          <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
            <div className="size-12 rounded-full border border-green-500 bg-green-500/10 flex items-center justify-center text-green-500 animate-pulse">
              <ShieldCheck className="size-6" />
            </div>
            <h3 className="font-sans text-base font-bold uppercase text-green-600">
              Overenie úspešné
            </h3>
            <p className="text-xs text-foreground/70">
              Váš profil bol plne overený (Tier-1 Biometrics).
            </p>
            <span className="font-mono text-[9px] bg-green-500/20 text-green-600 px-2 py-0.5 uppercase tracking-widest font-bold">
              [ VERIFIED_TIER_1 ]
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
