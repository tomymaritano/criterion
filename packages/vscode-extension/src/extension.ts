import * as vscode from "vscode";

/**
 * Criterion VS Code Extension
 *
 * Provides syntax highlighting, snippets, and basic validation
 * for Criterion decision files.
 */

let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext) {
  console.log("Criterion extension activated");

  // Create diagnostic collection for validation errors
  diagnosticCollection = vscode.languages.createDiagnosticCollection("criterion");
  context.subscriptions.push(diagnosticCollection);

  // Register document change listener for validation
  const config = vscode.workspace.getConfiguration("criterion");
  if (config.get("validate", true)) {
    // Validate on document change
    context.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (isCriterionFile(event.document)) {
          validateDocument(event.document);
        }
      })
    );

    // Validate on document open
    context.subscriptions.push(
      vscode.workspace.onDidOpenTextDocument((document) => {
        if (isCriterionFile(document)) {
          validateDocument(document);
        }
      })
    );

    // Validate all open documents on activation
    vscode.workspace.textDocuments.forEach((document) => {
      if (isCriterionFile(document)) {
        validateDocument(document);
      }
    });
  }

  // Register hover provider for Criterion keywords
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      ["typescript", "typescriptreact"],
      new CriterionHoverProvider()
    )
  );

  // Register command to create a new decision
  context.subscriptions.push(
    vscode.commands.registerCommand("criterion.newDecision", createNewDecision)
  );
}

export function deactivate() {
  if (diagnosticCollection) {
    diagnosticCollection.dispose();
  }
}

/**
 * Check if a document is a Criterion file
 */
function isCriterionFile(document: vscode.TextDocument): boolean {
  const fileName = document.fileName;
  const text = document.getText();

  return (
    fileName.endsWith(".criterion.ts") ||
    (fileName.endsWith(".ts") &&
      (text.includes("defineDecision") ||
        text.includes("@criterionx/core")))
  );
}

/**
 * Validate a Criterion document
 */
function validateDocument(document: vscode.TextDocument): void {
  const diagnostics: vscode.Diagnostic[] = [];
  const text = document.getText();

  // Check for common issues
  const issues = [
    checkMissingId(text, document),
    checkMissingVersion(text, document),
    checkMissingSchemas(text, document),
    checkEmptyRules(text, document),
    checkMissingRuleProperties(text, document),
  ];

  diagnostics.push(...issues.flat());
  diagnosticCollection.set(document.uri, diagnostics);
}

/**
 * Check for missing id in decision
 */
function checkMissingId(
  text: string,
  document: vscode.TextDocument
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];

  // Find defineDecision calls without id
  const defineDecisionRegex = /defineDecision\s*\(\s*\{/g;
  let match;

  while ((match = defineDecisionRegex.exec(text)) !== null) {
    const startPos = match.index;
    const blockEnd = findBlockEnd(text, startPos);
    const block = text.slice(startPos, blockEnd);

    if (!block.includes("id:") && !block.includes("id :")) {
      const position = document.positionAt(startPos);
      const range = new vscode.Range(position, position.translate(0, 14));
      diagnostics.push(
        new vscode.Diagnostic(
          range,
          "Decision is missing required 'id' property",
          vscode.DiagnosticSeverity.Error
        )
      );
    }
  }

  return diagnostics;
}

/**
 * Check for missing version in decision
 */
function checkMissingVersion(
  text: string,
  document: vscode.TextDocument
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];

  const defineDecisionRegex = /defineDecision\s*\(\s*\{/g;
  let match;

  while ((match = defineDecisionRegex.exec(text)) !== null) {
    const startPos = match.index;
    const blockEnd = findBlockEnd(text, startPos);
    const block = text.slice(startPos, blockEnd);

    if (!block.includes("version:") && !block.includes("version :")) {
      const position = document.positionAt(startPos);
      const range = new vscode.Range(position, position.translate(0, 14));
      diagnostics.push(
        new vscode.Diagnostic(
          range,
          "Decision is missing required 'version' property",
          vscode.DiagnosticSeverity.Error
        )
      );
    }
  }

  return diagnostics;
}

/**
 * Check for missing schemas
 */
function checkMissingSchemas(
  text: string,
  document: vscode.TextDocument
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];

  const defineDecisionRegex = /defineDecision\s*\(\s*\{/g;
  let match;

  while ((match = defineDecisionRegex.exec(text)) !== null) {
    const startPos = match.index;
    const blockEnd = findBlockEnd(text, startPos);
    const block = text.slice(startPos, blockEnd);

    const schemas = ["inputSchema", "outputSchema", "profileSchema"];

    for (const schema of schemas) {
      if (!block.includes(`${schema}:`)) {
        const position = document.positionAt(startPos);
        const range = new vscode.Range(position, position.translate(0, 14));
        diagnostics.push(
          new vscode.Diagnostic(
            range,
            `Decision is missing required '${schema}' property`,
            vscode.DiagnosticSeverity.Error
          )
        );
      }
    }
  }

  return diagnostics;
}

/**
 * Check for empty rules array
 */
function checkEmptyRules(
  text: string,
  document: vscode.TextDocument
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];

  const emptyRulesRegex = /rules\s*:\s*\[\s*\]/g;
  let match;

  while ((match = emptyRulesRegex.exec(text)) !== null) {
    const position = document.positionAt(match.index);
    const range = new vscode.Range(
      position,
      position.translate(0, match[0].length)
    );
    diagnostics.push(
      new vscode.Diagnostic(
        range,
        "Decision has no rules defined. Add at least one rule.",
        vscode.DiagnosticSeverity.Warning
      )
    );
  }

  return diagnostics;
}

/**
 * Check for missing rule properties
 */
function checkMissingRuleProperties(
  text: string,
  document: vscode.TextDocument
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];

  // Find rule objects within rules array
  const rulesRegex = /rules\s*:\s*\[/g;
  let rulesMatch;

  while ((rulesMatch = rulesRegex.exec(text)) !== null) {
    const rulesStart = rulesMatch.index + rulesMatch[0].length;
    const rulesEnd = findArrayEnd(text, rulesMatch.index);
    const rulesBlock = text.slice(rulesStart, rulesEnd);

    // Find individual rule objects
    const ruleRegex = /\{\s*id\s*:/g;
    let ruleMatch;
    let searchText = rulesBlock;
    let offset = rulesStart;

    while ((ruleMatch = ruleRegex.exec(searchText)) !== null) {
      const ruleStart = offset + ruleMatch.index;
      const ruleEnd = findBlockEnd(text, ruleStart);
      const ruleBlock = text.slice(ruleStart, ruleEnd);

      const requiredProps = ["when", "emit", "explain"];

      for (const prop of requiredProps) {
        if (!ruleBlock.includes(`${prop}:`)) {
          const position = document.positionAt(ruleStart);
          const range = new vscode.Range(position, position.translate(0, 1));
          diagnostics.push(
            new vscode.Diagnostic(
              range,
              `Rule is missing required '${prop}' function`,
              vscode.DiagnosticSeverity.Error
            )
          );
        }
      }
    }
  }

  return diagnostics;
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

/**
 * Hover provider for Criterion keywords
 */
class CriterionHoverProvider implements vscode.HoverProvider {
  private readonly docs: Record<string, string> = {
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

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.Hover | null {
    const range = document.getWordRangeAtPosition(position);
    if (!range) return null;

    const word = document.getText(range);
    const doc = this.docs[word];

    if (doc) {
      return new vscode.Hover(new vscode.MarkdownString(doc));
    }

    return null;
  }
}

/**
 * Command to create a new decision file
 */
async function createNewDecision() {
  const name = await vscode.window.showInputBox({
    prompt: "Enter decision name (e.g., risk-assessment)",
    placeHolder: "decision-name",
  });

  if (!name) return;

  const fileName = `${name}.criterion.ts`;
  const pascalName = name
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  const camelName = pascalName.charAt(0).toLowerCase() + pascalName.slice(1);

  const content = `import { defineDecision } from "@criterionx/core";
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

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage("No workspace folder open");
    return;
  }

  const uri = vscode.Uri.joinPath(workspaceFolder.uri, fileName);

  try {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
    vscode.window.showInformationMessage(`Created ${fileName}`);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to create file: ${error}`);
  }
}
