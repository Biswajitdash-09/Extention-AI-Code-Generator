import * as vscode from 'vscode';
import { generateProjectCommand, selectModelCommand, setHistoryServices, setAuthManager } from './commands/generateProject';
import { loginCommand } from './commands/auth';
import { HistoryManager } from './services/historyManager';
import { registerHistoryCommands } from './views/historyView';
import { AuthManager } from './services/authManager';
import { manageOllamaCommand } from './commands/ollama';
import { ChatViewProvider } from './views/chatView';

/**
 * Called when the extension is activated
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('AI Code Generator extension is now active!');

    // Initialize Services
    const historyManager = new HistoryManager(context);
    const authManager = new AuthManager(context);

    // Views
    const treeProvider = registerHistoryCommands(context, historyManager);

    const chatProvider = new ChatViewProvider(context.extensionUri, historyManager);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, chatProvider)
    );

    // Pass services to command handler
    setHistoryServices(historyManager, treeProvider);
    setAuthManager(authManager);

    // Register Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('ai-code-generator.generateProject', generateProjectCommand),
        vscode.commands.registerCommand('ai-code-generator.selectModel', selectModelCommand),
        vscode.commands.registerCommand('ai-code-generator.manageOllama', manageOllamaCommand),
        vscode.commands.registerCommand('ai-code-generator.login', () => loginCommand(context.extensionUri, authManager))
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
