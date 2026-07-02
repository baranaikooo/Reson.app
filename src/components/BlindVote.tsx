import { useHaptic } from "@/hooks/use-haptics";
import { Key, Trash2, HelpCircle } from "lucide-react";

interface BlindVoteProps {
  onVote: (vote: "unlock" | "cancel") => void;
}

export function BlindVote({ onVote }: BlindVoteProps) {
  const haptic = useHaptic();

  const handleVote = (vote: "unlock" | "cancel") => {
    if (vote === "unlock") {
      haptic("success");
    } else {
      haptic("heavy");
    }
    onVote(vote);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md border border-foreground/20 bg-card p-8 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Top Warning Icon */}
        <div className="mx-auto w-12 h-12 bg-red-500/10 flex items-center justify-center text-red-500">
          <HelpCircle className="size-6 animate-pulse" />
        </div>

        {/* Text Details */}
        <div className="text-center space-y-2">
          <h3 className="font-sans font-black text-xl tracking-tight text-foreground uppercase">
            Prisoner's Dilemma
          </h3>
          <p className="font-mono text-[9px] tracking-widest text-red-500 uppercase font-bold">
            Slepé hlasovanie o budúcnosti
          </p>
          <p className="text-xs text-foreground/60 leading-relaxed pt-2 font-mono uppercase">
            Dosiahli ste 3-minútovú hranicu (180s) hlasovej komunikácie. Čet bol dočasne
            zablokovaný. Obaja musíte nezávisle (naslepo) rozhodnúť:
          </p>
        </div>

        {/* Rules visual list */}
        <div className="bg-foreground/5 border border-foreground/10 p-4 text-left space-y-2 font-mono text-[11px]">
          <div className="flex gap-2.5 items-start">
            <span className="text-foreground font-bold text-xs pt-0.5">✓</span>
            <p className="text-foreground/75 leading-relaxed">
              Ak **obaja** zvolíte *Odomknúť*, profilová fotografia/video sa zaostria a povolí sa
              neobmedzený textový čet.
            </p>
          </div>
          <div className="flex gap-2.5 items-start">
            <span className="text-red-500 font-bold text-xs pt-0.5">✗</span>
            <p className="text-foreground/75 leading-relaxed">
              Ak **čo i len jeden** zvolí *Zrušiť*, match sa okamžite a navždy vymaže pre oboch
              používateľov.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => handleVote("unlock")}
            className="w-full flex items-center justify-center gap-3 bg-foreground text-background font-mono font-bold text-xs tracking-widest uppercase py-4 hover:bg-foreground/90 active:scale-[0.99] transition-all"
          >
            <Key className="size-4" />
            <span>ODOMKNÚŤ PROFIL (COOPERATE)</span>
          </button>

          <button
            type="button"
            onClick={() => handleVote("cancel")}
            className="w-full flex items-center justify-center gap-3 border border-red-500/30 bg-red-500/5 text-red-500 font-mono font-bold text-xs tracking-widest uppercase py-4 hover:bg-red-500/10 active:scale-[0.99] transition-all"
          >
            <Trash2 className="size-4" />
            <span>ZRUŠIŤ MATCH (DEFECT)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
