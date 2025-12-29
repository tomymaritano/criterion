import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";

interface ValidateOptions {
  dir: string;
}

interface ValidationError {
  file: string;
  errors: string[];
  warnings: string[];
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
 * Validate a decision file content
 */
function validateDecision(content: string, filePath: string): ValidationError | null {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for defineDecision call
  const defineDecisionMatch = content.match(/defineDecision\s*\(\s*\{/);
  if (!defineDecisionMatch) {
    return null; // Not a decision file
  }

  // Find the decision block
  const startPos = defineDecisionMatch.index!;
  const blockEnd = findBlockEnd(content, startPos);
  const block = content.slice(startPos, blockEnd);

  // Check required properties
  const requiredProps = [
    { prop: "id:", message: "Missing required 'id' property" },
    { prop: "version:", message: "Missing required 'version' property" },
    { prop: "inputSchema:", message: "Missing required 'inputSchema' property" },
    { prop: "outputSchema:", message: "Missing required 'outputSchema' property" },
    { prop: "profileSchema:", message: "Missing required 'profileSchema' property" },
    { prop: "rules:", message: "Missing required 'rules' property" },
  ];

  for (const { prop, message } of requiredProps) {
    if (!block.includes(prop)) {
      errors.push(message);
    }
  }

  // Check for empty rules
  if (/rules\s*:\s*\[\s*\]/.test(block)) {
    warnings.push("Decision has empty rules array");
  }

  // Check for rules without required functions
  const rulesMatch = block.match(/rules\s*:\s*\[/);
  if (rulesMatch) {
    const rulesStart = rulesMatch.index! + rulesMatch[0].length;
    const rulesEnd = findArrayEnd(block, rulesMatch.index!);
    const rulesBlock = block.slice(rulesStart, rulesEnd);

    // Find individual rules
    const ruleRegex = /\{\s*id\s*:/g;
    let ruleMatch;

    while ((ruleMatch = ruleRegex.exec(rulesBlock)) !== null) {
      const ruleStart = ruleMatch.index;
      const ruleEnd = findBlockEnd(rulesBlock, ruleStart);
      const rule = rulesBlock.slice(ruleStart, ruleEnd);

      // Extract rule id
      const idMatch = rule.match(/id\s*:\s*["'`]([^"'`]+)["'`]/);
      const ruleId = idMatch ? idMatch[1] : "unknown";

      const requiredFunctions = ["when:", "emit:", "explain:"];
      for (const func of requiredFunctions) {
        if (!rule.includes(func)) {
          errors.push(`Rule '${ruleId}' missing required '${func.replace(":", "")}' function`);
        }
      }
    }
  }

  if (errors.length === 0 && warnings.length === 0) {
    return null;
  }

  return { file: filePath, errors, warnings };
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

export async function validateCommand(options: ValidateOptions): Promise<void> {
  const targetDir = path.resolve(options.dir);

  console.log(pc.cyan("\n🔍 Validating Criterion decisions...\n"));

  if (!fs.existsSync(targetDir)) {
    console.log(pc.red(`\n❌ Directory not found: ${targetDir}\n`));
    process.exit(1);
  }

  // Find all TypeScript files
  const files = findDecisionFiles(targetDir);

  if (files.length === 0) {
    console.log(pc.yellow("  No TypeScript files found in"), pc.dim(targetDir));
    console.log();
    return;
  }

  let decisionsFound = 0;
  let decisionsValid = 0;
  const validationErrors: ValidationError[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");

    if (!isDecisionFile(content)) {
      continue;
    }

    decisionsFound++;
    const result = validateDecision(content, file);

    if (result) {
      validationErrors.push(result);
    } else {
      decisionsValid++;
      const relativePath = path.relative(targetDir, file);
      console.log(pc.green("  ✓"), pc.dim(relativePath));
    }
  }

  // Print errors
  if (validationErrors.length > 0) {
    console.log();
    for (const result of validationErrors) {
      const relativePath = path.relative(targetDir, result.file);
      console.log(pc.red("  ✗"), pc.dim(relativePath));

      for (const error of result.errors) {
        console.log(pc.red("    →"), error);
      }
      for (const warning of result.warnings) {
        console.log(pc.yellow("    →"), warning);
      }
    }
  }

  // Summary
  console.log();

  if (decisionsFound === 0) {
    console.log(pc.yellow("⚠ No decisions found in"), pc.dim(targetDir));
    console.log(pc.dim("  Decisions should import from '@criterionx/core' and use defineDecision()"));
  } else if (validationErrors.length === 0) {
    console.log(pc.green(`✅ All ${decisionsFound} decision(s) are valid!`));
  } else {
    const errorCount = validationErrors.reduce((sum, e) => sum + e.errors.length, 0);
    const warningCount = validationErrors.reduce((sum, e) => sum + e.warnings.length, 0);

    console.log(
      pc.red(`❌ Found issues in ${validationErrors.length} of ${decisionsFound} decision(s)`)
    );
    if (errorCount > 0) {
      console.log(pc.red(`   ${errorCount} error(s)`));
    }
    if (warningCount > 0) {
      console.log(pc.yellow(`   ${warningCount} warning(s)`));
    }
    process.exit(1);
  }

  console.log();
}
