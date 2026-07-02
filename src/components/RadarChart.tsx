import React from "react";

interface RadarChartProps {
  conscientiousness: number;
  extraversion: number;
  size?: number;
}

// ⚡ Bolt: Wrapped RadarChart in React.memo to prevent unnecessary re-renders.
// The SVG math and array mapping (points, axes, rings) are moderately expensive.
// Since it's a pure presentation component relying only on primitive props,
// memoization avoids recomputing these SVG coordinates during parent re-renders.
export const RadarChart = React.memo(function RadarChart({
  conscientiousness,
  extraversion,
  size = 160,
}: RadarChartProps) {
  // We plot 4 axes representing key psychometrics:
  // 1. COG (Cognitive depth)
  // 2. CON (Conscientiousness)
  // 3. EXT (Extraversion)
  // 4. AUT (Autonomy - inverse of extraversion)
  const axes = [
    { label: "COG", val: 0.7 },
    { label: "CON", val: conscientiousness },
    { label: "EXT", val: extraversion },
    { label: "AUT", val: Math.max(0.1, 1.0 - extraversion) },
  ];

  const center = size / 2;
  const maxRadius = size / 2 - 20;

  // Grid rings levels
  const rings = [0.25, 0.5, 0.75, 1.0];

  const getCoords = (index: number, value: number) => {
    const angle = ((Math.PI * 2) / axes.length) * index - Math.PI / 2;
    const r = value * maxRadius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const points = axes
    .map((axis, idx) => {
      const { x, y } = getCoords(idx, axis.val);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={size} height={size} className="font-mono text-[9px]">
      {/* Spiderweb Background grid */}
      {rings.map((ring, rIdx) => {
        const ringPoints = axes
          .map((_, idx) => {
            const { x, y } = getCoords(idx, ring);
            return `${x},${y}`;
          })
          .join(" ");
        return (
          <polygon key={rIdx} points={ringPoints} fill="none" stroke="#222222" strokeWidth="1" />
        );
      })}

      {/* Radiating Axis Lines */}
      {axes.map((_, idx) => {
        const end = getCoords(idx, 1.0);
        return (
          <line
            key={idx}
            x1={center}
            y1={center}
            x2={end.x}
            y2={end.y}
            stroke="#222222"
            strokeWidth="1"
          />
        );
      })}

      {/* Main Scored Area Outline (Strict White Line) */}
      <polygon points={points} fill="none" stroke="#ffffff" strokeWidth="1.5" />

      {/* Monospace Labels */}
      {axes.map((axis, idx) => {
        const textPos = getCoords(idx, 1.2);
        return (
          <text
            key={idx}
            x={textPos.x}
            y={textPos.y}
            textAnchor="middle"
            alignmentBaseline="middle"
            fill="#888888"
            className="font-mono text-[8px] font-bold"
          >
            {axis.label}
          </text>
        );
      })}
    </svg>
  );
});
