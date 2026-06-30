import * as React from "react";
import { cn } from "@/lib/utils";

/* ============================================================
 * Reson — shared "playful" UI primitives
 * Strict Brutalist design: monochrome, monospace, sharp edges.
 * ========================================================= */

type BlobVariant = "default" | "warm" | "cool" | "soft";

const BLOB_PRESETS: Record<BlobVariant, { color: string; pos: string; size: string }[]> = {
  default: [
    { color: "rgba(255,255,255,0.04)", pos: "-top-12 -left-10", size: "size-48" },
    { color: "rgba(255,255,255,0.03)", pos: "top-1/3 -right-12", size: "size-56" },
    { color: "rgba(255,255,255,0.02)", pos: "bottom-8 left-1/4", size: "size-44" },
  ],
  warm: [
    { color: "rgba(255,255,255,0.04)", pos: "-top-10 right-0",   size: "size-56" },
    { color: "rgba(255,255,255,0.03)", pos: "bottom-10 -left-10",size: "size-52" },
    { color: "rgba(255,255,255,0.02)", pos: "top-1/2 right-1/4", size: "size-40" },
  ],
  cool: [
    { color: "rgba(255,255,255,0.04)", pos: "-top-12 left-1/4",  size: "size-56" },
    { color: "rgba(255,255,255,0.03)", pos: "bottom-0 -right-8", size: "size-52" },
    { color: "rgba(255,255,255,0.02)", pos: "top-1/2 -left-10",  size: "size-44" },
  ],
  soft: [
    { color: "rgba(255,255,255,0.03)", pos: "-top-16 -left-6",   size: "size-44" },
    { color: "rgba(255,255,255,0.02)", pos: "bottom-10 right-0", size: "size-44" },
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
          className={cn("absolute opacity-55 blur-3xl", b.pos, b.size)}
          style={{ background: `radial-gradient(circle, ${b.color}, transparent 70%)` }}
        />
      ))}
    </div>
  );
}

type ChipTone = "violet" | "cyan" | "pink" | "neutral";
const CHIP_BG: Record<ChipTone, string> = {
  violet:  "border-foreground/20 bg-foreground/5 text-foreground",
  cyan:    "border-foreground/20 bg-foreground/5 text-foreground",
  pink:    "border-foreground/20 bg-foreground/5 text-foreground",
  neutral: "border-foreground/10 bg-foreground/[0.03] text-foreground",
};

/** Monochrome chip — used on landing & throughout. */
export function Chip({
  children, tone = "neutral", className,
}: { children: React.ReactNode; tone?: ChipTone; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 border px-3 py-1 text-[11px] font-mono font-medium tracking-wide",
      CHIP_BG[tone],
      className,
    )}>
      {children}
    </span>
  );
}

type PillVariant = "primary" | "ghost" | "soft";

/** Big CTA button — brutalist style. */
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
  const base = "inline-flex w-full items-center justify-center gap-2 px-6 py-4 text-sm font-bold font-mono tracking-wide uppercase transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed";
  const variants: Record<PillVariant, string> = {
    primary: "bg-foreground text-background hover:bg-foreground/90",
    ghost:   "border border-foreground/20 bg-transparent text-foreground hover:bg-foreground/5",
    soft:    "bg-foreground/10 text-foreground hover:bg-foreground/15",
  };

  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={cn(base, variants[variant], className)}>
      <span className="relative z-10 inline-flex items-center justify-center gap-2">{children}</span>
    </button>
  );
}

/** Bordered card — used to group sections. */
export function SoftCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      "border border-foreground/10 bg-card p-5",
      className,
    )}>
      {children}
    </div>
  );
}

/** Tiny monospace note. */
export function HandNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn(
      "text-[11px] font-mono text-muted-foreground/80 leading-snug",
      className,
    )}>
      {children}
    </p>
  );
}
