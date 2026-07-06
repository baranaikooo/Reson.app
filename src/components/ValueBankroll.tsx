import { useState } from "react";
import { useHaptic } from "@/hooks/use-haptics";
import { Coins, Check } from "lucide-react";

interface ValueBankrollProps {
  onDone: (conscientiousness: number, priorities: Record<string, number>) => void;
  onSliderChange?: (conscientiousness: number, extraversion: number) => void;
}

const CATEGORIES = [
  { id: "rodina", label: "Rodina & Vzťahy", desc: "Zázemie, rodinné hodnoty, blízki ľudia" },
  { id: "kariera", label: "Kariéra & Rozvoj", desc: "Ambície, úspech, financie a vzdelanie" },
  { id: "stabilita", label: "Bezpečie & Stabilita", desc: "Plánovanie, istota, dlhodobý poriadok" },
  { id: "kreativita", label: "Kreativita & Zvedavosť", desc: "Umenie, nové myšlienky, bádanie" },
  { id: "sloboda", label: "Sloboda & Dobrodružstvo", desc: "Cestovanie, nezávislosť, spontánnosť" },
];

export function ValueBankroll({ onDone, onSliderChange }: ValueBankrollProps) {
  const haptic = useHaptic();
  const [allocations, setAllocations] = useState<Record<string, number>>({
    rodina: 0,
    kariera: 0,
    stabilita: 0,
    kreativita: 0,
    sloboda: 0,
  });

  const totalChips = 100;
  const allocatedSum = Object.values(allocations).reduce((a, b) => a + b, 0);
  const remainingChips = totalChips - allocatedSum;

  const getDerivedMetrics = (currentAllocations: Record<string, number>) => {
    const rodina = currentAllocations.rodina || 0;
    const career = currentAllocations.kariera || 0;
    const stability = currentAllocations.stabilita || 0;
    const kreativita = currentAllocations.kreativita || 0;
    const freedom = currentAllocations.sloboda || 0;

    const conscientiousness = (career + stability + (20 - freedom / 5)) / 220;
    const clampedC = Math.max(0.1, Math.min(0.99, conscientiousness));

    const extraversion =
      (0.8 * freedom + 0.6 * rodina + 0.5 * career + 0.4 * kreativita + 0.2 * stability) / 100;
    const clampedE = Math.max(0.1, Math.min(0.99, extraversion));

    return { c: clampedC, e: clampedE };
  };

  const handleSliderChange = (id: string, val: number) => {
    const currentVal = allocations[id] || 0;
    const diff = val - currentVal;

    if (diff > remainingChips) {
      const maxPossible = currentVal + remainingChips;
      if (maxPossible !== currentVal) {
        haptic("tap");
        setAllocations((prev) => {
          const next = { ...prev, [id]: maxPossible };
          const { c, e } = getDerivedMetrics(next);
          onSliderChange?.(c, e);
          return next;
        });
      }
    } else {
      haptic("tap");
      setAllocations((prev) => {
        const next = { ...prev, [id]: val };
        const { c, e } = getDerivedMetrics(next);
        onSliderChange?.(c, e);
        return next;
      });
    }
  };

  const handleConfirm = () => {
    if (allocatedSum !== totalChips) return;
    haptic("success");

    const { c } = getDerivedMetrics(allocations);
    onDone(c, allocations);
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-8 animate-fade-up">
      {/* Top Header */}
      <div className="flex items-center justify-between text-xs tracking-widest text-foreground/50 uppercase font-mono mb-4">
        <span>Kvíz osobnosti (2. časť)</span>
        <span>Životné hodnoty</span>
      </div>

      {/* Utilitarian Chips Box Indicator */}
      <div className="border border-foreground/20 bg-card p-6 mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-foreground/10 p-3 text-foreground">
            <Coins className="size-6" />
          </div>
          <div>
            <h4 className="font-sans font-bold text-foreground text-base uppercase">Tvoje body</h4>
            <p className="text-xs text-foreground/50 font-mono">// Rozdeľ presne 100 bodov</p>
          </div>
        </div>
        <div className="text-right">
          <span className="font-mono text-4xl font-black text-foreground">{remainingChips}</span>
          <span className="text-xs text-foreground/50 uppercase font-mono block">zostáva</span>
        </div>
      </div>

      {/* Sliders Container */}
      <div className="space-y-6">
        {CATEGORIES.map((cat) => {
          const val = allocations[cat.id] || 0;
          return (
            <div key={cat.id} className="border border-foreground/10 bg-card p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-0.5 pr-2">
                  <h5 className="text-base font-bold text-foreground uppercase">
                    {cat.label}
                  </h5>
                  <p className="text-sm text-foreground/55 leading-relaxed font-mono">{cat.desc}</p>
                </div>
                <div className="bg-foreground/10 px-3 py-1.5 font-mono text-base font-bold text-foreground">
                  {val}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={val}
                  onChange={(e) => handleSliderChange(cat.id, parseInt(e.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none bg-foreground/10 accent-foreground"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Button */}
      <div className="mt-8">
        <button
          type="button"
          disabled={allocatedSum !== totalChips}
          onClick={handleConfirm}
          className="w-full flex items-center justify-center gap-2 bg-foreground text-background font-mono font-bold text-lg tracking-wider uppercase py-4.5 hover:bg-foreground/90 disabled:opacity-20 disabled:pointer-events-none active:scale-[0.99] transition-all"
        >
          {allocatedSum === totalChips ? (
            <>
              <Check className="size-5" />
              <span>ULOŽIŤ PRIORITNÝ PROFIL</span>
            </>
          ) : (
            <span className="font-mono text-lg tracking-wider">ROZDEĽ EŠTE {remainingChips} BODOV</span>
          )}
        </button>
      </div>
    </div>
  );
}
