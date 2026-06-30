import { useEffect, useMemo, useRef, useState } from "react";

type Dot = { x: number; y: number; r: number; size: number; hue: number };

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sonar/Radar scan: a dark dial with a single thin wave that sweeps
 * outward on a fixed cadence. Seeded "cognitive profile" dots flicker
 * on briefly as the wave front crosses their radius.
 */
export function SonarScan({
  size = 280,
  seed = 1,
  period = 2400, // ms between sweeps
}: {
  size?: number;
  seed?: number;
  period?: number;
}) {
  const dots = useMemo<Dot[]>(() => {
    const rnd = mulberry(seed * 9301 + 49297);
    const count = 14 + Math.floor(rnd() * 6);
    const arr: Dot[] = [];
    for (let i = 0; i < count; i++) {
      const r = 0.18 + rnd() * 0.74; // 0..1 normalized radius
      const a = rnd() * Math.PI * 2;
      arr.push({
        x: Math.cos(a) * r,
        y: Math.sin(a) * r,
        r,
        size: 1.4 + rnd() * 2.2,
        hue: 175 + rnd() * 40, // cyan → teal
      });
    }
    return arr;
  }, [seed]);

  const [t, setT] = useState(0); // 0..1 phase within current sweep
  const startRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    startRef.current = performance.now();
    const tick = (now: number) => {
      const phase = ((now - startRef.current) % period) / period;
      setT(phase);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [period]);

  // Wave front radius in normalized [0..1]; eased so it slows near the rim.
  const wave = 1 - Math.pow(1 - t, 1.6);
  const waveOpacity = Math.sin(Math.min(1, t * 1.05) * Math.PI) * 0.9;

  const cx = 50, cy = 50, R = 48;

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} className="block">
        <defs>
          <radialGradient id="sonar-bg" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="#0b1620" />
            <stop offset="70%" stopColor="#06090f" />
            <stop offset="100%" stopColor="#03050a" />
          </radialGradient>
          <radialGradient id="sonar-inner" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(103,232,249,0.10)" />
            <stop offset="60%" stopColor="rgba(103,232,249,0.02)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>

        {/* dial */}
        <circle cx={cx} cy={cy} r={R} fill="url(#sonar-bg)" />
        <circle cx={cx} cy={cy} r={R} fill="url(#sonar-inner)" />

        {/* concentric guide rings */}
        {[0.28, 0.5, 0.74, 0.95].map((k) => (
          <circle key={k} cx={cx} cy={cy} r={R * k}
            fill="none" stroke="rgba(103,232,249,0.08)" strokeWidth={0.25} />
        ))}
        {/* crosshair */}
        <line x1={cx - R} y1={cy} x2={cx + R} y2={cy} stroke="rgba(103,232,249,0.07)" strokeWidth={0.2} />
        <line x1={cx} y1={cy - R} x2={cx} y2={cy + R} stroke="rgba(103,232,249,0.07)" strokeWidth={0.2} />

        {/* dots — flare as the wave crosses */}
        {dots.map((d, i) => {
          const dist = Math.abs(d.r - wave);
          const glow = Math.max(0, 1 - dist / 0.08); // narrow band
          const baseAlpha = 0.12 + glow * 0.85;
          return (
            <g key={i}>
              {glow > 0.05 && (
                <circle
                  cx={cx + d.x * R} cy={cy + d.y * R}
                  r={d.size * (1 + glow * 1.4)}
                  fill={`hsla(${d.hue}, 90%, 70%, ${glow * 0.35})`}
                />
              )}
              <circle
                cx={cx + d.x * R} cy={cy + d.y * R} r={d.size * 0.45}
                fill={`hsla(${d.hue}, 95%, ${55 + glow * 25}%, ${baseAlpha})`}
              />
            </g>
          );
        })}

        {/* the sweeping wave */}
        <circle
          cx={cx} cy={cy} r={Math.max(0.1, wave * R)}
          fill="none"
          stroke="#67e8f9"
          strokeWidth={0.45}
          opacity={waveOpacity}
          style={{ filter: "drop-shadow(0 0 1.4px rgba(103,232,249,0.9))" }}
        />
        {/* faint trailing wave */}
        <circle
          cx={cx} cy={cy} r={Math.max(0.1, wave * R * 0.82)}
          fill="none"
          stroke="rgba(103,232,249,0.35)"
          strokeWidth={0.25}
          opacity={waveOpacity * 0.5}
        />

        {/* rim */}
        <circle cx={cx} cy={cy} r={R} fill="none"
          stroke="rgba(103,232,249,0.22)" strokeWidth={0.4} />
        <circle cx={cx} cy={cy} r={R - 1.2} fill="none"
          stroke="rgba(255,255,255,0.04)" strokeWidth={0.3} />

        {/* center pip */}
        <circle cx={cx} cy={cy} r={0.9} fill="#67e8f9" opacity={0.85} />
      </svg>
    </div>
  );
}
