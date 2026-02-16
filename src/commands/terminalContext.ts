/**
 * Terminal Context Menu Commands
 * Provides right-click context menu actions for terminal
 */

import * as vscode from 'vscode';

/**
 * Add Terminal Content to Context
 */
export async function terminalAddToContextCommand(): Promise<void> {
    const terminal = vscode.window.activeTerminal;
    if (!terminal) {
        vscode.window.showErrorMessage('No active terminal');
        return;
    }

    // Get terminal selection (if available)
    const selection = await vscode.window.showInputBox({
        prompt: 'Paste the terminal output you want to add to context',
        placeHolder: 'Terminal output...'
    });

    if (!selection) {
        return;
    }

    const prompt = `I'm sharing this terminal output:\n\n\`\`\`\n${selection}\n\`\`\`\n\nPlease acknowledge and I'll ask my question.`;

    await sendToChatView(prompt);
}

/**
 * Fix Terminal Command
 */
export async function terminalFixCommandCommand(): Promise<void> {
    const command = await vscode.window.showInputBox({
        prompt: 'Paste the command that failed',
        placeHolder: 'e.g., npm install package-name'
    });

    if (!command) {
        return;
    }

    const error = await vscode.window.showInputBox({
        prompt: 'Paste the error message (optional)',
        placeHolder: 'Error message...'
    });

    let prompt = `Fix this terminal command that failed:\n\n\`\`\`bash\n${command}\n\`\`\``;

    if (error) {
        prompt += `\n\nError message:\n\`\`\`\n${error}\n\`\`\``;
    }

    await sendToChatView(prompt);
}

/**
 * Explain Terminal Command
 */
export async function terminalExplainCommandCommand(): Promise<void> {
    const command = await vscode.window.showInputBox({
        prompt: 'Paste the command you want explained',
        placeHolder: 'e.g., git rebase -i HEAD~3'
    });

    if (!command) {
        return;
    }

    const prompt = `Explain this terminal command in detail:\n\n\`\`\`bash\n${command}\n\`\`\``;

    await sendToChatView(prompt);
}

/**
 * Generate Terminal Command (Ctrl+Shift+G)
 */
export async function generateTerminalCommandCommand(): Promise<void> {
    const description = await vscode.window.showInputBox({
        prompt: 'Describe what you want to do in the terminal',
        placeHolder: 'e.g., list all running processes, find large files'
    });

    if (!description) {
        return;
    }

    const prompt = `Generate a terminal command to: ${description}\n\nProvide ONLY the command, no explanations.`;

    // For this one, we want to get the command and offer to run it
    await sendToChatView(prompt);
}

/**
 * Send prompt to chat view
 */
async function sendToChatView(prompt: string): Promise<void> {
    await vscode.commands.executeCommand('aiCodeGenerator.chatView.focus');
    vscode.commands.executeCommand('ai-code-generator.sendToChat', prompt);
}
