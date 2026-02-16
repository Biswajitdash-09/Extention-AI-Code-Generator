/**
 * Git Commit Message Generation
 * Generates AI-powered commit messages based on staged changes
 */

import * as vscode from 'vscode';
import simpleGit, { SimpleGit } from 'simple-git';
import { createAIProviderAdapter } from '../features/ghost/aiProviderAdapter';

/**
 * Generate commit message command
 */
export async function generateCommitMessageCommand(): Promise<void> {
    try {
        // Get workspace folder
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        // Initialize git
        const git: SimpleGit = simpleGit(workspaceFolder.uri.fsPath);

        // Check if it's a git repository
        const isRepo = await git.checkIsRepo();
        if (!isRepo) {
            vscode.window.showErrorMessage('Not a git repository');
            return;
        }

        // Get staged changes
        const status = await git.status();

        if (status.staged.length === 0) {
            vscode.window.showWarningMessage('No staged changes. Stage files first with git add.');
            return;
        }

        // Get diff of staged changes
        const diff = await git.diff(['--cached']);

        if (!diff) {
            vscode.window.showWarningMessage('No changes to commit');
            return;
        }

        // Show progress
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Generating commit message...',
            cancellable: false
        }, async () => {
            // Generate commit message using AI
            const commitMessage = await generateCommitMessage(diff, status.staged);

            // Insert into SCM input box
            await insertCommitMessage(commitMessage);

            vscode.window.showInformationMessage('Commit message generated!');
        });

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to generate commit message: ${error}`);
    }
}

/**
 * Generate commit message using AI
 */
async function generateCommitMessage(diff: string, stagedFiles: string[]): Promise<string> {
    const aiProvider = createAIProviderAdapter();

    // Build prompt
    const prompt = `Generate a concise, conventional commit message for these changes.

Staged files:
${stagedFiles.map(f => `- ${f}`).join('\n')}

Diff:
\`\`\`diff
${diff.substring(0, 3000)} ${diff.length > 3000 ? '...(truncated)' : ''}
\`\`\`

Follow these rules:
1. Use conventional commit format: type(scope): description
2. Types: feat, fix, docs, style, refactor, test, chore
3. Keep the first line under 72 characters
4. Add a blank line and detailed description if needed
5. Be specific about what changed and why

Generate ONLY the commit message, no explanations.`;

    try {
        const response = await aiProvider.generateCode(prompt);
        return response.trim();
    } catch (error) {
        throw new Error(`AI generation failed: ${error}`);
    }
}

/**
 * Insert commit message into SCM input box
 */
async function insertCommitMessage(message: string): Promise<void> {
    // Get the SCM API
    const scm = vscode.scm.inputBox;

    if (scm) {
        scm.value = message;
    } else {
        // Fallback: show in a dialog
        const action = await vscode.window.showInformationMessage(
            'Commit message generated:',
            { modal: true, detail: message },
            'Copy to Clipboard'
        );

        if (action === 'Copy to Clipboard') {
            await vscode.env.clipboard.writeText(message);
            vscode.window.showInformationMessage('Commit message copied to clipboard');
        }
    }
}
