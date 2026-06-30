import * as React from "react";
import { cn } from "@/lib/utils";

/* ============================================================
 * Reson — shared "playful" UI primitives
 * Used across all screens so the Boo/Tinder vibe stays consistent.
 * ========================================================= */

type BlobVariant = "default" | "warm" | "cool" | "soft";

const BLOB_PRESETS: Record<BlobVariant, { color: string; pos: string; size: string }[]> = {
  default: [
    { color: "#f0abfc", pos: "-top-12 -left-10", size: "size-48" },
    { color: "#67e8f9", pos: "top-1/3 -right-12", size: "size-56" },
    { color: "#a78bfa", pos: "bottom-8 left-1/4", size: "size-44" },
  ],
  warm: [
    { color: "#f0abfc", pos: "-top-10 right-0",   size: "size-56" },
    { color: "#fda4af", pos: "bottom-10 -left-10",size: "size-52" },
    { color: "#a78bfa", pos: "top-1/2 right-1/4", size: "size-40" },
  ],
  cool: [
    { color: "#67e8f9", pos: "-top-12 left-1/4",  size: "size-56" },
    { color: "#818cf8", pos: "bottom-0 -right-8", size: "size-52" },
    { color: "#c4b5fd", pos: "top-1/2 -left-10",  size: "size-44" },
  ],
  soft: [
    { color: "#c4b5fd", pos: "-top-16 -left-6",   size: "size-44" },
    { color: "#a5f3fc", pos: "bottom-10 right-0", size: "size-44" },
  ],
};

/** Floating gradient blobs behind a screen. Decorative only. */
export function Blobs({ variant = "default", className }: { variant?: BlobVariant; className?: string }) {
  const cfg = BLOB_PRESETS[variant];
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {cfg.map((b, i) => (
        <div
          key={i}
          className={cn("absolute rounded-full opacity-55 blur-3xl", b.pos, b.size)}
          style={{ background: `radial-gradient(circle, ${b.color}, transparent 70%)` }}
        />
      ))}
    </div>
  );
}

type ChipTone = "violet" | "cyan" | "pink" | "neutral";
const CHIP_BG: Record<ChipTone, string> = {
  violet:  "border-[#a78bfa]/30 bg-[#a78bfa]/10 text-foreground",
  cyan:    "border-[#67e8f9]/30 bg-[#67e8f9]/10 text-foreground",
  pink:    "border-[#f0abfc]/30 bg-[#f0abfc]/10 text-foreground",
  neutral: "border-white/10 bg-white/5 text-foreground",
};

/** Little rounded emoji/text chip — used on landing & throughout. */
export function Chip({
  children, tone = "neutral", className,
}: { children: React.ReactNode; tone?: ChipTone; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium tracking-wide backdrop-blur",
      CHIP_BG[tone],
      className,
    )}>
      {children}
    </span>
  );
}

type PillVariant = "primary" | "ghost" | "soft";

/** Big chunky pill CTA — the main button across the app. */
export function PillButton({
  children, onClick, disabled, variant = "primary", className, type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: PillVariant;
  className?: string;
  type?: "button" | "submit";
}) {
  const base = "inline-flex w-full items-center justify-center gap-2 rounded-3xl px-6 py-4 text-sm font-bold tracking-wide transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed";
  const variants: Record<PillVariant, string> = {
    primary: "cta-gradient cta-gradient-hover hover:brightness-110",
    ghost:   "border border-white/15 bg-white/[0.04] text-foreground hover:bg-white/[0.08] backdrop-blur",
    soft:    "text-foreground hover:brightness-110",
  };
  const inlineStyle: React.CSSProperties | undefined =
    variant === "soft" ? { background: "var(--gradient-soft)" } :
    variant === "primary" && !disabled ? { boxShadow: "0 16px 40px -16px rgba(167,139,250,0.65)" } :
    undefined;

  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={cn(base, variants[variant], className)}
      style={inlineStyle}>
      <span className="relative z-10 inline-flex items-center justify-center gap-2">{children}</span>
    </button>
  );
}

/** Soft glassy card — used to group sections. */
export function SoftCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      "rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl",
      className,
    )}
      style={{ boxShadow: "0 16px 40px -28px rgba(167,139,250,0.45)" }}>
      {children}
    </div>
  );
}

/** Tiny "by-the-way" handwritten-feel note. Adds the human touch. */
export function HandNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn(
      "text-[11px] italic text-muted-foreground/80 leading-snug",
      className,
    )}>
      {children}
    </p>
  );
}
