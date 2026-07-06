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
import { BackgroundGeoEngine } from "@/lib/geo";

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
  const [isFrozen, setIsFrozen] = useState(user.status === "FROZEN");

  // Local personalization states
  const [hapticProfile, setHapticProfile] = useState<"STEALTH" | "TACTILE" | "MECHANICAL">(
    user.haptic_profile || (localStorage.getItem("reson_haptic_profile") as any) || "TACTILE"
  );
  const [geoDensity, setGeoDensity] = useState<"ECO_5KM" | "BALANCED_2KM" | "HIGH_FREQ_500M">(
    user.geo_density || (localStorage.getItem("reson_geo_density") as any) || "BALANCED_2KM"
  );
  const [uiSpeed, setUiSpeed] = useState<"TYPEWRITER_ANIMATED" | "INSTANT_RAW">(
    user.ui_speed || (localStorage.getItem("reson_ui_speed") as any) || "TYPEWRITER_ANIMATED"
  );

  // Sync initial database settings to state and local storage on mount/update
  useEffect(() => {
    if (user.haptic_profile) {
      setHapticProfile(user.haptic_profile);
      localStorage.setItem("reson_haptic_profile", user.haptic_profile);
    }
    if (user.geo_density) {
      setGeoDensity(user.geo_density);
      localStorage.setItem("reson_geo_density", user.geo_density);
      BackgroundGeoEngine.setDistanceFilter(user.geo_density);
    }
    if (user.ui_speed) {
      setUiSpeed(user.ui_speed);
      localStorage.setItem("reson_ui_speed", user.ui_speed);
    }
  }, [user.haptic_profile, user.geo_density, user.ui_speed]);

  async function handleUpdateHapticProfile(val: "STEALTH" | "TACTILE" | "MECHANICAL") {
    setHapticProfile(val);
    localStorage.setItem("reson_haptic_profile", val);
    haptic("tap");

    if (user.id && user.id !== "00000000-0000-0000-0000-000000000001") {
      const { error } = await supabase
        .from("profiles")
        .update({ haptic_profile: val })
        .eq("id", user.id);
      if (error) {
        console.error("[settings] failed to save haptic profile in database:", error);
      }
    }
    onUpdateUser((prev) => (prev ? { ...prev, haptic_profile: val } : null));
  }

  async function handleUpdateGeoDensity(val: "ECO_5KM" | "BALANCED_2KM" | "HIGH_FREQ_500M") {
    setGeoDensity(val);
    localStorage.setItem("reson_geo_density", val);
    BackgroundGeoEngine.setDistanceFilter(val);
    haptic("tap");

    if (user.id && user.id !== "00000000-0000-0000-0000-000000000001") {
      const { error } = await supabase
        .from("profiles")
        .update({ geo_density: val })
        .eq("id", user.id);
      if (error) {
        console.error("[settings] failed to save geo density in database:", error);
      }
    }
    onUpdateUser((prev) => (prev ? { ...prev, geo_density: val } : null));
  }

  async function handleUpdateUiSpeed(val: "TYPEWRITER_ANIMATED" | "INSTANT_RAW") {
    setUiSpeed(val);
    localStorage.setItem("reson_ui_speed", val);
    haptic("tap");

    if (user.id && user.id !== "00000000-0000-0000-0000-000000000001") {
      const { error } = await supabase
        .from("profiles")
        .update({ ui_speed: val })
        .eq("id", user.id);
      if (error) {
        console.error("[settings] failed to save UI speed in database:", error);
      }
    }
    onUpdateUser((prev) => (prev ? { ...prev, ui_speed: val } : null));
  }

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
  async function handleToggleFreeze() {
    haptic("warning");
    const nextState = !isFrozen;
    setIsFrozen(nextState);

    if (user.id && user.id !== "00000000-0000-0000-0000-000000000001") {
      const { error } = await supabase
        .from("profiles")
        .update({ status: nextState ? "FROZEN" : "ACTIVE" })
        .eq("id", user.id);

      if (error) {
        console.error("[settings] failed to toggle freeze in database:", error);
        alert("Chyba: Nepodarilo sa zmeniť stav profilu v databáze.");
        setIsFrozen(!nextState); // rollback
        return;
      }
    }

    onUpdateUser((prev) => (prev ? { ...prev, status: nextState ? "FROZEN" : "ACTIVE" } : null));

    alert(
      nextState
        ? "SKRYTIE PROFILU AKTÍVNE: Váš profil je dočasne skrytý pred ostatnými. Vaša doterajšia kompatibilita zostáva zachovaná."
        : "PROFIL JE AKTÍVNY: Váš profil je znova viditeľný pre ostatných.",
    );
  }

  // Account Management
  async function handleLogout() {
    haptic("warning");
    if (confirm("Naozaj sa chcete odhlásiť?")) {
      try {
        localStorage.clear();
      } catch {
        /* ignore */
      }
      await supabase.auth.signOut();
      location.reload();
    }
  }

  async function handleDataWipe() {
    haptic("destructive");
    if (
      confirm(
        "UPOZORNENIE: Chystáte sa natrvalo zmazať svoj profil. Všetky informácie, výsledky testov a správy budú permanentne vymazané. Táto akcia je NEVRATNÁ. Chcete pokračovať?",
      )
    ) {
      if (user.id && user.id !== "00000000-0000-0000-0000-000000000001") {
        const { error } = await supabase
          .from("profiles")
          .delete()
          .eq("id", user.id);

        if (error) {
          console.error("[settings] failed to delete profile from database:", error);
          alert("Chyba: Nepodarilo sa zmazať profil z databázy.");
          return;
        }
      }

      try {
        localStorage.clear();
      } catch {
        /* ignore */
      }
      await supabase.auth.signOut();
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

      {/* Personalization & System Engine Configs */}
      <div className="mb-6 border border-foreground/10 bg-card p-5 rounded-none space-y-4">
        <p className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
          HARDWARE & PERSONALIZÁCIA
        </p>

        <div className="space-y-4 font-mono text-xs">
          {/* Haptic profile */}
          <div className="space-y-2 border-b border-foreground/5 pb-3">
            <div className="flex justify-between items-center">
              <span className="text-foreground/60 uppercase">Haptický profil</span>
              <span className="text-[10px] font-bold text-foreground bg-foreground/10 px-2 py-0.5 uppercase">
                {hapticProfile}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {(["STEALTH", "TACTILE", "MECHANICAL"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => handleUpdateHapticProfile(p)}
                  className={`border py-2 text-[8px] font-bold tracking-wider rounded-none transition-all cursor-pointer ${
                    hapticProfile === p
                      ? "border-foreground bg-foreground text-background"
                      : "border-foreground/10 text-foreground/50 hover:bg-foreground/5"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* GPS background tracking density */}
          <div className="space-y-2 border-b border-foreground/5 pb-3">
            <div className="flex justify-between items-center">
              <span className="text-foreground/60 uppercase">Frekvencia GPS</span>
              <span className="text-[10px] font-bold text-foreground bg-foreground/10 px-2 py-0.5 uppercase">
                {geoDensity.replace("_", " ")}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {(["ECO_5KM", "BALANCED_2KM", "HIGH_FREQ_500M"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => handleUpdateGeoDensity(d)}
                  className={`border py-2 text-[8px] font-bold tracking-wider rounded-none transition-all cursor-pointer ${
                    geoDensity === d
                      ? "border-foreground bg-foreground text-background"
                      : "border-foreground/10 text-foreground/50 hover:bg-foreground/5"
                  }`}
                >
                  {d.split("_")[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Progressive Typewriter rendering speed */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-foreground/60 uppercase">Vykresľovanie textu</span>
              <span className="text-[10px] font-bold text-foreground bg-foreground/10 px-2 py-0.5 uppercase">
                {uiSpeed === "TYPEWRITER_ANIMATED" ? "POSTUPNÉ" : "OKAMŽITÉ"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleUpdateUiSpeed("TYPEWRITER_ANIMATED")}
                className={`border py-2 text-[8px] font-bold tracking-wider rounded-none transition-all cursor-pointer ${
                  uiSpeed === "TYPEWRITER_ANIMATED"
                    ? "border-foreground bg-foreground text-background"
                    : "border-foreground/10 text-foreground/50 hover:bg-foreground/5"
                }`}
              >
                TYPEWRITER
              </button>
              <button
                onClick={() => handleUpdateUiSpeed("INSTANT_RAW")}
                className={`border py-2 text-[8px] font-bold tracking-wider rounded-none transition-all cursor-pointer ${
                  uiSpeed === "INSTANT_RAW"
                    ? "border-foreground bg-foreground text-background"
                    : "border-foreground/10 text-foreground/50 hover:bg-foreground/5"
                }`}
              >
                RAW (OKAMŽITE)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Theme Settings */}
      <div className="mb-6 border border-foreground/10 bg-card p-4 rounded-none">
        <p className="mb-3 font-mono text-[9px] tracking-widest text-foreground/45 uppercase">
          Vzhľad aplikácie
        </p>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => {
              haptic("tap");
              onTheme("system");
            }}
            className={`border py-3 text-xs tracking-widest transition-all rounded-none font-mono cursor-pointer ${
              theme === "system"
                ? "border-foreground bg-foreground text-background"
                : "border-foreground/10 bg-transparent text-foreground/65 hover:bg-foreground/[0.02]"
            }`}
          >
            SYSTÉM
          </button>
          <button
            onClick={() => {
              haptic("tap");
              onTheme("dark");
            }}
            className={`border py-3 text-xs tracking-widest transition-all rounded-none font-mono cursor-pointer ${
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
            className={`border py-3 text-xs tracking-widest transition-all rounded-none font-mono cursor-pointer ${
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
            {isFrozen ? "[ ODKRYŤ PROFIL ]" : "[ SKRYŤ PROFIL ]"}
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
    </div>
  );
}
