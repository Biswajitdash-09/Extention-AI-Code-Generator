import * as vscode from 'vscode';
import { ProviderManager } from '../providers';
import { OllamaProvider } from '../providers/ollamaProvider';

export async function manageOllamaCommand(): Promise<void> {
    const config = vscode.workspace.getConfiguration('aiCodeGenerator');
    const baseUrl = config.get<string>('ollama.baseUrl') || 'http://localhost:11434';

    try {
        const response = await fetch(`${baseUrl}/api/tags`);
        if (!response.ok) {
            throw new Error('Failed to fetch Ollama models');
        }

        const data = await response.json() as any;
        const models = data.models || [];

        const items: vscode.QuickPickItem[] = [
            {
                label: '$(cloud-download) Pull New Model',
                description: 'Download a model from Ollama library',
                alwaysShow: true
            },
            {
                label: '',
                kind: vscode.QuickPickItemKind.Separator
            },
            ...models.map((m: any) => ({
                label: m.name,
                description: `${(m.size / 1024 / 1024 / 1024).toFixed(2)} GB`,
                detail: `Family: ${m.details?.family || 'unknown'} | Format: ${m.details?.format || 'unknown'}`
            }))
        ];

        const selected = await vscode.window.showQuickPick(items, {
            title: 'Manage Ollama Models',
            placeHolder: 'Select a model to use or pull a new one'
        });

        if (!selected) return;

        if (selected.label === '$(cloud-download) Pull New Model') {
            await pullOllamaModel(baseUrl);
        } else {
            await config.update('ollama.model', selected.label, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Ollama model set to: ${selected.label}`);
        }

    } catch (error) {
        vscode.window.showErrorMessage(`Ollama Error: ${error instanceof Error ? error.message : 'Is Ollama running?'}`);
    }
}

async function pullOllamaModel(baseUrl: string): Promise<void> {
    const modelName = await vscode.window.showInputBox({
        title: 'Pull Ollama Model',
        prompt: 'Enter the model name to pull (e.g., codellama, llama3, mistral)',
        placeHolder: 'model-name'
    });

    if (!modelName) return;

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Ollama: Pulling ${modelName}`,
        cancellable: true
    }, async (progress, token) => {
        try {
            const response = await fetch(`${baseUrl}/api/pull`, {
                method: 'POST',
                body: JSON.stringify({ name: modelName, stream: true })
            });

            if (!response.ok) throw new Error(`Failed to pull model: ${response.statusText}`);

            const reader = response.body?.getReader();
            if (!reader) throw new Error('Failed to get reader');

            const decoder = new TextDecoder();
            while (true) {
                if (token.isCancellationRequested) {
                    reader.cancel();
                    break;
                }

                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (!line.trim()) continue;
                    const data = JSON.parse(line);
                    if (data.status === 'downloading' && data.total) {
                        const percent = Math.round((data.completed / data.total) * 100);
                        progress.report({ message: `${data.status}: ${percent}%`, increment: 0 });
                    } else {
                        progress.report({ message: data.status });
                    }
                }
            }

            vscode.window.showInformationMessage(`Successfully pulled model: ${modelName}`);

        } catch (error) {
            vscode.window.showErrorMessage(`Pull failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });
}
