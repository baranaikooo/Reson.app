import { useMemo } from "react";

interface DNAOrbProps {
  conscientiousness: number; // 0.1 - 1.0
  extraversion: number;      // 0.1 - 1.0
  size?: number;
}

export function DNAOrb({ conscientiousness, extraversion, size = 180 }: DNAOrbProps) {
  // Map psychometric variables to colors (HSL)
  // Extraversion (E) maps from calm teal (180) to highly energetic crimson/rose (340)
  const huePrimary = useMemo(() => {
    return Math.round(180 + extraversion * 160);
  }, [extraversion]);

  // Conscientiousness (C) maps to secondary color gradient (teal to deep purple)
  const hueSecondary = useMemo(() => {
    return Math.round(200 + conscientiousness * 100);
  }, [conscientiousness]);

  // Speed of wave pulse and fluid animation:
  // High conscientiousness (orderly) = slower, calm, structured flow
  // Low conscientiousness (spontaneous/chaotic) = fast, energetic, fluid warping
  const animationDuration = useMemo(() => {
    return `${Math.max(0.8, 3.5 - conscientiousness * 2.5)}s`;
  }, [conscientiousness]);

  // Pulse expansion scale:
  // High extraversion (expressive) = larger ripples and aura expansion
  // High introversion = tighter, compact, self-contained orb core
  const pulseScale = useMemo(() => {
    return 1.0 + extraversion * 0.35;
  }, [extraversion]);

  return (
    <div 
      className="relative grid place-items-center transition-all duration-500 ease-out" 
      style={{ width: size, height: size }}
    >
      {/* Outer Halo Glow */}
      <div 
        className="absolute rounded-full opacity-35 blur-[35px] transition-all duration-500 ease-out"
        style={{
          width: size * 0.8,
          height: size * 0.8,
          background: `radial-gradient(circle, hsla(${huePrimary}, 90%, 60%, 0.8) 0%, hsla(${hueSecondary}, 80%, 40%, 0.2) 60%, transparent 100%)`,
          transform: `scale(${pulseScale})`,
        }}
      />

      {/* Ripple Rings */}
      {[0.0, 0.4, 0.8].map((delay, index) => (
        <span 
          key={index} 
          className="absolute rounded-full border transition-all ease-out"
          style={{
            width: size * 0.5,
            height: size * 0.5,
            borderColor: `hsla(${huePrimary}, 80%, 75%, 0.25)`,
            borderWidth: "1.5px",
            boxShadow: `0 0 15px hsla(${huePrimary}, 80%, 75%, 0.05)`,
            transform: `scale(${pulseScale})`,
            animation: `dna-ripple ${animationDuration} infinite linear`,
            animationDelay: `${delay}s`,
          }} 
        />
      ))}

      {/* Inner Fluid Orb using SVG filter blobs */}
      <div className="absolute grid place-items-center">
        <svg 
          viewBox="0 0 100 100" 
          width={size * 0.65} 
          height={size * 0.65} 
          className="overflow-visible"
        >
          <defs>
            <radialGradient id="dnaGrad" cx="35%" cy="30%" r="65%">
              <stop offset="0%" stopColor={`hsla(${huePrimary}, 95%, 75%, 1)`} />
              <stop offset="50%" stopColor={`hsla(${hueSecondary}, 90%, 50%, 0.8)`} />
              <stop offset="100%" stopColor={`hsla(${huePrimary - 40}, 100%, 30%, 0.9)`} />
            </radialGradient>
            
            <radialGradient id="dnaAura" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={`hsla(${huePrimary}, 90%, 65%, 0.35)`} />
              <stop offset="70%" stopColor={`hsla(${hueSecondary}, 80%, 45%, 0.1)`} />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>

            {/* Fluid morphing filter */}
            <filter id="fluidFilter">
              <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
              <feColorMatrix 
                in="blur" 
                mode="matrix" 
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" 
                result="fluid" 
              />
              <feComposite in="SourceGraphic" in2="fluid" operator="atop" />
            </filter>
          </defs>

          {/* Aura Underlay */}
          <circle cx="50" cy="50" r="48" fill="url(#dnaAura)" />

          {/* Morphing Blob Group */}
          <g filter="url(#fluidFilter)">
            {/* Core Blob 1 */}
            <circle cx="50" cy="50" r="28" fill="url(#dnaGrad)">
              <animate 
                attributeName="r" 
                values="28;29.5;26.5;28" 
                dur={animationDuration} 
                repeatCount="indefinite" 
              />
            </circle>

            {/* Satellite Blob 2 */}
            <circle cx="42" cy="46" r="14" fill="url(#dnaGrad)">
              <animate 
                attributeName="cx" 
                values="42;45;38;42" 
                dur={animationDuration} 
                repeatCount="indefinite" 
              />
              <animate 
                attributeName="cy" 
                values="46;40;48;46" 
                dur={animationDuration} 
                repeatCount="indefinite" 
              />
            </circle>

            {/* Satellite Blob 3 */}
            <circle cx="58" cy="54" r="13" fill="url(#dnaGrad)">
              <animate 
                attributeName="cx" 
                values="58;53;61;58" 
                dur={animationDuration} 
                repeatCount="indefinite" 
              />
              <animate 
                attributeName="cy" 
                values="54;60;50;54" 
                dur={animationDuration} 
                repeatCount="indefinite" 
              />
            </circle>
          </g>

          {/* Center Energy Core */}
          <circle 
            cx="50" 
            cy="50" 
            r="8" 
            fill="#ffffff" 
            opacity="0.8" 
            style={{ filter: "drop-shadow(0 0 5px #ffffff)" }}
          >
            <animate 
              attributeName="r" 
              values="7;9;7" 
              dur={`${parseFloat(animationDuration) * 0.6}s`} 
              repeatCount="indefinite" 
            />
          </circle>
        </svg>
      </div>

      {/* Inject Keyframe animations locally if needed, but styling system already has base tokens */}
      <style>{`
        @keyframes dna-ripple {
          0% {
            transform: scale(0.6);
            opacity: 0.8;
          }
          100% {
            transform: scale(1.6);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
