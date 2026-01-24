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
        const totalItems = structure.folders.length + structure.files.length;
        const incrementPerItem = totalItems > 0 ? 100 / totalItems : 0;

        try {
            // Create folders first
            for (const folder of structure.folders) {
                const fullPath = path.join(workspaceRoot, folder);

                progress?.report({
                    message: `Creating folder: ${folder}`,
                    increment: incrementPerItem
                });

                if (!fs.existsSync(fullPath)) {
                    fs.mkdirSync(fullPath, { recursive: true });
                }
            }

            // Create files
            for (const file of structure.files) {
                progress?.report({
                    message: `Creating file: ${file.path}`,
                    increment: incrementPerItem
                });

                await this.createFile(workspaceRoot, file);
                filesCreated++;
            }

            return { success: true, filesCreated };
        } catch (error) {
            return {
                success: false,
                filesCreated,
                error: `Failed to create project structure: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Create a single file with content
     */
    static async createFile(workspaceRoot: string, file: ProjectFile): Promise<void> {
        const fullPath = path.join(workspaceRoot, file.path);
        const dir = path.dirname(fullPath);

        // Ensure parent directory exists
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Write file content
        fs.writeFileSync(fullPath, file.content, 'utf-8');
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
        if (structure.files.length > 0) {
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

            const filePath = path.join(workspaceRoot, fileToOpen.path);
            const document = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(document);
        }
    }
}
