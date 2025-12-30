import { describe, it, expect } from "vitest";
import { generateDecisionCode, generateDecisionsFile } from "./codegen.js";
import type { DecisionSpec } from "./types.js";

describe("generateDecisionCode", () => {
  const simpleSpec: DecisionSpec = {
    id: "eligibility",
    version: "1.0.0",
    description: "Check user eligibility",
    input: {
      age: { type: "number" },
    },
    output: {
      eligible: { type: "boolean" },
    },
    profile: {
      minAge: { type: "number" },
    },
    rules: [
      {
        id: "check-age",
        description: "User meets age requirement",
        when: [{ field: "input.age", operator: "gte", value: "$profile.minAge" }],
        emit: { eligible: true },
      },
      {
        id: "default",
        when: "always",
        emit: { eligible: false },
      },
    ],
  };

  it("should generate valid TypeScript code", () => {
    const { code, decisionId, exportName } = generateDecisionCode(simpleSpec);

    expect(decisionId).toBe("eligibility");
    expect(exportName).toBe("eligibilityDecision");
    expect(code).toContain('import { defineDecision } from "@criterionx/core"');
    expect(code).toContain('import { z } from "zod"');
    expect(code).toContain("export const eligibilityDecision = defineDecision");
    expect(code).toContain('id: "eligibility"');
    expect(code).toContain('version: "1.0.0"');
  });

  it("should include JSDoc comment when description provided", () => {
    const { code } = generateDecisionCode(simpleSpec);

    expect(code).toContain("/**");
    expect(code).toContain(" * Check user eligibility");
    expect(code).toContain(" */");
  });

  it("should generate Zod schemas for input", () => {
    const { code } = generateDecisionCode(simpleSpec);

    expect(code).toContain("inputSchema: z.object({");
    expect(code).toContain("age: z.number()");
  });

  it("should generate Zod schemas for output", () => {
    const { code } = generateDecisionCode(simpleSpec);

    expect(code).toContain("outputSchema: z.object({");
    expect(code).toContain("eligible: z.boolean()");
  });

  it("should generate Zod schemas for profile", () => {
    const { code } = generateDecisionCode(simpleSpec);

    expect(code).toContain("profileSchema: z.object({");
    expect(code).toContain("minAge: z.number()");
  });

  it("should generate rules with conditions", () => {
    const { code } = generateDecisionCode(simpleSpec);

    expect(code).toContain('id: "check-age"');
    expect(code).toContain("input.age >= profile.minAge");
  });

  it("should generate 'always' rules", () => {
    const { code } = generateDecisionCode(simpleSpec);

    expect(code).toContain('id: "default"');
    expect(code).toContain("() => true");
  });

  it("should generate emit functions", () => {
    const { code } = generateDecisionCode(simpleSpec);

    expect(code).toContain("({ eligible: true })");
    expect(code).toContain("({ eligible: false })");
  });

  it("should generate explain functions", () => {
    const { code } = generateDecisionCode(simpleSpec);

    expect(code).toContain('explain: () => "User meets age requirement"');
    expect(code).toContain('explain: () => "Rule default matched"');
  });

  it("should respect includeImports option", () => {
    const { code: withImports } = generateDecisionCode(simpleSpec, { includeImports: true });
    const { code: withoutImports } = generateDecisionCode(simpleSpec, { includeImports: false });

    expect(withImports).toContain('import { defineDecision }');
    expect(withoutImports).not.toContain('import { defineDecision }');
  });

  it("should respect includeComments option", () => {
    const { code: withComments } = generateDecisionCode(simpleSpec, { includeComments: true });
    const { code: withoutComments } = generateDecisionCode(simpleSpec, { includeComments: false });

    expect(withComments).toContain("/**");
    expect(withoutComments).not.toContain("/**");
  });

  it("should respect custom exportName option", () => {
    const { code, exportName } = generateDecisionCode(simpleSpec, {
      exportName: "myCustomDecision",
    });

    expect(exportName).toBe("myCustomDecision");
    expect(code).toContain("export const myCustomDecision = defineDecision");
  });

  it("should handle kebab-case decision IDs", () => {
    const spec: DecisionSpec = {
      ...simpleSpec,
      id: "user-eligibility-check",
    };

    const { exportName } = generateDecisionCode(spec);
    expect(exportName).toBe("userEligibilityCheckDecision");
  });

  it("should handle snake_case decision IDs", () => {
    const spec: DecisionSpec = {
      ...simpleSpec,
      id: "user_eligibility_check",
    };

    const { exportName } = generateDecisionCode(spec);
    expect(exportName).toBe("userEligibilityCheckDecision");
  });

  it("should generate string enums", () => {
    const spec: DecisionSpec = {
      id: "status-check",
      version: "1.0.0",
      input: {
        status: { type: "string", enum: ["active", "pending", "inactive"] },
      },
      output: { valid: { type: "boolean" } },
      profile: {},
      rules: [{ id: "default", when: "always", emit: { valid: true } }],
    };

    const { code } = generateDecisionCode(spec);
    expect(code).toContain('z.enum(["active", "pending", "inactive"])');
  });

  it("should generate number constraints", () => {
    const spec: DecisionSpec = {
      id: "range-check",
      version: "1.0.0",
      input: {
        score: { type: "number", min: 0, max: 100 },
      },
      output: { valid: { type: "boolean" } },
      profile: {},
      rules: [{ id: "default", when: "always", emit: { valid: true } }],
    };

    const { code } = generateDecisionCode(spec);
    expect(code).toContain("z.number().min(0).max(100)");
  });

  it("should generate optional fields", () => {
    const spec: DecisionSpec = {
      id: "optional-test",
      version: "1.0.0",
      input: {
        required: { type: "string" },
        optional: { type: "string", optional: true },
      },
      output: { result: { type: "boolean" } },
      profile: {},
      rules: [{ id: "default", when: "always", emit: { result: true } }],
    };

    const { code } = generateDecisionCode(spec);
    expect(code).toContain("required: z.string()");
    expect(code).toContain("optional: z.string().optional()");
  });

  it("should generate default values", () => {
    const spec: DecisionSpec = {
      id: "default-test",
      version: "1.0.0",
      input: {
        value: { type: "number", default: 42 },
      },
      output: { result: { type: "number" } },
      profile: {},
      rules: [{ id: "default", when: "always", emit: { result: 0 } }],
    };

    const { code } = generateDecisionCode(spec);
    expect(code).toContain("z.number().default(42)");
  });

  it("should generate date fields", () => {
    const spec: DecisionSpec = {
      id: "date-test",
      version: "1.0.0",
      input: {
        createdAt: { type: "date" },
      },
      output: { valid: { type: "boolean" } },
      profile: {},
      rules: [{ id: "default", when: "always", emit: { valid: true } }],
    };

    const { code } = generateDecisionCode(spec);
    expect(code).toContain("z.coerce.date()");
  });

  it("should generate array fields", () => {
    const spec: DecisionSpec = {
      id: "array-test",
      version: "1.0.0",
      input: {
        tags: { type: "array", items: "string" },
        scores: { type: "array", items: "number" },
      },
      output: { valid: { type: "boolean" } },
      profile: {},
      rules: [{ id: "default", when: "always", emit: { valid: true } }],
    };

    const { code } = generateDecisionCode(spec);
    expect(code).toContain("z.array(z.string())");
    expect(code).toContain("z.array(z.number())");
  });

  it("should generate object fields", () => {
    const spec: DecisionSpec = {
      id: "object-test",
      version: "1.0.0",
      input: {
        user: {
          type: "object",
          properties: {
            name: { type: "string" },
            age: { type: "number" },
          },
        },
      },
      output: { valid: { type: "boolean" } },
      profile: {},
      rules: [{ id: "default", when: "always", emit: { valid: true } }],
    };

    const { code } = generateDecisionCode(spec);
    expect(code).toContain("user: z.object({");
    expect(code).toContain("name: z.string()");
    expect(code).toContain("age: z.number()");
  });

  it("should generate all comparison operators", () => {
    const operators: Array<{ op: string; expected: string }> = [
      { op: "eq", expected: "===" },
      { op: "neq", expected: "!==" },
      { op: "gt", expected: ">" },
      { op: "gte", expected: ">=" },
      { op: "lt", expected: "<" },
      { op: "lte", expected: "<=" },
    ];

    for (const { op, expected } of operators) {
      const spec: DecisionSpec = {
        id: `${op}-test`,
        version: "1.0.0",
        input: { value: { type: "number" } },
        output: { result: { type: "boolean" } },
        profile: { threshold: { type: "number" } },
        rules: [
          {
            id: "check",
            when: [{ field: "input.value", operator: op as "eq", value: "$profile.threshold" }],
            emit: { result: true },
          },
        ],
      };

      const { code } = generateDecisionCode(spec);
      expect(code).toContain(`input.value ${expected} profile.threshold`);
    }
  });

  it("should generate 'in' operator", () => {
    const spec: DecisionSpec = {
      id: "in-test",
      version: "1.0.0",
      input: { status: { type: "string" } },
      output: { valid: { type: "boolean" } },
      profile: { validStatuses: { type: "array", items: "string" } },
      rules: [
        {
          id: "check",
          when: [{ field: "input.status", operator: "in", value: "$profile.validStatuses" }],
          emit: { valid: true },
        },
      ],
    };

    const { code } = generateDecisionCode(spec);
    expect(code).toContain("profile.validStatuses.includes(input.status)");
  });

  it("should generate 'contains' operator", () => {
    const spec: DecisionSpec = {
      id: "contains-test",
      version: "1.0.0",
      input: { roles: { type: "array", items: "string" } },
      output: { isAdmin: { type: "boolean" } },
      profile: { adminRole: { type: "string" } },
      rules: [
        {
          id: "check",
          when: [{ field: "input.roles", operator: "contains", value: "$profile.adminRole" }],
          emit: { isAdmin: true },
        },
      ],
    };

    const { code } = generateDecisionCode(spec);
    expect(code).toContain("input.roles.includes(profile.adminRole)");
  });

  it("should generate 'matches' operator", () => {
    const spec: DecisionSpec = {
      id: "matches-test",
      version: "1.0.0",
      input: { email: { type: "string" } },
      output: { valid: { type: "boolean" } },
      profile: { pattern: { type: "string" } },
      rules: [
        {
          id: "check",
          when: [{ field: "input.email", operator: "matches", value: "$profile.pattern" }],
          emit: { valid: true },
        },
      ],
    };

    const { code } = generateDecisionCode(spec);
    expect(code).toContain("new RegExp(profile.pattern).test(input.email)");
  });

  it("should sort rules by priority in generated code", () => {
    const spec: DecisionSpec = {
      id: "priority-test",
      version: "1.0.0",
      input: { value: { type: "number" } },
      output: { result: { type: "string" } },
      profile: {},
      rules: [
        { id: "low", priority: 10, when: "always", emit: { result: "low" } },
        { id: "high", priority: 1, when: "always", emit: { result: "high" } },
        { id: "medium", priority: 5, when: "always", emit: { result: "medium" } },
      ],
    };

    const { code } = generateDecisionCode(spec);
    const highIndex = code.indexOf('id: "high"');
    const mediumIndex = code.indexOf('id: "medium"');
    const lowIndex = code.indexOf('id: "low"');

    expect(highIndex).toBeLessThan(mediumIndex);
    expect(mediumIndex).toBeLessThan(lowIndex);
  });

  it("should handle emit with expressions", () => {
    const spec: DecisionSpec = {
      id: "expression-test",
      version: "1.0.0",
      input: { quantity: { type: "number" } },
      output: { total: { type: "number" } },
      profile: { price: { type: "number" } },
      rules: [
        {
          id: "calculate",
          when: "always",
          emit: { total: "$input.quantity * $profile.price" },
        },
      ],
    };

    const { code } = generateDecisionCode(spec);
    expect(code).toContain("total: input.quantity * profile.price");
  });
});

describe("generateDecisionsFile", () => {
  const specs: DecisionSpec[] = [
    {
      id: "decision-a",
      version: "1.0.0",
      input: { x: { type: "number" } },
      output: { y: { type: "number" } },
      profile: {},
      rules: [{ id: "r1", when: "always", emit: { y: 1 } }],
    },
    {
      id: "decision-b",
      version: "2.0.0",
      input: { a: { type: "string" } },
      output: { b: { type: "string" } },
      profile: {},
      rules: [{ id: "r1", when: "always", emit: { b: "result" } }],
    },
  ];

  it("should generate multiple decisions in one file", () => {
    const code = generateDecisionsFile(specs);

    expect(code).toContain("export const decisionADecision = defineDecision");
    expect(code).toContain("export const decisionBDecision = defineDecision");
  });

  it("should include imports only once at the top", () => {
    const code = generateDecisionsFile(specs);

    const firstImportIndex = code.indexOf('import { defineDecision }');
    const lastImportIndex = code.lastIndexOf('import { defineDecision }');

    expect(firstImportIndex).toBe(lastImportIndex);
  });

  it("should respect includeImports option", () => {
    const withImports = generateDecisionsFile(specs, { includeImports: true });
    const withoutImports = generateDecisionsFile(specs, { includeImports: false });

    expect(withImports).toContain('import { defineDecision }');
    expect(withoutImports).not.toContain('import { defineDecision }');
  });
});
