import { useState, useEffect } from "react";
import { useHaptic } from "@/hooks/use-haptics";
import { ArrowRight } from "lucide-react";

interface SemanticMirrorProps {
  onDone: (cognitiveDepth: number) => void;
}

const METAPHORS_POOL = [
  {
    text: "Láska nie je prístav, v ktorom kotvíme, ale...",
    options: [
      { text: "...búrka, ktorú sa učíme milovať.", weight: 0.4 },
      { text: "...neznámy oceán, ktorý spoločne mapujeme bez kompasu.", weight: 1.0 },
      { text: "...lístok na cestu, ktorá nemá žiadny konečný cieľ.", weight: 0.7 }
    ]
  },
  {
    text: "Ticho medzi dvoma ľuďmi je buď...",
    options: [
      { text: "...prázdnota, ktorú treba vyplniť hlukom slov.", weight: 0.3 },
      { text: "...most postavený z nevypovedaných myšlienok, ktorému obaja rozumejú.", weight: 1.0 },
      { text: "...bezpečné útočisko, kde slová strácajú svoju váhu.", weight: 0.8 }
    ]
  },
  {
    text: "Zrkadlo nám neukazuje to, kým sme, ale...",
    options: [
      { text: "...len povrch, ktorý chce vidieť svet.", weight: 0.4 },
      { text: "...mozaiku našich minulých jaziev a budúcich nádejí.", weight: 1.0 },
      { text: "...odraz človeka, ktorého sa bojíme spoznať.", weight: 0.8 }
    ]
  },
  {
    text: "Sloboda nie je robiť to, čo chceme, ale...",
    options: [
      { text: "...nebyť nútený robiť to, čo nechceme.", weight: 0.8 },
      { text: "...chápať hranice svojho vlastného väzenia a prekračovať ich.", weight: 1.0 },
      { text: "...mať možnosť vybrať si svoje vlastné závislosti.", weight: 0.5 }
    ]
  },
  {
    text: "Domov nie je miesto, kde sme sa narodili, ale...",
    options: [
      { text: "...priestor, kde môžeme byť slabí bez strachu.", weight: 1.0 },
      { text: "...adresa, ktorú píšeme na balíky z ciest.", weight: 0.4 },
      { text: "...ľudia, ktorí si všimnú, keď tam nie sme.", weight: 0.7 }
    ]
  },
  {
    text: "Čas nie je rieka, ktorá tečie jedným smerom, ale...",
    options: [
      { text: "...archív okamihov, v ktorých žijeme opakovane.", weight: 0.9 },
      { text: "...lineárne pravítko, ktoré meria naše starnutie.", weight: 0.3 },
      { text: "...sieť ciest, kde každé rozhodnutie vytvára nový vesmír.", weight: 1.0 }
    ]
  },
  {
    text: "Porozumieť druhému znamená...",
    options: [
      { text: "...vedieť preložiť jeho mlčanie do vlastného jazyka.", weight: 1.0 },
      { text: "...súhlasím so všetkým, čo hovorí a robí.", weight: 0.3 },
      { text: "...prijať skutočnosť, že ho nikdy úplne nespoznáme.", weight: 0.8 }
    ]
  },
  {
    text: "Dôvera je ako papier, ktorý...",
    options: [
      { text: "...ak raz pokrčíš, už nikdy nebude úplne hladký.", weight: 0.7 },
      { text: "...sa ľahko spáli, ale popol z neho zostáva navždy.", weight: 1.0 },
      { text: "...slúži len na zapisovanie dočasných sľubov.", weight: 0.4 }
    ]
  },
  {
    text: "Zmena je jediná konštanta, ktorá...",
    options: [
      { text: "...nás núti rásť, aj keď sa bránime zubami-nechtami.", weight: 0.8 },
      { text: "...nás neustále vyzlieka z našich starých identít.", weight: 1.0 },
      { text: "...iba prináša chaos do našich naplánovaných životov.", weight: 0.5 }
    ]
  }
];

export function SemanticMirror({ onDone }: SemanticMirrorProps) {
  const haptic = useHaptic();
  const [metaphors, setMetaphors] = useState<typeof METAPHORS_POOL>([]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  useEffect(() => {
    const shuffled = [...METAPHORS_POOL].sort(() => 0.5 - Math.random());
    setMetaphors(shuffled.slice(0, 3));
  }, []);

  const handleSelect = (idx: number) => {
    haptic("tap");
    setSelectedIdx(idx);
  };

  const handleNext = () => {
    if (selectedIdx === null || metaphors.length === 0) return;
    
    haptic("medium");
    const weight = metaphors[step].options[selectedIdx].weight;
    const newAnswers = [...answers, weight];
    setAnswers(newAnswers);
    
    if (step < metaphors.length - 1) {
      setStep(step + 1);
      setSelectedIdx(null);
    } else {
      const avgDepth = newAnswers.reduce((a, b) => a + b, 0) / metaphors.length;
      onDone(avgDepth);
    }
  };

  if (metaphors.length === 0) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="size-8 animate-spin border-2 border-foreground border-t-transparent" />
      </div>
    );
  }

  const currentMetaphor = metaphors[step];

  return (
    <div className="mx-auto w-full max-w-md px-4 py-8 animate-fade-up">
      {/* Step Indicator */}
      <div className="flex items-center justify-between text-xs tracking-widest text-foreground/50 uppercase font-mono mb-4">
        <span>Sémantické zrkadlo</span>
        <span>{step + 1} / {metaphors.length}</span>
      </div>
      
      {/* Progress Bar */}
      <div className="h-1.5 w-full bg-foreground/10 overflow-hidden mb-8">
        <div 
          className="h-full bg-foreground transition-all duration-300"
          style={{ width: `${((step + 1) / metaphors.length) * 100}%` }}
        />
      </div>

      {/* Main card */}
      <div className="border border-foreground/20 bg-card p-8 relative overflow-hidden mb-6">
        <p className="font-mono text-[9px] tracking-wider text-foreground/45 uppercase mb-3">// Doplň myšlienku</p>
        <h3 className="font-sans text-xl font-bold leading-relaxed text-foreground uppercase">
          &ldquo;{currentMetaphor.text}&rdquo;
        </h3>
      </div>

      {/* Options List */}
      <div className="space-y-3">
        {currentMetaphor.options.map((opt, idx) => {
          const isSelected = selectedIdx === idx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelect(idx)}
              className={`w-full text-left border px-6 py-4 transition-all duration-200 active:scale-[0.98] ${
                isSelected 
                  ? "border-foreground bg-foreground/10 text-foreground font-bold" 
                  : "border-foreground/10 bg-foreground/[0.02] text-foreground/75 hover:bg-foreground/5"
              }`}
            >
              <p className="text-sm font-medium leading-relaxed">{opt.text}</p>
            </button>
          );
        })}
      </div>

      {/* Next Button */}
      <div className="mt-8">
        <button
          type="button"
          disabled={selectedIdx === null}
          onClick={handleNext}
          className="w-full flex items-center justify-center gap-2 bg-foreground text-background font-mono font-bold text-xs tracking-widest uppercase py-4 hover:bg-foreground/90 disabled:opacity-20 active:scale-[0.99] transition-all"
        >
          <span>{step === metaphors.length - 1 ? "DOKONČIŤ ZRKADLO" : "ĎALŠIA KARTA"}</span>
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
