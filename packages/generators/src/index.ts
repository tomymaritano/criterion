/**
 * @criterionx/generators
 *
 * Code generators for Criterion decision engine.
 * Generate decisions from declarative specifications.
 *
 * @example Parse spec to runtime decision
 * ```typescript
 * import { parseDecisionSpec } from "@criterionx/generators";
 *
 * const spec = {
 *   id: "eligibility",
 *   version: "1.0.0",
 *   input: { age: { type: "number" } },
 *   output: { eligible: { type: "boolean" } },
 *   profile: { minAge: { type: "number" } },
 *   rules: [
 *     {
 *       id: "check-age",
 *       when: [{ field: "input.age", operator: "gte", value: "$profile.minAge" }],
 *       emit: { eligible: true },
 *     },
 *     {
 *       id: "default",
 *       when: "always",
 *       emit: { eligible: false },
 *     },
 *   ],
 * };
 *
 * const decision = parseDecisionSpec(spec);
 * const result = engine.run(decision, { age: 25 }, { profile: { minAge: 18 } });
 * ```
 *
 * @example Generate TypeScript code
 * ```typescript
 * import { generateDecisionCode } from "@criterionx/generators";
 *
 * const { code } = generateDecisionCode(spec);
 * fs.writeFileSync("eligibility.decision.ts", code);
 * ```
 */

// Parser (spec -> runtime decision)
export { parseDecisionSpec, parseDecisionSpecs } from "./parser.js";

// Code generator (spec -> TypeScript code)
export { generateDecisionCode, generateDecisionsFile } from "./codegen.js";

// Types
export type {
  DecisionSpec,
  SchemaSpec,
  SchemaField,
  SchemaFieldType,
  RuleSpec,
  RuleCondition,
  CodeGenOptions,
  GeneratedCode,
} from "./types.js";
