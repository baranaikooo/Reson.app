// All Reson domain logic + content in one place.
// Simple Slovak, no jargon.

import { loadBanditState, saveBanditState } from "./supabase";

export type Answer = "A" | "B";
export type Answers = Partial<Record<`q${1 | 2 | 3 | 4 | 5 | 6}`, Answer>>;
export type FullAnswers = Required<Answers>;
export type DimensionId = "q1" | "q2" | "q3" | "q4" | "q5" | "q6";

export type ThemeMode = "system" | "dark" | "light";

export type PartnerDecision = "yes" | "no" | "pending";
export const partnerContinueDecision = "yes";

type Mode = "similar" | "complement";
type WeightEntry = { mode: Mode; weight: number };

export const DIMENSIONS: Record<DimensionId, WeightEntry> = {
  q1: { mode: "complement", weight: 1.5 },
  q2: { mode: "similar", weight: 2.5 },
  q3: { mode: "complement", weight: 1.5 },
  q4: { mode: "similar", weight: 2.0 },
  q5: { mode: "similar", weight: 2.5 },
  q6: { mode: "similar", weight: 1.0 },
};

const MAX_SCORE = Object.values(DIMENSIONS).reduce((s, d) => s + d.weight, 0); // 11.0

export type Scenario = {
  id: DimensionId;
  title: string;
  text: string;
  a: string;
  b: string;
};

// Each dimension has multiple variants; A/B semantics are preserved:
//   q1: A = rýchle/impulz, B = premyslené
//   q2: A = hlava/logika, B = srdce/empatia
//   q3: A = istota/stabilita, B = risk/zmena
//   q4: A = sám, B = s druhými
//   q5: A = pravda/princíp, B = dobro/výsledok
//   q6: A = talent/predispozícia, B = drina/úsilie
export const SCENARIO_VARIANTS: Record<DimensionId, Scenario[]> = {
  q1: [
    {
      id: "q1",
      title: "Ako sa rozhoduješ",
      text: "Ponúkli ti super prácu v zahraničí. Musíš odletieť o dva týždne. Doma máš ale nový byt a všetko ide v pohode. Máš 48 hodín na rozhodnutie.",
      a: "Beriem to hneď. Radšej skočím, než aby som dva dni v noci nespal.",
      b: "Vezmem si tých 48 hodín. Spíšem si plusy a mínusy, zavolám rodine, premyslím si oba scenáre.",
    },
    {
      id: "q1",
      title: "Tempo rozhodnutia",
      text: "V obchode vidíš poslednú vec, ktorú si dlho chcel. Cena je ale o tretinu vyššia, než si plánoval minúť.",
      a: "Kupujem hneď. Keď to chcem, nepotrebujem si to dvakrát premýšľať.",
      b: "Odídem a vrátim sa o hodinu. Ak to bude stále vo mne, kúpim si to.",
    },
    {
      id: "q1",
      title: "Cestou na schôdzu",
      text: "Sedíš v aute pred dôležitou schôdzou. Kamarát ti zavolá, že má voľný lístok na koncert tvojej obľúbenej kapely — dnes večer, posledný kus.",
      a: "Hneď hovorím áno a presúvam si veci. Príležitosť je príležitosť.",
      b: "Poprosím o päť minút, prejdem si kalendár a až potom mu odpoviem.",
    },
    {
      id: "q1",
      title: "Šanca v startupe",
      text: "Kamarát ti ponúka, že môžeš vstúpiť do jeho startupu — musíš však dať 5 000 € do troch dní. Vyzerá to ako reálna šanca.",
      a: "Idem do toho hneď. Príležitosti dvakrát neklopú.",
      b: "Dám si pár dní, prejdem si čísla a opýtam sa niekoho, kto rozumie biznisu.",
    },
  ],
  q2: [
    {
      id: "q2",
      title: "Hlava alebo srdce",
      text: "Kamarát ti večer zavolá v slzách. Stratil všetky úspory v biznise, lebo niečo prehliadol v zmluve. Panikári.",
      a: "Hneď s ním začnem riešiť čo ďalej. Aké má možnosti, koho zavolať, ako z toho von.",
      b: "Najprv ho len vypočujem a som pri ňom. Riešenia môžu počkať — teraz potrebuje cítiť, že nie je sám.",
    },
    {
      id: "q2",
      title: "Rozhodnutie sestry",
      text: "Sestra ti hovorí, že chce odísť od partnera. Nevie, či je to správne — len cíti, že už nemôže.",
      a: "Pýtam sa ju na fakty. Kam pôjde, z čoho bude žiť, čo s deťmi. Potrebuje plán.",
      b: "Sadnem si k nej a počúvam. Najprv pocity, potom všetko ostatné. Nie je sama.",
    },
    {
      id: "q2",
      title: "Tím v kríze",
      text: "V práci sa kolegyni rozsypal projekt aj rodina v jednom týždni. Príde za tebou na kávu.",
      a: "Spolu prejdeme, čo sa dá zachrániť v práci a kde si pýtať pomoc.",
      b: "Necháme prácu bokom. Dnes potrebuje, aby ju niekto vypočul bez toho, aby z toho hneď robil úlohu.",
    },
    {
      id: "q2",
      title: "Spor doma",
      text: "Mama sa pohádala s otcom. Volá ti v noci a chce, aby si jej dal za pravdu.",
      a: "Zhrniem jej, čo objektívne počujem. Aj jej, aj jeho strana má pointu — povedz mi to bez emócií.",
      b: "Najprv ju nechám, nech sa vyplače. Pravda počká, teraz potrebuje cítiť, že ju mám rád/rada.",
    },
  ],
  q3: [
    {
      id: "q3",
      title: "Istota alebo risk",
      text: "Vedieš projekt, ktorý ide podľa plánu. Zrazu sa objaví šanca skúsiť úplne nový prístup — môže to byť obrovský úspech alebo prepadák.",
      a: "Zostávam pri pôvodnom pláne. Funguje to a netreba experimentovať za pochodu.",
      b: "Idem do toho nového. Ak chceš niečo veľké, niekedy treba pustiť to staré.",
    },
    {
      id: "q3",
      title: "Stabilná práca",
      text: "Máš dobrú prácu, ktorá ťa už ale nebaví. Kamarát ťa volá do nového projektu — zaujímavý, ale neistý príjem na prvý rok.",
      a: "Ostávam, kde som. Stabilita má svoju cenu, neistota tiež.",
      b: "Idem do toho. Bez risku sa nič nové nestane.",
    },
    {
      id: "q3",
      title: "Dovolenka",
      text: "Plánuješ leto. Môžeš ísť na overené miesto, kde ti je vždy dobre, alebo do krajiny, kde si nikdy nebol/a a nevieš, čo čakať.",
      a: "Beriem overené. Dovolenka je na oddych, nie na adrenalín.",
      b: "Idem do neznáma. Práve preto si pamätám tie najlepšie cesty.",
    },
    {
      id: "q3",
      title: "Investícia",
      text: "Máš úspory. Banka ponúka 4 % ročne s nulovým rizikom. Známy ti hovorí o investícii s potenciálom 40 %, ale aj s reálnou stratou.",
      a: "Dávam to do banky. V noci aspoň pokojne spím.",
      b: "Idem do tej rizikovej. Bez odvahy nie sú veľké výnosy.",
    },
  ],
  q4: [
    {
      id: "q4",
      title: "Sám alebo s druhými",
      text: "Si úplne vyčerpaný/á. Kamarát ti ponúkne, že ti na týždeň prevezme nákupy, varenie a veci okolo domu, aby si si oddýchol/la.",
      a: "Slušne odmietnem. Chcem si tým prejsť po svojom — bez toho, aby som niekoho zaťažoval/a.",
      b: "Prijmem. Nechať si pomôcť, keď je zle, je v poriadku — a aj to medzi nami niečo posilní.",
    },
    {
      id: "q4",
      title: "Sťahovanie",
      text: "Sťahuješ sa do nového bytu. Tvoji kamaráti sami napíšu, že prídu pomôcť celý deň.",
      a: "Poďakujem a poviem, že to zvládnem sám/sama. Nechcem nikoho oberať o sobotu.",
      b: "Prijmem s vďakou. Spoločne to bude rýchlejšie a aj zábavnejšie.",
    },
    {
      id: "q4",
      title: "Choroba",
      text: "Si chorý/á a ležíš týždeň doma. Kamarát ponúkne, že ti bude každý deň nosiť jedlo.",
      a: "Odmietnem. Objednám si donášku, nech ho nezdržujem.",
      b: "Prijmem. Vďaka tomu sa cítim menej sám/sama a aj rýchlejšie sa vyzdraviem.",
    },
    {
      id: "q4",
      title: "Pohovor",
      text: "Pripravuješ sa na dôležitý pohovor. Známy v odbore ti ponúkne mock interview a spätnú väzbu.",
      a: "Pripravím sa sám/sama. Mám svoj rytmus a cudzí feedback ma len vyhodí z miery.",
      b: "Prijmem. Cudzie oči vidia, čo ja nevidím — to mi dá náskok.",
    },
  ],
  q5: [
    {
      id: "q5",
      title: "Pravda alebo dobrá vec",
      text: "Zistíš, že kolega trochu upravuje firemné dáta. Nikomu to neublíži, ale vďaka tomu získali peniaze na výskum, ktorý zachráni stovky životov.",
      a: "Nahlásim ho. Klamstvo je klamstvo — aj keď z dobrých dôvodov to neskôr pokazí dôveru vo všetkom.",
      b: "Mlčím. Zachránené životy sú dôležitejšie ako jedno porušené pravidlo na papieri.",
    },
    {
      id: "q5",
      title: "Priateľov tip",
      text: "Tvoj priateľ ti dá tip, ktorý ti zarobí veľa peňazí — ale dostal ho z práce, kde to nesmel povedať.",
      a: "Tip nepoužijem. Aj zisk z toho má v sebe niečo zlomené.",
      b: "Použijem ho. Nikomu sa tým neublíži a nám sa otvoria nové dvere.",
    },
    {
      id: "q5",
      title: "Sestrina práca",
      text: "Sestra ide na pohovor, na ktorý si reálne nesedí, ale veľmi ho chce. Pýta sa ťa, či má v životopise prikrášliť dve veci.",
      a: "Hovorím nie. Začať na klamstve sa skôr či neskôr vráti.",
      b: "Hovorím áno. Šancu si zaslúži a život je dlhý — pravda sa časom doženie aj výsledkami.",
    },
    {
      id: "q5",
      title: "Priateľ v probléme",
      text: "Najlepší kamarát urobil vážnu chybu v práci a hrozí mu výpoveď. Vie, že to vieš. Prosí ťa, aby si o tom mlčal/a.",
      a: "Poviem to vedeniu. Pravda je dôležitejšia ako moje pohodlie s ním.",
      b: "Mlčím. Priateľstvo a druhá šanca preváži formálne pravidlo.",
    },
  ],
  q6: [
    {
      id: "q6",
      title: "Talent alebo drina",
      text: "Mesiace tvrdo cvičíš novú vec (hudba, šport, kódovanie). Expert ti povie, že snahu máš, ale prirodzený talent na to nemáš.",
      a: "Skúsim niečo iné. Má zmysel robiť to, na čo mám prirodzene bunky.",
      b: "Pridám ešte viac. Talent sa preceňuje — drina prebije takmer všetko.",
    },
    {
      id: "q6",
      title: "Dieťa na klavíri",
      text: "Tvoje dieťa miluje klavír, ale učiteľka hovorí, že nemá hudobný sluch. Ostatné deti ho prebehnú.",
      a: "Nájdem mu niečo, kde ho talent unesie ďalej. Zlomené sebavedomie nestojí za to.",
      b: "Necháme ho hrať. Drina a láska k veci ho dovedú ďalej ako talent.",
    },
    {
      id: "q6",
      title: "Beh",
      text: "Začneš trénovať na maratón. Po polroku vidíš, že tvoj kamarát s polovičnou drinou je o triedu vyššie.",
      a: "Prijmem, že na to nemám stavbu. Skúsim disciplínu, kde budem mať férovejší štart.",
      b: "Trénujem dvojnásobne. Genetika ma nezastaví — len ma spomalí.",
    },
    {
      id: "q6",
      title: "Pracovný posun",
      text: "Roky sa snažíš preraziť v odbore. Mladší kolega s polovičnou praxou ťa preskočí — má to v sebe.",
      a: "Skúsim niečo, kde mám prirodzenú výhodu. Bojovať proti talentu druhých vyčerpáva.",
      b: "Pridám. Pravidelná drina dlhodobo poráža talent bez disciplíny.",
    },
  ],
};

// Backwards-compatible default: first variant per dimension (used as fallback / by anything that still imports SCENARIOS).
export const SCENARIOS: ReadonlyArray<Scenario> = (
  Object.keys(SCENARIO_VARIANTS) as DimensionId[]
).map((k) => SCENARIO_VARIANTS[k][0]);

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h >>> 0;
}

export function pickScenarios(seed?: string): Scenario[] {
  const keys = Object.keys(SCENARIO_VARIANTS) as DimensionId[];
  if (seed) {
    return keys.map((k, i) => {
      const variants = SCENARIO_VARIANTS[k];
      const idx = hashString(seed + ":" + k + ":" + i) % variants.length;
      return variants[idx];
    });
  }
  return keys.map((k) => {
    const variants = SCENARIO_VARIANTS[k];
    return variants[Math.floor(Math.random() * variants.length)];
  });
}

// ============ Dynamic Algorithm ============

// Dynamic weights that adapt based on user feedback
type DynamicWeights = Record<DimensionId, number>;

// Default initial weights (will be adjusted dynamically)
const DEFAULT_WEIGHTS: DynamicWeights = {
  q1: 1.5,
  q2: 2.5,
  q3: 1.5,
  q4: 2.0,
  q5: 2.5,
  q6: 1.0,
};

// Learning rate for weight adjustment
const LEARNING_RATE = 0.1;
const TEMPORAL_DECAY = 0.95; // Decay factor for old feedback

// User feedback tracking
export type UserFeedback = {
  matchId: string;
  score: number; // -1 (dislike) to +1 (like)
  timestamp: number;
  dimensionScores?: Partial<Record<DimensionId, number>>;
  context?: {
    timeOfDay?: number; // 0-23
    dayOfWeek?: number; // 0-6
    sessionLength?: number; // seconds
  };
};

// Dynamic weight storage (in-memory, would be persisted to database in production)
let dynamicWeights: DynamicWeights = { ...DEFAULT_WEIGHTS };
let userFeedbackHistory: UserFeedback[] = [];

// Multi-armed bandit: track performance of different match patterns
type MatchPattern = string; // e.g., "AABBAB"
type BanditArm = {
  pattern: MatchPattern;
  pulls: number;
  reward: number;
  lastPull: number;
};
let banditArms: Map<string, BanditArm> = new Map();

// Load bandit state from Supabase
export async function initializeBanditState() {
  const state = await loadBanditState();
  if (state) {
    if (state.dynamic_weights && Object.keys(state.dynamic_weights).length > 0) {
      dynamicWeights = state.dynamic_weights;
    }
    if (state.user_feedback_history && Array.isArray(state.user_feedback_history)) {
      userFeedbackHistory = state.user_feedback_history;
    }
    if (state.bandit_arms && typeof state.bandit_arms === "object") {
      banditArms = new Map(Object.entries(state.bandit_arms)) as Map<string, BanditArm>;
    }
  }
}

// Save bandit state to Supabase
async function persistBanditState() {
  const armsObj = Object.fromEntries(banditArms);
  await saveBanditState(dynamicWeights, armsObj, userFeedbackHistory);
}

// Calculate dynamic resonance with adaptive weights
export function calcResonance(
  a: FullAnswers,
  b: FullAnswers,
  customWeights?: DynamicWeights,
): number {
  const weights = customWeights || dynamicWeights;
  let score = 0;
  let totalWeight = 0;

  (Object.keys(DIMENSIONS) as Array<DimensionId>).forEach((k) => {
    if (a[k] === undefined || b[k] === undefined) return;
    const { mode } = DIMENSIONS[k];
    const weight = weights[k];
    const same = a[k] === b[k];

    let dimensionScore: number;
    if (mode === "similar") {
      dimensionScore = same ? weight : weight * 0.15;
    } else {
      dimensionScore = same ? weight * 0.55 : weight;
    }

    score += dimensionScore;
    totalWeight += weight;
  });

  if (totalWeight === 0) return 0;
  return Math.round((score / totalWeight) * 1000) / 10;
}

// Update weights based on user feedback (reinforcement learning with temporal decay)
export function updateWeightsFromFeedback(feedback: UserFeedback): void {
  userFeedbackHistory.push(feedback);

  // Only keep last 100 feedbacks with temporal decay
  if (userFeedbackHistory.length > 100) {
    userFeedbackHistory = userFeedbackHistory.slice(-100);
  }

  // Calculate time-weighted feedback per dimension
  const dimensionFeedback: Partial<
    Record<DimensionId, { weightedSum: number; totalWeight: number }>
  > = {};
  const now = Date.now();
  const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

  userFeedbackHistory.forEach((f) => {
    const age = now - f.timestamp;
    const timeWeight = Math.pow(TEMPORAL_DECAY, age / (24 * 60 * 60 * 1000)); // Daily decay

    if (f.dimensionScores) {
      (Object.keys(f.dimensionScores) as DimensionId[]).forEach((dim) => {
        if (!dimensionFeedback[dim]) dimensionFeedback[dim] = { weightedSum: 0, totalWeight: 0 };
        dimensionFeedback[dim]!.weightedSum += f.dimensionScores![dim]! * f.score * timeWeight;
        dimensionFeedback[dim]!.totalWeight += timeWeight;
      });
    }
  });

  // Adjust weights based on time-weighted feedback
  (Object.keys(DIMENSIONS) as DimensionId[]).forEach((dim) => {
    const feedback = dimensionFeedback[dim];
    if (feedback && feedback.totalWeight > 0) {
      const avgFeedback = feedback.weightedSum / feedback.totalWeight;
      const adjustment = avgFeedback * LEARNING_RATE;
      dynamicWeights[dim] = Math.max(0.5, Math.min(4.0, dynamicWeights[dim] + adjustment));
    }
  });

  console.log("[algorithm] Weights updated:", dynamicWeights);
  void persistBanditState();
}

// Calculate dimension-specific compatibility for feedback
export function calcDimensionScores(
  a: FullAnswers,
  b: FullAnswers,
): Partial<Record<DimensionId, number>> {
  const scores: Partial<Record<DimensionId, number>> = {};
  (Object.keys(DIMENSIONS) as DimensionId[]).forEach((k) => {
    const { mode } = DIMENSIONS[k];
    const same = a[k] === b[k];
    scores[k] = (mode === "similar" && same) || (mode === "complement" && !same) ? 1 : -0.5;
  });
  return scores;
}

// Multi-armed bandit: select match pattern with UCB (Upper Confidence Bound)
export function selectMatchPattern(
  userAnswers: FullAnswers,
  availablePatterns: MatchPattern[],
): MatchPattern {
  const now = Date.now();

  // Initialize arms if needed
  availablePatterns.forEach((pattern) => {
    if (!banditArms.has(pattern)) {
      banditArms.set(pattern, { pattern, pulls: 0, reward: 0, lastPull: now });
    }
  });

  // Calculate UCB for each arm
  const totalPulls = Array.from(banditArms.values()).reduce((sum, arm) => sum + arm.pulls, 0);

  let bestPattern = availablePatterns[0];
  let bestUCB = -Infinity;

  availablePatterns.forEach((pattern) => {
    const arm = banditArms.get(pattern)!;
    const avgReward = arm.pulls > 0 ? arm.reward / arm.pulls : 0;

    // UCB formula: avg_reward + sqrt(2 * ln(total_pulls) / pulls)
    const exploration = arm.pulls > 0 ? Math.sqrt((2 * Math.log(totalPulls + 1)) / arm.pulls) : 1.0; // High exploration for untried arms

    const ucb = avgReward + exploration;

    if (ucb > bestUCB) {
      bestUCB = ucb;
      bestPattern = pattern;
    }
  });

  return bestPattern;
}

// Update bandit arm after match outcome
export function updateBanditArm(pattern: MatchPattern, reward: number): void {
  const arm = banditArms.get(pattern);
  if (arm) {
    arm.pulls++;
    arm.reward += reward;
    arm.lastPull = Date.now();
    void persistBanditState();
  }
}

// Calculate match pattern from answers
export function getMatchPattern(a: FullAnswers, b: FullAnswers): MatchPattern {
  return Object.values(a)
    .map((ans, i) => {
      const bAns = Object.values(b)[i];
      return ans === bAns ? "S" : "D"; // S = same, D = different
    })
    .join("");
}

// Context-aware scoring: consider time of day, user state
export function calcContextualScore(
  a: FullAnswers,
  b: FullAnswers,
  context?: { timeOfDay?: number; dayOfWeek?: number },
): { score: number; contextBonus: number } {
  const baseScore = calcResonance(a, b);
  let contextBonus = 0;

  if (context) {
    // Evening/night might prefer different match types
    if (context.timeOfDay && context.timeOfDay >= 20) {
      // Late night: slightly boost complement matches (q1, q3)
      const complementCount = (a.q1 !== b.q1 ? 1 : 0) + (a.q3 !== b.q3 ? 1 : 0);
      contextBonus += complementCount * 2;
    }

    // Weekend might prefer similar matches
    if (context.dayOfWeek && (context.dayOfWeek === 0 || context.dayOfWeek === 6)) {
      const similarCount = (a.q2 === b.q2 ? 1 : 0) + (a.q5 === b.q5 ? 1 : 0);
      contextBonus += similarCount * 1.5;
    }
  }

  return {
    score: Math.min(100, baseScore + contextBonus),
    contextBonus,
  };
}

// Diversity constraint: ensure variety in recommendations
export function ensureDiversity(
  rankedMatches: RankedMatch[],
  topN: number,
  minArchetypes: number = 2,
): RankedMatch[] {
  if (rankedMatches.length <= topN) return rankedMatches;

  const selected: RankedMatch[] = [];
  const usedArchetypes = new Set<ArchetypeId>();

  // First pass: pick top matches while ensuring archetype diversity
  for (const match of rankedMatches) {
    if (selected.length >= topN) break;

    const arch = archetypeOf(match.answers);
    if (!usedArchetypes.has(arch.id) || usedArchetypes.size >= minArchetypes) {
      selected.push(match);
      usedArchetypes.add(arch.id);
    }
  }

  // Second pass: fill remaining slots with highest remaining
  if (selected.length < topN) {
    const remaining = rankedMatches.filter((m) => !selected.includes(m));
    selected.push(...remaining.slice(0, topN - selected.length));
  }

  return selected;
}

// Calculate compatibility with uncertainty (for exploration vs exploitation)
export function calcResonanceWithUncertainty(
  a: FullAnswers,
  b: FullAnswers,
): {
  score: number;
  uncertainty: number;
  explorationBonus: number;
  banditScore?: number;
} {
  const baseScore = calcResonance(a, b);
  const pattern = getMatchPattern(a, b);

  // Calculate uncertainty based on how much feedback we have for this match type
  const dimensionScores = calcDimensionScores(a, b);
  const feedbackCount = userFeedbackHistory.filter(
    (f) =>
      f.dimensionScores &&
      (Object.keys(f.dimensionScores) as DimensionId[]).some(
        (dim) => dimensionScores[dim] === f.dimensionScores![dim],
      ),
  ).length;

  const uncertainty = Math.max(0, 1 - feedbackCount / 10); // 0 = certain, 1 = uncertain

  // Add exploration bonus for uncertain matches (epsilon-greedy approach)
  const explorationBonus = uncertainty * 5;

  // Get bandit score if available
  const arm = banditArms.get(pattern);
  const banditScore = arm && arm.pulls > 0 ? arm.reward / arm.pulls : undefined;

  return {
    score: baseScore,
    uncertainty,
    explorationBonus,
    banditScore,
  };
}

// Reset weights to defaults (for testing or user preference reset)
export function resetWeights(): void {
  dynamicWeights = { ...DEFAULT_WEIGHTS };
  userFeedbackHistory = [];
  banditArms.clear();
}

// Get current weights (for debugging/visualization)
export function getCurrentWeights(): DynamicWeights {
  return { ...dynamicWeights };
}

// Get bandit statistics (for debugging/visualization)
export function getBanditStats(): Array<{ pattern: string; pulls: number; avgReward: number }> {
  return Array.from(banditArms.values()).map((arm) => ({
    pattern: arm.pattern,
    pulls: arm.pulls,
    avgReward: arm.pulls > 0 ? arm.reward / arm.pulls : 0,
  }));
}

export type BreakdownItem = { kind: "similar" | "complement"; label: string };

export function resonanceBreakdown(a: FullAnswers, b: FullAnswers): BreakdownItem[] {
  const labels: Record<string, { sim: string; comp: string }> = {
    q1: {
      sim: "Rozhodujete sa rovnakým tempom",
      comp: "Jeden z vás brzdí, druhý tlačí — vyvažujete sa",
    },
    q2: { sim: "Obaja idete rovnako — hlavou alebo srdcom", comp: "Vidíte ľudí cez iné šošovky" },
    q3: {
      sim: "K riziku pristupujete rovnako",
      comp: "Jeden drží istotu, druhý skúša nové — dobrá kombinácia",
    },
    q4: {
      sim: "Rovnako vnímate samotu aj blízkosť",
      comp: "Inak chápete, kedy sa oprieť o druhých",
    },
    q5: {
      sim: "Máte rovnaký kompas v zložitých veciach",
      comp: "Rozdielne vnímate pravdu a dobro",
    },
    q6: { sim: "Rovnako vnímate talent aj snahu", comp: "Inak sa pozeráte na to, čo nás formuje" },
  };
  const out: BreakdownItem[] = [];
  (Object.keys(DIMENSIONS) as Array<DimensionId>).forEach((k) => {
    const { mode } = DIMENSIONS[k];
    const same = a[k] === b[k];
    if (mode === "similar" && same) out.push({ kind: "similar", label: labels[k].sim });
    else if (mode === "complement" && !same)
      out.push({ kind: "complement", label: labels[k].comp });
  });
  return out;
}

type Prompt = { title: string; sub: string };

const PROMPT_BANK: Record<
  | "q1same"
  | "q1diff"
  | "q2same"
  | "q2diff"
  | "q3same"
  | "q3diff"
  | "q4same"
  | "q4diff"
  | "q5same"
  | "q5diff"
  | "q6same"
  | "q6diff",
  Prompt[]
> = {
  q1same: [
    {
      title: "Tempo života",
      sub: "Obaja sa rozhodujete podobne. Kedy ste naposledy svoj štýl ľutovali a kedy vám priniesol víťazstvo?",
    },
    {
      title: "Rýchle áno",
      sub: "Ak by ste sa mali dnes večer rozhodnúť pre niečo veľké, čo by to bolo a prečo by ste neváhali?",
    },
    {
      title: "Cena rozhodnutia",
      sub: "Aké rozhodnutie vás stálo najviac — a urobili by ste ho dnes znova?",
    },
  ],
  q1diff: [
    {
      title: "Brzda a plyn",
      sub: "Jeden z vás skáče, druhý si veci premyslí. Spomeňte si na moment, keď vám ten druhý prístup zachránil situáciu.",
    },
    {
      title: "Spoločný plán",
      sub: "Predstavte si, že spolu plánujete víkend o hodinu — ako sa dohodnete, kto rozhoduje?",
    },
    {
      title: "Risk vs. premýšľanie",
      sub: "Kedy bola vaša impulzívnosť (alebo opatrnosť) presne to, čo treba?",
    },
  ],
  q2same: [
    {
      title: "Hlava alebo srdce",
      sub: "Spomeňte si na situáciu, keď ste museli vybrať medzi tým, čo dáva zmysel, a tým, čo cítite. Ako ste sa rozhodli?",
    },
    {
      title: "Empatia v praxi",
      sub: "Kedy vás emócia (alebo logika) doviedla k najlepšiemu rozhodnutiu vášho života?",
    },
    {
      title: "Človek v kríze",
      sub: "Ako si predstavujete, že vás partner podrží, keď budete na dne — slovami alebo riešením?",
    },
  ],
  q2diff: [
    {
      title: "Iné šošovky",
      sub: "Vidíte ľudí cez iné šošovky. Skúste si vzájomne opísať jednu spoločnú osobu — čo si na nej všímate?",
    },
    {
      title: "Cit vs. analýza",
      sub: "Kedy vám rozdielny pohľad pomohol pochopiť situáciu, ktorú sami zvládnuť neviete?",
    },
    {
      title: "Most medzi nami",
      sub: "Ako môže človek so srdcom pomôcť človeku s hlavou — a naopak?",
    },
  ],
  q3same: [
    {
      title: "Istota alebo risk",
      sub: "K riziku pristupujete rovnako. Aké je najodvážnejšie (alebo najopatrnejšie) rozhodnutie, na ktoré ste hrdí?",
    },
    {
      title: "Komfortná zóna",
      sub: "Kde leží vaša komfortná zóna — a kedy ste z nej naposledy vykročili?",
    },
    {
      title: "Spoločná cesta",
      sub: "Keby ste mali spolu vyraziť do neznáma, kam by to bolo a kto by viedol?",
    },
  ],
  q3diff: [
    {
      title: "Istota a zmena",
      sub: "Jeden má rád stabilitu, druhý zmenu. Ako by ste si rozdelili roly v spoločnom projekte?",
    },
    {
      title: "Volant",
      sub: "Keby ste teraz mali spolu vyraziť na nečakaný výlet, kto sedí za volantom a prečo?",
    },
    {
      title: "Nový krok",
      sub: "Aký bol váš posledný skok do neznáma — alebo váš posledný rozumný odklad?",
    },
  ],
  q4same: [
    {
      title: "Sám alebo spolu",
      sub: "Rovnako vnímate samotu aj blízkosť. Kedy je pre vás samota liekom a kedy je to spolu?",
    },
    {
      title: "Opora",
      sub: "Kto bol naposledy vaša opora — a kedy ste vy boli oporou pre niekoho?",
    },
    {
      title: "Hranice",
      sub: "Kde sú vaše hranice — kedy ešte \u201Esom tu pre teba\u201C a kedy už \u201Epotrebujem byť sám/sama\u201C?",
    },
  ],
  q4diff: [
    {
      title: "Požiadať o pomoc",
      sub: "Vnútornú silu vnímate rozdielne. Povedzte si moment, keď vám prosba o pomoc niečo zmenila — alebo keď ste ju neuniesli.",
    },
    {
      title: "Spoločná batoha",
      sub: "Aké veci si nesiete sami — a ktoré by ste boli ochotní niekomu odovzdať?",
    },
    {
      title: "Nezávislosť a blízkosť",
      sub: "Ako vyzerá vaša ideálna rovnováha medzi \u201Emy\u201C a \u201Eja\u201C?",
    },
  ],
  q5same: [
    {
      title: "Pravda alebo dobro",
      sub: "Zhodli ste sa na podobnom kompase. Kde je u vás hranica, ktorú by ste neprekročili ani pre väčšie dobro?",
    },
    {
      title: "Malé klamstvá",
      sub: "Existuje pre vás \u201Edobré klamstvo\u201C? Skúste si vzájomne dať príklad.",
    },
    {
      title: "Vlastná česť",
      sub: "Aký princíp si dnes držíte aj vtedy, keď je to pre vás nevýhodné?",
    },
  ],
  q5diff: [
    {
      title: "Pravda vs. výsledok",
      sub: "Rozdielne vnímate pravdu a dobro. Spomeňte si na situáciu, kde by ste sa rozhodli inak — a vysvetlite prečo.",
    },
    { title: "Šedá zóna", sub: "Kde leží vaša šedá zóna — a kde leží tá druhého?" },
    {
      title: "Skúška charakteru",
      sub: "Čo by vám muselo byť na váhe, aby ste porušili vlastný princíp?",
    },
  ],
  q6same: [
    {
      title: "Talent a drina",
      sub: "Rovnako vnímate snahu aj talent. V čom ste sa vy sami naučili niečo \u201Eproti svojej prirodzenosti\u201C?",
    },
    {
      title: "Zlyhania",
      sub: "Aké zlyhanie vás najviac posunulo a čo by ste si dnes povedali vtedajšiemu sebe?",
    },
    { title: "Rast", sub: "Kde dnes cítite, že rastiete — a kde sa cítite zaseknutí?" },
  ],
  q6diff: [
    {
      title: "Predispozícia vs. úsilie",
      sub: "Inak sa pozeráte na to, čo nás formuje. Ako by ste viedli dieťa, ktoré niečo veľmi chce, ale nemá k tomu \u201Edary\u201C?",
    },
    {
      title: "Cudzia disciplína",
      sub: "Obdivujete na druhom skôr jeho prirodzený dar alebo to, ako tvrdo pracoval?",
    },
    {
      title: "Vlastný príbeh",
      sub: "Vďačíte za to, kde dnes ste, viac svojej drine alebo svojim danostiam?",
    },
  ],
};

function pickFromBank(bank: Prompt[], seed: string): Prompt {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return bank[h % bank.length];
}

export function catalystFor(a: FullAnswers, b: FullAnswers, seed: string = ""): Prompt {
  // Build a weighted list of relevant categories so the prompt varies per match.
  const candidates: { key: keyof typeof PROMPT_BANK; weight: number }[] = [];
  const push = (k: keyof typeof PROMPT_BANK, w: number) => candidates.push({ key: k, weight: w });
  if (a.q2 === b.q2) push("q2same", 3);
  else push("q2diff", 3);
  if (a.q5 === b.q5) push("q5same", 2.5);
  else push("q5diff", 2.5);
  if (a.q1 === b.q1) push("q1same", 1.5);
  else push("q1diff", 2);
  if (a.q3 === b.q3) push("q3same", 1.5);
  else push("q3diff", 2);
  if (a.q4 === b.q4) push("q4same", 1.5);
  else push("q4diff", 2);
  if (a.q6 === b.q6) push("q6same", 1);
  else push("q6diff", 1);

  // Deterministic weighted pick from the seed.
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  const total = candidates.reduce((s, c) => s + c.weight, 0);
  let r = ((h % 1000) / 1000) * total;
  let chosen = candidates[0].key;
  for (const c of candidates) {
    if (r < c.weight) {
      chosen = c.key;
      break;
    }
    r -= c.weight;
  }
  return pickFromBank(PROMPT_BANK[chosen], seed + chosen);
}

// ============ Profile / matching filter ============

export type Gender = "male" | "female" | "other";
export type Orientation = "hetero" | "homo" | "bi";

export type UserProfile = {
  name: string;
  age: number;
  birthDate?: string;
  city: string;
  gender: Gender;
  orientation: Orientation;
  coords?: { lat: number; lon: number };
  radiusKm?: number; // max search radius (default 200)
  // psychometric EV variables
  cognitiveDepth?: number;
  conscientiousness?: number;
  extraversion?: number;
  attachmentStyle?: string;
  avgResponseTime?: number;
  topPriority?: string;
  hesitated?: boolean; // gyroscopic volatility flag
  redemptionQuota?: number; // drawdown redemption quota
  completedPressureScenarios?: string[]; // track completed pressure scenarios
  id?: string;
  videoUrls?: string[]; // live snippet video URLs
  nonNegotiable?: string; // user directive: non-negotiable
  currentThesis?: string; // user directive: current thesis
  livenessVerified?: boolean; // Biometric verified tier
  verifiedAt?: string; // ISO timestamp of verification
  status?: "ACTIVE" | "FROZEN" | "BANNED";
  haptic_profile?: "STEALTH" | "TACTILE" | "MECHANICAL";
  geo_density?: "ECO_5KM" | "BALANCED_2KM" | "HIGH_FREQ_500M";
  ui_speed?: "TYPEWRITER_ANIMATED" | "INSTANT_RAW";
  directive_goal?: string;
  directive_redflags?: string;
  directive_lifestyle?: string;
};

export function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function ageBounds(age: number): { min: number; max: number } {
  const min = Math.max(18, Math.floor(age / 2 + 7));
  const max = Math.floor((age - 7) * 2);
  return { min, max: max < min ? min : max };
}

export function isCompatible(me: UserProfile, other: UserProfile): boolean {
  const a = ageBounds(me.age),
    b = ageBounds(other.age);
  if (other.age < a.min || other.age > a.max) return false;
  if (me.age < b.min || me.age > b.max) return false;

  const wants = (x: UserProfile, y: UserProfile) => {
    if (x.orientation === "bi") return true;
    if (x.orientation === "hetero") {
      if (x.gender === "other" || y.gender === "other") return false;
      return x.gender !== y.gender;
    }
    if (x.gender === "other" || y.gender === "other") return false;
    return x.gender === y.gender;
  };

  return wants(me, other) && wants(other, me);
}

function ageBonus(myAge: number, partnerAge: number): number {
  const diff = Math.abs(myAge - partnerAge);
  if (diff <= 2) return 10;
  if (diff <= 5) return 5;
  return 0;
}

// ============ Mock matches ============

export type MockMatch = {
  id: string;
  name: string;
  age: number;
  city: string;
  gender: Gender;
  orientation: Orientation;
  bio: string;
  img: string;
  answers: FullAnswers;
  coords?: { lat: number; lon: number };
  // New EV variables
  cognitive_depth: number;
  conscientiousness: number;
  extraversion: number;
  attachment_style: "Secure" | "Anxious" | "Avoidant" | "Fearful";
  avg_response_time: number;
  top_priority: string;
  hesitated?: boolean;
  videoUrls?: string[];
};

export const MOCK_MATCHES: MockMatch[] = [];

export type RankedMatch = MockMatch & { score: number; distanceKm?: number; isAutoExpanded?: boolean };

export const MAX_MATCH_PHOTOS = 6;

export function calcEVScore(
  depthP: number,
  depthQ: number,
  consP: number,
  consQ: number,
  extP: number,
  extQ: number,
  styleP: string,
  styleQ: string,
  rtP: number,
  rtQ: number,
  targetT: number = 1.0,
  hesitatedP: boolean = false,
  hesitatedQ: boolean = false,
): number {
  // 1. Similarity (Euclidean distance on Cognition & Conscientiousness)
  const dist = Math.sqrt(Math.pow(depthP - depthQ, 2) + Math.pow(consP - consQ, 2));
  const s_sim = 1.0 - dist / Math.sqrt(2.0);

  // 2. Complementarity (with asymmetric introvert discount based on targetT)
  const sum = extP + extQ;
  const d_comp = sum < targetT ? 0.5 * (targetT - sum) : 1.0 * (sum - targetT);
  const s_comp = 1.0 - Math.min(1.0, Math.max(0.0, d_comp));

  // 3. Toxicity Matrix Multiplier
  const getSinglePenalty = (sp: string, sq: string): number => {
    const sp_norm = sp.trim().substring(0, 3).toLowerCase();
    const sq_norm = sq.trim().substring(0, 3).toLowerCase();

    const matrix: Record<string, Record<string, number>> = {
      sec: { sec: 0.0, anx: -0.15, avo: -0.2, fea: -0.25 },
      anx: { sec: -0.15, anx: -0.4, avo: -1.0, fea: -0.6 },
      avo: { sec: -0.2, anx: -1.0, avo: -0.5, fea: -0.6 },
      fea: { sec: -0.25, anx: -0.6, avo: -0.6, fea: -0.7 },
    };

    const pStyle = matrix[sp_norm] ? sp_norm : "sec";
    const qStyle = matrix[sq_norm] ? sq_norm : "sec";
    return matrix[pStyle][qStyle] ?? 0.0;
  };

  const m_tox = Math.max(0.0, Math.min(1.0, 1.0 + getSinglePenalty(styleP, styleQ)));

  // 4. Anti-Cheat Response time calibration (Gyroscopic Hesitation discount)
  const calculateDiscount = (rt: number, hesitated: boolean, t_min = 2.0): number => {
    let discount = rt >= t_min ? 1.0 : rt / t_min;
    if (hesitated) {
      discount *= 0.7; // apply an extra 30% discount for gyroscopic instability
    }
    return Math.max(0.1, Math.min(1.0, discount));
  };

  const m_cheat = calculateDiscount(rtP, hesitatedP) * calculateDiscount(rtQ, hesitatedQ);

  // 5. Combined Score
  const w_sim = 0.6;
  const w_comp = 0.4;
  const base_score = w_sim * s_sim + w_comp * s_comp;

  return base_score * m_tox * m_cheat;
}

export function rankMatches(me: UserProfile, list: MockMatch[]): RankedMatch[] {
  const isGlobal = me.radiusKm === undefined || me.radiusKm >= 500;
  let currentRadius = me.radiusKm ?? 200;
  const MIN_CANDIDATE_POOL = 50;

  const cDepthP = me.cognitiveDepth ?? 0.5;
  const consP = me.conscientiousness ?? 0.5;
  const extP = me.extraversion ?? 0.5;
  const styleP = me.attachmentStyle ?? "Secure";
  const rtP = me.avgResponseTime ?? 3.0;
  const hesitatedP = me.hesitated ?? false;

  const compatibleCandidates = list.filter((m) => isCompatible(me, m));

  const avgCandidateE =
    compatibleCandidates.length > 0
      ? compatibleCandidates.reduce((acc, c) => acc + c.extraversion, 0) /
        compatibleCandidates.length
      : 0.5;
  const dynamicTargetT = Math.max(0.6, Math.min(1.4, avgCandidateE * 2.0));

  const allScored = compatibleCandidates.map((m) => {
    const base = calcEVScore(
      cDepthP,
      m.cognitive_depth,
      consP,
      m.conscientiousness,
      extP,
      m.extraversion,
      styleP,
      m.attachment_style,
      rtP,
      m.avg_response_time,
      dynamicTargetT,
      hesitatedP,
      m.hesitated ?? false,
    );
    const bonus = ageBonus(me.age, m.age) / 100.0;
    const distanceKm = me.coords && m.coords ? haversineKm(me.coords, m.coords) : undefined;
    return {
      ...m,
      distanceKm,
      score: Math.min(100, Math.round((base + bonus) * 1000) / 10),
    };
  });

  // Iterative auto-expansion
  let filtered = allScored.filter(
    (m) => isGlobal || m.distanceKm === undefined || m.distanceKm <= currentRadius,
  );
  const totalCompatibleCount = allScored.length;
  const targetThreshold = Math.min(MIN_CANDIDATE_POOL, totalCompatibleCount);
  let autoExpanded = false;

  if (!isGlobal && filtered.length < targetThreshold) {
    autoExpanded = true;
    while (filtered.length < targetThreshold && currentRadius < 500) {
      currentRadius += 25;
      filtered = allScored.filter(
        (m) => m.distanceKm === undefined || m.distanceKm <= currentRadius,
      );
    }
    if (filtered.length < targetThreshold) {
      filtered = allScored; // fallback to global
    }
  }

  const originalRadius = me.radiusKm ?? 200;
  return filtered
    .map((m) => ({
      ...m,
      isAutoExpanded:
        !isGlobal && autoExpanded && m.distanceKm !== undefined && m.distanceKm > originalRadius,
    }))
    .sort((a, b) => b.score - a.score);
}

// ============ Conversations (text DMs after voice chamber) ============

export type ChatMessage = {
  id: string;
  from: "me" | "them";
  text: string;
  ts: number;
  media?: { kind: "image" | "gif" | "audio"; url: string; duration?: number };
};

export type Conversation = {
  id: string;
  matchId: string;
  blurLevel: number; // 0..100 (higher = more blurred)
  messages: ChatMessage[];
  unread: boolean;
  createdAt: number;
  status?: "active" | "closed";
  closureReason?: string;
};

const REPLY_TEMPLATES = [
  "Hmm, to ma chytilo. Povedz viac.",
  "Súhlasím. Aj ja to tak vnímam.",
  "Zaujímavé. Mňa to vedie inde — povedz prečo si tak rozhodol/a.",
  "Daj mi chvíľu, premyslím si to.",
  "Pekne povedané. Toto si zapíšem.",
  "Smeješ sa? Ja tiež. :)",
  "A čo robíš teraz, hneď v tejto chvíli?",
  "Spomenul/a si mi niekoho, koho mám rád/rada.",
  "To ma prekvapilo. Naozaj?",
  "Cítim sa pri tom dobre. Vďaka.",
];

export function mockReply(seed: string, lastUserMsg: string): string {
  const s = seed + lastUserMsg;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return REPLY_TEMPLATES[h % REPLY_TEMPLATES.length];
}

// ============ Personality archetype & orb seed ============

export type ArchetypeId = "ANALYTIK" | "STRATEG" | "STRAZCA" | "SNILEK";

export type Archetype = {
  id: ArchetypeId;
  label: string;
  tagline: string;
  hue: number; // 0..1 primary hue
  accent: string; // hex accent for UI
  accent2: string; // gradient tail
};

export const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  ANALYTIK: {
    id: "ANALYTIK",
    label: "ANALYTIK",
    tagline: "Hlava + istota.",
    hue: 0.52,
    accent: "#e5e5e5",
    accent2: "#a3a3a3",
  },
  STRATEG: {
    id: "STRATEG",
    label: "STRATÉG",
    tagline: "Hlava + zmena.",
    hue: 0.7,
    accent: "#d4d4d4",
    accent2: "#a3a3a3",
  },
  STRAZCA: {
    id: "STRAZCA",
    label: "STRÁŽCA",
    tagline: "Srdce + istota.",
    hue: 0.95,
    accent: "#c4c4c4",
    accent2: "#8a8a8a",
  },
  SNILEK: {
    id: "SNILEK",
    label: "SNÍLEK",
    tagline: "Srdce + zmena.",
    hue: 0.1,
    accent: "#b4b4b4",
    accent2: "#8a8a8a",
  },
};

export function archetypeOf(a: FullAnswers): Archetype {
  const head = a.q2 === "A";
  const stable = a.q3 === "A";
  if (head && stable) return ARCHETYPES.ANALYTIK;
  if (head && !stable) return ARCHETYPES.STRATEG;
  if (!head && stable) return ARCHETYPES.STRAZCA;
  return ARCHETYPES.SNILEK;
}

export type OrbSeed = {
  hue: number;
  saturation: number;
  speed: number;
  turbulence: number;
  hash: number;
  archetype: ArchetypeId;
};

export function orbSeedFor(a: FullAnswers): OrbSeed {
  const arch = archetypeOf(a);
  const saturation = a.q5 === "A" ? 0.95 : 0.65;
  const turbulence = a.q1 === "A" ? 1.6 : 0.75;
  const speed = a.q1 === "A" ? 1.0 : 0.35;
  const str = Object.values(a).join("") + arch.id;
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return {
    hue: arch.hue,
    saturation,
    speed,
    turbulence,
    hash: (h % 1000) / 1000,
    archetype: arch.id,
  };
}
