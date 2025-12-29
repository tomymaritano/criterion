/**
 * Pure validation functions for Criterion decision files
 * Extracted from extension.ts for testability
 */

export interface Diagnostic {
  range: { start: number; end: number };
  message: string;
  severity: "error" | "warning" | "info";
}

/**
 * Find the end of a block starting with {
 */
export function findBlockEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let stringChar = "";

  for (let i = start; i < text.length; i++) {
    const char = text[i];
    const prevChar = i > 0 ? text[i - 1] : "";

    if (inString) {
      if (char === stringChar && prevChar !== "\\") {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      inString = true;
      stringChar = char;
      continue;
    }

    if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0) {
        return i + 1;
      }
    }
  }

  return text.length;
}

/**
 * Find the end of an array starting with [
 */
export function findArrayEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let stringChar = "";

  for (let i = start; i < text.length; i++) {
    const char = text[i];
    const prevChar = i > 0 ? text[i - 1] : "";

    if (inString) {
      if (char === stringChar && prevChar !== "\\") {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      inString = true;
      stringChar = char;
      continue;
    }

    if (char === "[") {
      depth++;
    } else if (char === "]") {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }

  return text.length;
}

/**
 * Check if text content is a Criterion file
 */
export function isCriterionContent(fileName: string, text: string): boolean {
  return (
    fileName.endsWith(".criterion.ts") ||
    (fileName.endsWith(".ts") &&
      (text.includes("defineDecision") || text.includes("@criterionx/core")))
  );
}

/**
 * Check for missing id in decision
 */
export function checkMissingId(text: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const defineDecisionRegex = /defineDecision\s*\(\s*\{/g;
  let match;

  while ((match = defineDecisionRegex.exec(text)) !== null) {
    const startPos = match.index;
    const blockEnd = findBlockEnd(text, startPos);
    const block = text.slice(startPos, blockEnd);

    if (!block.includes("id:") && !block.includes("id :")) {
      diagnostics.push({
        range: { start: startPos, end: startPos + 14 },
        message: "Decision is missing required 'id' property",
        severity: "error",
      });
    }
  }

  return diagnostics;
}

/**
 * Check for missing version in decision
 */
export function checkMissingVersion(text: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const defineDecisionRegex = /defineDecision\s*\(\s*\{/g;
  let match;

  while ((match = defineDecisionRegex.exec(text)) !== null) {
    const startPos = match.index;
    const blockEnd = findBlockEnd(text, startPos);
    const block = text.slice(startPos, blockEnd);

    if (!block.includes("version:") && !block.includes("version :")) {
      diagnostics.push({
        range: { start: startPos, end: startPos + 14 },
        message: "Decision is missing required 'version' property",
        severity: "error",
      });
    }
  }

  return diagnostics;
}

/**
 * Check for missing schemas
 */
export function checkMissingSchemas(text: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const defineDecisionRegex = /defineDecision\s*\(\s*\{/g;
  let match;

  while ((match = defineDecisionRegex.exec(text)) !== null) {
    const startPos = match.index;
    const blockEnd = findBlockEnd(text, startPos);
    const block = text.slice(startPos, blockEnd);

    const schemas = ["inputSchema", "outputSchema", "profileSchema"];

    for (const schema of schemas) {
      if (!block.includes(`${schema}:`)) {
        diagnostics.push({
          range: { start: startPos, end: startPos + 14 },
          message: `Decision is missing required '${schema}' property`,
          severity: "error",
        });
      }
    }
  }

  return diagnostics;
}

/**
 * Check for empty rules array
 */
export function checkEmptyRules(text: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const emptyRulesRegex = /rules\s*:\s*\[\s*\]/g;
  let match;

  while ((match = emptyRulesRegex.exec(text)) !== null) {
    diagnostics.push({
      range: { start: match.index, end: match.index + match[0].length },
      message: "Decision has no rules defined. Add at least one rule.",
      severity: "warning",
    });
  }

  return diagnostics;
}

/**
 * Check for missing rule properties
 */
export function checkMissingRuleProperties(text: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const rulesRegex = /rules\s*:\s*\[/g;
  let rulesMatch;

  while ((rulesMatch = rulesRegex.exec(text)) !== null) {
    const rulesStart = rulesMatch.index + rulesMatch[0].length;
    const rulesEnd = findArrayEnd(text, rulesMatch.index);
    const rulesBlock = text.slice(rulesStart, rulesEnd);

    const ruleRegex = /\{\s*id\s*:/g;
    let ruleMatch;

    while ((ruleMatch = ruleRegex.exec(rulesBlock)) !== null) {
      const ruleStart = rulesStart + ruleMatch.index;
      const ruleEnd = findBlockEnd(text, ruleStart);
      const ruleBlock = text.slice(ruleStart, ruleEnd);

      const requiredProps = ["when", "emit", "explain"];

      for (const prop of requiredProps) {
        if (!ruleBlock.includes(`${prop}:`)) {
          diagnostics.push({
            range: { start: ruleStart, end: ruleStart + 1 },
            message: `Rule is missing required '${prop}' function`,
            severity: "error",
          });
        }
      }
    }
  }

  return diagnostics;
}

/**
 * Validate all checks on text content
 */
export function validateCriterionContent(text: string): Diagnostic[] {
  return [
    ...checkMissingId(text),
    ...checkMissingVersion(text),
    ...checkMissingSchemas(text),
    ...checkEmptyRules(text),
    ...checkMissingRuleProperties(text),
  ];
}

/**
 * Hover documentation for Criterion keywords
 */
export const hoverDocs: Record<string, string> = {
  defineDecision:
    "**defineDecision(config)**\n\nCreate a new Criterion decision with type inference.\n\n```typescript\ndefineDecision({\n  id: string,\n  version: string,\n  inputSchema: ZodSchema,\n  outputSchema: ZodSchema,\n  profileSchema: ZodSchema,\n  rules: Rule[]\n})\n```",
  inputSchema:
    "**inputSchema**\n\nZod schema defining the input context for this decision.\n\nExample:\n```typescript\ninputSchema: z.object({\n  amount: z.number(),\n  country: z.string()\n})\n```",
  outputSchema:
    "**outputSchema**\n\nZod schema defining the output of this decision.\n\nExample:\n```typescript\noutputSchema: z.object({\n  approved: z.boolean(),\n  reason: z.string()\n})\n```",
  profileSchema:
    "**profileSchema**\n\nZod schema defining the profile parameters.\n\nExample:\n```typescript\nprofileSchema: z.object({\n  threshold: z.number(),\n  blockedCountries: z.array(z.string())\n})\n```",
  when: "**when(ctx, profile)**\n\nCondition function that returns true if this rule should match.\n\n```typescript\nwhen: (ctx, profile) => ctx.amount > profile.threshold\n```",
  emit: "**emit(ctx, profile)**\n\nFunction that returns the output when this rule matches.\n\n```typescript\nemit: (ctx, profile) => ({\n  approved: false,\n  reason: 'Amount too high'\n})\n```",
  explain:
    "**explain(ctx, profile)**\n\nFunction that returns a human-readable explanation.\n\n```typescript\nexplain: (ctx) => `Amount ${ctx.amount} exceeded limit`\n```",
};

/**
 * Get hover documentation for a word
 */
export function getHoverDoc(word: string): string | undefined {
  return hoverDocs[word];
}

/**
 * Generate decision template content
 */
export function generateDecisionTemplate(name: string): string {
  const pascalName = name
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  const camelName = pascalName.charAt(0).toLowerCase() + pascalName.slice(1);

  return `import { defineDecision } from "@criterionx/core";
import { z } from "zod";

/**
 * ${pascalName} Decision
 */
export const ${camelName} = defineDecision({
  id: "${name}",
  version: "1.0.0",

  inputSchema: z.object({
    // TODO: Define input schema
    value: z.string(),
  }),

  outputSchema: z.object({
    // TODO: Define output schema
    result: z.string(),
  }),

  profileSchema: z.object({
    // TODO: Define profile schema
  }),

  rules: [
    {
      id: "default",
      when: () => true,
      emit: () => ({ result: "OK" }),
      explain: () => "Default rule",
    },
  ],
});
`;
}
