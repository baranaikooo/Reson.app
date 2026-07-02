import { describe, it, expect } from "vitest";
import { calcResonance, FullAnswers, pickScenarios } from "./resonance";

describe("Resonance Algorithm", () => {
  const baseAnswers: FullAnswers = {
    q1: "A",
    q2: "A",
    q3: "A",
    q4: "A",
    q5: "A",
    q6: "A",
  };

  it("should pick 6 scenarios correctly", () => {
    const scenarios = pickScenarios();
    expect(scenarios.length).toBe(6);
    expect(scenarios.map((s) => s.id).sort()).toEqual(["q1", "q2", "q3", "q4", "q5", "q6"]);
  });

  it("should pick stable scenarios when seed is provided", () => {
    const scenarios1 = pickScenarios("user123");
    const scenarios2 = pickScenarios("user123");
    expect(scenarios1).toEqual(scenarios2);
  });

  it("should calculate 100% resonance for identical similar-seeking answers but less for identical complement-seeking", () => {
    // q1, q3 are complement -> if same, they get weight * 0.55
    // q2, q4, q5, q6 are similar -> if same, they get weight
    // Total weight = 1.5 + 2.5 + 1.5 + 2.0 + 2.5 + 1.0 = 11.0
    // Same for all:
    // q1: 1.5 * 0.55 = 0.825
    // q2: 2.5
    // q3: 1.5 * 0.55 = 0.825
    // q4: 2.0
    // q5: 2.5
    // q6: 1.0
    // Total score = 9.65
    // 9.65 / 11.0 * 100 = 87.72... rounds to 87.7
    const score = calcResonance(baseAnswers, baseAnswers);
    expect(score).toBe(87.7);
  });

  it("should calculate higher resonance for perfect complements in complement-seeking dimensions", () => {
    // b has perfect complements for q1, q3
    const perfectAnswers: FullAnswers = {
      ...baseAnswers,
      q1: "B",
      q3: "B",
    };
    // Score should be 100%
    const score = calcResonance(baseAnswers, perfectAnswers);
    expect(score).toBe(100.0);
  });

  it("should score lower when similar-seeking dimensions are opposite", () => {
    const terribleAnswers: FullAnswers = {
      q1: "B",
      q2: "B",
      q3: "B",
      q4: "B",
      q5: "B",
      q6: "B",
    };
    // q1: 1.5 (complement works!)
    // q2: 2.5 * 0.15 = 0.375
    // q3: 1.5 (complement works!)
    // q4: 2.0 * 0.15 = 0.3
    // q5: 2.5 * 0.15 = 0.375
    // q6: 1.0 * 0.15 = 0.15
    // Total score = 4.2
    // 4.2 / 11.0 * 100 = 38.18... rounds to 38.2
    const score = calcResonance(baseAnswers, terribleAnswers);
    expect(score).toBe(38.2);
  });
});
