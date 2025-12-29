import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";

interface NewOptions {
  dir: string;
}

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function generateDecision(name: string): string {
  const id = toKebabCase(name);
  const varName = toCamelCase(name);

  return `import { defineDecision } from "@criterionx/core";
import { z } from "zod";

/**
 * ${toPascalCase(name)} Decision
 *
 * TODO: Add description
 */
export const ${varName} = defineDecision({
  id: "${id}",
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
    // TODO: Define profile schema (parameters that can vary)
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

function generateProfile(name: string): string {
  const varName = toCamelCase(name) + "Profile";

  return `/**
 * ${toPascalCase(name)} Profile
 *
 * Profiles parameterize decisions without changing logic.
 * Create different profiles for different regions, tiers, or environments.
 */
export const ${varName} = {
  // TODO: Define profile values
  // These should match the profileSchema of your decision
};

// Example: Multiple profiles for different contexts
// export const ${varName}US = { threshold: 10000 };
// export const ${varName}EU = { threshold: 8000 };
`;
}

export async function newCommand(
  type: string,
  name: string,
  options: NewOptions
): Promise<void> {
  const validTypes = ["decision", "profile"];

  if (!validTypes.includes(type)) {
    console.log(pc.red(`\\n❌ Invalid type: ${type}`));
    console.log(pc.dim(`   Valid types: ${validTypes.join(", ")}\\n`));
    process.exit(1);
  }

  const fileName = toKebabCase(name) + ".ts";
  const targetDir = path.resolve(options.dir);
  const filePath = path.join(targetDir, fileName);

  console.log(pc.cyan(`\\n🎯 Generating ${type}: ${name}\\n`));

  // Create directory if needed
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log(pc.green("  ✓"), pc.dim("Created directory"), targetDir);
  }

  // Check if file exists
  if (fs.existsSync(filePath)) {
    console.log(pc.red(`\\n❌ File already exists: ${filePath}\\n`));
    process.exit(1);
  }

  // Generate content
  let content: string;
  switch (type) {
    case "decision":
      content = generateDecision(name);
      break;
    case "profile":
      content = generateProfile(name);
      break;
    default:
      throw new Error(`Unknown type: ${type}`);
  }

  // Write file
  fs.writeFileSync(filePath, content);
  console.log(pc.green("  ✓"), pc.dim("Created"), filePath);

  console.log(pc.green(`\\n✅ ${toPascalCase(type)} created!\\n`));
  console.log("Next steps:");
  console.log(pc.dim(`  1. Edit ${filePath}`));
  console.log(pc.dim(`  2. Define your schemas and rules`));
  console.log(pc.dim(`  3. Import and use in your application\\n`));
}
