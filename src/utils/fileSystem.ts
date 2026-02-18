import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectStructure, ProjectFile } from '../types';

/**
 * Utility functions for file system operations
 */
export class FileSystemUtils {

    /**
     * Create all folders and files from a project structure
     */
    static async createProjectStructure(
        workspaceRoot: string,
        structure: ProjectStructure,
        progress?: vscode.Progress<{ message?: string; increment?: number }>
    ): Promise<{ success: boolean; filesCreated: number; error?: string }> {

        let filesCreated = 0;
        const totalItems = (structure.folders?.length || 0) + (structure.files?.length || 0);
        const incrementPerItem = totalItems > 0 ? 100 / totalItems : 0;

        try {
            const rootUri = vscode.Uri.file(path.normalize(workspaceRoot));

            // Create folders first
            if (structure.folders) {
                for (const folder of structure.folders) {
                    const normalizedFolder = path.normalize(folder);
                    const folderUri = vscode.Uri.joinPath(rootUri, normalizedFolder);

                    progress?.report({
                        message: `Creating folder: ${normalizedFolder}`,
                        increment: incrementPerItem
                    });

                    try {
                        await vscode.workspace.fs.createDirectory(folderUri);
                    } catch (e) {
                        // Directory creation might fail if it already exists or on some systems
                        // We continue as createFile will also attempt to create parent dirs
                        console.warn(`Folder creation warning for ${normalizedFolder}:`, e);
                    }
                }
            }

            // Create files
            if (structure.files) {
                for (const file of structure.files) {
                    const normalizedPath = path.normalize(file.path);
                    progress?.report({
                        message: `Creating file: ${normalizedPath}`,
                        increment: incrementPerItem
                    });

                    try {
                        await this.createFile(workspaceRoot, { ...file, path: normalizedPath });
                        filesCreated++;
                    } catch (e) {
                        throw new Error(`Failed to create file "${normalizedPath}": ${e instanceof Error ? e.message : 'Unknown error'}`);
                    }
                }
            }

            return { success: true, filesCreated };
        } catch (error) {
            return {
                success: false,
                filesCreated,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Create a single file with content using VS Code FS API
     */
    static async createFile(workspaceRoot: string, file: ProjectFile): Promise<void> {
        const rootUri = vscode.Uri.file(path.normalize(workspaceRoot));
        const fileUri = vscode.Uri.joinPath(rootUri, file.path);
        
        // Ensure parent directory exists (though createDirectory is recursive in VS Code)
        const parentUri = vscode.Uri.file(path.dirname(fileUri.fsPath));
        await vscode.workspace.fs.createDirectory(parentUri);

        // Write file content using Uint8Array
        const encoder = new TextEncoder();
        const data = encoder.encode(file.content);
        await vscode.workspace.fs.writeFile(fileUri, data);
    }

    /**
     * Get workspace root folder
     * Falls back to asking user to select a folder if no workspace is open
     */
    static async getWorkspaceRoot(): Promise<string | undefined> {
        // Check if workspace folder exists
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (workspaceFolders && workspaceFolders.length > 0) {
            // If multiple folders, let user pick
            if (workspaceFolders.length > 1) {
                const selected = await vscode.window.showQuickPick(
                    workspaceFolders.map(f => ({
                        label: f.name,
                        description: f.uri.fsPath,
                        uri: f.uri
                    })),
                    { placeHolder: 'Select target folder for project generation' }
                );
                return selected?.uri.fsPath;
            }
            return workspaceFolders[0].uri.fsPath;
        }

        // No workspace open, ask user to select a folder
        const selectedFolders = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select Folder for Project',
            title: 'Select Target Folder'
        });

        if (selectedFolders && selectedFolders.length > 0) {
            return selectedFolders[0].fsPath;
        }

        return undefined;
    }

    /**
     * Open the first created file in the editor
     */
    static async openFirstFile(workspaceRoot: string, structure: ProjectStructure): Promise<void> {
        if (structure.files && structure.files.length > 0) {
            // Prefer opening main/index files first
            const priorityFiles = [
                'index.tsx', 'index.ts', 'index.js', 'index.jsx',
                'App.tsx', 'App.ts', 'App.js', 'App.jsx',
                'main.tsx', 'main.ts', 'main.js',
                'README.md'
            ];

            let fileToOpen = structure.files[0];

            for (const priority of priorityFiles) {
                const found = structure.files.find(f =>
                    f.path.endsWith(priority) || f.path.endsWith('/' + priority)
                );
                if (found) {
                    fileToOpen = found;
                    break;
                }
            }

            const rootUri = vscode.Uri.file(path.normalize(workspaceRoot));
            const fileUri = vscode.Uri.joinPath(rootUri, fileToOpen.path);
            const document = await vscode.workspace.openTextDocument(fileUri);
            await vscode.window.showTextDocument(document);
        }
    }
}
