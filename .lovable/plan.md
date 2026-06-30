## Zmeny v Reson

### A) Funk\u010dn\u00e9 \u00fapravy

**1. Variantn\u00e9 ot\u00e1zky (rovnak\u00e1 dimenzia, in\u00fd pr\u00edbeh)**
V `src/lib/resonance.ts` rozd\u00e9li\u0165 `SCENARIOS` na 3\u20134 varianty pre ka\u017ed\u00fa z `q1..q6`. V\u0161etky varianty jednej dimenzie zachov\u00e1vaj\u00fa s\u00e9mantiku A/B (napr. `q1` A = r\u00fdchle rozhodnutie, B = premyslen\u00e9; `q2` A = hlava, B = srdce). Skórovanie (`DIMENSIONS`, `calcResonance`, archet\u00fdp) sa nemen\u00ed \u2014 pracuje len s id `q1..q6` a A/B.

Prida\u0165 `pickScenarios(seed?): Scenario[]` ktor\u00fd deterministicky (alebo n\u00e1hodne) vyberie po jednom variante na dimenziu. V `Test` komponente zavola\u0165 raz pri mount-e (do `useRef`), tak\u017ee ka\u017ed\u00fd test = unik\u00e1tna zostava.

**2. \u010casovanie testu 10 + 10 s**
`PHASE_TIMES = { reading: 10, answers: 10 }`. Posledn\u00e9 3 s `answers` \u010derven\u00e9 + warning haptika. Auto A/B pri vypr\u0161an\u00ed zostáva.

**3. Hlasovky \u00e0 la Instagram (press-and-hold + swipe-to-cancel)**
V `RecordButton` a `Chamber`:
- Statick\u00e1 ikona \u2014 odstr\u00e1ni\u0165 v\u0161etky animovan\u00e9 ringy/scale/pulse, ktor\u00e9 menia poz\u00edciu alebo ve\u013ekos\u0165. Tla\u010didlo dr\u017e\u00ed fixn\u00fa poz\u00edciu, men\u00ed sa len farba/glow a vn\u00fatorn\u00fd \u010das.
- `pointerdown` \u2192 `onStart()` (haptika `recording`, \u0161tart timera, ulo\u017ei\u0165 `startX`).
- `pointermove` \u2192 ak `startX - clientX > 80px`, prejs\u0165 do `willCancel` (ikona ko\u0161a, \u010derven\u00fd text \u201eUvo\u013enite pre zru\u0161enie\u201c).
- `pointerup` / `pointercancel`:
  - mimo cancel z\u00f3ny \u2192 commit \u2192 hlasovka odoslan\u00e1, blur klesne o krok, haptika `send`.
  - vo `willCancel` \u2192 discard, haptika `warning`, \u017eiadny dekrement.
- Pomocn\u00fd hint nad tla\u010didlom po\u010das nahr\u00e1vania: `\u2190 Posu\u0148te pre zru\u0161enie \u00b7 Xs / 60s` (statick\u00fd text, \u017eiadny layout posun).
- Nahradi\u0165 `onMouseDown/Up/Leave` za pointer events, aby `mouseleave` neodoslalo nechcene.

### B) Vizu\u00e1lny redesign \u2014 \u201eVapor Chrome / Bento\u201c

**Design tokens (`src/styles.css`)**
- Pozadie: ponecha\u0165 tmav\u00fa b\u00e1zu `#0D0F12`, ale prida\u0165 jemn\u00fd ambient gradient `radial(circle at 20% 0%, #818cf8 0%, transparent 60%), radial(circle at 80% 100%, #67e8f9 0%, transparent 55%)` cez fixn\u00fd `body::before` (opacity 0.18, `pointer-events:none`).
- Primary: `#a78bfa` (lavender), accent-1: `#67e8f9` (cyan), accent-2: `#c4b5fd` (soft lilac), accent-3: `#818cf8` (indigo).
- Prida\u0165 tokeny: `--gradient-primary: linear-gradient(135deg, #a78bfa, #67e8f9)`, `--gradient-glow: linear-gradient(135deg, #818cf8, #c4b5fd, #67e8f9)`, `--shadow-glow: 0 20px 60px -20px color-mix(in oklab, #a78bfa 50%, transparent)`, `--bento-radius: 28px`.
- CTA tla\u010didlá: gradient primary + biele lesklé highlight v top edge (inset shadow), aktívny stav scale-down 0.97, jemný haptický pulz po dotyku (CSS keyframe, žiadny layout shift).

**Typografia**
- Pridať `<link>` na Syne (700/800) + Plus Jakarta Sans (400/500/600/700) v `src/routes/__root.tsx` head.
- `@theme`: `--font-display: "Syne", sans-serif`, `--font-sans: "Plus Jakarta Sans", sans-serif`. Body default body, headings/akcenty `font-display`.
- Nadpisy mierne stiesnené (tracking -0.02em), veľké display sizes na landing/processing/archetype reveal.

**Bento layout**
Hlavné obrazovky (post-test domov + messages) reorganizovať na bento mriežku:
- **Domov / autoMatch idle**: 2-stĺpcová grid mriežka v `max-w-md`:
  - veľká karta (col-span-2) s NebulaOrb + archetyp label + tagline,
  - malá karta „Skóre dňa" / streak,
  - malá karta „Posledná konverzácia" (preview blur avatar + alias),
  - široká karta CTA „Nájsť rezonanciu" s gradient pozadím a šípkou.
- **Messages zoznam**: každý item ako card s `--bento-radius`, blur avatar vľavo, alias + posledná správa, drobný „nečítané" badge ako svietiaci dot v cyan.
- **Test obrazovka**: jedna veľká bento karta na otázku s soft gradient border (conic gradient maska), nad ňou 2 menšie pill chipy (fáza, čas), pod ňou 2 veľké A/B tlačidlá ako samostatné karty (každá s vlastným hover gradient glow).
- **Chamber**: NebulaOrb v hlavnej karte (col-span-2), pod ním 2 menšie karty (môj blur, partnerov blur), úplne dole jedna široká card s record button.

**Mikrointerakcie (bez layout shiftu)**
- Karty na tap: krátky scale 0.98 → 1 (150 ms), žiadny posun susedov.
- Gradient border okolo aktívnej karty animovaný cez `background-position` na conic-gradient (rotácia 8 s), nie cez transform.
- Phase chip vypršanie: shimmer pulz vnútri pillu (background only).
- Page tranzície: fade + scale-in 0.98→1 (200 ms) pre celý screen container.

**Bottom nav**
Floating pill (`position: fixed`, bottom 16px), priehľadný blur backdrop (`backdrop-filter: blur(20px)`), 3 ikony s aktívnym tab ako gradient blob za ikonou (rovnaký gradient ako primary), label pod ikonou v `font-display` 11 px uppercase tracking-wide.

### Dotknuté súbory
- `src/lib/resonance.ts` \u2014 `SCENARIOS` na varianty + `pickScenarios()`.
- `src/routes/index.tsx` \u2014 `PHASE_TIMES`, `Test` cez `pickScenarios`, prepísaný `RecordButton`, bento layouty pre domov/messages/test/chamber, `BottomNav` floating pill, page tranzície.
- `src/routes/__root.tsx` \u2014 `<link>` pre Syne + Plus Jakarta Sans.
- `src/styles.css` \u2014 nové tokeny (Vapor Chrome paleta, gradients, glow shadows, bento radius), font-family v `@theme`, ambient gradient `body::before`, utility pre gradient border a card scale.

### Mimo scope
- Skuto\u010dn\u00e9 nahr\u00e1vanie audia (zostáva mock).
- Zmena sk\u00f3rovacieho algoritmu, archet\u00fdpov, blur mechaniky.
- Light mode (app zostáva dark-only).
