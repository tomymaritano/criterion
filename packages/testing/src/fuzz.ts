import { Engine, type Decision } from "@criterionx/core";
import * as fc from "fast-check";
import type { FuzzOptions, FuzzResult, FuzzError } from "./types.js";

const engine = new Engine();

/**
 * Fuzz test a decision with random inputs
 *
 * Uses fast-check for property-based testing to discover edge cases
 */
export function fuzz<TInput, TOutput, TProfile>(
  decision: Decision<TInput, TOutput, TProfile>,
  options: FuzzOptions<TInput, TProfile>
): FuzzResult<TInput> {
  const iterations = options.iterations ?? 100;
  const errors: FuzzError<TInput>[] = [];
  const ruleDistribution: Record<string, number> = {};
  let passed = 0;
  let failed = 0;

  // Initialize rule distribution
  for (const rule of decision.rules) {
    ruleDistribution[rule.id] = 0;
  }
  ruleDistribution["NO_MATCH"] = 0;
  ruleDistribution["INVALID_INPUT"] = 0;

  // Generate random inputs using fast-check
  const inputArbitrary = options.inputArbitrary ?? createDefaultArbitrary();

  const inputs: TInput[] = [];
  const seed = options.seed ?? Date.now();

  // Sample inputs from arbitrary
  fc.assert(
    fc.property(inputArbitrary, (input) => {
      inputs.push(input as TInput);
      return true;
    }),
    {
      numRuns: iterations,
      seed,
    }
  );

  // Run each input through the decision
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    try {
      const result = engine.run(decision, input, { profile: options.profile });

      if (result.status === "OK" && result.meta.matchedRule) {
        ruleDistribution[result.meta.matchedRule]++;
        passed++;
      } else if (result.status === "NO_MATCH") {
        ruleDistribution["NO_MATCH"]++;
        passed++;
      } else if (result.status === "INVALID_INPUT") {
        // Invalid input is expected for fuzzing - count it
        ruleDistribution["INVALID_INPUT"]++;
        passed++;
      } else {
        // INVALID_OUTPUT is a real error
        failed++;
        errors.push({
          input,
          error: result.meta.explanation,
          iteration: i,
        });
      }
    } catch (error) {
      failed++;
      errors.push({
        input,
        error: String(error),
        iteration: i,
      });
    }
  }

  return {
    totalRuns: inputs.length,
    passed,
    failed,
    errors,
    ruleDistribution,
  };
}

/**
 * Run property-based tests on a decision
 *
 * Allows defining custom properties that should hold for all inputs
 */
export function checkProperty<TInput, TOutput, TProfile>(
  decision: Decision<TInput, TOutput, TProfile>,
  options: {
    profile: TProfile;
    inputArbitrary: fc.Arbitrary<TInput>;
    property: (input: TInput, result: ReturnType<Engine["run"]>) => boolean;
    numRuns?: number;
    seed?: number;
  }
): { passed: boolean; counterExample?: TInput; error?: string } {
  try {
    fc.assert(
      fc.property(options.inputArbitrary, (input) => {
        const result = engine.run(decision, input, {
          profile: options.profile,
        });
        return options.property(input, result);
      }),
      {
        numRuns: options.numRuns ?? 100,
        seed: options.seed,
      }
    );
    return { passed: true };
  } catch (error: unknown) {
    // Fast-check throws errors with counterexample attached
    if (error instanceof Error) {
      const fcError = error as Error & { counterexample?: [TInput] };
      return {
        passed: false,
        counterExample: fcError.counterexample?.[0],
        error: fcError.message,
      };
    }
    return {
      passed: false,
      error: String(error),
    };
  }
}

/**
 * Create a default arbitrary for fuzzing when none is provided
 *
 * Generates random JSON-like structures
 */
function createDefaultArbitrary(): fc.Arbitrary<unknown> {
  return fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.oneof(
      fc.string(),
      fc.integer(),
      fc.double({ noNaN: true }),
      fc.boolean(),
      fc.constant(null)
    )
  );
}
