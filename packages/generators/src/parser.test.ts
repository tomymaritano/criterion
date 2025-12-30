import { describe, it, expect } from "vitest";
import { parseDecisionSpec, parseDecisionSpecs } from "./parser.js";
import { Engine } from "@criterionx/core";
import type { DecisionSpec } from "./types.js";

describe("parseDecisionSpec", () => {
  const simpleSpec: DecisionSpec = {
    id: "eligibility",
    version: "1.0.0",
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

  it("should parse a simple spec into a runtime decision", () => {
    const decision = parseDecisionSpec(simpleSpec);

    expect(decision.id).toBe("eligibility");
    expect(decision.version).toBe("1.0.0");
  });

  it("should work with Engine", () => {
    const decision = parseDecisionSpec(simpleSpec);
    const engine = new Engine();

    const result = engine.run(decision, { age: 25 }, { profile: { minAge: 18 } });

    expect(result.status).toBe("OK");
    expect(result.data).toEqual({ eligible: true });
  });

  it("should evaluate conditions correctly", () => {
    const decision = parseDecisionSpec(simpleSpec);
    const engine = new Engine();

    // Age below minimum
    const result1 = engine.run(decision, { age: 15 }, { profile: { minAge: 18 } });
    expect(result1.data).toEqual({ eligible: false });

    // Age at minimum
    const result2 = engine.run(decision, { age: 18 }, { profile: { minAge: 18 } });
    expect(result2.data).toEqual({ eligible: true });

    // Age above minimum
    const result3 = engine.run(decision, { age: 30 }, { profile: { minAge: 18 } });
    expect(result3.data).toEqual({ eligible: true });
  });

  it("should handle all comparison operators", () => {
    const operators: Array<{ op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte"; input: number; expected: boolean }> = [
      { op: "eq", input: 10, expected: true },
      { op: "eq", input: 5, expected: false },
      { op: "neq", input: 5, expected: true },
      { op: "neq", input: 10, expected: false },
      { op: "gt", input: 15, expected: true },
      { op: "gt", input: 10, expected: false },
      { op: "gte", input: 10, expected: true },
      { op: "gte", input: 9, expected: false },
      { op: "lt", input: 5, expected: true },
      { op: "lt", input: 10, expected: false },
      { op: "lte", input: 10, expected: true },
      { op: "lte", input: 11, expected: false },
    ];

    for (const { op, input, expected } of operators) {
      const spec: DecisionSpec = {
        id: `test-${op}`,
        version: "1.0.0",
        input: { value: { type: "number" } },
        output: { match: { type: "boolean" } },
        profile: { threshold: { type: "number" } },
        rules: [
          {
            id: "check",
            when: [{ field: "input.value", operator: op, value: "$profile.threshold" }],
            emit: { match: true },
          },
          { id: "default", when: "always", emit: { match: false } },
        ],
      };

      const decision = parseDecisionSpec(spec);
      const engine = new Engine();
      const result = engine.run(decision, { value: input }, { profile: { threshold: 10 } });

      expect(result.data?.match, `${op} with input ${input}`).toBe(expected);
    }
  });

  it("should handle 'in' operator", () => {
    const spec: DecisionSpec = {
      id: "in-test",
      version: "1.0.0",
      input: { status: { type: "string" } },
      output: { allowed: { type: "boolean" } },
      profile: { validStatuses: { type: "array", items: "string" } },
      rules: [
        {
          id: "check-status",
          when: [{ field: "input.status", operator: "in", value: "$profile.validStatuses" }],
          emit: { allowed: true },
        },
        { id: "default", when: "always", emit: { allowed: false } },
      ],
    };

    const decision = parseDecisionSpec(spec);
    const engine = new Engine();

    const result1 = engine.run(
      decision,
      { status: "active" },
      { profile: { validStatuses: ["active", "pending"] } }
    );
    expect(result1.data).toEqual({ allowed: true });

    const result2 = engine.run(
      decision,
      { status: "deleted" },
      { profile: { validStatuses: ["active", "pending"] } }
    );
    expect(result2.data).toEqual({ allowed: false });
  });

  it("should handle 'contains' operator for arrays", () => {
    const spec: DecisionSpec = {
      id: "contains-test",
      version: "1.0.0",
      input: { roles: { type: "array", items: "string" } },
      output: { isAdmin: { type: "boolean" } },
      profile: { adminRole: { type: "string" } },
      rules: [
        {
          id: "check-admin",
          when: [{ field: "input.roles", operator: "contains", value: "$profile.adminRole" }],
          emit: { isAdmin: true },
        },
        { id: "default", when: "always", emit: { isAdmin: false } },
      ],
    };

    const decision = parseDecisionSpec(spec);
    const engine = new Engine();

    const result1 = engine.run(
      decision,
      { roles: ["user", "admin", "viewer"] },
      { profile: { adminRole: "admin" } }
    );
    expect(result1.data).toEqual({ isAdmin: true });

    const result2 = engine.run(
      decision,
      { roles: ["user", "viewer"] },
      { profile: { adminRole: "admin" } }
    );
    expect(result2.data).toEqual({ isAdmin: false });
  });

  it("should handle 'matches' operator for regex", () => {
    const spec: DecisionSpec = {
      id: "matches-test",
      version: "1.0.0",
      input: { email: { type: "string" } },
      output: { valid: { type: "boolean" } },
      profile: { pattern: { type: "string" } },
      rules: [
        {
          id: "check-email",
          when: [{ field: "input.email", operator: "matches", value: "$profile.pattern" }],
          emit: { valid: true },
        },
        { id: "default", when: "always", emit: { valid: false } },
      ],
    };

    const decision = parseDecisionSpec(spec);
    const engine = new Engine();

    const result1 = engine.run(
      decision,
      { email: "test@example.com" },
      { profile: { pattern: "^[^@]+@[^@]+\\.[^@]+$" } }
    );
    expect(result1.data).toEqual({ valid: true });

    const result2 = engine.run(
      decision,
      { email: "invalid-email" },
      { profile: { pattern: "^[^@]+@[^@]+\\.[^@]+$" } }
    );
    expect(result2.data).toEqual({ valid: false });
  });

  it("should handle expression emit values", () => {
    const spec: DecisionSpec = {
      id: "pricing",
      version: "1.0.0",
      input: { quantity: { type: "number" } },
      output: { total: { type: "number" } },
      profile: { unitPrice: { type: "number" } },
      rules: [
        {
          id: "calculate",
          when: "always",
          emit: { total: "$input.quantity * $profile.unitPrice" },
        },
      ],
    };

    const decision = parseDecisionSpec(spec);
    const engine = new Engine();

    const result = engine.run(
      decision,
      { quantity: 5 },
      { profile: { unitPrice: 10 } }
    );
    expect(result.data).toEqual({ total: 50 });
  });

  it("should handle reference emit values", () => {
    const spec: DecisionSpec = {
      id: "echo",
      version: "1.0.0",
      input: { value: { type: "string" } },
      output: { result: { type: "string" } },
      profile: { prefix: { type: "string" } },
      rules: [
        {
          id: "echo",
          when: "always",
          emit: { result: "$input.value" },
        },
      ],
    };

    const decision = parseDecisionSpec(spec);
    const engine = new Engine();

    const result = engine.run(
      decision,
      { value: "hello" },
      { profile: { prefix: "test" } }
    );
    expect(result.data).toEqual({ result: "hello" });
  });

  it("should respect rule priority", () => {
    const spec: DecisionSpec = {
      id: "priority-test",
      version: "1.0.0",
      input: { value: { type: "number" } },
      output: { result: { type: "string" } },
      profile: {},
      rules: [
        {
          id: "low-priority",
          priority: 10,
          when: "always",
          emit: { result: "low" },
        },
        {
          id: "high-priority",
          priority: 1,
          when: "always",
          emit: { result: "high" },
        },
        {
          id: "medium-priority",
          priority: 5,
          when: "always",
          emit: { result: "medium" },
        },
      ],
    };

    const decision = parseDecisionSpec(spec);
    const engine = new Engine();

    const result = engine.run(decision, { value: 1 }, { profile: {} });
    // First matching rule (sorted by priority) wins
    expect(result.data).toEqual({ result: "high" });
  });

  it("should handle optional fields with defaults", () => {
    const spec: DecisionSpec = {
      id: "defaults-test",
      version: "1.0.0",
      input: {
        required: { type: "string" },
        optional: { type: "number", optional: true, default: 42 },
      },
      output: { result: { type: "number" } },
      profile: {},
      rules: [
        {
          id: "use-optional",
          when: "always",
          emit: { result: "$input.optional" },
        },
      ],
    };

    const decision = parseDecisionSpec(spec);
    const engine = new Engine();

    // Without providing optional field - uses default
    const result = engine.run(decision, { required: "test" }, { profile: {} });
    expect(result.data).toEqual({ result: 42 });
  });
});

describe("parseDecisionSpecs", () => {
  it("should parse multiple specs into a Map", () => {
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

    const decisions = parseDecisionSpecs(specs);

    expect(decisions.size).toBe(2);
    expect(decisions.get("decision-a")?.id).toBe("decision-a");
    expect(decisions.get("decision-b")?.id).toBe("decision-b");
  });

  it("should work with Engine for all parsed decisions", () => {
    const specs: DecisionSpec[] = [
      {
        id: "add-ten",
        version: "1.0.0",
        input: { value: { type: "number" } },
        output: { result: { type: "number" } },
        profile: { add: { type: "number" } },
        rules: [{ id: "add", when: "always", emit: { result: "$input.value + $profile.add" } }],
      },
      {
        id: "multiply-two",
        version: "1.0.0",
        input: { value: { type: "number" } },
        output: { result: { type: "number" } },
        profile: { mult: { type: "number" } },
        rules: [{ id: "mult", when: "always", emit: { result: "$input.value * $profile.mult" } }],
      },
    ];

    const decisions = parseDecisionSpecs(specs);
    const engine = new Engine();

    const addResult = engine.run(
      decisions.get("add-ten")!,
      { value: 5 },
      { profile: { add: 10 } }
    );
    expect(addResult.data).toEqual({ result: 15 });

    const multResult = engine.run(
      decisions.get("multiply-two")!,
      { value: 5 },
      { profile: { mult: 2 } }
    );
    expect(multResult.data).toEqual({ result: 10 });
  });
});
