/**
 * Context Menu Commands
 * Provides right-click context menu actions for code
 */

import * as vscode from 'vscode';
import { ChatViewProvider } from '../views/chatView';

/**
 * Explain Code command - Explain selected code
 */
export async function explainCodeContextCommand(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    if (!selectedText) {
        vscode.window.showWarningMessage('Please select some code to explain');
        return;
    }

    const language = editor.document.languageId;
    const prompt = `Explain the following ${language} code:\n\n\`\`\`${language}\n${selectedText}\n\`\`\``;

    // Send to chat view
    await sendToChatView(prompt);
}

/**
 * Fix Code command - Fix issues in selected code
 */
export async function fixCodeContextCommand(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    if (!selectedText) {
        vscode.window.showWarningMessage('Please select some code to fix');
        return;
    }

    const language = editor.document.languageId;
    const prompt = `Fix any bugs or issues in the following ${language} code. Provide the corrected code:\n\n\`\`\`${language}\n${selectedText}\n\`\`\``;

    await sendToChatView(prompt);
}

/**
 * Improve Code command - Improve code quality
 */
export async function improveCodeContextCommand(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    if (!selectedText) {
        vscode.window.showWarningMessage('Please select some code to improve');
        return;
    }

    const language = editor.document.languageId;
    const prompt = `Improve the following ${language} code for better readability, performance, and best practices:\n\n\`\`\`${language}\n${selectedText}\n\`\`\``;

    await sendToChatView(prompt);
}

/**
 * Add to Context command - Add selected code to chat context
 */
export async function addToContextCommand(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    if (!selectedText) {
        vscode.window.showWarningMessage('Please select some code to add to context');
        return;
    }

    const language = editor.document.languageId;
    const fileName = editor.document.fileName.split(/[\\/]/).pop() || 'file';
    const prompt = `I'm sharing this code from ${fileName}:\n\n\`\`\`${language}\n${selectedText}\n\`\`\`\n\nPlease acknowledge and I'll ask my question.`;

    await sendToChatView(prompt);
}

/**
 * Send prompt to chat view
 */
async function sendToChatView(prompt: string): Promise<void> {
    // Focus the chat view
    await vscode.commands.executeCommand('aiCodeGenerator.chatView.focus');

    // Send message to webview
    // Note: This requires the ChatViewProvider to expose a method to receive messages
    // We'll need to update ChatViewProvider to handle this
    vscode.commands.executeCommand('ai-code-generator.sendToChat', prompt);
}
