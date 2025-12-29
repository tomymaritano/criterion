import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import path from "node:path";

const CLI_PATH = path.join(__dirname, "../dist/index.js");

describe("CLI", () => {
  it("should show help", () => {
    const output = execSync(`node ${CLI_PATH} --help`, { encoding: "utf-8" });
    expect(output).toContain("criterion");
    expect(output).toContain("init");
    expect(output).toContain("new");
  });

  it("should show version", () => {
    const output = execSync(`node ${CLI_PATH} --version`, { encoding: "utf-8" });
    expect(output.trim()).toBe("0.3.1");
  });
});
