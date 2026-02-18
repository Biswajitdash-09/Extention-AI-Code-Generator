import * as vscode from 'vscode';
import { ProviderManager } from '../providers';
import { FileSystemUtils } from '../utils';
import { PROVIDER_INFO, ProviderType } from '../types';
import { HistoryManager } from '../services/historyManager';
import { HistoryTreeProvider } from '../views/historyView';
import { AuthManager } from '../services/authManager';

let historyManager: HistoryManager | undefined;
let historyTreeProvider: HistoryTreeProvider | undefined;
let authManager: AuthManager | undefined;

export function setHistoryServices(manager: HistoryManager, provider: HistoryTreeProvider) {
    historyManager = manager;
    historyTreeProvider = provider;
}

export function setAuthManager(manager: AuthManager) {
    authManager = manager;
}


/**
 * Handle the "AI: Generate Project from Task" command
 */
export async function generateProjectCommand(): Promise<void> {
    try {
        // Get workspace root or ask user to select folder
        const workspaceRoot = await FileSystemUtils.getWorkspaceRoot();

        if (!workspaceRoot) {
            vscode.window.showWarningMessage('No folder selected. Please select a folder to generate the project in.');
            return;
        }

        // Check Authentication
        if (!authManager?.isAuthenticated) {
            const loginAction = 'Login / Sign Up';
            const result = await vscode.window.showWarningMessage(
                'Authentication required. Please login to generate projects.',
                loginAction
            );
            if (result === loginAction) {
                vscode.commands.executeCommand('ai-code-generator.login');
            }
            return;
        }

        // Get task description from user
        const taskDescription = await vscode.window.showInputBox({
            placeHolder: 'e.g., Create a React login page with form validation',
            prompt: 'Describe the project you want to generate',
            title: 'CodeForge AI',
            ignoreFocusOut: true
        });

        if (!taskDescription) {
            return; // User cancelled
        }

        // Get the configured provider
        const provider = ProviderManager.getProvider();
        const validation = provider.validate();

        if (!validation.valid) {
            const setupAction = 'Open Settings';
            const result = await vscode.window.showErrorMessage(
                validation.error || 'Provider configuration error',
                setupAction
            );

            if (result === setupAction) {
                vscode.commands.executeCommand('workbench.action.openSettings', 'aiCodeGenerator');
            }
            return;
        }

        // Show progress
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `CodeForge AI (${provider.name})`,
                cancellable: false
            },
            async (progress) => {
                // Generate project structure via AI
                progress.report({ message: 'Generating project structure...', increment: 0 });

                const result = await provider.generateProject(taskDescription);

                if (!result.success || !result.projectStructure) {
                    vscode.window.showErrorMessage(`Generation failed: ${result.error}`);
                    return;
                }

                const providerConfig = vscode.workspace.getConfiguration('aiCodeGenerator');
                let model = 'unknown';
                if (provider.name.includes('OpenAI')) model = providerConfig.get('openai.model') || 'gpt-4o-mini';
                else if (provider.name.includes('Gemini')) model = providerConfig.get('gemini.model') || 'gemini-1.5-flash';
                else if (provider.name.includes('Groq')) model = providerConfig.get('groq.model') || 'llama-3.3-70b';
                else if (provider.name.includes('Ollama')) model = providerConfig.get('ollama.model') || 'codellama';

                await applyProjectStructure(workspaceRoot, result.projectStructure, {
                    prompt: taskDescription,
                    provider: provider.name,
                    model: model
                }, progress);
            }
        );

    } catch (error) {
        vscode.window.showErrorMessage(
            `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
        );
    }
}

/**
 * Apply a project structure to the filesystem
 */
export async function applyProjectStructure(
    workspaceRoot: string,
    projectStructure: any,
    metadata: { prompt: string; provider: string; model: string },
    progress?: vscode.Progress<{ message?: string; increment?: number }>
): Promise<void> {
    try {
        let createResult;
        
        if (progress) {
            progress.report({ message: 'Creating files...', increment: 50 });
            createResult = await FileSystemUtils.createProjectStructure(
                workspaceRoot,
                projectStructure,
                progress
            );
        } else {
            createResult = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "CodeForge AI",
                cancellable: false
            }, async (p) => {
                p.report({ message: 'Creating files...' });
                return await FileSystemUtils.createProjectStructure(
                    workspaceRoot,
                    projectStructure,
                    p
                );
            });
        }

        if (!createResult.success) {
            const errorMsg = `File creation failed: ${createResult.error}`;
            vscode.window.showErrorMessage(errorMsg);
            console.error(errorMsg);
            return;
        }

        // Small delay to allow VS Code to detect new files
        await new Promise(resolve => setTimeout(resolve, 500));

        // Open main file in editor
        try {
            await FileSystemUtils.openFirstFile(workspaceRoot, projectStructure);
        } catch (e) {
            console.warn('Could not open first file automatically:', e);
        }

        // Show success message
        const description = projectStructure.description || 'Project generated';
        const successMsg = `✅ ${description} (${createResult.filesCreated} files created)`;
        vscode.window.showInformationMessage(successMsg);
        console.log(successMsg);

        // Add to history
        if (historyManager) {
            await historyManager.addEntry({
                prompt: metadata.prompt,
                provider: metadata.provider,
                model: metadata.model,
                targetFolder: workspaceRoot,
                projectName: projectStructure.projectName,
                fileCount: createResult.filesCreated
            });
            historyTreeProvider?.refresh();
        }
    } catch (error) {
        const errMsg = `Failed to apply project: ${error instanceof Error ? error.message : 'Unknown error'}`;
        vscode.window.showErrorMessage(errMsg);
        console.error(errMsg);
    }
}

/**
 * Handle the "AI: Select AI Model" command
 */
export async function selectModelCommand(): Promise<void> {
    const selectedType = await ProviderManager.selectProvider();

    if (selectedType) {
        const config = vscode.workspace.getConfiguration('aiCodeGenerator');
        await config.update('provider', selectedType, vscode.ConfigurationTarget.Global);

        const info = PROVIDER_INFO[selectedType];
        vscode.window.showInformationMessage(`Switched to ${info.name}`);

        // Check if API key is needed and not set
        if (info.requiresApiKey) {
            const apiKey = config.get<string>(`${selectedType}.apiKey`);
            if (!apiKey) {
                const setKey = 'Set API Key';
                const result = await vscode.window.showWarningMessage(
                    `${info.name} requires an API key. Would you like to set it now?`,
                    setKey
                );
                if (result === setKey) {
                    vscode.commands.executeCommand('workbench.action.openSettings', `aiCodeGenerator.${selectedType}.apiKey`);
                }
            }
        }
    }
}
