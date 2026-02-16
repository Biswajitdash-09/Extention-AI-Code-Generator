/**
 * Chat Focus Commands
 * Commands for focusing and managing chat view
 */

import * as vscode from 'vscode';

/**
 * Focus chat input command (Ctrl+Shift+A)
 */
export async function focusChatInputCommand(): Promise<void> {
    try {
        // Focus the chat view
        await vscode.commands.executeCommand('aiCodeGenerator.chatView.focus');

        // Note: The actual input focus needs to be handled by the webview
        // We'll send a message to the webview to focus the input
        // This requires the ChatViewProvider to listen for this message

        vscode.window.showInformationMessage('Chat view focused');
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to focus chat: ${error}`);
    }
}

/**
 * New chat command (Alt+Ctrl+C)
 */
export async function newChatCommand(): Promise<void> {
    try {
        // Focus the chat view first
        await vscode.commands.executeCommand('aiCodeGenerator.chatView.focus');

        // Show confirmation
        const action = await vscode.window.showInformationMessage(
            'Start a new chat session?',
            'Yes',
            'No'
        );

        if (action === 'Yes') {
            // Clear chat history (this would need to be implemented in ChatViewProvider)
            // For now, just show a message
            vscode.window.showInformationMessage('New chat session started');

            // TODO: Send message to webview to clear chat
            // This requires updating ChatViewProvider to handle 'newChat' message
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to start new chat: ${error}`);
    }
}

/**
 * Accept current suggestion (Alt+A)
 * This is an alternative keybinding to Tab
 */
export async function acceptSuggestionCommand(): Promise<void> {
    // Delegate to the existing ghost command
    await vscode.commands.executeCommand('ai-code-generator.ghost.applyCurrentSuggestion');
}

/**
 * Reject current suggestion (Alt+R)
 */
export async function rejectSuggestionCommand(): Promise<void> {
    // Delegate to the existing ghost cancel command
    await vscode.commands.executeCommand('ai-code-generator.ghost.cancelSuggestions');
}

/**
 * Accept all suggestions (Cmd+Alt+A / Ctrl+Alt+A)
 */
export async function acceptAllSuggestionsCommand(): Promise<void> {
    // Delegate to the existing ghost command
    await vscode.commands.executeCommand('ai-code-generator.ghost.applyAllSuggestions');
}

/**
 * Reject all suggestions (Cmd+Alt+R / Ctrl+Alt+R)
 */
export async function rejectAllSuggestionsCommand(): Promise<void> {
    // Same as reject current - cancels all suggestions
    await vscode.commands.executeCommand('ai-code-generator.ghost.cancelSuggestions');
}
