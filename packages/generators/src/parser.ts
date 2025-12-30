/**
 * Parse decision specifications into runtime decisions
 *
 * @example
 * ```typescript
 * import { parseDecisionSpec } from "@criterionx/generators";
 *
 * const spec = {
 *   id: "pricing",
 *   version: "1.0.0",
 *   input: { quantity: { type: "number" } },
 *   output: { price: { type: "number" } },
 *   profile: { basePrice: { type: "number" } },
 *   rules: [
 *     {
 *       id: "calculate",
 *       when: "always",
 *       emit: { price: "$input.quantity * $profile.basePrice" },
 *     },
 *   ],
 * };
 *
 * const decision = parseDecisionSpec(spec);
 * ```
 */

import { z, type ZodTypeAny } from "zod";
import { defineDecision, type Decision } from "@criterionx/core";
import type { DecisionSpec, SchemaSpec, SchemaField, RuleCondition } from "./types.js";

/**
 * Convert schema spec to Zod schema
 */
function schemaSpecToZod(spec: SchemaSpec): ZodTypeAny {
  const shape: Record<string, ZodTypeAny> = {};

  for (const [key, field] of Object.entries(spec)) {
    shape[key] = fieldToZod(field);
  }

  return z.object(shape);
}

/**
 * Convert field spec to Zod type
 */
function fieldToZod(field: SchemaField): ZodTypeAny {
  let schema: ZodTypeAny;

  switch (field.type) {
    case "string":
      schema = field.enum ? z.enum(field.enum as [string, ...string[]]) : z.string();
      break;
    case "number":
      schema = z.number();
      if (field.min !== undefined) schema = (schema as z.ZodNumber).min(field.min);
      if (field.max !== undefined) schema = (schema as z.ZodNumber).max(field.max);
      break;
    case "boolean":
      schema = z.boolean();
      break;
    case "date":
      schema = z.coerce.date();
      break;
    case "array":
      if (typeof field.items === "string") {
        schema = z.array(fieldToZod({ type: field.items }));
      } else if (field.items) {
        schema = z.array(schemaSpecToZod(field.items as SchemaSpec));
      } else {
        schema = z.array(z.unknown());
      }
      break;
    case "object":
      if (field.properties) {
        schema = schemaSpecToZod(field.properties);
      } else {
        schema = z.record(z.unknown());
      }
      break;
    default:
      schema = z.unknown();
  }

  if (field.optional) {
    schema = schema.optional();
  }

  if (field.default !== undefined) {
    schema = schema.default(field.default);
  }

  return schema;
}

/**
 * Get value from path (e.g., "input.value" -> input.value)
 */
function getValueFromPath(path: string, input: unknown, profile: unknown): unknown {
  const parts = path.split(".");
  let current: unknown;

  if (parts[0] === "input" || parts[0] === "$input") {
    current = input;
    parts.shift();
  } else if (parts[0] === "profile" || parts[0] === "$profile") {
    current = profile;
    parts.shift();
  } else {
    return undefined;
  }

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Evaluate a condition
 */
function evaluateCondition(
  condition: RuleCondition,
  input: unknown,
  profile: unknown
): boolean {
  const fieldValue = getValueFromPath(condition.field, input, profile);
  let compareValue = condition.value;

  // Resolve reference values (e.g., "$profile.threshold")
  if (typeof compareValue === "string" && compareValue.startsWith("$")) {
    compareValue = getValueFromPath(compareValue, input, profile);
  }

  switch (condition.operator) {
    case "eq":
      return fieldValue === compareValue;
    case "neq":
      return fieldValue !== compareValue;
    case "gt":
      return (fieldValue as number) > (compareValue as number);
    case "gte":
      return (fieldValue as number) >= (compareValue as number);
    case "lt":
      return (fieldValue as number) < (compareValue as number);
    case "lte":
      return (fieldValue as number) <= (compareValue as number);
    case "in":
      return Array.isArray(compareValue) && compareValue.includes(fieldValue);
    case "contains":
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(compareValue);
      }
      if (typeof fieldValue === "string") {
        return fieldValue.includes(String(compareValue));
      }
      return false;
    case "matches":
      if (typeof fieldValue === "string" && typeof compareValue === "string") {
        return new RegExp(compareValue).test(fieldValue);
      }
      return false;
    default:
      return false;
  }
}

/**
 * Resolve emit value (handle expressions like "$input.quantity * $profile.basePrice")
 */
function resolveEmitValue(
  value: unknown,
  input: unknown,
  profile: unknown
): unknown {
  if (typeof value !== "string") {
    return value;
  }

  // Check if it's a simple reference
  if (value.startsWith("$")) {
    const resolved = getValueFromPath(value, input, profile);
    if (resolved !== undefined) return resolved;
  }

  // Check if it's an expression with references
  if (value.includes("$input") || value.includes("$profile")) {
    // Replace references with values and evaluate
    const expression = value.replace(/\$input\.(\w+)/g, (_, key) => {
      const val = (input as Record<string, unknown>)[key];
      return typeof val === "string" ? `"${val}"` : String(val);
    }).replace(/\$profile\.(\w+)/g, (_, key) => {
      const val = (profile as Record<string, unknown>)[key];
      return typeof val === "string" ? `"${val}"` : String(val);
    });

    try {
      // Safe eval for simple arithmetic expressions
      // eslint-disable-next-line no-new-func
      return new Function(`return ${expression}`)();
    } catch {
      return value;
    }
  }

  return value;
}

/**
 * Resolve emit object
 */
function resolveEmit(
  emit: Record<string, unknown>,
  input: unknown,
  profile: unknown
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(emit)) {
    result[key] = resolveEmitValue(value, input, profile);
  }

  return result;
}

/**
 * Parse a decision specification into a runtime Decision
 *
 * @example
 * ```typescript
 * const spec: DecisionSpec = {
 *   id: "eligibility",
 *   version: "1.0.0",
 *   input: { age: { type: "number" } },
 *   output: { eligible: { type: "boolean" }, reason: { type: "string" } },
 *   profile: { minAge: { type: "number" } },
 *   rules: [
 *     {
 *       id: "too-young",
 *       when: [{ field: "input.age", operator: "lt", value: "$profile.minAge" }],
 *       emit: { eligible: false, reason: "Too young" },
 *     },
 *     {
 *       id: "eligible",
 *       when: "always",
 *       emit: { eligible: true, reason: "Meets requirements" },
 *     },
 *   ],
 * };
 *
 * const decision = parseDecisionSpec(spec);
 * const result = engine.run(decision, { age: 25 }, { profile: { minAge: 18 } });
 * ```
 */
export function parseDecisionSpec<TInput, TOutput, TProfile>(
  spec: DecisionSpec
): Decision<TInput, TOutput, TProfile> {
  // Sort rules by priority
  const sortedRules = [...spec.rules].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

  const inputSchema = schemaSpecToZod(spec.input);
  const outputSchema = schemaSpecToZod(spec.output);
  const profileSchema = schemaSpecToZod(spec.profile);

  const rules = sortedRules.map((rule) => ({
    id: rule.id,
    when: (input: TInput, profile: TProfile): boolean => {
      if (rule.when === "always") return true;

      return rule.when.every((condition) =>
        evaluateCondition(condition, input, profile)
      );
    },
    emit: (input: TInput, profile: TProfile): TOutput => {
      return resolveEmit(rule.emit, input, profile) as TOutput;
    },
    explain: (): string => {
      return rule.description ?? `Rule ${rule.id} matched`;
    },
  }));

  return defineDecision({
    id: spec.id,
    version: spec.version,
    inputSchema: inputSchema as z.ZodType<TInput>,
    outputSchema: outputSchema as z.ZodType<TOutput>,
    profileSchema: profileSchema as z.ZodType<TProfile>,
    rules,
  });
}

/**
 * Parse multiple decision specifications
 */
export function parseDecisionSpecs(
  specs: DecisionSpec[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Map<string, Decision<any, any, any>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const decisions = new Map<string, Decision<any, any, any>>();

  for (const spec of specs) {
    decisions.set(spec.id, parseDecisionSpec(spec));
  }

  return decisions;
}
