/**
 * Terminal Command Generation
 * Generates and executes terminal commands from natural language
 */

import * as vscode from 'vscode';
import { createAIProviderAdapter } from '../features/ghost/aiProviderAdapter';

/**
 * Generate terminal command from natural language (Ctrl+Shift+G)
 */
export async function generateTerminalCommandCommand(): Promise<void> {
    // Get description from user
    const description = await vscode.window.showInputBox({
        prompt: 'Describe what you want to do in the terminal',
        placeHolder: 'e.g., list all running processes, find large files, compress folder',
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return 'Please enter a description';
            }
            return null;
        }
    });

    if (!description) {
        return;
    }

    try {
        // Show progress
        const command = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Generating terminal command...',
            cancellable: false
        }, async () => {
            return await generateCommand(description);
        });

        // Show command and ask for confirmation
        const action = await vscode.window.showInformationMessage(
            `Generated command: ${command}`,
            { modal: true },
            'Run in Terminal',
            'Copy to Clipboard',
            'Cancel'
        );

        if (action === 'Run in Terminal') {
            await executeInTerminal(command);
        } else if (action === 'Copy to Clipboard') {
            await vscode.env.clipboard.writeText(command);
            vscode.window.showInformationMessage('Command copied to clipboard');
        }

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to generate command: ${error}`);
    }
}

/**
 * Generate command using AI
 */
async function generateCommand(description: string): Promise<string> {
    const aiProvider = createAIProviderAdapter();

    // Detect OS
    const platform = process.platform;
    const osName = platform === 'win32' ? 'Windows (PowerShell)' :
        platform === 'darwin' ? 'macOS (bash/zsh)' :
            'Linux (bash)';

    const prompt = `Generate a terminal command for ${osName} to: ${description}

Requirements:
1. Provide ONLY the command, no explanations
2. Use safe, non-destructive commands when possible
3. If the task requires multiple steps, provide a single compound command using && or ;
4. For Windows, use PowerShell syntax
5. For Unix-like systems, use bash/zsh syntax

Generate ONLY the command:`;

    try {
        const response = await aiProvider.generateCode(prompt);
        // Clean up the response - remove markdown code blocks if present
        let command = response.trim();
        command = command.replace(/^```[\w]*\n?/gm, '').replace(/\n?```$/gm, '');
        return command.trim();
    } catch (error) {
        throw new Error(`AI generation failed: ${error}`);
    }
}

/**
 * Execute command in terminal
 */
async function executeInTerminal(command: string): Promise<void> {
    // Get or create terminal
    let terminal = vscode.window.activeTerminal;

    if (!terminal) {
        terminal = vscode.window.createTerminal('AI Generated Command');
    }

    // Show terminal and send command
    terminal.show();
    terminal.sendText(command);

    vscode.window.showInformationMessage('Command sent to terminal');
}

/**
 * Run command and capture output (for future use)
 */
export async function runCommandWithOutput(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const { exec } = require('child_process');

        exec(command, { timeout: 30000 }, (error: any, stdout: string, stderr: string) => {
            if (error) {
                reject(stderr || error.message);
            } else {
                resolve(stdout);
            }
        });
    });
}
