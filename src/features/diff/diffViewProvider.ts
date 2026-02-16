/**
 * Diff View Provider
 * Provides read-only content for diff comparisons
 */

import * as vscode from 'vscode';

/**
 * Provider for virtual documents used in diff views
 */
export class DiffViewProvider implements vscode.TextDocumentContentProvider {
    // Scheme for our virtual documents
    public static readonly scheme = 'ai-code-diff';

    // Event emitter for content changes
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    get onDidChange(): vscode.Event<vscode.Uri> {
        return this._onDidChange.event;
    }

    // Map to store content for URIs
    private contentMap = new Map<string, string>();

    /**
     * Provide content for the virtual document
     */
    provideTextDocumentContent(uri: vscode.Uri): string {
        return this.contentMap.get(uri.toString()) || '';
    }

    /**
     * Set content for a specific URI
     */
    public setContent(uri: vscode.Uri, content: string): void {
        this.contentMap.set(uri.toString(), content);
        this._onDidChange.fire(uri);
    }

    /**
     * Delete content for a URI (cleanup)
     */
    public deleteContent(uri: vscode.Uri): void {
        this.contentMap.delete(uri.toString());
    }
}

// Singleton instance
export const diffViewProvider = new DiffViewProvider();
