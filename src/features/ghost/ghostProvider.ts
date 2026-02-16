/**
 * Ghost Provider
 * Main provider for inline code suggestions
 */

import * as vscode from 'vscode';
import { SuggestionManager } from './suggestionManager';
import { showSuggestionDiffCommand } from '../../commands/showDiff';

export class GhostProvider {
    private suggestionManager: SuggestionManager;
    private disposables: vscode.Disposable[] = [];

    constructor(private context: vscode.ExtensionContext) {
        this.suggestionManager = new SuggestionManager(context);
        this.registerCommands();
    }

    /**
     * Set the AI provider for generating suggestions
     */
    public setAIProvider(provider: any): void {
        this.suggestionManager.setAIProvider(provider);
    }

    /**
     * Register all Ghost commands
     */
    private registerCommands(): void {
        // Quick Task (Ctrl+I) - Prompt for code suggestion
        this.disposables.push(
            vscode.commands.registerCommand('ai-code-generator.ghost.promptCodeSuggestion', async () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showErrorMessage('No active editor');
                    return;
                }

                const prompt = await vscode.window.showInputBox({
                    prompt: 'Describe what you want to do...',
                    placeHolder: 'e.g., add error handling, create a helper function',
                    title: 'Quick Task'
                });

                if (prompt) {
                    await this.suggestionManager.generateQuickSuggestion(editor, prompt);
                }
            })
        );

        // Smart Inline Task (Ctrl+L) - Generate based on context
        this.disposables.push(
            vscode.commands.registerCommand('ai-code-generator.ghost.generateSuggestions', async () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showErrorMessage('No active editor');
                    return;
                }

                await this.suggestionManager.generateSmartSuggestion(editor);
            })
        );

        // Apply Current Suggestion (Tab)
        this.disposables.push(
            vscode.commands.registerCommand('ai-code-generator.ghost.applyCurrentSuggestion', async () => {
                await this.suggestionManager.applyCurrentSuggestion();
            })
        );

        // Apply All Suggestions (Shift+Tab)
        this.disposables.push(
            vscode.commands.registerCommand('ai-code-generator.ghost.applyAllSuggestions', async () => {
                await this.suggestionManager.applyAllSuggestions();
            })
        );

        // Cancel Suggestions (Escape)
        this.disposables.push(
            vscode.commands.registerCommand('ai-code-generator.ghost.cancelSuggestions', () => {
                this.suggestionManager.cancelSuggestions();
            })
        );

        // Go to Next Suggestion (Down Arrow)
        this.disposables.push(
            vscode.commands.registerCommand('ai-code-generator.ghost.goToNextSuggestion', () => {
                this.suggestionManager.goToNextSuggestion();
            })
        );

        // Go to Previous Suggestion (Up Arrow)
        this.disposables.push(
            vscode.commands.registerCommand('ai-code-generator.ghost.goToPreviousSuggestion', () => {
                this.suggestionManager.goToPreviousSuggestion();
            })
        );

        // Show Suggestion Diff
        this.disposables.push(
            vscode.commands.registerCommand('ai-code-generator.showSuggestionDiff', () => {
                showSuggestionDiffCommand(this.suggestionManager);
            })
        );
    }

    /**
     * Dispose of all resources
     */
    public dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.suggestionManager.dispose();
    }
}
