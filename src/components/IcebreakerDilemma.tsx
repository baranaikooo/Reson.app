import { useHaptic } from "@/hooks/use-haptics";
import { Sparkles, MessageCircle } from "lucide-react";

interface IcebreakerDilemmaProps {
  similarity: number;
  complementarity: number;
  userStyle: string;
  matchStyle: string;
  userTopPriority: string;
  matchTopPriority: string;
}

const CATEGORY_NAMES: Record<string, string> = {
  rodina: "Rodina",
  kariera: "Kariéra",
  stabilita: "Stabilita",
  kreativita: "Kreativita",
  sloboda: "Sloboda"
};

export function IcebreakerDilemma({
  similarity,
  complementarity,
  userStyle,
  matchStyle,
  userTopPriority,
  matchTopPriority
}: IcebreakerDilemmaProps) {
  const haptic = useHaptic();

  // Generate dilemma content based on vectors
  let dilemmaTitle = "Algoritmická Dilema";
  let dilemmaText = "";
  let reason = "";

  if (userTopPriority === matchTopPriority && userTopPriority) {
    dilemmaTitle = "Spoločná Základná Hodnota";
    reason = `Oboja zdieľate rovnakú životnú prioritu: ${CATEGORY_NAMES[userTopPriority] || userTopPriority}.`;
    
    if (userTopPriority === "rodina") {
      dilemmaText = "Predstavte si, že máte možnosť odísť na rok na izolovanú chatu v lese úplne bez signálu, kde budete mať len jeden druhého. Prijali by ste to, alebo je pre vás rodinné zázemie spojené s blízkosťou širšieho okolia?";
    } else if (userTopPriority === "kariera") {
      dilemmaText = "Oboch vás poháňa úspech. Ak by jeden z vás dostal životnú ponuku v zahraničí, ktorá by však znamenala, že druhý musí svoju kariéru na 2 roky odložiť, ako by ste to vyriešili?";
    } else if (userTopPriority === "stabilita") {
      dilemmaText = "Zhodli ste sa na potrebe istoty. Čo by vás viac vyviedlo z rovnováhy: nečakaná výpoveď z bytu s nutnosťou rýchleho sťahovania, alebo zistenie, že váš partner urobil veľké spontánne finančné rozhodnutie?";
    } else if (userTopPriority === "kreativita") {
      dilemmaText = "Umenie a objavovanie sú vaše jadro. Ak by ste mali spoločne vytvoriť jedno dielo (obraz, pieseň alebo knihu), o čom by bolo a kto z vás by priniesol chaos a kto štruktúru?";
    } else {
      dilemmaText = "Sloboda je pre vás všetkým. Znamená pre vás sloboda vo vzťahu možnosť tráviť veľa času osamote bez vysvetľovania, alebo spoločné bezhraničné dobrodružstvá?";
    }
  } else if (complementarity > 0.75) {
    dilemmaTitle = "Komplementárny Kontrast";
    reason = "Zafungoval zákon príťažlivosti protikladov (Introvertná a Extrovertná polarita).";
    dilemmaText = "Jeden z vás miluje nabíjanie batérií osamote, druhý čerpá energiu zo sociálneho ruchu. Ak by ste mali naplánovať ideálny víkend, kde by v sobotu večer bol veľký večierok a v nedeľu ticho v prírode, prežili by ste to v harmónii?";
  } else {
    dilemmaTitle = "Kognitívne Zrkadlenie";
    reason = `Vaša kognitívna zhoda je vysoká (${Math.round(similarity * 100)}%).`;
    dilemmaText = "Dostali ste možnosť zistiť presný dátum a okolnosti konca vášho vzťahu s vedomím, že to nemôžete zmeniť. Chceli by ste to vedieť, aby ste si viac vážili spoločný čas, alebo by to pre vás bolo prekliatím?";
  }

  return (
    <div className="border border-foreground/20 bg-card p-6 relative overflow-hidden">
      {/* Sparkle background element */}
      <div className="absolute top-0 right-0 p-4 opacity-5">
        <Sparkles className="size-12 text-foreground" />
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="border border-foreground/20 p-1.5 text-foreground bg-foreground/5">
          <Sparkles className="size-4" />
        </div>
        <h4 className="font-mono font-bold text-sm tracking-wide text-foreground uppercase">{dilemmaTitle}</h4>
      </div>

      {/* Rationale text */}
      <p className="text-[9px] tracking-wider text-foreground/45 uppercase font-mono mb-4 leading-relaxed">
        // {reason}
      </p>

      {/* Dilemma Question */}
      <div className="bg-foreground/5 border border-foreground/10 p-5 mb-5">
        <p className="text-xs font-medium leading-relaxed text-foreground/80 italic font-mono uppercase">
          &ldquo;{dilemmaText}&rdquo;
        </p>
      </div>

      {/* Visual indicator of the icebreaker */}
      <div className="flex items-center gap-3 text-[10px] text-foreground/45 font-mono uppercase">
        <div className="flex -space-x-1">
          <div className="size-5 border border-foreground bg-foreground text-[8px] flex items-center justify-center text-background font-mono font-bold">
            {userStyle[0]}
          </div>
          <div className="size-5 border border-foreground bg-foreground text-[8px] flex items-center justify-center text-background font-mono font-bold">
            {matchStyle[0]}
          </div>
        </div>
        <span>Odpovedzte hlasovou správou</span>
      </div>
    </div>
  );
}
