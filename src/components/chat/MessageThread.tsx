import React, { useState, useRef, useEffect } from "react";
import { UserProfile, RankedMatch, Conversation, ChatMessage } from "@/lib/resonance";
import { useHaptic } from "@/hooks/use-haptics";
import {
  ChevronRight,
  ArrowLeft,
  MoreVertical,
  X,
  Sparkles,
  Send,
  AlertTriangle,
  Shield,
  Check,
} from "lucide-react";
import { makeMockToneWavUrl } from "@/lib/media"; // Placeholder if used elsewhere

const THREAD_BLUR_STEP = 8;
const MOCK_GIFS: string[] = [
  "https://media.tenor.com/x8v1oNUOmg4AAAAi/heart-love.gif",
  "https://media.tenor.com/Mxv-AaTHraEAAAAi/wave-hello.gif",
  "https://media.tenor.com/I6kN-6X2HgAAAAAi/sparkle-stars.gif",
  "https://media.tenor.com/CzZjqUyVx8gAAAAi/cat-laptop.gif",
  "https://media.tenor.com/sj7y9LDsQ_kAAAAi/dance-party.gif",
  "https://media.tenor.com/L4Yh1c6jw7AAAAAi/cool-sunglasses.gif",
];
const REPLY_TYPING_MS = 1400;

export function MessageThread({
  conversation,
  match,
  myVideoUrl,
  user,
  onUpdateUser,
  onUpdate,
  onEnd,
  onBack,
}: {
  conversation: Conversation;
  match: RankedMatch;
  myVideoUrl?: string;
  user: UserProfile;
  onUpdateUser: (update: Partial<UserProfile>) => void;
  onUpdate: (c: (prev: Conversation) => Conversation) => void;
  onEnd: () => void;
  onBack: () => void;
}) {
  const haptic = useHaptic();
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [closureOpen, setClosureOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [showGifs, setShowGifs] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [pressureActive, setPressureActive] = useState(false);
  const [pressureCompleted, setPressureCompleted] = useState(false);
  const [waitingForPartner, setWaitingForPartner] = useState(false);

  // Trigger pressure test roughly midway to final blur (e.g. at 5 messages)
  const pressureTriggerAt = 5;

  function handleClosure(reason: string) {
    haptic("success");
    onUpdate((c) => ({ ...c, status: "closed", closureReason: reason }));
    alert(`Konverzácia uzavretá. Dôvod: ${reason}`);
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
    if (
      !pressureCompleted &&
      !pressureActive &&
      conversation.messages.length >= pressureTriggerAt
    ) {
      haptic("warning");
      setPressureActive(true);
    }
  }, [conversation.messages.length, pressureTriggerAt, pressureCompleted, pressureActive, haptic]);

  function sendMedia(media: { kind: "image" | "gif"; url: string }) {
    haptic("send");
    const myMsg: ChatMessage = {
      id: `mt-${Date.now()}`,
      from: "me",
      text: "",
      ts: Date.now(),
      media,
    };
    onUpdate((c) => ({
      ...c,
      messages: [...c.messages, myMsg],
      blurLevel: Math.max(0, c.blurLevel - THREAD_BLUR_STEP),
    }));
    setShowGifs(false);
    triggerReply(myMsg);
  }

  function send() {
    if (!input.trim() || pressureActive || conversation.status === "closed") return;
    haptic("send");
    const myMsg: ChatMessage = {
      id: `mt-${Date.now()}`,
      from: "me",
      text: input.trim(),
      ts: Date.now(),
    };
    setInput("");
    setShowGifs(false);
    onUpdate((c) => ({
      ...c,
      messages: [...c.messages, myMsg],
      blurLevel: Math.max(0, c.blurLevel - THREAD_BLUR_STEP),
    }));

    triggerReply(myMsg);
  }

  function triggerReply(myMsg: ChatMessage) {
    setTyping(true);
    haptic("tap");
    setTimeout(() => {
      setTyping(false);
      haptic("success");

      // Simple mock reply based on text length for variety
      const replies = [
        "To je zaujímavé.",
        "Súhlasím s tým.",
        "Úplne chápem, ako to myslíš.",
        "Povedz mi o tom viac.",
        "Haha, presne!",
        "Tiež to tak občas vnímam.",
      ];
      const textResponse = replies[myMsg.text.length % replies.length] || "To znie dobre.";

      const themMsg: ChatMessage = {
        id: `tt-${Date.now()}`,
        from: "them",
        text: textResponse,
        ts: Date.now(),
      };
      onUpdate((c) => ({
        ...c,
        messages: [...c.messages, themMsg],
        blurLevel: Math.max(0, c.blurLevel - THREAD_BLUR_STEP),
      }));
    }, REPLY_TYPING_MS);
  }

  const blurPx = Math.round((conversation.blurLevel / 100) * 24);

  return (
    <div className="flex h-screen flex-col bg-background animate-fade-in">
      <div className="sticky top-0 z-10 border-b border-foreground/10 bg-background/80 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="grid size-10 place-items-center rounded-none bg-foreground/5 hover:bg-foreground/10 active:scale-95"
            >
              <ArrowLeft className="size-5 text-foreground" />
            </button>
            <div className="flex items-center gap-3">
              <div className="relative size-10 overflow-hidden border border-foreground/10 bg-card">
                <img
                  src={match.img}
                  alt={match.name}
                  className="size-full object-cover scale-110"
                  style={{ filter: `blur(${blurPx}px)` }}
                />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-foreground text-sm tracking-tight">
                  {match.name}
                </span>
                <span className="font-mono text-[9px] tracking-widest text-foreground/50 uppercase">
                  BLUR: {conversation.blurLevel}%
                </span>
              </div>
            </div>
          </div>
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="grid size-10 place-items-center rounded-none hover:bg-foreground/5"
            >
              <MoreVertical className="size-5 text-foreground" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-12 z-50 w-48 border border-foreground/10 bg-card py-2 shadow-2xl animate-fade-up">
                  {conversation.status !== "closed" && (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setClosureOpen(true);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-foreground/80 hover:bg-foreground/5"
                    >
                      <Check className="size-4" /> Uzavrieť čet slušne
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setReportOpen(true);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-red-500 hover:bg-red-500/10"
                  >
                    <Shield className="size-4" /> Nahlásiť a Blokovať
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="border border-foreground/10 bg-foreground/[0.02] p-6 text-center text-sm font-light text-foreground/60 leading-relaxed font-mono mt-4 mb-8">
          Vstúpili ste do textového dialógu. Rozmazanie profilu (aktuálne {conversation.blurLevel}%)
          sa bude postupne znižovať po každej odoslanej správe (krok {THREAD_BLUR_STEP}%).
        </div>

        {conversation.messages.map((m) => {
          const mine = m.from === "me";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-none px-4 py-3 text-sm leading-relaxed ${
                  mine
                    ? "bg-foreground text-background"
                    : "bg-card border border-foreground/10 text-foreground"
                }`}
              >
                {m.media && m.media.kind === "gif" && (
                  <img src={m.media.url} alt="gif" className="mb-2 max-w-full rounded-sm" />
                )}
                <p className="break-words">{m.text}</p>
                <span
                  className={`block mt-1.5 text-right font-mono text-[9px] ${mine ? "text-background/60" : "text-foreground/40"}`}
                >
                  {new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          );
        })}
        {typing && (
          <div className="flex justify-start">
            <div className="bg-card border border-foreground/10 px-4 py-3 text-foreground/50 text-xs font-mono animate-pulse">
              Píše...
            </div>
          </div>
        )}
        <div ref={bottomRef} className="h-4" />
      </div>

      <div className="bg-background/95 backdrop-blur-md border-t border-foreground/10 z-20">
        {showGifs && (
          <div className="border-t border-foreground/5 bg-background/40 p-3 animate-fade-up">
            <div className="flex justify-between items-center mb-2">
              <span className="font-mono text-[10px] text-foreground/50">MOCK GIF LIBRRAY</span>
              <button
                onClick={() => setShowGifs(false)}
                className="text-[10px] tracking-widest text-foreground/40 hover:text-foreground"
              >
                ZAVRIEŤ
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {MOCK_GIFS.map((g) => (
                <button
                  key={g}
                  onClick={() => sendMedia({ kind: "gif", url: g })}
                  className="overflow-hidden rounded-xl border border-foreground/10 transition-all hover:border-foreground/60 active:scale-95"
                >
                  <img src={g} alt="gif" className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="relative flex items-end gap-2 border-t border-foreground/5 p-3">
          <div className="relative">
            <button
              onClick={() => setShowGifs(!showGifs)}
              className="grid size-10 shrink-0 place-items-center rounded-none bg-foreground/5 text-foreground hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-foreground"
            >
              <Sparkles className="size-5" />
            </button>
          </div>
          <textarea
            value={input}
            disabled={pressureActive || conversation.status === "closed"}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={
              pressureActive
                ? "Tlakový test je aktívny..."
                : conversation.status === "closed"
                  ? "Táto konverzácia je uzavretá."
                  : "Napíš správu…"
            }
            className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-foreground/10 bg-foreground/5 px-3 py-2 text-sm outline-none focus:border-foreground disabled:opacity-50 disabled:pointer-events-none"
          />
          <button
            onClick={send}
            disabled={pressureActive || !input.trim() || conversation.status === "closed"}
            aria-label="Odoslať správu"
            className="grid size-10 shrink-0 place-items-center rounded-none bg-foreground text-background disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-foreground"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>

      {/* In-Chat Pressure Test Overlay */}
      {pressureActive && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-md z-[110] flex flex-col justify-center items-center p-4">
          <div className="w-full max-w-md border border-foreground/20 bg-card p-6 relative">
            <div className="mb-4 flex items-center justify-between font-mono text-[9px] tracking-widest text-red-500 font-bold uppercase animate-pulse">
              <span>⚠️ NÁŠĽAPNÁ MÍNA DETEKOVANÁ</span>
              <span>TLAKOVÝ TEST</span>
            </div>

            {waitingForPartner ? (
              <div className="text-center py-12 space-y-4">
                <div className="size-8 mx-auto border-2 border-foreground border-t-transparent animate-spin" />
                <p className="font-mono text-xs text-foreground/60 uppercase tracking-widest">
                  Čakáme na reakciu partnera...
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm leading-relaxed text-foreground/80 mb-6 border-l-2 border-red-500 pl-4 py-1 font-medium">
                  {match.name} sa dostal/a do úzadia. Z tvojho profilu vidí, že dbáš na{" "}
                  {user.topPriority}. Ako zareaguješ, ak túto hodnotu spochybní?
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      haptic("success");
                      setWaitingForPartner(true);
                      setTimeout(() => {
                        setPressureCompleted(true);
                        setPressureActive(false);
                        setWaitingForPartner(false);
                        alert("Úspešne ste prešli tlakovým testom.");
                      }, 2500);
                    }}
                    className="w-full text-left border border-foreground/10 bg-foreground/[0.02] px-4 py-4 text-xs hover:bg-foreground/5 transition-all"
                  >
                    Vysvetlím svoj postoj pokojne (SECURE)
                  </button>
                  <button
                    onClick={() => {
                      haptic("warning");
                      setWaitingForPartner(true);
                      setTimeout(() => {
                        setPressureCompleted(true);
                        setPressureActive(false);
                        setWaitingForPartner(false);
                        alert("Reakcia nebola ideálna.");
                      }, 2500);
                    }}
                    className="w-full text-left border border-foreground/10 bg-foreground/[0.02] px-4 py-4 text-xs hover:bg-red-500/5 transition-all"
                  >
                    Stiahnem sa a neodpoviem priamo (AVOIDANT)
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Closure Graceful UI */}
      {closureOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] grid place-items-center p-4">
          <div className="w-full max-w-sm border border-foreground/20 bg-card p-6 animate-fade-up">
            <h3 className="font-mono font-bold text-sm tracking-widest text-foreground uppercase mb-2">
              Dôstojné Ukončenie
            </h3>
            <p className="text-xs text-foreground/60 leading-relaxed mb-6 font-mono">
              Vyberte čestný a slušný dôvod uzavretia konverzácie. Druhej strane sa odošle systémová
              správa a čet sa bezpečne uzamkne. Nenesie to žiadnu penalizáciu.
            </p>
            <div className="space-y-2 mb-6">
              {[
                "Necítim romantickú chémiu",
                "Hľadám niečo iné",
                "Nenašli sme spoločnú reč",
                "Výrazný hodnotový nesúlad",
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
              ⚠️ Varovanie: Zneužitie tohto tlačidla na zrušenie matchu namiesto
              &ldquo;Uzavrieť&rdquo; vedie k trvalému zablokovaniu vášho účtu. Nahlásenia slúžia
              výhradne pre prípady spamu, zneužívania alebo obťažovania.
            </div>

            <div className="space-y-2 mb-6">
              {[
                "Obťažovanie / Nevhodné správanie",
                "Spam / Falošný profil",
                "Propagácia / Reklama",
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
