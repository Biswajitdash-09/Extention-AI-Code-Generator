/**
 * Suggestion Decorator
 * Handles rendering of inline suggestions as ghost text in the editor
 */

import * as vscode from 'vscode';
import { Suggestion, GhostDecoration } from './types';

export class SuggestionDecorator {
    private decorationType: vscode.TextEditorDecorationType;
    private currentDecorations: GhostDecoration[] = [];

    constructor() {
        // Create decoration type for ghost text
        this.decorationType = vscode.window.createTextEditorDecorationType({
            after: {
                color: new vscode.ThemeColor('editorGhostText.foreground'),
                fontStyle: 'italic',
            },
            isWholeLine: false,
        });
    }

    /**
     * Render a suggestion as ghost text in the editor
     */
    public renderSuggestion(editor: vscode.TextEditor, suggestion: Suggestion): void {
        const decorations: vscode.DecorationOptions[] = [{
            range: suggestion.range,
            renderOptions: {
                after: {
                    contentText: suggestion.text,
                    color: new vscode.ThemeColor('editorGhostText.foreground'),
                }
            }
        }];

        editor.setDecorations(this.decorationType, decorations);

        this.currentDecorations.push({
            decoration: this.decorationType,
            range: suggestion.range
        });
    }

    /**
     * Clear all suggestion decorations
     */
    public clearDecorations(editor: vscode.TextEditor): void {
        editor.setDecorations(this.decorationType, []);
        this.currentDecorations = [];
    }

    /**
     * Highlight the current suggestion (when navigating with arrows)
     */
    public highlightSuggestion(editor: vscode.TextEditor, suggestion: Suggestion): void {
        // First clear existing decorations
        this.clearDecorations(editor);

        // Then render the highlighted suggestion
        this.renderSuggestion(editor, suggestion);

        // Move cursor to suggestion location
        editor.selection = new vscode.Selection(suggestion.range.start, suggestion.range.start);
        editor.revealRange(suggestion.range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    }

    /**
     * Dispose of decoration types
     */
    public dispose(): void {
        this.decorationType.dispose();
    }
}
