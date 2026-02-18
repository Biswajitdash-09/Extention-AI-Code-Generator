import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ProviderManager } from '../providers';

interface CodeChunk {
    path: string;
    content: string;
    embedding: number[];
    range: { start: number; end: number };
}

export class IndexingService {
    private static readonly CACHE_DIR = '.ai-code-generator';
    private static readonly INDEX_FILE = 'vector-index.json';
    private static index: CodeChunk[] = [];

    /**
     * Index the entire workspace
     */
    static async indexWorkspace(progress?: vscode.Progress<{ message?: string; increment?: number }>): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;

        const rootPath = workspaceFolders[0].uri.fsPath;
        const cacheDirPath = path.join(rootPath, this.CACHE_DIR);
        const indexFilePath = path.join(cacheDirPath, this.INDEX_FILE);

        if (!fs.existsSync(cacheDirPath)) {
            fs.mkdirSync(cacheDirPath);
        }

        const provider = ProviderManager.getProvider();
        const files = await this.getRelevantFiles(rootPath);
        const totalFiles = files.length;
        
        let processedFiles = 0;
        this.index = [];

        for (const filePath of files) {
            const relativePath = path.relative(rootPath, filePath);
            progress?.report({ message: `Indexing ${relativePath}...`, increment: (1 / totalFiles) * 100 });

            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                const chunks = this.chunkFile(relativePath, content);

                for (const chunk of chunks) {
                    const embedding = await provider.getEmbeddings(chunk.content);
                    this.index.push({
                        ...chunk,
                        embedding
                    });
                }
            } catch (e) {
                console.error(`Error indexing ${relativePath}:`, e);
            }
            processedFiles++;
        }

        fs.writeFileSync(indexFilePath, JSON.stringify(this.index));
        vscode.window.showInformationMessage(`Workspace indexed: ${this.index.length} chunks from ${totalFiles} files.`);
    }

    /**
     * Search for relevant code chunks using semantic similarity
     */
    static async search(query: string, limit: number = 5): Promise<CodeChunk[]> {
        if (this.index.length === 0) {
            await this.loadIndex();
        }

        if (this.index.length === 0) return [];

        const provider = ProviderManager.getProvider();
        const queryEmbedding = await provider.getEmbeddings(query);

        const results = this.index.map(chunk => ({
            chunk,
            similarity: this.cosineSimilarity(queryEmbedding, chunk.embedding)
        }));

        return results
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit)
            .map(r => r.chunk);
    }

    private static async loadIndex() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;

        const rootPath = workspaceFolders[0].uri.fsPath;
        const indexFilePath = path.join(rootPath, this.CACHE_DIR, this.INDEX_FILE);

        if (fs.existsSync(indexFilePath)) {
            try {
                this.index = JSON.parse(fs.readFileSync(indexFilePath, 'utf-8'));
            } catch (e) {
                console.error('Error loading index:', e);
            }
        }
    }

    private static cosineSimilarity(a: number[], b: number[]): number {
        let dotProduct = 0;
        let mA = 0;
        let mB = 0;
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            mA += a[i] * a[i];
            mB += b[i] * b[i];
        }
        return dotProduct / (Math.sqrt(mA) * Math.sqrt(mB));
    }

    private static async getRelevantFiles(rootPath: string): Promise<string[]> {
        const pattern = '**/*.{ts,tsx,js,jsx,py,java,go,rs,cpp,c}';
        const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**');
        return files.map(f => f.fsPath);
    }

    private static chunkFile(path: string, content: string): Omit<CodeChunk, 'embedding'>[] {
        const chunks: Omit<CodeChunk, 'embedding'>[] = [];
        const lines = content.split('\n');
        const chunkSize = 50; // lines per chunk
        const overlap = 10;

        for (let i = 0; i < lines.length; i += (chunkSize - overlap)) {
            const chunkLines = lines.slice(i, i + chunkSize);
            if (chunkLines.length === 0) break;

            chunks.push({
                path,
                content: chunkLines.join('\n'),
                range: { start: i + 1, end: i + chunkLines.length }
            });

            if (i + chunkSize >= lines.length) break;
        }

        return chunks;
    }
}
