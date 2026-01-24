import * as vscode from 'vscode';
import { ProjectStructure } from '../types';

export interface HistoryItem {
    id: string;
    timestamp: number;
    prompt: string;
    provider: string;
    model: string;
    targetFolder: string;
    projectName?: string;
    fileCount: number;
}

export class HistoryManager {
    private static readonly STORAGE_KEY = 'aiCodeGenerator.history';
    private static readonly MAX_ITEMS = 50;

    constructor(private context: vscode.ExtensionContext) { }

    /**
     * Add an entry to history
     */
    async addEntry(item: Omit<HistoryItem, 'id' | 'timestamp'>): Promise<void> {
        const history = this.getHistory();

        const newEntry: HistoryItem = {
            ...item,
            id: crypto.randomUUID(),
            timestamp: Date.now()
        };

        history.unshift(newEntry);

        // Trim history
        if (history.length > HistoryManager.MAX_ITEMS) {
            history.length = HistoryManager.MAX_ITEMS;
        }

        await this.context.globalState.update(HistoryManager.STORAGE_KEY, history);
    }

    /**
     * Get all history items
     */
    getHistory(): HistoryItem[] {
        return this.context.globalState.get<HistoryItem[]>(HistoryManager.STORAGE_KEY) || [];
    }

    /**
     * Clear all history
     */
    async clearHistory(): Promise<void> {
        await this.context.globalState.update(HistoryManager.STORAGE_KEY, []);
    }

    /**
     * Delete a specific item
     */
    async deleteItem(id: string): Promise<void> {
        const history = this.getHistory();
        const newHistory = history.filter(item => item.id !== id);
        await this.context.globalState.update(HistoryManager.STORAGE_KEY, newHistory);
    }
}
