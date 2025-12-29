/**
 * Criterion Performance Benchmarks
 *
 * Run with: npx tsx benchmarks/run.ts
 */

import { Engine, defineDecision, createRule } from "../packages/core/src/index.js";
import { z } from "zod";

// Utility to measure execution time
function benchmark(name: string, fn: () => void, iterations: number = 10000) {
  // Warmup
  for (let i = 0; i < 100; i++) fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const end = performance.now();

  const totalMs = end - start;
  const avgMs = totalMs / iterations;
  const opsPerSec = Math.round(iterations / (totalMs / 1000));

  return { name, iterations, totalMs, avgMs, opsPerSec };
}

function formatResults(results: ReturnType<typeof benchmark>[]) {
  console.log("\n" + "=".repeat(70));
  console.log("CRITERION PERFORMANCE BENCHMARKS");
  console.log("=".repeat(70) + "\n");

  console.log(
    "| Benchmark".padEnd(40) +
      "| Ops/sec".padEnd(15) +
      "| Avg (μs)".padEnd(15) +
      "|"
  );
  console.log("|" + "-".repeat(39) + "|" + "-".repeat(14) + "|" + "-".repeat(14) + "|");

  for (const r of results) {
    const name = `| ${r.name}`.padEnd(40);
    const ops = `| ${r.opsPerSec.toLocaleString()}`.padEnd(15);
    const avg = `| ${(r.avgMs * 1000).toFixed(2)}`.padEnd(15);
    console.log(name + ops + avg + "|");
  }

  console.log("\n" + "=".repeat(70) + "\n");
}

// ============================================================================
// BENCHMARK: Simple Decision (3 rules)
// ============================================================================

const simpleDecision = defineDecision({
  id: "simple-benchmark",
  version: "1.0.0",
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ category: z.string() }),
  profileSchema: z.object({ threshold: z.number() }),
  rules: [
    createRule({
      id: "high",
      when: (i, p) => i.value > p.threshold,
      emit: () => ({ category: "HIGH" }),
      explain: () => "Value above threshold",
    }),
    createRule({
      id: "medium",
      when: (i, p) => i.value > p.threshold / 2,
      emit: () => ({ category: "MEDIUM" }),
      explain: () => "Value above half threshold",
    }),
    createRule({
      id: "low",
      when: () => true,
      emit: () => ({ category: "LOW" }),
      explain: () => "Default category",
    }),
  ],
});

// ============================================================================
// BENCHMARK: Complex Decision (10 rules)
// ============================================================================

const complexDecision = defineDecision({
  id: "complex-benchmark",
  version: "1.0.0",
  inputSchema: z.object({
    amount: z.number(),
    country: z.string(),
    tier: z.enum(["BRONZE", "SILVER", "GOLD", "PLATINUM"]),
    isNew: z.boolean(),
  }),
  outputSchema: z.object({
    risk: z.string(),
    action: z.string(),
    score: z.number(),
  }),
  profileSchema: z.object({
    highRiskCountries: z.array(z.string()),
    largeAmount: z.number(),
    tierScores: z.record(z.number()),
  }),
  rules: [
    createRule({
      id: "blocked-country",
      when: (i, p) => p.highRiskCountries.includes(i.country),
      emit: () => ({ risk: "CRITICAL", action: "BLOCK", score: 0 }),
      explain: () => "Blocked country",
    }),
    createRule({
      id: "new-large",
      when: (i, p) => i.isNew && i.amount > p.largeAmount,
      emit: () => ({ risk: "HIGH", action: "REVIEW", score: 20 }),
      explain: () => "New customer large amount",
    }),
    createRule({
      id: "platinum-large",
      when: (i, p) => i.tier === "PLATINUM" && i.amount > p.largeAmount,
      emit: (i, p) => ({ risk: "LOW", action: "APPROVE", score: p.tierScores.PLATINUM }),
      explain: () => "Platinum large",
    }),
    createRule({
      id: "gold-large",
      when: (i, p) => i.tier === "GOLD" && i.amount > p.largeAmount,
      emit: (i, p) => ({ risk: "MEDIUM", action: "REVIEW", score: p.tierScores.GOLD }),
      explain: () => "Gold large",
    }),
    createRule({
      id: "silver-large",
      when: (i, p) => i.tier === "SILVER" && i.amount > p.largeAmount,
      emit: (i, p) => ({ risk: "MEDIUM", action: "REVIEW", score: p.tierScores.SILVER }),
      explain: () => "Silver large",
    }),
    createRule({
      id: "bronze-large",
      when: (i, p) => i.tier === "BRONZE" && i.amount > p.largeAmount,
      emit: () => ({ risk: "HIGH", action: "REVIEW", score: 30 }),
      explain: () => "Bronze large",
    }),
    createRule({
      id: "new-customer",
      when: (i) => i.isNew,
      emit: () => ({ risk: "MEDIUM", action: "MONITOR", score: 50 }),
      explain: () => "New customer",
    }),
    createRule({
      id: "platinum",
      when: (i) => i.tier === "PLATINUM",
      emit: (i, p) => ({ risk: "LOW", action: "APPROVE", score: p.tierScores.PLATINUM }),
      explain: () => "Platinum tier",
    }),
    createRule({
      id: "gold",
      when: (i) => i.tier === "GOLD",
      emit: (i, p) => ({ risk: "LOW", action: "APPROVE", score: p.tierScores.GOLD }),
      explain: () => "Gold tier",
    }),
    createRule({
      id: "default",
      when: () => true,
      emit: () => ({ risk: "LOW", action: "APPROVE", score: 70 }),
      explain: () => "Default approval",
    }),
  ],
});

// ============================================================================
// BENCHMARK: Many Rules Decision (50 rules)
// ============================================================================

const manyRulesDecision = defineDecision({
  id: "many-rules-benchmark",
  version: "1.0.0",
  inputSchema: z.object({ code: z.number() }),
  outputSchema: z.object({ result: z.string() }),
  profileSchema: z.object({}),
  rules: [
    // Generate 49 specific rules + 1 catch-all
    ...Array.from({ length: 49 }, (_, i) =>
      createRule({
        id: `rule-${i}`,
        when: (input) => input.code === i,
        emit: () => ({ result: `MATCH_${i}` }),
        explain: () => `Matched code ${i}`,
      })
    ),
    createRule({
      id: "default",
      when: () => true,
      emit: () => ({ result: "NO_SPECIFIC_MATCH" }),
      explain: () => "Default rule",
    }),
  ],
});

// ============================================================================
// RUN BENCHMARKS
// ============================================================================

const engine = new Engine();

const simpleProfile = { threshold: 100 };
const complexProfile = {
  highRiskCountries: ["KP", "IR", "SY"],
  largeAmount: 10000,
  tierScores: { BRONZE: 40, SILVER: 60, GOLD: 80, PLATINUM: 95 },
};

const results = [
  // Simple decision benchmarks
  benchmark("Simple: First rule match", () => {
    engine.run(simpleDecision, { value: 150 }, { profile: simpleProfile });
  }),
  benchmark("Simple: Middle rule match", () => {
    engine.run(simpleDecision, { value: 75 }, { profile: simpleProfile });
  }),
  benchmark("Simple: Last rule match", () => {
    engine.run(simpleDecision, { value: 10 }, { profile: simpleProfile });
  }),

  // Complex decision benchmarks
  benchmark("Complex: First rule match (blocked)", () => {
    engine.run(
      complexDecision,
      { amount: 5000, country: "KP", tier: "GOLD", isNew: false },
      { profile: complexProfile }
    );
  }),
  benchmark("Complex: Middle rule match", () => {
    engine.run(
      complexDecision,
      { amount: 5000, country: "US", tier: "GOLD", isNew: false },
      { profile: complexProfile }
    );
  }),
  benchmark("Complex: Last rule match", () => {
    engine.run(
      complexDecision,
      { amount: 500, country: "US", tier: "BRONZE", isNew: false },
      { profile: complexProfile }
    );
  }),

  // Many rules benchmarks
  benchmark("50 Rules: First rule match", () => {
    engine.run(manyRulesDecision, { code: 0 }, { profile: {} });
  }),
  benchmark("50 Rules: Middle rule match (code=25)", () => {
    engine.run(manyRulesDecision, { code: 25 }, { profile: {} });
  }),
  benchmark("50 Rules: Last rule match (catch-all)", () => {
    engine.run(manyRulesDecision, { code: 999 }, { profile: {} });
  }),

  // Explain benchmark
  benchmark("Explain result", () => {
    const result = engine.run(simpleDecision, { value: 150 }, { profile: simpleProfile });
    engine.explain(result);
  }, 5000),
];

formatResults(results);

// Summary
console.log("Summary:");
console.log(`- Simple decisions: ~${results[0].opsPerSec.toLocaleString()} ops/sec`);
console.log(`- Complex decisions: ~${results[3].opsPerSec.toLocaleString()} ops/sec`);
console.log(`- 50-rule decisions: ~${results[6].opsPerSec.toLocaleString()} ops/sec`);
console.log("\nNote: Results may vary based on hardware and Node.js version.\n");
