## 2026-07-01 - SVG Rendering Computations inside RadarChart

**Learning:** RadarChart component executes complex array mappings and trigonometric math to generate spiderweb rings, point coords, and layout for axes. This runs during every re-render of the parent if not memoized.
**Action:** Used `React.memo` for components taking primitive props but carrying out heavy internal math/SVG operations to prevent needless re-calculations.
