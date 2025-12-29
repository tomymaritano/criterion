import { describe, it, expect } from "vitest";
import {
  findBlockEnd,
  findArrayEnd,
  isCriterionContent,
  checkMissingId,
  checkMissingVersion,
  checkMissingSchemas,
  checkEmptyRules,
  checkMissingRuleProperties,
  validateCriterionContent,
  getHoverDoc,
  generateDecisionTemplate,
  hoverDocs,
} from "./validators";

describe("validators", () => {
  describe("findBlockEnd", () => {
    it("finds end of simple block", () => {
      const text = "{ foo: 1 }";
      expect(findBlockEnd(text, 0)).toBe(10);
    });

    it("handles nested blocks", () => {
      const text = "{ foo: { bar: 1 } }";
      expect(findBlockEnd(text, 0)).toBe(19);
    });

    it("handles strings with braces", () => {
      const text = '{ foo: "{ not a block }" }';
      expect(findBlockEnd(text, 0)).toBe(26);
    });

    it("handles template literals with braces", () => {
      const text = "{ foo: `{ template }` }";
      expect(findBlockEnd(text, 0)).toBe(23);
    });

    it("handles escaped quotes in strings", () => {
      const text = '{ foo: "escaped \\" quote" }';
      expect(findBlockEnd(text, 0)).toBe(27);
    });

    it("returns text length if no closing brace", () => {
      const text = "{ foo: 1";
      expect(findBlockEnd(text, 0)).toBe(8);
    });
  });

  describe("findArrayEnd", () => {
    it("finds end of simple array", () => {
      const text = "[1, 2, 3]";
      expect(findArrayEnd(text, 0)).toBe(8);
    });

    it("handles nested arrays", () => {
      const text = "[[1, 2], [3, 4]]";
      expect(findArrayEnd(text, 0)).toBe(15);
    });

    it("handles strings with brackets", () => {
      const text = '["[ not an array ]"]';
      expect(findArrayEnd(text, 0)).toBe(19);
    });

    it("handles mixed nesting", () => {
      const text = '[{ arr: [1] }, "text"]';
      expect(findArrayEnd(text, 0)).toBe(21);
    });

    it("returns text length if no closing bracket", () => {
      const text = "[1, 2";
      expect(findArrayEnd(text, 0)).toBe(5);
    });
  });

  describe("isCriterionContent", () => {
    it("returns true for .criterion.ts files", () => {
      expect(isCriterionContent("risk.criterion.ts", "")).toBe(true);
    });

    it("returns true for .ts files with defineDecision", () => {
      expect(isCriterionContent("rules.ts", "defineDecision({})")).toBe(true);
    });

    it("returns true for .ts files with @criterionx/core import", () => {
      expect(
        isCriterionContent("rules.ts", 'import { Engine } from "@criterionx/core"')
      ).toBe(true);
    });

    it("returns false for non-criterion .ts files", () => {
      expect(isCriterionContent("utils.ts", "function foo() {}")).toBe(false);
    });

    it("returns false for non-.ts files", () => {
      expect(isCriterionContent("readme.md", "defineDecision")).toBe(false);
    });
  });

  describe("checkMissingId", () => {
    it("returns error for decision without id", () => {
      const text = `
        defineDecision({
          version: "1.0.0",
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          profileSchema: z.object({}),
          rules: []
        })
      `;
      const diagnostics = checkMissingId(text);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].message).toBe("Decision is missing required 'id' property");
      expect(diagnostics[0].severity).toBe("error");
    });

    it("returns empty for decision with id", () => {
      const text = `
        defineDecision({
          id: "my-decision",
          version: "1.0.0"
        })
      `;
      const diagnostics = checkMissingId(text);
      expect(diagnostics).toHaveLength(0);
    });

    it("handles id with space before colon", () => {
      const text = `defineDecision({ id : "test" })`;
      const diagnostics = checkMissingId(text);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe("checkMissingVersion", () => {
    it("returns error for decision without version", () => {
      const text = `
        defineDecision({
          id: "test"
        })
      `;
      const diagnostics = checkMissingVersion(text);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].message).toBe("Decision is missing required 'version' property");
    });

    it("returns empty for decision with version", () => {
      const text = `defineDecision({ version: "1.0.0" })`;
      const diagnostics = checkMissingVersion(text);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe("checkMissingSchemas", () => {
    it("returns errors for missing schemas", () => {
      const text = `
        defineDecision({
          id: "test",
          version: "1.0.0"
        })
      `;
      const diagnostics = checkMissingSchemas(text);
      expect(diagnostics).toHaveLength(3);
      expect(diagnostics.map((d) => d.message)).toContain(
        "Decision is missing required 'inputSchema' property"
      );
      expect(diagnostics.map((d) => d.message)).toContain(
        "Decision is missing required 'outputSchema' property"
      );
      expect(diagnostics.map((d) => d.message)).toContain(
        "Decision is missing required 'profileSchema' property"
      );
    });

    it("returns empty for decision with all schemas", () => {
      const text = `
        defineDecision({
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          profileSchema: z.object({})
        })
      `;
      const diagnostics = checkMissingSchemas(text);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe("checkEmptyRules", () => {
    it("returns warning for empty rules array", () => {
      const text = `rules: []`;
      const diagnostics = checkEmptyRules(text);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].message).toBe("Decision has no rules defined. Add at least one rule.");
      expect(diagnostics[0].severity).toBe("warning");
    });

    it("returns warning for empty rules with whitespace", () => {
      const text = `rules: [   ]`;
      const diagnostics = checkEmptyRules(text);
      expect(diagnostics).toHaveLength(1);
    });

    it("returns empty for non-empty rules", () => {
      const text = `rules: [{ id: "test" }]`;
      const diagnostics = checkEmptyRules(text);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe("checkMissingRuleProperties", () => {
    it("returns errors for rule missing required properties", () => {
      const text = `
        rules: [
          {
            id: "test"
          }
        ]
      `;
      const diagnostics = checkMissingRuleProperties(text);
      expect(diagnostics).toHaveLength(3);
      expect(diagnostics.map((d) => d.message)).toContain("Rule is missing required 'when' function");
      expect(diagnostics.map((d) => d.message)).toContain("Rule is missing required 'emit' function");
      expect(diagnostics.map((d) => d.message)).toContain(
        "Rule is missing required 'explain' function"
      );
    });

    it("returns empty for complete rule", () => {
      const text = `
        rules: [
          {
            id: "test",
            when: () => true,
            emit: () => ({}),
            explain: () => "test"
          }
        ]
      `;
      const diagnostics = checkMissingRuleProperties(text);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe("validateCriterionContent", () => {
    it("returns all diagnostics for invalid decision", () => {
      const text = `
        defineDecision({
          rules: []
        })
      `;
      const diagnostics = validateCriterionContent(text);
      // Missing: id, version, inputSchema, outputSchema, profileSchema + empty rules warning
      expect(diagnostics.length).toBeGreaterThan(0);
    });

    it("returns empty for valid decision", () => {
      const text = `
        defineDecision({
          id: "test",
          version: "1.0.0",
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          profileSchema: z.object({}),
          rules: [
            {
              id: "default",
              when: () => true,
              emit: () => ({}),
              explain: () => "Default"
            }
          ]
        })
      `;
      const diagnostics = validateCriterionContent(text);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe("getHoverDoc", () => {
    it("returns documentation for known keywords", () => {
      expect(getHoverDoc("defineDecision")).toContain("Create a new Criterion decision");
      expect(getHoverDoc("inputSchema")).toContain("Zod schema defining the input");
      expect(getHoverDoc("when")).toContain("Condition function");
      expect(getHoverDoc("emit")).toContain("Function that returns the output");
      expect(getHoverDoc("explain")).toContain("human-readable explanation");
    });

    it("returns undefined for unknown keywords", () => {
      expect(getHoverDoc("unknownKeyword")).toBeUndefined();
      expect(getHoverDoc("")).toBeUndefined();
    });
  });

  describe("hoverDocs", () => {
    it("has documentation for all expected keywords", () => {
      const expectedKeywords = [
        "defineDecision",
        "inputSchema",
        "outputSchema",
        "profileSchema",
        "when",
        "emit",
        "explain",
      ];
      for (const keyword of expectedKeywords) {
        expect(hoverDocs[keyword]).toBeDefined();
      }
    });
  });

  describe("generateDecisionTemplate", () => {
    it("generates valid decision template", () => {
      const template = generateDecisionTemplate("risk-assessment");
      expect(template).toContain('import { defineDecision } from "@criterionx/core"');
      expect(template).toContain('import { z } from "zod"');
      expect(template).toContain("RiskAssessment Decision");
      expect(template).toContain("export const riskAssessment");
      expect(template).toContain('id: "risk-assessment"');
      expect(template).toContain('version: "1.0.0"');
      expect(template).toContain("inputSchema:");
      expect(template).toContain("outputSchema:");
      expect(template).toContain("profileSchema:");
      expect(template).toContain("rules:");
    });

    it("handles single-word names", () => {
      const template = generateDecisionTemplate("approval");
      expect(template).toContain("Approval Decision");
      expect(template).toContain("export const approval");
      expect(template).toContain('id: "approval"');
    });

    it("handles multi-word names", () => {
      const template = generateDecisionTemplate("loan-risk-assessment");
      expect(template).toContain("LoanRiskAssessment Decision");
      expect(template).toContain("export const loanRiskAssessment");
    });
  });
});
