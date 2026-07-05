import React, { useState, useRef, useEffect } from "react";
import { X, MessageCircle, ChevronRight, Mic, Play, Pause } from "lucide-react";
import { UserProfile, RankedMatch, Conversation, ChatMessage } from "@/lib/resonance";
import { useHaptic } from "@/hooks/use-haptics";
import { IcebreakerDilemma } from "@/components/IcebreakerDilemma";
import { BlindVote } from "@/components/BlindVote";
import { VoiceBubble, VoiceMsg } from "@/components/chat/VoiceBubble";
import { RecordButton } from "@/components/chat/RecordButton";
import { pickAudioMime, createMediaRecorder, stopStream } from "@/lib/media";
import {
  supabase,
  getOrCreateMatch,
  submitBlindVote,
  uploadVoiceMessageBlob
} from "@/lib/supabase";

// Since Wave is heavily used, let's just create a quick local copy of it for Chamber since we can't easily extract it without creating another file and updating all its usages.
function Wave({ size = 280, intense = false }: { size?: number; intense?: boolean }) {
  return (
    <div
      className="relative grid place-items-center animate-fade-in"
      style={{ width: size, height: size }}
    >
      <div
        className="absolute rounded-full"
        style={{
          width: size,
          height: size,
          background:
            "radial-gradient(circle, rgba(255,255,255,0.15), rgba(255,255,255,0.03) 60%, transparent 70%)",
        }}
      />
      {Array.from({ length: intense ? 4 : 2 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full border border-foreground/30 mix-blend-screen"
          style={{
            width: size * (0.4 + i * 0.15),
            height: size * (0.4 + i * 0.15),
            animation: `spin ${8 + i * 2}s linear infinite${i % 2 === 0 ? " reverse" : ""}`,
            borderRadius:
              i % 2 === 0
                ? "40% 60% 70% 30% / 40% 50% 60% 50%"
                : "60% 40% 30% 70% / 60% 30% 70% 40%",
          }}
        />
      ))}
      <div
        className="absolute rounded-full bg-foreground"
        style={{
          width: size * 0.32,
          height: size * 0.32,
          background:
            "radial-gradient(circle, rgba(255,255,255,0.15), rgba(255,255,255,0.03) 60%, transparent 70%)",
        }}
      />
    </div>
  );
}

const BLUR_START = 24;
const BLUR_STEP = 3;
const MAX_REC_SECONDS = 60;

export function Chamber({
  user,
  match,
  myVideoUrl,
  onSuccess,
  onDiscard,
  onFairInteraction,
}: {
  user: UserProfile;
  match: RankedMatch;
  myVideoUrl?: string;
  onSuccess: (blur: number) => void;
  onDiscard: () => void;
  onFairInteraction: () => void;
}) {
  const haptic = useHaptic();
  const [messages, setMessages] = useState<VoiceMsg[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recLen, setRecLen] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [stage, setStage] = useState<
    "voice" | "blindVote" | "waiting" | "result-no" | "result-yes"
  >("voice");
  const [myChoice, setMyChoice] = useState<"unlock" | "cancel" | null>(null);
  const [theirChoice, setTheirChoice] = useState<"unlock" | "cancel" | null>(null);
  const [supabaseMatchId, setSupabaseMatchId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let channel: any = null;

    async function initMatch() {
      try {
        const result = await getOrCreateMatch(user.id!, match.id, match.score);
        if (!active) return;
        setSupabaseMatchId(result.id);

        const { data: dbMessages, error } = await supabase
          .from("messages")
          .select("*")
          .eq("match_id", result.id)
          .order("created_at", { ascending: true });

        if (error) {
          console.error("[Chamber] Fetching messages error:", error);
        } else if (dbMessages && active) {
          setMessages(
            dbMessages.map((m: any) => ({
              id: m.id,
              from: m.sender_id === user.id ? "me" : "them",
              duration: m.duration || 0,
              audioUrl: m.media_url,
            }))
          );
        }

        channel = supabase
          .channel(`chamber:${result.id}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
              filter: `match_id=eq.${result.id}`,
            },
            (payload) => {
              const newMsg = payload.new;
              if (newMsg.sender_id !== user.id) {
                setMessages((prev) => {
                  if (prev.some((x) => x.id === newMsg.id)) return prev;
                  return [
                    ...prev,
                    {
                      id: newMsg.id,
                      from: "them",
                      duration: newMsg.duration || 0,
                      audioUrl: newMsg.media_url,
                    },
                  ];
                });
               }
            }
          )
          .subscribe();
      } catch (err) {
        console.error("[Chamber] Init match failed:", err);
      }
    }

    if (user.id && match.id && !user.id.startsWith("00000000")) {
      initMatch();
    }

    return () => {
      active = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user.id, match.id]);

  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recStartRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingStopRef = useRef<Promise<void> | null>(null);
  const cancelledRef = useRef(false);

  // Voice progress details
  const totalVoiceDuration = messages.reduce((sum, msg) => sum + msg.duration, 0);
  const progressPct = Math.min(100, Math.round((totalVoiceDuration / 180) * 100));

  // Clamped progressive blur: reduces from 40px down to minimum 15px before Unlock
  const blurPx = Math.max(15, 40 * (1.0 - totalVoiceDuration / 180));

  // Check if cumulative voice limit of 180s is reached
  useEffect(() => {
    if (totalVoiceDuration >= 180 && stage === "voice") {
      haptic("warning");
      setStage("blindVote");
    }
  }, [totalVoiceDuration, stage, haptic]);

  // Cleanup mic + object URLs on unmount.
  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      try {
        mediaRecRef.current?.state !== "inactive" && mediaRecRef.current?.stop();
      } catch {
        /* ignore */
      }
      if (micStreamRef.current) stopStream(micStreamRef.current);
      setMessages((m) => {
        m.forEach((x) => {
          if (x.audioUrl) URL.revokeObjectURL(x.audioUrl);
        });
        return m;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickMime(): string {
    return pickAudioMime();
  }

  async function startRec() {
    if (stage !== "voice" || recording) return;
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      const msg = "Tento prehliadač nepodporuje nahrávanie z mikrofónu.";
      console.warn("[voice]", msg);
      setMicError(msg);
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      const msg = "Tvoj prehliadač nepodporuje MediaRecorder API.";
      console.warn("[voice]", msg);
      setMicError(msg);
      return;
    }

    pendingStopRef.current = null;
    cancelledRef.current = false;
    setMicError(null);
    setRecLen(0);
    setRecording(true);
    recStartRef.current = performance.now();

    try {
      const perms = (navigator as Navigator & { permissions?: Permissions }).permissions;
      if (perms?.query) {
        const status = await perms.query({ name: "microphone" as PermissionName });
        if (status.state === "denied") {
          console.warn("[voice] microphone permission denied");
          setMicError(
            "Mikrofón je zablokovaný. Klikni na ikonu zámku v adresnom riadku a povoľ mikrofón.",
          );
          setRecording(false);
          return;
        }
      }
    } catch {
      /* ignore */
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      micStreamRef.current = stream;

      const mime = pickMime() || "audio/webm";
      const rec = createMediaRecorder(stream, mime, "audio");
      mediaRecRef.current = rec;

      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const stopPromise = new Promise<void>((resolve) => {
        rec.onstop = () => {
          if (tickRef.current) {
            clearInterval(tickRef.current);
            tickRef.current = null;
          }
          if (micStreamRef.current) stopStream(micStreamRef.current);
          micStreamRef.current = null;

          if (cancelledRef.current) {
            resolve();
            return;
          }

          const elapsed = (performance.now() - recStartRef.current) / 1000;
          if (elapsed < 1.0) {
            setMicError("Hlasovka je príliš krátka.");
            resolve();
            return;
          }

          const blob = chunks.length ? new Blob(chunks, { type: rec.mimeType || mime }) : null;
          if (!blob || blob.size === 0) {
            setMicError("Nepodarilo sa nahrať zvuk (prázdny súbor).");
            resolve();
            return;
          }

          const dur = Math.min(MAX_REC_SECONDS, Math.round(elapsed));
          const msgId = `msg-${Date.now()}`;
          const url = URL.createObjectURL(blob);

          setMessages((prev) => [...prev, { id: msgId, from: "me", duration: dur, audioUrl: url }]);

          if (supabaseMatchId) {
            uploadVoiceMessageBlob(supabaseMatchId, user.id!, blob, dur)
              .then((dbMsg) => {
                setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, id: dbMsg.id } : m));
              })
              .catch((err) => {
                console.error("[Chamber] Failed to upload voice message:", err);
                setMicError("Chyba synchronizácie správy so serverom.");
              });
          }
          resolve();
        };
      });

      pendingStopRef.current = stopPromise;
      rec.start(100);

      tickRef.current = setInterval(() => {
        const sec = (performance.now() - recStartRef.current) / 1000;
        setRecLen(sec);
        if (sec >= MAX_REC_SECONDS) stopRec(true);
      }, 1000);
    } catch (err) {
      console.error("[voice] start recording failed:", err);
      const e = err as Error;
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        setMicError(
          "Prístup k mikrofónu bol zamietnutý. Povoľ ho prosím v nastaveniach prehliadača.",
        );
      } else {
        setMicError(`Nepodarilo sa spustiť mikrofón: ${e.message}`);
      }
      setRecording(false);
    }
  }

  async function stopRec(commit: boolean) {
    if (!recording) return;
    cancelledRef.current = !commit;
    setRecording(false);
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }

    const rec = mediaRecRef.current;
    if (!rec) {
      if (micStreamRef.current) stopStream(micStreamRef.current);
      micStreamRef.current = null;
      return;
    }
    try {
      if (rec.state !== "inactive") rec.stop();
    } catch (err) {
      console.warn("[voice] stop error:", err);
    }
    mediaRecRef.current = null;
  }

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <span className="text-xs tracking-widest text-foreground/70">
          {match.name.toUpperCase()} <span className="text-foreground/40">· {match.age}</span>
        </span>
        <span className="text-xs tracking-widest text-foreground/40 font-mono">
          HLASOVÁ KOMUNIKÁCIA
        </span>
      </div>

      {/* Progress & Blurry Profile Frame */}
      <div className="mb-6 border border-foreground/10 bg-foreground/[0.02] p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] tracking-widest text-foreground/40">
              SPOLOČNÁ REZONANCIA
            </p>
            <p className="mt-1 text-sm font-light text-foreground/80">
              Nahrajte {180 - totalVoiceDuration > 0 ? `${180 - totalVoiceDuration}s` : "0s"} audia
              pre odomknutie a voľbu.
            </p>
          </div>
          <span className="font-mono text-[10px] tracking-widest text-foreground shrink-0 font-bold">
            {totalVoiceDuration}s / 180s
          </span>
        </div>
        <div className="mt-4 flex items-center gap-3">
          {/* Heavy blur for profiles initially */}
          <div className="relative size-14 shrink-0 overflow-hidden border border-foreground/20 rounded-none bg-black">
            {match.videoUrls && match.videoUrls.length > 0 ? (
              <video
                src={match.videoUrls[0]}
                autoPlay
                loop
                muted
                playsInline
                className="size-full object-contain bg-black"
                style={{ filter: `blur(${blurPx}px)` }}
              />
            ) : (
              <img
                src={match.img}
                alt={match.name}
                className="size-full object-cover scale-125"
                style={{ filter: `blur(${blurPx}px)` }}
              />
            )}
            <div className="absolute top-0.5 left-0.5 flex items-center gap-0.5 bg-black/65 px-1 py-0.5">
              <span className="size-1 animate-pulse rounded-full bg-red-500" />
              <span className="font-mono text-[5px] tracking-tighter text-white">LIVE</span>
            </div>
          </div>
          {myVideoUrl && (
            <div className="relative size-14 shrink-0 overflow-hidden border border-foreground/20 rounded-none bg-black">
              <video
                src={myVideoUrl}
                autoPlay
                loop
                muted
                playsInline
                className="size-full object-contain bg-black"
                style={{ transform: "scaleX(-1)", filter: `blur(${blurPx}px)` }}
              />
              <span className="absolute bottom-0.5 right-0.5 bg-background/60 px-1 font-mono text-[6px] tracking-widest text-foreground/70 uppercase">
                TY
              </span>
              <div className="absolute top-0.5 left-0.5 flex items-center gap-0.5 bg-black/65 px-1 py-0.5">
                <span className="size-1 animate-pulse rounded-full bg-red-500" />
                <span className="font-mono text-[5px] tracking-tighter text-white">LIVE</span>
              </div>
            </div>
          )}
          <div className="ml-auto h-[4px] flex-1 overflow-hidden bg-foreground/5">
            <div
              className="h-full transition-all duration-500 bg-foreground"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Icebreaker Dilemma Card */}
      <div className="mb-6">
        <IcebreakerDilemma
          similarity={
            1.0 -
            Math.sqrt(
              Math.pow((user.cognitiveDepth ?? 0.5) - match.cognitive_depth, 2) +
                Math.pow((user.conscientiousness ?? 0.5) - match.conscientiousness, 2),
            ) /
              Math.sqrt(2.0)
          }
          complementarity={Math.max(
            0,
            1.0 -
              Math.min(
                1.0,
                Math.max(
                  0.0,
                  (user.extraversion ?? 0.5) + match.extraversion < 1.0
                    ? 0.5 * (1.0 - ((user.extraversion ?? 0.5) + match.extraversion))
                    : 1.0 * ((user.extraversion ?? 0.5) + match.extraversion - 1.0),
                ),
              ),
          )}
          userStyle={user.attachmentStyle ?? "Secure"}
          matchStyle={match.attachment_style}
          userTopPriority={user.topPriority ?? "rodina"}
          matchTopPriority={match.top_priority}
        />
      </div>

      {/* Wave Visualizer */}
      <div className="grid place-items-center py-6">
        <Wave size={180} intense={recording || playing !== null} />
      </div>

      {micError && (
        <div className="mb-3 border border-foreground/30 bg-foreground/[0.06] px-4 py-3 text-xs text-foreground">
          {micError}
          <button
            onClick={() => setMicError(null)}
            className="ml-2 underline opacity-70 hover:opacity-100"
          >
            zavrieť
          </button>
        </div>
      )}

      {/* Voice Messages Bubbles */}
      <div className="space-y-3 py-2">
        {messages.map((m) => (
          <VoiceBubble
            key={m.id}
            msg={m}
            playing={playing === m.id}
            onToggle={() => {
              haptic("tap");
              setPlaying(playing === m.id ? null : m.id);
            }}
            onEnded={() => setPlaying(null)}
          />
        ))}
      </div>

      {stage === "voice" && (
        <>
          <div className="h-40" aria-hidden />
          <RecordButton
            recording={recording}
            recLen={recLen}
            disabled={false}
            onStart={startRec}
            onCommit={() => stopRec(true)}
            onCancel={() => stopRec(false)}
          />
        </>
      )}

      {stage === "blindVote" && (
        <BlindVote
          onVote={async (vote) => {
            haptic(vote === "unlock" ? "success" : "warning");
            setMyChoice(vote);
            setStage("waiting");
            onFairInteraction();

            if (!supabaseMatchId) {
              // Fallback to simulation if supabase is not available (demo mode)
              setTimeout(() => {
                const partnerCooperates = Math.random() < (match.score > 70 ? 0.9 : 0.6);
                const partnerChoice = partnerCooperates ? "unlock" : "cancel";
                setTheirChoice(partnerChoice);

                if (vote === "unlock" && partnerChoice === "unlock") {
                  haptic("success");
                  onSuccess(0);
                } else {
                  haptic("warning");
                  setStage("result-no");
                }
              }, 2500);
              return;
            }

            try {
              // Submit our vote to Supabase
              await submitBlindVote(supabaseMatchId, user.id!, vote);

              // Check if the other user has already voted
              const { data: partnerVotes } = await supabase
                .from("blind_votes")
                .select("vote")
                .eq("match_id", supabaseMatchId)
                .neq("user_id", user.id!)
                .maybeSingle();

              if (partnerVotes) {
                setTheirChoice(partnerVotes.vote as "unlock" | "cancel");
                
                if (partnerVotes.vote === "cancel" || vote === "cancel") {
                  await supabase
                    .from("matches")
                    .update({ status: "deleted" })
                    .eq("id", supabaseMatchId);
                  haptic("warning");
                  setStage("result-no");
                  return;
                }
              }

              // Subscribe to match updates (is_unlocked changes)
              const matchChannel = supabase
                .channel(`match_status:${supabaseMatchId}`)
                .on(
                  "postgres_changes",
                  {
                    event: "UPDATE",
                    schema: "public",
                    table: "matches",
                    filter: `id=eq.${supabaseMatchId}`,
                  },
                  (payload) => {
                    const updatedMatch = payload.new;
                    if (updatedMatch.status === "deleted") {
                      haptic("warning");
                      setStage("result-no");
                    } else if (updatedMatch.is_unlocked) {
                      haptic("success");
                      onSuccess(0);
                    }
                  }
                )
                .subscribe();

              // Also check immediately if already unlocked by Postgres trigger
              const { data: currentMatch } = await supabase
                .from("matches")
                .select("is_unlocked, status")
                .eq("id", supabaseMatchId)
                .single();

              if (currentMatch) {
                if (currentMatch.status === "deleted") {
                  haptic("warning");
                  setStage("result-no");
                } else if (currentMatch.is_unlocked) {
                  haptic("success");
                  onSuccess(0);
                }
              }
            } catch (err) {
              console.error("[Chamber] Vote submission failed:", err);
              alert("Odoslanie voľby zlyhalo. Skúste znova.");
              setStage("blindVote");
            }
          }}
        />
      )}

      {stage === "waiting" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/90 backdrop-blur-md p-6">
          <div className="w-full max-w-md border border-foreground/10 bg-card p-10 text-center animate-fade-up">
            <Wave size={140} intense />
            <h3 className="mt-6 text-xl font-light tracking-wider uppercase">
              Vyhodnocovanie voľby
            </h3>
            <p className="mt-3 text-sm text-foreground/60 font-light">
              Tvoj hlas:{" "}
              <span className="text-foreground font-bold">
                {myChoice === "unlock" ? "ODOMKNÚŤ" : "ZRUŠIŤ"}
              </span>
            </p>
            <p className="mt-2 text-xs text-foreground/40 font-light">
              Čaká sa na rozhodnutie od {match.name}…
            </p>
          </div>
        </div>
      )}

      {stage === "result-no" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/95 backdrop-blur-md p-6">
          <div className="w-full max-w-md border border-foreground/10 bg-card p-10 text-center animate-fade-up">
            <X className="mx-auto size-12 text-foreground mb-4" />
            <h3 className="text-2xl font-light tracking-wider text-foreground">
              SPÁROVANIE ZLYHALO
            </h3>
            <p className="mt-4 text-sm text-foreground/60 font-light leading-relaxed">
              {myChoice === "cancel"
                ? "Rozhodol/a si sa nepokračovať a match zrušiť."
                : `${match.name} sa rozhodol/a nepokračovať v komunikácii.`}
            </p>
            <p className="mt-2 text-xs text-foreground/45 font-light">
              Tento match bol permanentne odstránený. Žiadna história, žiadne stopy.
            </p>
            <button
              onClick={onDiscard}
              className="mt-8 w-full bg-foreground/5 border border-foreground/10 py-4 text-xs font-bold tracking-[0.2em] text-foreground hover:bg-foreground/10 transition-all uppercase"
            >
              Späť na Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
