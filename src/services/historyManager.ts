import * as vscode from 'vscode';
import { ProjectStructure } from '../types';
import { FirebaseService, FirebaseHistoryItem } from './firebaseService';
import { auth } from './firebaseService';

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

    constructor(private context: vscode.ExtensionContext) {
        // Initial sync if already logged in
        if (auth.currentUser) {
            this.syncFromFirebase();
        }

        // Listen for auth changes to sync
        auth.onAuthStateChanged((user: any) => {
            if (user) {
                this.syncFromFirebase();
            }
        });
    }

    /**
     * Sync history from Firebase to local storage
     */
    async syncFromFirebase(): Promise<void> {
        if (!auth.currentUser) return;
        try {
            const firebaseHistory = await FirebaseService.getHistory(auth.currentUser.uid);
            if (firebaseHistory && firebaseHistory.length > 0) {
                const localHistory = this.getHistory();

                // Merge and deduplicate by timestamp
                const merged = [...localHistory];
                for (const item of firebaseHistory) {
                    if (!merged.some(m => m.timestamp === item.timestamp)) {
                        merged.push({
                            ...item,
                            id: crypto.randomUUID(),
                            targetFolder: '', // Folder info isn't in Firebase yet
                            fileCount: 0      // File count info isn't in Firebase yet
                        });
                    }
                }

                merged.sort((a, b) => b.timestamp - a.timestamp);
                await this.context.globalState.update(HistoryManager.STORAGE_KEY, merged.slice(0, HistoryManager.MAX_ITEMS));
            }
        } catch (error) {
            console.error('Failed to sync from Firebase:', error);
        }
    }

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

        // Sync with Firebase if logged in
        if (auth.currentUser) {
            await this.syncToFirebase(history);
        }
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
        if (auth.currentUser) {
            await FirebaseService.saveHistory(auth.currentUser.uid, []);
        }
    }

    /**
     * Delete a specific item
     */
    async deleteItem(id: string): Promise<void> {
        const history = this.getHistory();
        const newHistory = history.filter(item => item.id !== id);
        await this.context.globalState.update(HistoryManager.STORAGE_KEY, newHistory);

        if (auth.currentUser) {
            await this.syncToFirebase(newHistory);
        }
    }

    /**
     * Sync local history to Firebase
     */
    private async syncToFirebase(history: HistoryItem[]): Promise<void> {
        if (!auth.currentUser) return;

        const firebaseHistory: FirebaseHistoryItem[] = history.map(item => ({
            prompt: item.prompt,
            provider: item.provider,
            model: item.model,
            timestamp: item.timestamp,
            projectName: item.projectName
        }));

        await FirebaseService.saveHistory(auth.currentUser.uid, firebaseHistory);
    }
}
