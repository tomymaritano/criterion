import * as vscode from "vscode";
import {
  isCriterionContent,
  validateCriterionContent,
  getHoverDoc,
  generateDecisionTemplate,
  type Diagnostic,
} from "./validators";

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
        if (isCriterionContent(event.document.fileName, event.document.getText())) {
          validateDocument(event.document);
        }
      })
    );

    // Validate on document open
    context.subscriptions.push(
      vscode.workspace.onDidOpenTextDocument((document) => {
        if (isCriterionContent(document.fileName, document.getText())) {
          validateDocument(document);
        }
      })
    );

    // Validate all open documents on activation
    vscode.workspace.textDocuments.forEach((document) => {
      if (isCriterionContent(document.fileName, document.getText())) {
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
 * Validate a Criterion document
 */
function validateDocument(document: vscode.TextDocument): void {
  const text = document.getText();
  const diagnostics = validateCriterionContent(text);

  const vscodeDiagnostics = diagnostics.map((d) => convertDiagnostic(d, document));
  diagnosticCollection.set(document.uri, vscodeDiagnostics);
}

/**
 * Convert internal diagnostic to VS Code diagnostic
 */
function convertDiagnostic(diagnostic: Diagnostic, document: vscode.TextDocument): vscode.Diagnostic {
  const startPos = document.positionAt(diagnostic.range.start);
  const endPos = document.positionAt(diagnostic.range.end);
  const range = new vscode.Range(startPos, endPos);

  const severity =
    diagnostic.severity === "error"
      ? vscode.DiagnosticSeverity.Error
      : diagnostic.severity === "warning"
        ? vscode.DiagnosticSeverity.Warning
        : vscode.DiagnosticSeverity.Information;

  return new vscode.Diagnostic(range, diagnostic.message, severity);
}

/**
 * Hover provider for Criterion keywords
 */
class CriterionHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.Hover | null {
    const range = document.getWordRangeAtPosition(position);
    if (!range) return null;

    const word = document.getText(range);
    const doc = getHoverDoc(word);

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
  const content = generateDecisionTemplate(name);

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
