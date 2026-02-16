/**
 * Suggestion Manager
 * Manages the lifecycle of suggestions: generate, accept, reject, navigate
 */

import * as vscode from 'vscode';
import { Suggestion, SuggestionState, SuggestionRequest } from './types';
import { SuggestionDecorator } from './suggestionDecorator';
import { nanoid } from 'nanoid';

export class SuggestionManager {
    private state: SuggestionState = {
        suggestions: [],
        currentIndex: 0,
        isProcessing: false,
        activeEditor: undefined
    };

    private decorator: SuggestionDecorator;
    private aiProvider: any; // Will be injected

    constructor(private context: vscode.ExtensionContext) {
        this.decorator = new SuggestionDecorator();
    }

    /**
     * Set the AI provider for generating suggestions
     */
    public setAIProvider(provider: any): void {
        this.aiProvider = provider;
    }

    /**
     * Generate suggestions based on user prompt (Quick Task - Ctrl+I)
     */
    public getState(): SuggestionState {
        return this.state;
    }

    public async generateQuickSuggestion(editor: vscode.TextEditor, prompt: string): Promise<void> {
        this.state.isProcessing = true;
        this.updateContext();

        try {
            const request = this.buildSuggestionRequest(editor, prompt);
            const suggestionText = await this.callAI(request, 'quick');

            if (suggestionText) {
                const suggestion: Suggestion = {
                    id: nanoid(),
                    text: suggestionText,
                    range: new vscode.Range(editor.selection.active, editor.selection.active),
                    type: 'quick',
                    timestamp: Date.now()
                };

                this.state.suggestions = [suggestion];
                this.state.currentIndex = 0;
                this.state.activeEditor = editor;

                this.decorator.renderSuggestion(editor, suggestion);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to generate suggestion: ${error}`);
        } finally {
            this.state.isProcessing = false;
            this.updateContext();
        }
    }

    /**
     * Generate smart suggestions based on context (Smart Inline - Ctrl+L)
     */
    public async generateSmartSuggestion(editor: vscode.TextEditor): Promise<void> {
        this.state.isProcessing = true;
        this.updateContext();

        try {
            const request = this.buildSuggestionRequest(editor, 'Generate code based on context');
            const suggestionText = await this.callAI(request, 'smart');

            if (suggestionText) {
                const suggestion: Suggestion = {
                    id: nanoid(),
                    text: suggestionText,
                    range: new vscode.Range(editor.selection.active, editor.selection.active),
                    type: 'smart',
                    timestamp: Date.now()
                };

                this.state.suggestions = [suggestion];
                this.state.currentIndex = 0;
                this.state.activeEditor = editor;

                this.decorator.renderSuggestion(editor, suggestion);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to generate suggestion: ${error}`);
        } finally {
            this.state.isProcessing = false;
            this.updateContext();
        }
    }

    /**
     * Apply the current suggestion to the editor
     */
    public async applyCurrentSuggestion(): Promise<void> {
        if (!this.hasSuggestions() || !this.state.activeEditor) {
            return;
        }

        const suggestion = this.state.suggestions[this.state.currentIndex];
        const editor = this.state.activeEditor;

        await editor.edit(editBuilder => {
            editBuilder.insert(suggestion.range.start, suggestion.text);
        });

        this.clearSuggestions();
    }

    /**
     * Apply all suggestions to the editor
     */
    public async applyAllSuggestions(): Promise<void> {
        if (!this.hasSuggestions() || !this.state.activeEditor) {
            return;
        }

        const editor = this.state.activeEditor;

        await editor.edit(editBuilder => {
            for (const suggestion of this.state.suggestions) {
                editBuilder.insert(suggestion.range.start, suggestion.text);
            }
        });

        this.clearSuggestions();
    }

    /**
     * Navigate to the next suggestion
     */
    public goToNextSuggestion(): void {
        if (!this.hasSuggestions() || !this.state.activeEditor) {
            return;
        }

        this.state.currentIndex = (this.state.currentIndex + 1) % this.state.suggestions.length;
        const suggestion = this.state.suggestions[this.state.currentIndex];
        this.decorator.highlightSuggestion(this.state.activeEditor, suggestion);
    }

    /**
     * Navigate to the previous suggestion
     */
    public goToPreviousSuggestion(): void {
        if (!this.hasSuggestions() || !this.state.activeEditor) {
            return;
        }

        this.state.currentIndex =
            (this.state.currentIndex - 1 + this.state.suggestions.length) % this.state.suggestions.length;
        const suggestion = this.state.suggestions[this.state.currentIndex];
        this.decorator.highlightSuggestion(this.state.activeEditor, suggestion);
    }

    /**
     * Cancel all suggestions
     */
    public cancelSuggestions(): void {
        this.clearSuggestions();
    }

    /**
     * Check if there are active suggestions
     */
    public hasSuggestions(): boolean {
        return this.state.suggestions.length > 0;
    }

    /**
     * Check if processing
     */
    public isProcessing(): boolean {
        return this.state.isProcessing;
    }

    /**
     * Clear all suggestions and decorations
     */
    private clearSuggestions(): void {
        if (this.state.activeEditor) {
            this.decorator.clearDecorations(this.state.activeEditor);
        }
        this.state.suggestions = [];
        this.state.currentIndex = 0;
        this.state.activeEditor = undefined;
        this.updateContext();
    }

    /**
     * Build suggestion request with context
     */
    private buildSuggestionRequest(editor: vscode.TextEditor, prompt: string): SuggestionRequest {
        const document = editor.document;
        const position = editor.selection.active;
        const selectedText = document.getText(editor.selection);

        // Get surrounding code (10 lines before and after)
        const startLine = Math.max(0, position.line - 10);
        const endLine = Math.min(document.lineCount - 1, position.line + 10);
        const surroundingRange = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
        const surroundingCode = document.getText(surroundingRange);

        return {
            prompt,
            context: {
                fileName: document.fileName,
                language: document.languageId,
                cursorPosition: position,
                selectedText,
                surroundingCode
            }
        };
    }

    /**
     * Call AI provider to generate suggestion
     */
    private async callAI(request: SuggestionRequest, type: 'quick' | 'smart'): Promise<string> {
        if (!this.aiProvider) {
            throw new Error('AI provider not configured');
        }

        const systemPrompt = type === 'quick'
            ? 'You are a code completion assistant. Generate concise code based on the user prompt.'
            : 'You are a smart code completion assistant. Analyze the surrounding code and generate contextually appropriate code.';

        const userPrompt = `
${systemPrompt}

File: ${request.context.fileName}
Language: ${request.context.language}

Surrounding Code:
\`\`\`${request.context.language}
${request.context.surroundingCode}
\`\`\`

${request.context.selectedText ? `Selected Text:\n${request.context.selectedText}\n` : ''}

User Request: ${request.prompt}

Generate ONLY the code to insert at the cursor position. Do not include explanations or markdown formatting.
`;

        // Call the AI provider (this will use the existing provider infrastructure)
        const response = await this.aiProvider.generateCode(userPrompt);
        return response.trim();
    }

    /**
     * Update VS Code context for keybinding conditions
     */
    private updateContext(): void {
        vscode.commands.executeCommand('setContext', 'ghost.hasSuggestions', this.hasSuggestions());
        vscode.commands.executeCommand('setContext', 'ghost.isProcessing', this.isProcessing());
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.decorator.dispose();
    }
}
