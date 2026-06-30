import { useEffect, useState } from "react";
import { Cookie, Shield, BarChart3, Sparkles, ChevronDown } from "lucide-react";

const KEY = "reson-cookie-consent-v1";

type Prefs = { necessary: true; analytics: boolean; personalization: boolean };

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>({ necessary: true, analytics: true, personalization: true });

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function save(value: "accepted" | "rejected" | "custom", p?: Prefs) {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          value,
          prefs:
            value === "accepted"
              ? { necessary: true, analytics: true, personalization: true }
              : value === "rejected"
                ? { necessary: true, analytics: false, personalization: false }
                : p,
          ts: Date.now(),
        }),
      );
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  const Row = ({
    icon: Icon,
    title,
    desc,
    checked,
    locked,
    onChange,
  }: {
    icon: typeof Shield;
    title: string;
    desc: string;
    checked: boolean;
    locked?: boolean;
    onChange?: (v: boolean) => void;
  }) => (
    <div className="flex items-start gap-3 rounded-2xl border border-border/40 bg-background/30 p-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] font-semibold tracking-wide text-foreground">{title}</p>
          <button
            onClick={() => !locked && onChange?.(!checked)}
            disabled={locked}
            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
              checked ? "bg-primary" : "bg-muted-foreground/30"
            } ${locked ? "opacity-60" : ""}`}
            aria-pressed={checked}
          >
            <span
              className={`absolute top-0.5 size-4 rounded-full bg-background shadow transition-all ${
                checked ? "left-[18px]" : "left-0.5"
              }`}
            />
          </button>
        </div>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{desc}</p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] md:inset-x-auto md:right-4 md:bottom-4 md:max-w-md animate-fade-up">
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-background/85 shadow-glow backdrop-blur-xl">
        <div className="flex items-start gap-3 p-5">
          <div className="relative flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 text-primary">
            <Cookie className="size-4" />
            <span className="absolute -top-1 -right-1 size-2 rounded-full bg-primary animate-pulse" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-sans text-sm font-bold tracking-wide text-foreground uppercase">
              Tvoje súkromie, tvoja voľba
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Používame cookies, aby Reson fungoval hladko. Voliteľné nám pomáhajú zlepšovať zážitok.
            </p>
          </div>
        </div>

        {expanded && (
          <div className="space-y-2 px-5 pb-1">
            <Row
              icon={Shield}
              title="Nevyhnutné"
              desc="Bez týchto aplikácia nefunguje (prihlásenie, bezpečnosť)."
              checked
              locked
            />
            <Row
              icon={BarChart3}
              title="Analytika"
              desc="Anonymné dáta o používaní, aby sme vedeli, čo zlepšiť."
              checked={prefs.analytics}
              onChange={(v) => setPrefs({ ...prefs, analytics: v })}
            />
            <Row
              icon={Sparkles}
              title="Personalizácia"
              desc="Lepšie odporúčania rezonancií podľa tvojich odpovedí."
              checked={prefs.personalization}
              onChange={(v) => setPrefs({ ...prefs, personalization: v })}
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-2 px-5 pb-4 pt-3">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] font-medium tracking-wide text-muted-foreground hover:text-foreground"
          >
            {expanded ? "Skryť detaily" : "Prispôsobiť"}
            <ChevronDown className={`size-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
          <div className="flex flex-1 justify-end gap-2">
            <button
              onClick={() => (expanded ? save("custom", prefs) : save("rejected"))}
              className="border border-border/60 bg-background/40 px-3 py-2 text-[11px] font-mono font-medium tracking-[0.14em] text-foreground/80 hover:bg-background/60"
            >
              {expanded ? "ULOŽIŤ" : "ODMIETNUŤ"}
            </button>
            <button
              onClick={() => save("accepted")}
              className="cta-gradient cta-gradient-hover px-4 py-2 text-[11px] font-mono font-semibold tracking-[0.14em]"
            >
              <span className="relative z-10">PRIJAŤ VŠETKO</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
