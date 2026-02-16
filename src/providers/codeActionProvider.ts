/**
 * AI Code Action Provider
 * Provides AI-powered quick fixes for code issues
 */

import * as vscode from 'vscode';
import { createAIProviderAdapter } from '../features/ghost/aiProviderAdapter';

/**
 * Code Action Provider for AI-powered quick fixes
 */
export class AICodeActionProvider implements vscode.CodeActionProvider {
    public static readonly providedCodeActionKinds = [
        vscode.CodeActionKind.QuickFix,
        vscode.CodeActionKind.Refactor,
        vscode.CodeActionKind.RefactorRewrite
    ];

    /**
     * Provide code actions for diagnostics
     */
    public async provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken
    ): Promise<vscode.CodeAction[] | undefined> {
        // Check if code actions are enabled
        const config = vscode.workspace.getConfiguration('aiCodeGenerator');
        const enabled = config.get<boolean>('enableCodeActions', true);

        if (!enabled) {
            return undefined;
        }

        const actions: vscode.CodeAction[] = [];

        // Add quick fixes for diagnostics (errors and warnings)
        if (context.diagnostics && context.diagnostics.length > 0) {
            for (const diagnostic of context.diagnostics) {
                // Only handle errors and warnings
                if (diagnostic.severity === vscode.DiagnosticSeverity.Error ||
                    diagnostic.severity === vscode.DiagnosticSeverity.Warning) {

                    const fixAction = this.createFixAction(document, diagnostic);
                    if (fixAction) {
                        actions.push(fixAction);
                    }
                }
            }
        }

        // Add refactor actions for selected code
        if (!range.isEmpty) {
            const refactorAction = this.createRefactorAction(document, range);
            if (refactorAction) {
                actions.push(refactorAction);
            }
        }

        return actions;
    }

    /**
     * Create a quick fix action for a diagnostic
     */
    private createFixAction(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic
    ): vscode.CodeAction | undefined {
        const action = new vscode.CodeAction(
            `AI: Fix "${diagnostic.message.substring(0, 50)}..."`,
            vscode.CodeActionKind.QuickFix
        );

        action.diagnostics = [diagnostic];
        action.isPreferred = true;

        // Create command to execute the fix
        action.command = {
            command: 'ai-code-generator.applyQuickFix',
            title: 'Apply AI Quick Fix',
            arguments: [document, diagnostic]
        };

        return action;
    }

    /**
     * Create a refactor action for selected code
     */
    private createRefactorAction(
        document: vscode.TextDocument,
        range: vscode.Range
    ): vscode.CodeAction | undefined {
        const action = new vscode.CodeAction(
            'AI: Refactor/Improve Code',
            vscode.CodeActionKind.RefactorRewrite
        );

        action.command = {
            command: 'ai-code-generator.refactorCode',
            title: 'Refactor with AI',
            arguments: [document, range]
        };

        return action;
    }
}

/**
 * Apply quick fix command
 */
export async function applyQuickFixCommand(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
): Promise<void> {
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Generating AI fix...',
            cancellable: false
        }, async () => {
            // Get the problematic code
            const problemCode = document.getText(diagnostic.range);
            const lineNumber = diagnostic.range.start.line + 1;
            const language = document.languageId;

            // Get surrounding context (5 lines before and after)
            const startLine = Math.max(0, diagnostic.range.start.line - 5);
            const endLine = Math.min(document.lineCount - 1, diagnostic.range.end.line + 5);
            const contextRange = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
            const context = document.getText(contextRange);

            // Generate fix using AI
            const fix = await generateFix(problemCode, diagnostic.message, context, language, lineNumber);

            // Apply the fix
            const edit = new vscode.WorkspaceEdit();
            edit.replace(document.uri, diagnostic.range, fix);
            await vscode.workspace.applyEdit(edit);

            vscode.window.showInformationMessage('AI fix applied!');
        });
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to apply fix: ${error}`);
    }
}

/**
 * Refactor code command
 */
export async function refactorCodeCommand(
    document: vscode.TextDocument,
    range: vscode.Range
): Promise<void> {
    try {
        const selectedCode = document.getText(range);
        const language = document.languageId;

        // Ask user what kind of refactoring they want
        const refactorType = await vscode.window.showQuickPick([
            { label: 'Improve Readability', value: 'readability' },
            { label: 'Optimize Performance', value: 'performance' },
            { label: 'Add Error Handling', value: 'error-handling' },
            { label: 'Extract Function', value: 'extract-function' },
            { label: 'Simplify Logic', value: 'simplify' }
        ], {
            placeHolder: 'Select refactoring type'
        });

        if (!refactorType) {
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Refactoring with AI...',
            cancellable: false
        }, async () => {
            // Generate refactored code
            const refactoredCode = await generateRefactoring(selectedCode, refactorType.value, language);

            // Apply the refactoring
            const edit = new vscode.WorkspaceEdit();
            edit.replace(document.uri, range, refactoredCode);
            await vscode.workspace.applyEdit(edit);

            vscode.window.showInformationMessage('Code refactored!');
        });
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to refactor: ${error}`);
    }
}

/**
 * Generate fix using AI
 */
async function generateFix(
    problemCode: string,
    errorMessage: string,
    context: string,
    language: string,
    lineNumber: number
): Promise<string> {
    const aiProvider = createAIProviderAdapter();

    const prompt = `Fix this ${language} code error.

Error: ${errorMessage}
Line: ${lineNumber}

Problematic code:
\`\`\`${language}
${problemCode}
\`\`\`

Context (surrounding code):
\`\`\`${language}
${context}
\`\`\`

Provide ONLY the fixed code for the problematic section, no explanations. The fix should:
1. Resolve the error
2. Maintain the same functionality
3. Follow best practices
4. Be a drop-in replacement

Fixed code:`;

    try {
        const response = await aiProvider.generateCode(prompt);
        // Clean up the response - remove markdown code blocks if present
        let fixedCode = response.trim();
        fixedCode = fixedCode.replace(/^```[\w]*\n?/gm, '').replace(/\n?```$/gm, '');
        return fixedCode.trim();
    } catch (error) {
        throw new Error(`AI generation failed: ${error}`);
    }
}

/**
 * Generate refactored code using AI
 */
async function generateRefactoring(
    code: string,
    refactorType: string,
    language: string
): Promise<string> {
    const aiProvider = createAIProviderAdapter();

    const refactorInstructions: Record<string, string> = {
        'readability': 'Improve code readability with better variable names, comments, and structure',
        'performance': 'Optimize for better performance and efficiency',
        'error-handling': 'Add comprehensive error handling and validation',
        'extract-function': 'Extract reusable logic into separate functions',
        'simplify': 'Simplify the logic while maintaining functionality'
    };

    const instruction = refactorInstructions[refactorType] || 'Improve the code';

    const prompt = `Refactor this ${language} code: ${instruction}

Original code:
\`\`\`${language}
${code}
\`\`\`

Requirements:
1. ${instruction}
2. Maintain the same functionality
3. Follow ${language} best practices
4. Keep the same interface/API

Provide ONLY the refactored code, no explanations.

Refactored code:`;

    try {
        const response = await aiProvider.generateCode(prompt);
        // Clean up the response
        let refactoredCode = response.trim();
        refactoredCode = refactoredCode.replace(/^```[\w]*\n?/gm, '').replace(/\n?```$/gm, '');
        return refactoredCode.trim();
    } catch (error) {
        throw new Error(`AI generation failed: ${error}`);
    }
}
