/**
 * Show Diff Command
 * Opens a diff view to compare current code with AI suggestion
 */

import * as vscode from 'vscode';
import { DiffViewProvider, diffViewProvider } from '../features/diff/diffViewProvider';
import { SuggestionManager } from '../features/ghost/suggestionManager';

/**
 * Command to show diff for the current suggestion
 */
export async function showSuggestionDiffCommand(suggestionManager: SuggestionManager): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }

    const state = suggestionManager.getState();
    if (!state.suggestions || state.suggestions.length === 0) {
        vscode.window.showInformationMessage('No active suggestions to compare');
        return;
    }

    const suggestion = state.suggestions[state.currentIndex];
    const document = editor.document;

    // Create virtual URI for the suggestion content
    // We construct the full file content with the suggestion applied
    const originalContent = document.getText();
    const suggestionContent =
        originalContent.substring(0, document.offsetAt(suggestion.range.start)) +
        suggestion.text +
        originalContent.substring(document.offsetAt(suggestion.range.end));

    // Create URI for the "after" view (suggested content)
    // We use the same path but with our custom scheme and a query param to ensure uniqueness
    const suggestionUri = convertToDiffUri(document.uri, 'Suggested Change');

    // Set the content in our provider
    diffViewProvider.setContent(suggestionUri, suggestionContent);

    try {
        // Open the diff editor
        // Left: Original document (live)
        // Right: Virtual document with suggestion (read-only)
        await vscode.commands.executeCommand(
            'vscode.diff',
            document.uri,
            suggestionUri,
            `Diff: Current vs Suggestion (${state.currentIndex + 1}/${state.suggestions.length})`
        );
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to open diff view: ${error}`);
    }
}

/**
 * Helper to create a diff URI
 */
function convertToDiffUri(originalUri: vscode.Uri, label: string): vscode.Uri {
    return originalUri.with({
        scheme: DiffViewProvider.scheme,
        query: JSON.stringify({ label, timestamp: Date.now() })
    });
}
