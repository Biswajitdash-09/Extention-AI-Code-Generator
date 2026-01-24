import * as vscode from 'vscode';
import * as path from 'path';
import { HistoryManager, HistoryItem } from '../services/historyManager';
import { formatDistanceToNow } from 'date-fns'; // We'll need to install this or use a simple formatter

export class HistoryTreeProvider implements vscode.TreeDataProvider<HistoryItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<HistoryItem | undefined | null | void> = new vscode.EventEmitter<HistoryItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<HistoryItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private historyManager: HistoryManager) { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: HistoryItem): vscode.TreeItem {
        const date = new Date(element.timestamp);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString();

        const treeItem = new vscode.TreeItem(element.prompt);
        treeItem.description = `${element.fileCount} files • ${element.provider} • ${timeStr}`;
        treeItem.tooltip = `Project: ${element.projectName || 'Unnamed'}\nPath: ${element.targetFolder}\nTime: ${dateStr} ${timeStr}\nModel: ${element.model}`;
        treeItem.contextValue = 'historyItem';

        // Icon based on provider
        treeItem.iconPath = new vscode.ThemeIcon('history');

        return treeItem;
    }

    getChildren(element?: HistoryItem): Thenable<HistoryItem[]> {
        if (element) {
            return Promise.resolve([]);
        }
        return Promise.resolve(this.historyManager.getHistory());
    }
}

/**
 * Register history commands
 */
export function registerHistoryCommands(context: vscode.ExtensionContext, historyManager: HistoryManager) {
    const treeProvider = new HistoryTreeProvider(historyManager);

    vscode.window.createTreeView('aiCodeGenerator.history', {
        treeDataProvider: treeProvider
    });

    context.subscriptions.push(
        vscode.commands.registerCommand('ai-code-generator.refreshHistory', () => {
            treeProvider.refresh();
        }),
        vscode.commands.registerCommand('ai-code-generator.clearHistory', async () => {
            const result = await vscode.window.showWarningMessage(
                'Are you sure you want to clear your project generation history?',
                'Yes', 'No'
            );
            if (result === 'Yes') {
                await historyManager.clearHistory();
                treeProvider.refresh();
                vscode.window.showInformationMessage('History cleared');
            }
        }),
        vscode.commands.registerCommand('ai-code-generator.openHistoryItem', async (item: HistoryItem) => {
            // Option to open the folder
            const uri = vscode.Uri.file(item.targetFolder);
            vscode.commands.executeCommand('vscode.openFolder', uri, true); // true = new window
        })
    );

    return treeProvider;
}
