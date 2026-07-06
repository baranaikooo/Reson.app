import { useState, useEffect, useRef } from "react";
import { useHaptic } from "@/hooks/use-haptics";
import { Send, AlertTriangle } from "lucide-react";

interface PressureChatProps {
  onDone: (
    attachmentStyle: string,
    responseTime: number,
    hesitated: boolean,
    scenarioId: string,
  ) => void;
  isOnboarding?: boolean;
  excludeScenarioIds?: string[];
}

export const SCENARIOS = [
  {
    id: "scenario_01_ghosting",
    sender: "Partner",
    message: "Prečo mi neodpisuješ celé poobede? Deje sa niečo?",
    options: [
      { text: "Sústredím sa na prácu, nepozerám na mobil.", style: "Avoidant" },
      { text: "Prepáč, nestíham. Hneď ako skončím, volám.", style: "Anxious" },
      { text: "Všetko je v pohode, len mám dnes zhon.", style: "Secure" },
    ],
  },
  {
    id: "scenario_02_cancellation",
    sender: "Partner",
    message: "Sorry, dnes to nedávam. Som úplne zničený/á, ruším to.",
    options: [
      { text: "Jasné, v pohode. Spravím si svoj program.", style: "Avoidant" },
      { text: "Chápem. Mám prísť aspoň na chvíľu ja za tebou?", style: "Anxious" },
      { text: "Jasné, oddýchni si. Dohodneme iný termín.", style: "Secure" },
    ],
  },
  {
    id: "scenario_03_jealousy",
    sender: "Partner",
    message: "Kamoši hovorili, že ťa videli v meste s niekým iným.",
    options: [
      { text: "Bolo to pracovné. Nemám dôvod to tajiť.", style: "Avoidant" },
      { text: "Zavolajme si, nechcem, aby si si niečo domýšľal.", style: "Anxious" },
      { text: "Bol som len na káve so známym. Nič sa nedeje.", style: "Secure" },
    ],
  },
  {
    id: "scenario_04_control",
    sender: "Partner",
    message: "Kto ti stále píše? Dúfam, že nemáš predo mnou tajnosti.",
    options: [
      { text: "Môj telefón je moje súkromie. Nemám tajnosti.", style: "Avoidant" },
      { text: "Kľudne ti to ukážem, nechcem aby si pochyboval.", style: "Anxious" },
      { text: "Sú to len veci z práce. Nemusíš to vôbel riešiť.", style: "Secure" },
    ],
  },
  {
    id: "scenario_05_distance",
    sender: "Partner",
    message: "Mám pocit, že sa mi vyhýbaš. Už ťa to nezaujíma?",
    options: [
      { text: "Zaujíma. Len teraz potrebujem trochu času pre seba.", style: "Avoidant" },
      { text: "Zaujíma! Mrzí ma, ak to tak vyzerá. Poďme von.", style: "Anxious" },
      { text: "Všetko je v poriadku, len som mal ťažší týždeň.", style: "Secure" },
    ],
  },
];

export function PressureChat({
  onDone,
  isOnboarding = false,
  excludeScenarioIds = [],
}: PressureChatProps) {
  const haptic = useHaptic();
  const startTimeRef = useRef<number>(0);
  const gyroSamples = useRef<{ time: number; beta: number; gamma: number }[]>([]);
  const lastTickRef = useRef<number>(0);

  // Pick a random scenario on component mount
  const [scenario] = useState(() => {
    const pool =
      excludeScenarioIds && excludeScenarioIds.length > 0
        ? SCENARIOS.filter((s) => !excludeScenarioIds.includes(s.id))
        : SCENARIOS;
    const finalPool = pool.length > 0 ? pool : SCENARIOS;
    const idx = Math.floor(Math.random() * finalPool.length);
    return finalPool[idx];
  });

  // Calculate dynamic reading time limit
  const wordCount = scenario.message.split(/\s+/).length;
  // If it's onboarding, give a fair fixed 12.0 seconds time to read & react.
  // Otherwise, use the hardcore dynamic limit of 5-8 seconds (min 8s clamp).
  const calculatedLimit = isOnboarding ? 12.0 : Math.max(wordCount / (200 / 60) + 6.0, 8.0);

  const [totalLimit] = useState(calculatedLimit);
  const [timeLeft, setTimeLeft] = useState(calculatedLimit);
  const [isTyping, setIsTyping] = useState(true);
  const [clicked, setClicked] = useState(false);

  // Gyroscopic orientation listener
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return;
      gyroSamples.current.push({
        time: performance.now(),
        beta: e.beta,
        gamma: e.gamma,
      });
      // Keep only last 3 seconds of samples
      const now = performance.now();
      gyroSamples.current = gyroSamples.current.filter((s) => now - s.time < 3000);
    };

    window.addEventListener("deviceorientation", handleOrientation);

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, []);

  // Phase 1: Typing Indicator for 3 seconds
  useEffect(() => {
    const typingTimer = setTimeout(() => {
      setIsTyping(false);
      haptic("warning");
      startTimeRef.current = performance.now();
      lastTickRef.current = performance.now();
    }, 3000);

    return () => clearTimeout(typingTimer);
  }, [haptic]);

  // Phase 2: Active countdown timer with haptic acceleration ticks
  useEffect(() => {
    if (isTyping || clicked) return;

    const start = performance.now();
    const initialLimit = timeLeft;

    const interval = setInterval(() => {
      const now = performance.now();
      const elapsed = (now - start) / 1000;
      const newTime = initialLimit - elapsed;

      if (newTime <= 0) {
        clearInterval(interval);
        handleTimeout();
        setTimeLeft(0);
      } else {
        setTimeLeft(newTime);
        const tickIntervalMs = newTime < 3.0 ? 300 : newTime < 6.0 ? 600 : 1200;
        if (now - lastTickRef.current >= tickIntervalMs) {
          haptic("tick"); // Subtle tick
          lastTickRef.current = now;
        }
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isTyping, clicked]);

  // Evaluates standard deviation of sensor angles to flag high hesitation
  const checkGyroscopeVolatility = (): boolean => {
    try {
      const now = performance.now();
      const recent = gyroSamples.current.filter(
        (s) =>
          s && typeof s.beta === "number" && typeof s.gamma === "number" && now - s.time < 2000,
      );
      if (recent.length < 5) return false;

      const betas = recent.map((s) => s.beta);
      const gammas = recent.map((s) => s.gamma);

      const meanBeta = betas.reduce((a, b) => a + b, 0) / betas.length;
      const meanGamma = gammas.reduce((a, b) => a + b, 0) / gammas.length;

      const varBeta = betas.reduce((a, b) => a + Math.pow(b - meanBeta, 2), 0) / betas.length;
      const varGamma = gammas.reduce((a, b) => a + Math.pow(b - meanGamma, 2), 0) / gammas.length;

      return varBeta > 12.0 || varGamma > 12.0;
    } catch (e) {
      console.warn("[pressure-chat] Gyro check failed, fallback to false:", e);
      return false;
    }
  };

  const handleTimeout = () => {
    if (clicked) return;
    setClicked(true);
    haptic("warning");
    const isHesitated = checkGyroscopeVolatility();
    console.warn(
      `[pressure-chat] Timeout triggered. Recording 'Timeout/Freeze' Avoidant style. Volatility: ${isHesitated}`,
    );
    onDone("Avoidant", totalLimit, isHesitated, scenario.id);
  };

  const handleSelect = (style: string) => {
    if (clicked || isTyping) return;
    setClicked(true);
    haptic("medium");

    const endTime = performance.now();
    const rt = (endTime - startTimeRef.current) / 1000.0;
    const isHesitated = checkGyroscopeVolatility();

    console.info(
      `[pressure-chat] User chose ${style} in ${rt.toFixed(2)}s (One-Tap). Volatility: ${isHesitated}`,
    );
    onDone(style, rt, isHesitated, scenario.id);
  };

  const progressPercent = (timeLeft / totalLimit) * 100;
  const isTimeCritical = timeLeft < 3.0;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-8 animate-fade-up">
      {/* Top Header */}
      <div className="flex items-center justify-between text-xs tracking-widest text-red-500/80 uppercase font-mono mb-4">
        <span className="flex items-center gap-1">
          <AlertTriangle className="size-3" /> {isTyping ? "Priprav sa..." : "Tlakový Test"}
        </span>
        <span
          className={`font-mono font-bold transition-all duration-300 ${isTimeCritical ? "text-red-500 scale-110" : "text-foreground"}`}
        >
          {isTyping ? "Načítavam..." : `${timeLeft.toFixed(2)}s`}
        </span>
      </div>

      {/* Shrinking Progress Bar */}
      <div className="h-1.5 w-full bg-foreground/5 overflow-hidden mb-8">
        <div
          className={`h-full transition-all duration-75 ${
            isTyping
              ? "bg-foreground/40 animate-pulse"
              : isTimeCritical
                ? "bg-red-500"
                : "bg-foreground"
          }`}
          style={{ width: `${isTyping ? 100 : progressPercent}%` }}
        />
      </div>

      {/* Fake Chat Screen Interface */}
      <div
        className={`border transition-all duration-300 overflow-hidden mb-8 flex flex-col h-80 justify-between ${
          isTyping
            ? "border-foreground/10 bg-card"
            : isTimeCritical
              ? "border-red-500/40 bg-red-950/10"
              : "border-foreground/10 bg-card"
        }`}
      >
        {/* Chat Header */}
        <div className="bg-foreground/[0.03] border-b border-foreground/10 px-6 py-4 flex items-center gap-3">
          <div className="size-8 bg-foreground text-background flex items-center justify-center font-bold text-xs font-mono">
            {scenario.sender.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground/90">{scenario.sender}</h4>
            <p
              className={`text-[10px] uppercase tracking-widest font-mono ${isTyping ? "text-foreground/40 animate-pulse" : isTimeCritical ? "text-red-500" : "text-foreground/60"}`}
            >
              {isTyping ? "píše..." : isTimeCritical ? "kritická odozva" : "aktívny"}
            </p>
          </div>
        </div>

        {/* Chat Feed */}
        <div className="p-6 flex-1 flex flex-col justify-end overflow-y-auto space-y-4">
          {isTyping ? (
            /* typing animation bubble */
            <div className="max-w-[85%] bg-foreground/5 border border-foreground/10 px-4 py-3 self-start flex items-center gap-1.5">
              <span
                className="size-1.5 animate-bounce bg-foreground/40"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="size-1.5 animate-bounce bg-foreground/40"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="size-1.5 animate-bounce bg-foreground/40"
                style={{ animationDelay: "300ms" }}
              />
            </div>
          ) : (
            <div className="max-w-[85%] bg-foreground/5 border border-foreground/10 px-4 py-3 text-foreground text-base md:text-lg font-bold leading-relaxed self-start animate-fade-in">
              {scenario.message}
              <span className="block text-[10px] text-foreground/35 text-right mt-1.5 font-mono">
                doručené
              </span>
            </div>
          )}
        </div>

        {/* Input Simulation Footer */}
        <div className="bg-foreground/[0.01] border-t border-foreground/10 px-6 py-4 flex items-center gap-3">
          <div className="flex-1 bg-foreground/[0.03] px-4 py-2 border border-foreground/10 text-xs text-foreground/30 italic font-mono">
            Zvoľ odpoveď pre odoslanie...
          </div>
          <div className="bg-foreground/5 p-2 text-foreground/30">
            <Send className="size-4" />
          </div>
        </div>
      </div>

      {/* Decision Prompt Label */}
      {isTyping ? (
        <p className="text-center font-mono text-base md:text-lg tracking-wider text-foreground/50 uppercase mb-4 animate-pulse">
          Čakaj na správu...
        </p>
      ) : (
        <div className="border-2 border-white bg-black text-white p-4 mb-4 uppercase text-center font-mono text-base md:text-lg font-bold tracking-wider">
          Máš jeden dotyk! Prvý dotyk odosiela:
        </div>
      )}

      {/* Choices Grid (Strict One-Tap Submit) */}
      <div className="space-y-3">
        {scenario.options.map((opt, idx) => (
          <button
            key={idx}
            type="button"
            disabled={clicked || isTyping}
            onClick={() => handleSelect(opt.style)}
            className="w-full text-left border border-foreground/10 bg-foreground/[0.02] px-6 py-4 hover:bg-foreground/5 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none transition-all duration-200"
          >
            <p className="text-base md:text-lg font-bold leading-relaxed text-foreground">{opt.text}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
