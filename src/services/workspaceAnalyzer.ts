import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface WorkspaceContext {
    structure: FileNode[];
    files: ContextFile[];
    summary: string;
    tokenEstimate: number;
}

export interface FileNode {
    name: string;
    type: 'file' | 'directory';
    path: string;
    children?: FileNode[];
}

export interface ContextFile {
    path: string;
    language: string;
    content: string;
    lines: number;
}

export class WorkspaceAnalyzer {
    private static readonly MAX_TOKENS = 8000; // Conservative token limit for context
    private static readonly IGNORED_DIRS = ['node_modules', '.git', 'dist', 'build', 'out', '.next', 'coverage', '__pycache__'];
    private static readonly IGNORED_FILES = ['.DS_Store', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
    private static readonly MAX_FILE_SIZE = 50000; // 50KB max per file

    /**
     * Analyze the workspace and generate context
     */
    static async analyzeWorkspace(maxDepth: number = 3, includeFileContent: boolean = true): Promise<WorkspaceContext | null> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return null;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const structure = await this.buildFileTree(rootPath, maxDepth);

        let files: ContextFile[] = [];
        let tokenEstimate = 0;

        if (includeFileContent) {
            const relevantFiles = await this.findRelevantFiles(rootPath, maxDepth);
            for (const filePath of relevantFiles) {
                if (tokenEstimate >= this.MAX_TOKENS) break;

                const file = await this.readFile(filePath, rootPath);
                if (file) {
                    const fileTokens = this.estimateTokens(file.content);
                    if (tokenEstimate + fileTokens <= this.MAX_TOKENS) {
                        files.push(file);
                        tokenEstimate += fileTokens;
                    }
                }
            }
        }

        const summary = this.generateSummary(structure, files);

        return {
            structure,
            files,
            summary,
            tokenEstimate
        };
    }

    /**
     * Build a file tree structure using async VS Code workspace API to avoid blocking
     */
    private static async buildFileTree(dirPath: string, maxDepth: number, currentDepth: number = 0): Promise<FileNode[]> {
        if (currentDepth >= maxDepth) return [];

        const nodes: FileNode[] = [];

        try {
            const dirUri = vscode.Uri.file(dirPath);
            const entries = await vscode.workspace.fs.readDirectory(dirUri);

            for (const [name, type] of entries) {
                if (this.IGNORED_DIRS.includes(name) || this.IGNORED_FILES.includes(name)) {
                    continue;
                }

                const fullPath = path.join(dirPath, name);
                const isDirectory = type === vscode.FileType.Directory;
                const node: FileNode = {
                    name,
                    type: isDirectory ? 'directory' : 'file',
                    path: fullPath
                };

                if (isDirectory) {
                    node.children = await this.buildFileTree(fullPath, maxDepth, currentDepth + 1);
                }

                nodes.push(node);
            }
        } catch (error) {
            console.error('Error reading directory:', error);
        }

        return nodes;
    }

    /**
     * Find relevant files to include in context using async operations to avoid blocking
     */
    private static async findRelevantFiles(rootPath: string, maxDepth: number): Promise<string[]> {
        const files: string[] = [];
        const priorityExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.cpp', '.c'];

        const traverse = async (dirPath: string, depth: number) => {
            if (depth >= maxDepth) return;

            try {
                const dirUri = vscode.Uri.file(dirPath);
                const entries = await vscode.workspace.fs.readDirectory(dirUri);

                for (const [name, type] of entries) {
                    if (this.IGNORED_DIRS.includes(name) || this.IGNORED_FILES.includes(name)) {
                        continue;
                    }

                    const fullPath = path.join(dirPath, name);

                    if (type === vscode.FileType.Directory) {
                        await traverse(fullPath, depth + 1);
                    } else if (type === vscode.FileType.File) {
                        const ext = path.extname(name);
                        if (priorityExtensions.includes(ext)) {
                            const stats = await vscode.workspace.fs.stat(vscode.Uri.file(fullPath));
                            if (stats.size <= this.MAX_FILE_SIZE) {
                                files.push(fullPath);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Error traversing directory:', error);
            }
        };

        await traverse(rootPath, 0);
        return files;
    }

    /**
     * Read a file and create a ContextFile using async VS Code workspace API to avoid blocking
     */
    private static async readFile(filePath: string, rootPath: string): Promise<ContextFile | null> {
        try {
            const fileUri = vscode.Uri.file(filePath);
            const uint8Array = await vscode.workspace.fs.readFile(fileUri);
            const content = new TextDecoder('utf-8').decode(uint8Array);
            const relativePath = path.relative(rootPath, filePath);
            const language = this.detectLanguage(filePath);
            const lines = content.split('\n').length;

            return {
                path: relativePath,
                language,
                content,
                lines
            };
        } catch (error) {
            console.error('Error reading file:', filePath, error);
            return null;
        }
    }

    /**
     * Detect language from file extension
     */
    private static detectLanguage(filePath: string): string {
        const ext = path.extname(filePath);
        const languageMap: Record<string, string> = {
            '.ts': 'typescript',
            '.tsx': 'typescriptreact',
            '.js': 'javascript',
            '.jsx': 'javascriptreact',
            '.py': 'python',
            '.java': 'java',
            '.go': 'go',
            '.rs': 'rust',
            '.cpp': 'cpp',
            '.c': 'c',
            '.html': 'html',
            '.css': 'css',
            '.json': 'json',
            '.md': 'markdown'
        };
        return languageMap[ext] || 'plaintext';
    }

    /**
     * Estimate tokens for content (rough approximation)
     */
    private static estimateTokens(content: string): number {
        // Rough estimate: 1 token ≈ 4 characters
        return Math.ceil(content.length / 4);
    }

    /**
     * Generate a summary of the workspace
     */
    private static generateSummary(structure: FileNode[], files: ContextFile[]): string {
        const fileCount = files.length;
        const languages = [...new Set(files.map(f => f.language))];
        const totalLines = files.reduce((sum, f) => sum + f.lines, 0);

        const frameworks = this.detectFrameworks(files);

        let summary = `Workspace contains ${fileCount} files with ${totalLines} total lines of code.\n`;
        summary += `Languages: ${languages.join(', ')}\n`;
        if (frameworks.length > 0) {
            summary += `Detected frameworks: ${frameworks.join(', ')}\n`;
        }

        return summary;
    }

    /**
     * Detect frameworks from package.json or imports
     */
    private static detectFrameworks(files: ContextFile[]): string[] {
        const frameworks: Set<string> = new Set();

        for (const file of files) {
            if (file.path.includes('package.json')) {
                const packageJson = JSON.parse(file.content);
                const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

                if (deps.react) frameworks.add('React');
                if (deps.vue) frameworks.add('Vue');
                if (deps.angular) frameworks.add('Angular');
                if (deps.next) frameworks.add('Next.js');
                if (deps.express) frameworks.add('Express');
                if (deps.fastify) frameworks.add('Fastify');
            }

            if (file.content.includes('import React') || file.content.includes('from "react"')) {
                frameworks.add('React');
            }
            if (file.content.includes('import Vue') || file.content.includes('from "vue"')) {
                frameworks.add('Vue');
            }
        }

        return Array.from(frameworks);
    }

    /**
     * Format workspace context for AI prompt
     */
    static formatContextForPrompt(context: WorkspaceContext): string {
        let prompt = `# Workspace Context\n\n${context.summary}\n\n`;

        if (context.files.length > 0) {
            prompt += `## Relevant Files\n\n`;
            for (const file of context.files) {
                prompt += `### ${file.path} (${file.language}, ${file.lines} lines)\n\`\`\`${file.language}\n${file.content}\n\`\`\`\n\n`;
            }
        }

        return prompt;
    }
}
