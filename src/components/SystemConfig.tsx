import React, { useState } from "react";
import { Settings as SettingsIcon, ShieldAlert, Key, LogOut, Trash2 } from "lucide-react";
import { UserProfile, ThemeMode } from "@/lib/resonance";
import { useHaptic } from "@/hooks/use-haptics";

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

  // Local settings states
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(user.age + 10 || 35);
  const [distance, setDistance] = useState(user.radiusKm || 250);
  const [orientation, setOrientation] = useState(user.orientation || "hetero");

  function saveFilterChange(key: string, value: any) {
    haptic("tap");
    onUpdateUser((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        [key]: value,
      };
    });
  }

  // Reset Hardware permissions JIT state
  function handleResetPermissions() {
    haptic("warning");
    try {
      localStorage.removeItem("reson:mic_primed");
      localStorage.removeItem("reson:camera_primed");
      alert("Hardvérové povolenia boli zresetované. Pri najbližšej interakcii sa znova vyžiada prístup.");
    } catch {
      alert("Nepodarilo sa vyčistiť nastavenia prehliadača.");
    }
  }

  // Account Management
  function handleLogout() {
    haptic("warning");
    if (confirm("Naozaj sa chcete odhlásiť? Všetky lokálne dáta a rozhovory zostanú v tomto zariadení.")) {
      try {
        localStorage.removeItem("reson:profile");
      } catch {
        /* ignore */
      }
      location.reload();
    }
  }

  function handleDeleteAccount() {
    haptic("destructive");
    if (confirm("POZOR: Naozaj chcete natrvalo vymazať svoj účet? Táto akcia je nevratná a zmaže všetky vaše dáta z našich systémov.")) {
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
        <h1 className="font-sans text-2xl tracking-tight text-foreground font-black uppercase">SYSTEM CONFIG // NASTAVENIA</h1>
        <span className="font-mono text-xs tracking-widest text-muted-foreground">RESON v0.9</span>
      </div>

      {/* Discovery Filters */}
      <div className="mb-6 border border-foreground/10 bg-card p-5 rounded-none space-y-4">
        <p className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">DISCOVERY FILTERS</p>

        <div className="space-y-4 font-mono text-xs">
          {/* Distance Filter */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-foreground/45 uppercase text-[9px]">MAX VZDIALENOSŤ</span>
              <span className="font-bold text-foreground">{distance} km</span>
            </div>
            <input
              type="range"
              min="5"
              max="500"
              step="5"
              value={distance}
              onChange={(e) => {
                const val = Number(e.target.value);
                setDistance(val);
                saveFilterChange("radiusKm", val);
              }}
              className="w-full accent-foreground h-1 bg-foreground/10 rounded-none cursor-pointer"
            />
          </div>

          {/* Age range mock representation */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-foreground/45 uppercase text-[9px]">VEKOVÉ ROZPÄTIE</span>
              <span className="font-bold text-foreground">{ageMin} - {ageMax} rokov</span>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                min="18"
                max="99"
                value={ageMin}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setAgeMin(val);
                }}
                className="w-1/2 border border-foreground/20 bg-background p-2 font-mono text-xs text-foreground focus:border-foreground focus:outline-none rounded-none"
              />
              <input
                type="number"
                min="18"
                max="99"
                value={ageMax}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setAgeMax(val);
                }}
                className="w-1/2 border border-foreground/20 bg-background p-2 font-mono text-xs text-foreground focus:border-foreground focus:outline-none rounded-none"
              />
            </div>
          </div>

          {/* Orientation Dropdown */}
          <div>
            <label className="block text-[8px] text-muted-foreground uppercase mb-1">Sexuálna orientácia</label>
            <select
              value={orientation}
              onChange={(e) => {
                const val = e.target.value;
                setOrientation(val);
                saveFilterChange("orientation", val);
              }}
              className="w-full border border-foreground/20 bg-background p-2 font-mono text-xs text-foreground focus:border-foreground focus:outline-none rounded-none"
            >
              <option value="hetero">Heterosexuálna</option>
              <option value="homo">Homosexuálna</option>
              <option value="bi">Bisexuálna</option>
              <option value="other">Iná / Neurodivergentná</option>
            </select>
          </div>
        </div>
      </div>

      {/* Theme Config */}
      <div className="mb-6 border border-foreground/10 bg-card p-4 rounded-none">
        <p className="mb-3 font-mono text-[9px] tracking-widest text-foreground/45 uppercase">VZHĽAD SYSTEMU</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { haptic("tap"); onTheme("dark"); }}
            className={`border py-3 text-xs tracking-widest transition-all rounded-none font-mono ${
              theme === "dark"
                ? "border-foreground bg-foreground text-background font-bold"
                : "border-foreground/10 bg-transparent text-foreground/65 hover:bg-foreground/[0.02]"
            }`}
          >
            TMAVÝ
          </button>
          <button
            onClick={() => { haptic("tap"); onTheme("light"); }}
            className={`border py-3 text-xs tracking-widest transition-all rounded-none font-mono ${
              theme === "light"
                ? "border-foreground bg-foreground text-background font-bold"
                : "border-foreground/10 bg-transparent text-foreground/65 hover:bg-foreground/[0.02]"
            }`}
          >
            SVETLÝ
          </button>
        </div>
      </div>

      {/* Hardware Access Reset */}
      <div className="mb-6 border border-foreground/10 bg-card p-5 rounded-none">
        <p className="mb-3 font-mono text-[9px] tracking-widest text-muted-foreground uppercase">HARDWARE & PERMISSIONS</p>
        <button
          onClick={handleResetPermissions}
          className="w-full flex items-center justify-between border border-foreground/10 p-4 text-left transition-all hover:bg-foreground/5 rounded-none font-mono text-xs uppercase"
        >
          <div className="flex items-center gap-3">
            <Key className="size-4 text-foreground/70" />
            <div>
              <p className="font-bold text-foreground">Reset JIT prístupu</p>
              <p className="text-[9px] text-muted-foreground mt-0.5 font-sans normal-case">Vynútiť znovuvyžiadanie prístupu ku kamere a mikrofónu</p>
            </div>
          </div>
          <span className="text-[10px] text-foreground/45 font-bold font-mono">[ RESET ]</span>
        </button>
      </div>

      {/* Legal & Terms Row actions */}
      <div className="mb-6 border border-foreground/10 bg-card p-4 rounded-none space-y-2">
        <p className="mb-2 font-mono text-[9px] tracking-widest text-muted-foreground uppercase">DOKUMENTÁCIA</p>
        <div className="grid grid-cols-2 gap-2 text-center font-mono text-[10px]">
          <button onClick={() => { haptic("tap"); onOpenTerms(); }} className="border border-foreground/10 py-2.5 hover:bg-foreground/5 transition-all rounded-none uppercase">PODMIENKY</button>
          <button onClick={() => { haptic("tap"); onOpenPrivacy(); }} className="border border-foreground/10 py-2.5 hover:bg-foreground/5 transition-all rounded-none uppercase">GDPR</button>
          <button onClick={() => { haptic("tap"); onOpenCookies(); }} className="border border-foreground/10 py-2.5 hover:bg-foreground/5 transition-all rounded-none uppercase">COOKIES</button>
          <button onClick={() => { haptic("tap"); onOpenContact(); }} className="border border-foreground/10 py-2.5 hover:bg-foreground/5 transition-all rounded-none uppercase">KONTAKT</button>
        </div>
      </div>

      {/* Account Management Actions */}
      <div className="border border-red-500/25 bg-red-500/5 p-5 rounded-none space-y-3">
        <p className="font-mono text-[9px] tracking-widest text-red-500/80 uppercase">ACCOUNT MANAGEMENT</p>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 border border-foreground/20 hover:border-foreground/40 py-3 font-mono text-xs font-bold text-foreground rounded-none bg-card hover:bg-foreground/5 transition-all"
          >
            <LogOut className="size-4" /> ODHLÁSIŤ SA
          </button>
          <button
            onClick={handleDeleteAccount}
            className="flex items-center justify-center gap-2 border border-red-500/40 hover:border-red-500/60 py-3 font-mono text-xs font-bold text-red-600 rounded-none bg-card hover:bg-red-500/10 transition-all"
          >
            <Trash2 className="size-4" /> ZMAZAŤ ÚČET
          </button>
        </div>
      </div>
    </div>
  );
}
