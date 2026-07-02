import React, { useState, useRef, useEffect } from "react";
import { Mic, Send, Trash2 } from "lucide-react";
import { useHaptic } from "@/hooks/use-haptics";

export function RecordButton({
  recording,
  recLen,
  disabled,
  onStart,
  onCommit,
  onCancel,
}: {
  recording: boolean;
  recLen: number;
  disabled: boolean;
  onStart: () => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const haptic = useHaptic();
  const max = 60;
  const progress = Math.min(1, recLen / max);

  const handleMainAction = () => {
    if (disabled) return;
    if (recording) {
      haptic("send");
      onCommit();
    } else {
      haptic("tap");
      onStart();
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 bg-background/80 p-4 pb-8 backdrop-blur-md">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-2 text-center font-mono text-xs text-foreground/50">
          {recording
            ? `NAHRÁVAM... 0:${String(Math.floor(recLen)).padStart(2, "0")}`
            : "STLAČ PRE NAHRÁVANIE"}
        </div>
        <div
          className="relative grid w-full grid-cols-[64px_1fr_64px] items-center"
          style={{ minHeight: 72 }}
        >
          {recording && (
            <button
              type="button"
              onClick={() => onCancel()}
              aria-label="Zrušiť hlasovku"
              className="grid size-12 place-items-center border border-red-500/30 bg-red-500/10 text-red-500 active:scale-95"
            >
              <Trash2 className="size-5" />
            </button>
          )}
          <button
            type="button"
            onClick={handleMainAction}
            disabled={disabled}
            aria-label={recording ? "Klepnutím odošleš hlasovku" : "Klepnutím začneš nahrávanie"}
            className={`relative col-start-2 mx-auto grid size-16 place-items-center disabled:opacity-30 active:scale-95 ${
              recording ? "bg-red-500" : "bg-foreground"
            }`}
            style={{ touchAction: "manipulation" }}
          >
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80">
              <circle
                cx="40"
                cy="40"
                r="36"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                opacity="0.18"
              />
              {recording && (
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray={2 * Math.PI * 36}
                  strokeDashoffset={2 * Math.PI * 36 * (1 - progress)}
                  className="transition-all duration-1000 ease-linear"
                />
              )}
            </svg>
            {recording ? (
              <Send className="size-6 text-white" />
            ) : (
              <Mic className="size-6 text-background" />
            )}
          </button>
          <div aria-hidden />
        </div>
      </div>
    </div>
  );
}
