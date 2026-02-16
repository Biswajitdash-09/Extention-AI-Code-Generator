import * as vscode from 'vscode';
import { ProviderManager } from '../providers';

/**
 * Refactor selected code using AI
 */
export async function refactorSelectionCommand(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    if (!selectedText) {
        vscode.window.showWarningMessage('No code selected');
        return;
    }

    const provider = ProviderManager.getProvider();
    const result = await provider.chat([
        { role: 'user', content: `Refactor this code to improve readability, performance, and best practices. Return ONLY the refactored code without explanations:\n\n${selectedText}` }
    ]);

    if (result.success && result.message) {
        // Extract code from markdown if present
        const codeMatch = result.message.match(/```[\w]*\n([\s\S]+?)\n```/);
        const refactoredCode = codeMatch ? codeMatch[1] : result.message;

        // Show diff and ask for confirmation
        const apply = await vscode.window.showInformationMessage(
            'Refactored code is ready. Apply changes?',
            'Apply',
            'Cancel'
        );

        if (apply === 'Apply') {
            await editor.edit(editBuilder => {
                editBuilder.replace(selection, refactoredCode);
            });
        }
    } else {
        vscode.window.showErrorMessage(`Refactoring failed: ${result.error}`);
    }
}

/**
 * Add documentation to selected code using AI
 */
export async function addDocumentationCommand(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    if (!selectedText) {
        vscode.window.showWarningMessage('No code selected');
        return;
    }

    const languageId = editor.document.languageId;
    const provider = ProviderManager.getProvider();

    const result = await provider.chat([
        { role: 'user', content: `Add comprehensive JSDoc/docstring documentation to this ${languageId} code. Return the code with documentation added:\n\n${selectedText}` }
    ]);

    if (result.success && result.message) {
        const codeMatch = result.message.match(/```[\w]*\n([\s\S]+?)\n```/);
        const documentedCode = codeMatch ? codeMatch[1] : result.message;

        await editor.edit(editBuilder => {
            editBuilder.replace(selection, documentedCode);
        });

        vscode.window.showInformationMessage('Documentation added successfully!');
    } else {
        vscode.window.showErrorMessage(`Documentation failed: ${result.error}`);
    }
}

/**
 * Optimize selected code using AI
 */
export async function optimizeCodeCommand(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    if (!selectedText) {
        vscode.window.showWarningMessage('No code selected');
        return;
    }

    const provider = ProviderManager.getProvider();
    const result = await provider.chat([
        { role: 'user', content: `Optimize this code for better performance while maintaining functionality. Return ONLY the optimized code:\n\n${selectedText}` }
    ]);

    if (result.success && result.message) {
        const codeMatch = result.message.match(/```[\w]*\n([\s\S]+?)\n```/);
        const optimizedCode = codeMatch ? codeMatch[1] : result.message;

        const apply = await vscode.window.showInformationMessage(
            'Optimized code is ready. Apply changes?',
            'Apply',
            'Cancel'
        );

        if (apply === 'Apply') {
            await editor.edit(editBuilder => {
                editBuilder.replace(selection, optimizedCode);
            });
        }
    } else {
        vscode.window.showErrorMessage(`Optimization failed: ${result.error}`);
    }
}

/**
 * Explain selected code using AI
 */
export async function explainCodeCommand(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    if (!selectedText) {
        vscode.window.showWarningMessage('No code selected');
        return;
    }

    const provider = ProviderManager.getProvider();
    const result = await provider.chat([
        { role: 'user', content: `Explain this code in simple terms:\n\n${selectedText}` }
    ]);

    if (result.success && result.message) {
        const panel = vscode.window.createWebviewPanel(
            'codeExplanation',
            'Code Explanation',
            vscode.ViewColumn.Two,
            {}
        );

        panel.webview.html = `
            <!DOCTYPE html>
            <html>
            <body style="font-family: var(--vscode-font-family); padding: 20px;">
                <h2>Code Explanation</h2>
                <pre style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 4px;">${selectedText}</pre>
                <div style="margin-top: 20px; line-height: 1.6;">${result.message.replace(/\n/g, '<br>')}</div>
            </body>
            </html>
        `;
    } else {
        vscode.window.showErrorMessage(`Explanation failed: ${result.error}`);
    }
}
