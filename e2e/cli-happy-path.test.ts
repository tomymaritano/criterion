/**
 * E2E Test: CLI Happy Path
 *
 * Tests the complete workflow:
 * 1. criterion init (create project structure)
 * 2. criterion new decision (generate decision file)
 * 3. Verify generated files are valid TypeScript
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const CLI_PATH = join(__dirname, "../packages/cli/dist/index.js");

describe("CLI E2E: Happy Path", () => {
  let testDir: string;

  beforeAll(() => {
    // Create temp directory for test
    testDir = mkdtempSync(join(tmpdir(), "criterion-e2e-"));
  });

  afterAll(() => {
    // Cleanup temp directory
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("should complete full workflow: init → new decision → valid output", () => {
    // Step 1: Initialize project
    const initOutput = execSync(
      `node ${CLI_PATH} init --dir ${testDir} --no-install`,
      { encoding: "utf-8" }
    );

    expect(initOutput).toContain("Project initialized");

    // Verify init created expected files
    expect(existsSync(join(testDir, "package.json"))).toBe(true);
    expect(existsSync(join(testDir, "tsconfig.json"))).toBe(true);
    expect(existsSync(join(testDir, "src/decisions"))).toBe(true);

    // Step 2: Create a new decision
    const newOutput = execSync(
      `node ${CLI_PATH} new decision risk-assessment --dir ${join(testDir, "src/decisions")}`,
      { encoding: "utf-8" }
    );

    expect(newOutput).toContain("Created");
    expect(newOutput).toContain("risk-assessment");

    // Verify decision file was created
    const decisionPath = join(testDir, "src/decisions/risk-assessment.ts");
    expect(existsSync(decisionPath)).toBe(true);

    // Step 3: Verify generated file is valid
    const decisionContent = readFileSync(decisionPath, "utf-8");

    // Should have required imports
    expect(decisionContent).toContain("import { defineDecision }");
    expect(decisionContent).toContain("@criterionx/core");
    expect(decisionContent).toContain("import { z }");

    // Should have required properties
    expect(decisionContent).toContain("id:");
    expect(decisionContent).toContain("version:");
    expect(decisionContent).toContain("inputSchema:");
    expect(decisionContent).toContain("outputSchema:");
    expect(decisionContent).toContain("profileSchema:");
    expect(decisionContent).toContain("rules:");

    // Should have the correct decision ID
    expect(decisionContent).toContain('"risk-assessment"');

    // Should have at least one rule with required properties
    expect(decisionContent).toContain("when:");
    expect(decisionContent).toContain("emit:");
    expect(decisionContent).toContain("explain:");
  });

  it("should show help without errors", () => {
    const helpOutput = execSync(`node ${CLI_PATH} --help`, { encoding: "utf-8" });

    expect(helpOutput).toContain("criterion");
    expect(helpOutput).toContain("init");
    expect(helpOutput).toContain("new");
  });

  it("should show version without errors", () => {
    const versionOutput = execSync(`node ${CLI_PATH} --version`, {
      encoding: "utf-8",
    });

    expect(versionOutput.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
