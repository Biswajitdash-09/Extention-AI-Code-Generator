import * as vscode from 'vscode';
import { generateProjectCommand, selectModelCommand, setHistoryServices, setAuthManager } from './commands/generateProject';
import { loginCommand } from './commands/auth';
import { HistoryManager } from './services/historyManager';
import { registerHistoryCommands } from './views/historyView';
import { AuthManager } from './services/authManager';
import { manageOllamaCommand } from './commands/ollama';
import { ChatViewProvider } from './views/chatView';
import { refactorSelectionCommand, addDocumentationCommand, optimizeCodeCommand, explainCodeCommand } from './commands/refactor';
import { GhostProvider } from './features/ghost/ghostProvider';
import { createAIProviderAdapter } from './features/ghost/aiProviderAdapter';
import { explainCodeContextCommand, fixCodeContextCommand, improveCodeContextCommand, addToContextCommand } from './commands/contextMenu';
import { terminalAddToContextCommand, terminalFixCommandCommand, terminalExplainCommandCommand } from './commands/terminalContext';
import { generateCommitMessageCommand } from './commands/gitCommit';
import { generateTerminalCommandCommand as genTermCmd } from './commands/terminalCommand';
import { focusChatInputCommand, newChatCommand, acceptSuggestionCommand, rejectSuggestionCommand, acceptAllSuggestionsCommand, rejectAllSuggestionsCommand } from './commands/chatFocus';
import { AICodeActionProvider, applyQuickFixCommand, refactorCodeCommand } from './providers/codeActionProvider';
import { DiffViewProvider, diffViewProvider } from './features/diff/diffViewProvider';
import { IndexingService } from './services/indexingService';
import { UsageTracker } from './services/usageTracker';

/**
 * Called when the extension is activated
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('AI Code Generator extension is now active!');

    // Initialize Services
    const historyManager = new HistoryManager(context);
    const authManager = new AuthManager(context);
    const usageTracker = new UsageTracker(context);

    // Views
    const treeProvider = registerHistoryCommands(context, historyManager);

    const chatProvider = new ChatViewProvider(context.extensionUri, historyManager, usageTracker);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, chatProvider)
    );

    // Initialize Ghost Provider for inline suggestions
    const ghostProvider = new GhostProvider(context);
    const aiAdapter = createAIProviderAdapter();
    ghostProvider.setAIProvider(aiAdapter);
    context.subscriptions.push(ghostProvider);

    // Register Code Action Provider for quick fixes
    const codeActionProvider = new AICodeActionProvider();
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            { scheme: 'file' }, // Apply to all file schemes
            codeActionProvider,
            {
                providedCodeActionKinds: AICodeActionProvider.providedCodeActionKinds
            }
        )
    );

    // Register Diff View Provider
    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider(
            DiffViewProvider.scheme,
            diffViewProvider
        )
    );

    // Pass services to command handler
    setHistoryServices(historyManager, treeProvider);
    setAuthManager(authManager);

    // Register Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('ai-code-generator.generateProject', generateProjectCommand),
        vscode.commands.registerCommand('ai-code-generator.selectModel', selectModelCommand),
        vscode.commands.registerCommand('ai-code-generator.manageOllama', manageOllamaCommand),
        vscode.commands.registerCommand('ai-code-generator.refactorSelection', refactorSelectionCommand),
        vscode.commands.registerCommand('ai-code-generator.addDocumentation', addDocumentationCommand),
        vscode.commands.registerCommand('ai-code-generator.optimizeCode', optimizeCodeCommand),
        vscode.commands.registerCommand('ai-code-generator.explainCode', explainCodeCommand),
        vscode.commands.registerCommand('ai-code-generator.login', () => loginCommand(context.extensionUri, authManager)),
        // Context menu commands
        vscode.commands.registerCommand('ai-code-generator.explainCodeContext', explainCodeContextCommand),
        vscode.commands.registerCommand('ai-code-generator.fixCodeContext', fixCodeContextCommand),
        vscode.commands.registerCommand('ai-code-generator.improveCodeContext', improveCodeContextCommand),
        vscode.commands.registerCommand('ai-code-generator.addToContext', addToContextCommand),
        // Terminal context menu commands
        vscode.commands.registerCommand('ai-code-generator.terminalAddToContext', terminalAddToContextCommand),
        vscode.commands.registerCommand('ai-code-generator.terminalFixCommand', terminalFixCommandCommand),
        vscode.commands.registerCommand('ai-code-generator.terminalExplainCommand', terminalExplainCommandCommand),
        vscode.commands.registerCommand('ai-code-generator.generateTerminalCommand', genTermCmd),
        // Git integration commands
        vscode.commands.registerCommand('ai-code-generator.generateCommitMessage', generateCommitMessageCommand),
        // Chat focus and keybinding commands
        vscode.commands.registerCommand('ai-code-generator.focusChatInput', focusChatInputCommand),
        vscode.commands.registerCommand('ai-code-generator.newChat', newChatCommand),
        vscode.commands.registerCommand('ai-code-generator.acceptSuggestion', acceptSuggestionCommand),
        vscode.commands.registerCommand('ai-code-generator.rejectSuggestion', rejectSuggestionCommand),
        vscode.commands.registerCommand('ai-code-generator.acceptAllSuggestions', acceptAllSuggestionsCommand),
        vscode.commands.registerCommand('ai-code-generator.rejectAllSuggestions', rejectAllSuggestionsCommand),
        // Indexing command
        vscode.commands.registerCommand('ai-code-generator.indexWorkspace', async () => {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Building semantic code index...',
                cancellable: false
            }, (progress) => {
                return IndexingService.indexWorkspace(progress);
            });
        }),
        // Code action commands
        vscode.commands.registerCommand('ai-code-generator.applyQuickFix', applyQuickFixCommand),
        vscode.commands.registerCommand('ai-code-generator.refactorCode', refactorCodeCommand)
    );

    // Show welcome message on first activation
    const hasShownWelcome = context.globalState.get('hasShownWelcome');
    if (!hasShownWelcome) {
        showWelcomeMessage();
        context.globalState.update('hasShownWelcome', true);
    }
}

/**
 * Show welcome message with setup instructions
 */
async function showWelcomeMessage() {
    const message = 'AI Code Generator installed! Configure your preferred AI provider to get started.';
    const configureAction = 'Configure';

    const result = await vscode.window.showInformationMessage(message, configureAction);

    if (result === configureAction) {
        vscode.commands.executeCommand('workbench.action.openSettings', 'aiCodeGenerator');
    }
}

/**
 * Called when the extension is deactivated
 */
export function deactivate() {
    console.log('AI Code Generator extension is now deactivated.');
}
