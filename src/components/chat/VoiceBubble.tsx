import React, { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { calcResonance, resonanceBreakdown } from "@/lib/resonance";

export type VoiceMsg = {
  id: string;
  from: "me" | "them";
  duration: number;
  audioUrl?: string; // object url from Blob
  read?: boolean;
};

export function VoiceBubble({
  msg,
  playing,
  onToggle,
  onEnded,
}: {
  msg: VoiceMsg;
  playing: boolean;
  onToggle: () => void;
  onEnded: () => void;
}) {
  const mine = msg.from === "me";
  void calcResonance;
  void resonanceBreakdown;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.currentTime = 0;
      void el.play().catch(() => onEndedRef.current());
    } else {
      el.pause();
      el.currentTime = 0;
      setProgress(0);
    }
  }, [playing]);

  const hasAudio = !!msg.audioUrl;
  const canPlay = hasAudio;

  function handleToggle() {
    if (!canPlay) return;
    onToggle();
  }

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`flex max-w-[80%] items-center gap-3 rounded-none px-4 py-3 border border-foreground/10 ${
          mine ? "bg-foreground/10" : "bg-card"
        }`}
      >
        <button
          onClick={handleToggle}
          disabled={!canPlay}
          aria-label={playing ? "Pauznúť" : "Prehrať"}
          className={`grid size-9 place-items-center rounded-none disabled:opacity-50 ${
            mine ? "bg-foreground text-background" : "bg-foreground/10 text-foreground"
          }`}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <div className="flex items-end gap-[2px]">
          {Array.from({ length: 22 }).map((_, i) => {
            const lit = playing ? i / 22 <= progress : false;
            return (
              <span
                key={i}
                className="w-[2px]"
                style={{
                  height: 6 + Math.abs(Math.sin(i * 0.6 + msg.duration)) * 18,
                  background: lit ? "currentColor" : "rgba(128,128,128,0.4)",
                  opacity: playing || lit ? 1 : 0.5,
                }}
              />
            );
          })}
        </div>
        <span className="font-mono text-xs text-foreground/60">{msg.duration}s</span>
        {hasAudio && (
          <audio
            ref={audioRef}
            src={msg.audioUrl}
            preload="auto"
            playsInline
            onTimeUpdate={(e) => {
              const a = e.currentTarget;
              if (a.duration && Number.isFinite(a.duration))
                setProgress(a.currentTime / a.duration);
            }}
            onEnded={() => {
              setProgress(0);
              onEndedRef.current();
            }}
            onError={() => onEndedRef.current()}
          />
        )}
      </div>
    </div>
  );
}
