/**
 * Ghost Inline Suggestion System Types
 * Provides inline code suggestions similar to GitHub Copilot
 */

import * as vscode from 'vscode';

export interface Suggestion {
    id: string;
    text: string;
    range: vscode.Range;
    type: 'quick' | 'smart'; // quick = Ctrl+I, smart = Ctrl+L
    timestamp: number;
}

export interface SuggestionState {
    suggestions: Suggestion[];
    currentIndex: number;
    isProcessing: boolean;
    activeEditor: vscode.TextEditor | undefined;
}

export interface GhostDecoration {
    decoration: vscode.TextEditorDecorationType;
    range: vscode.Range;
}

export interface SuggestionRequest {
    prompt: string;
    context: {
        fileName: string;
        language: string;
        cursorPosition: vscode.Position;
        selectedText: string;
        surroundingCode: string;
    };
}
