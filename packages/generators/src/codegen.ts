/**
 * Generate TypeScript code from decision specifications
 *
 * @example
 * ```typescript
 * import { generateDecisionCode } from "@criterionx/generators";
 *
 * const spec = {
 *   id: "pricing",
 *   version: "1.0.0",
 *   input: { quantity: { type: "number" } },
 *   output: { price: { type: "number" } },
 *   profile: { basePrice: { type: "number" } },
 *   rules: [
 *     { id: "calculate", when: "always", emit: { price: 0 } },
 *   ],
 * };
 *
 * const { code } = generateDecisionCode(spec);
 * // Outputs TypeScript code defining the decision
 * ```
 */

import type {
  DecisionSpec,
  SchemaSpec,
  SchemaField,
  RuleSpec,
  RuleCondition,
  CodeGenOptions,
  GeneratedCode,
} from "./types.js";

/**
 * Convert decision ID to valid export name
 */
function toExportName(id: string): string {
  return id
    .split(/[-_\s]+/)
    .map((part, i) =>
      i === 0
        ? part.toLowerCase()
        : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    )
    .join("") + "Decision";
}

/**
 * Generate Zod schema code from schema spec
 */
function generateZodSchema(spec: SchemaSpec, indent: string = "  "): string {
  const fields: string[] = [];

  for (const [key, field] of Object.entries(spec)) {
    fields.push(`${indent}${key}: ${generateZodField(field)},`);
  }

  return `z.object({\n${fields.join("\n")}\n${indent.slice(2)}})`;
}

/**
 * Generate Zod field code
 */
function generateZodField(field: SchemaField): string {
  let code: string;

  switch (field.type) {
    case "string":
      if (field.enum) {
        code = `z.enum([${field.enum.map((e) => `"${e}"`).join(", ")}])`;
      } else {
        code = "z.string()";
      }
      break;
    case "number":
      code = "z.number()";
      if (field.min !== undefined) code += `.min(${field.min})`;
      if (field.max !== undefined) code += `.max(${field.max})`;
      break;
    case "boolean":
      code = "z.boolean()";
      break;
    case "date":
      code = "z.coerce.date()";
      break;
    case "array":
      if (typeof field.items === "string") {
        code = `z.array(${generateZodField({ type: field.items })})`;
      } else if (field.items) {
        code = `z.array(${generateZodSchema(field.items as SchemaSpec, "    ")})`;
      } else {
        code = "z.array(z.unknown())";
      }
      break;
    case "object":
      if (field.properties) {
        code = generateZodSchema(field.properties, "    ");
      } else {
        code = "z.record(z.unknown())";
      }
      break;
    default:
      code = "z.unknown()";
  }

  if (field.optional) {
    code += ".optional()";
  }

  if (field.default !== undefined) {
    code += `.default(${JSON.stringify(field.default)})`;
  }

  return code;
}

/**
 * Generate condition code
 */
function generateCondition(condition: RuleCondition): string {
  const fieldParts = condition.field.split(".");
  const fieldRef = fieldParts[0] === "input" || fieldParts[0] === "$input"
    ? `input.${fieldParts.slice(1).join(".")}`
    : `profile.${fieldParts.slice(1).join(".")}`;

  let valueRef: string;
  if (typeof condition.value === "string" && condition.value.startsWith("$")) {
    const valueParts = condition.value.split(".");
    valueRef = valueParts[0] === "$input"
      ? `input.${valueParts.slice(1).join(".")}`
      : `profile.${valueParts.slice(1).join(".")}`;
  } else {
    valueRef = JSON.stringify(condition.value);
  }

  switch (condition.operator) {
    case "eq":
      return `${fieldRef} === ${valueRef}`;
    case "neq":
      return `${fieldRef} !== ${valueRef}`;
    case "gt":
      return `${fieldRef} > ${valueRef}`;
    case "gte":
      return `${fieldRef} >= ${valueRef}`;
    case "lt":
      return `${fieldRef} < ${valueRef}`;
    case "lte":
      return `${fieldRef} <= ${valueRef}`;
    case "in":
      return `${valueRef}.includes(${fieldRef})`;
    case "contains":
      return `${fieldRef}.includes(${valueRef})`;
    case "matches":
      return `new RegExp(${valueRef}).test(${fieldRef})`;
    default:
      return "true";
  }
}

/**
 * Generate emit object code
 */
function generateEmit(emit: Record<string, unknown>): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(emit)) {
    if (typeof value === "string" && (value.includes("$input") || value.includes("$profile"))) {
      // Expression - convert to code
      const expr = value
        .replace(/\$input\.(\w+)/g, "input.$1")
        .replace(/\$profile\.(\w+)/g, "profile.$1");
      parts.push(`${key}: ${expr}`);
    } else {
      parts.push(`${key}: ${JSON.stringify(value)}`);
    }
  }

  return `({ ${parts.join(", ")} })`;
}

/**
 * Generate rule code
 */
function generateRule(rule: RuleSpec, indent: string = "    "): string {
  const whenCode = rule.when === "always"
    ? "() => true"
    : `(input, profile) => ${rule.when.map(generateCondition).join(" && ")}`;

  const emitCode = `(input, profile) => ${generateEmit(rule.emit)}`;

  const explainText = rule.description ?? `Rule ${rule.id} matched`;
  const explainCode = `() => "${explainText}"`;

  return `${indent}{
${indent}  id: "${rule.id}",
${indent}  when: ${whenCode},
${indent}  emit: ${emitCode},
${indent}  explain: ${explainCode},
${indent}}`;
}

/**
 * Generate TypeScript code for a decision specification
 *
 * @example
 * ```typescript
 * const { code } = generateDecisionCode(spec, {
 *   includeComments: true,
 *   includeImports: true,
 * });
 *
 * // Write to file
 * fs.writeFileSync("pricing.decision.ts", code);
 * ```
 */
export function generateDecisionCode(
  spec: DecisionSpec,
  options: CodeGenOptions = {}
): GeneratedCode {
  const {
    includeComments = true,
    includeImports = true,
    exportName = toExportName(spec.id),
  } = options;

  const lines: string[] = [];

  // Imports
  if (includeImports) {
    lines.push('import { defineDecision } from "@criterionx/core";');
    lines.push('import { z } from "zod";');
    lines.push("");
  }

  // Description comment
  if (includeComments && spec.description) {
    lines.push("/**");
    lines.push(` * ${spec.description}`);
    lines.push(" */");
  }

  // Decision definition
  lines.push(`export const ${exportName} = defineDecision({`);
  lines.push(`  id: "${spec.id}",`);
  lines.push(`  version: "${spec.version}",`);

  // Input schema
  lines.push(`  inputSchema: ${generateZodSchema(spec.input, "    ")},`);

  // Output schema
  lines.push(`  outputSchema: ${generateZodSchema(spec.output, "    ")},`);

  // Profile schema
  lines.push(`  profileSchema: ${generateZodSchema(spec.profile, "    ")},`);

  // Rules
  lines.push("  rules: [");
  const sortedRules = [...spec.rules].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  for (const rule of sortedRules) {
    lines.push(generateRule(rule) + ",");
  }
  lines.push("  ],");

  lines.push("});");
  lines.push("");

  return {
    code: lines.join("\n"),
    decisionId: spec.id,
    exportName,
  };
}

/**
 * Generate TypeScript code for multiple decisions in a single file
 */
export function generateDecisionsFile(
  specs: DecisionSpec[],
  options: CodeGenOptions = {}
): string {
  const { includeImports = true } = options;

  const lines: string[] = [];

  // Single imports at top
  if (includeImports) {
    lines.push('import { defineDecision } from "@criterionx/core";');
    lines.push('import { z } from "zod";');
    lines.push("");
  }

  // Generate each decision
  for (const spec of specs) {
    const { code } = generateDecisionCode(spec, {
      ...options,
      includeImports: false,
    });
    lines.push(code);
  }

  return lines.join("\n");
}
