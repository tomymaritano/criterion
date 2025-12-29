import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";

interface ListOptions {
  dir: string;
  json: boolean;
}

interface DecisionInfo {
  file: string;
  id: string;
  version: string;
  rulesCount: number;
}

/**
 * Find all TypeScript files that might contain decisions
 */
function findDecisionFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string) {
    if (!fs.existsSync(currentDir)) return;

    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Skip common directories
        if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) {
          continue;
        }
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

/**
 * Check if file contains a Criterion decision
 */
function isDecisionFile(content: string): boolean {
  return content.includes("defineDecision") && content.includes("@criterionx/core");
}

/**
 * Extract decision info from file content
 */
function extractDecisionInfo(content: string, filePath: string): DecisionInfo | null {
  const defineDecisionMatch = content.match(/defineDecision\s*\(\s*\{/);
  if (!defineDecisionMatch) {
    return null;
  }

  // Find the decision block
  const startPos = defineDecisionMatch.index!;
  const blockEnd = findBlockEnd(content, startPos);
  const block = content.slice(startPos, blockEnd);

  // Extract id
  const idMatch = block.match(/id\s*:\s*["'`]([^"'`]+)["'`]/);
  const id = idMatch ? idMatch[1] : "unknown";

  // Extract version
  const versionMatch = block.match(/version\s*:\s*["'`]([^"'`]+)["'`]/);
  const version = versionMatch ? versionMatch[1] : "unknown";

  // Count rules
  const rulesMatch = block.match(/rules\s*:\s*\[/);
  let rulesCount = 0;

  if (rulesMatch) {
    const rulesStart = rulesMatch.index! + rulesMatch[0].length;
    const rulesEnd = findArrayEnd(block, rulesMatch.index!);
    const rulesBlock = block.slice(rulesStart, rulesEnd);

    // Count rule objects
    const ruleMatches = rulesBlock.match(/\{\s*id\s*:/g);
    rulesCount = ruleMatches ? ruleMatches.length : 0;
  }

  return { file: filePath, id, version, rulesCount };
}

/**
 * Find the end of a block starting with {
 */
function findBlockEnd(text: string, start: number): number {
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
function findArrayEnd(text: string, start: number): number {
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

export async function listCommand(options: ListOptions): Promise<void> {
  const targetDir = path.resolve(options.dir);

  if (!fs.existsSync(targetDir)) {
    if (options.json) {
      console.log(JSON.stringify({ error: "Directory not found", decisions: [] }));
    } else {
      console.log(pc.red(`\n❌ Directory not found: ${targetDir}\n`));
    }
    process.exit(1);
  }

  // Find all TypeScript files
  const files = findDecisionFiles(targetDir);
  const decisions: DecisionInfo[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");

    if (!isDecisionFile(content)) {
      continue;
    }

    const info = extractDecisionInfo(content, file);
    if (info) {
      decisions.push(info);
    }
  }

  // Output
  if (options.json) {
    console.log(JSON.stringify({ decisions }, null, 2));
    return;
  }

  if (decisions.length === 0) {
    console.log(pc.yellow("\n⚠ No decisions found in"), pc.dim(targetDir));
    console.log(pc.dim("  Decisions should import from '@criterionx/core' and use defineDecision()"));
    console.log();
    return;
  }

  console.log(pc.cyan("\n📋 Criterion Decisions\n"));

  // Calculate column widths
  const maxIdLen = Math.max(...decisions.map((d) => d.id.length), 2);
  const maxVersionLen = Math.max(...decisions.map((d) => d.version.length), 7);

  // Header
  console.log(
    pc.dim("  ") +
      pc.bold("ID".padEnd(maxIdLen + 2)) +
      pc.bold("VERSION".padEnd(maxVersionLen + 2)) +
      pc.bold("RULES".padEnd(7)) +
      pc.bold("FILE")
  );
  console.log(pc.dim("  " + "─".repeat(60)));

  // Rows
  for (const decision of decisions) {
    const relativePath = path.relative(targetDir, decision.file);
    console.log(
      pc.dim("  ") +
        pc.green(decision.id.padEnd(maxIdLen + 2)) +
        pc.cyan(decision.version.padEnd(maxVersionLen + 2)) +
        String(decision.rulesCount).padEnd(7) +
        pc.dim(relativePath)
    );
  }

  console.log();
  console.log(pc.dim(`  Found ${decisions.length} decision(s)`));
  console.log();
}
