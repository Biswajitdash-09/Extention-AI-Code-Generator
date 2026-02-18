import { BaseProvider } from './baseProvider';
import { ProviderConfig, ProviderResult, ChatMessage } from '../types';

/**
 * Ollama Provider
 * Run AI models locally - completely free and private
 * Requires Ollama to be installed: https://ollama.ai
 */
export class OllamaProvider extends BaseProvider {

    get name(): string {
        return 'Ollama (Local)';
    }

    validate(): { valid: boolean; error?: string } {
        // No API key needed for local Ollama
        return { valid: true };
    }

    async chat(messages: ChatMessage[]): Promise<ProviderResult> {
        const baseUrl = this.config.baseUrl || 'http://localhost:11434';
        const model = this.config.model || 'codellama';

        try {
            // First check if Ollama is running
            const healthCheck = await fetch(`${baseUrl}/api/tags`).catch(() => null);
            if (!healthCheck || !healthCheck.ok) {
                return {
                    success: false,
                    error: 'Ollama is not running. Please start Ollama first.\n\nInstall from: https://ollama.ai\nThen run: ollama pull codellama'
                };
            }

            // Set timeout using AbortController
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout

            const response = await fetch(`${baseUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: messages.map(m => ({
                        role: m.role,
                        content: m.content
                    })),
                    stream: false,
                    options: {
                        temperature: 0.7,
                        num_predict: 16000
                    }
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');

                // Check if model not found
                if (response.status === 404 || errorText.includes('not found')) {
                    return {
                        success: false,
                        error: `Model "${model}" not found. Run: ollama pull ${model}`
                    };
                }

                return { success: false, error: `Ollama error: ${errorText || response.statusText}` };
            }

            const data = await response.json() as Record<string, any>;
            const content = data.message?.content;

            if (!content) {
                return { success: false, error: 'No response content from Ollama' };
            }

            const parsed = this.parseJsonResponse(content);
            if (!parsed.success) {
                return {
                    success: true,
                    message: content
                };
            }

            return {
                success: true,
                projectStructure: parsed.data
            };

        } catch (error) {
            if (error instanceof TypeError && error.message.includes('fetch')) {
                return {
                    success: false,
                    error: 'Cannot connect to Ollama. Make sure Ollama is running.\n\nStart with: ollama serve'
                };
            }
            return {
                success: false,
                error: `Ollama request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    async streamChat(messages: ChatMessage[], onDelta: (delta: string) => void): Promise<ProviderResult> {
        const baseUrl = this.config.baseUrl || 'http://localhost:11434';
        const model = this.config.model || 'codellama';

        try {
            // Set timeout using AbortController
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout

            const response = await fetch(`${baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model,
                    messages: messages.map(m => ({
                        role: m.role,
                        content: m.content
                    })),
                    stream: true,
                    options: { temperature: 0.7, num_predict: 16000 }
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                return { success: false, error: `Ollama error: ${errorText || response.statusText}` };
            }

            const reader = response.body?.getReader();
            if (!reader) return { success: false, error: 'Failed to get reader from response' };

            let fullContent = '';
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line);
                        const delta = data.message?.content;
                        if (delta) {
                            fullContent += delta;
                            onDelta(delta);
                        }
                        if (data.done) break;
                    } catch (e) {
                        // Skip invalid JSON
                    }
                }
            }

            const parsed = this.parseJsonResponse(fullContent);
            if (!parsed.success) {
                return { success: true, message: fullContent };
            }

            return { success: true, projectStructure: parsed.data };

        } catch (error) {
            return { success: false, error: `Ollama streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
        }
    }

    async getEmbeddings(text: string): Promise<number[]> {
        const baseUrl = this.config.baseUrl || 'http://localhost:11434';
        const model = this.config.model || 'codellama';

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000);

            const response = await fetch(`${baseUrl}/api/embeddings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    prompt: text.replace(/\n/g, ' ')
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json() as any;
                if (data && Array.isArray(data.embedding)) {
                    return data.embedding as number[];
                }
            }
        } catch {
            // Fall through to local embedding fallback
        }

        return this.simpleHashEmbedding(text);
    }

    private simpleHashEmbedding(text: string, dims: number = 256): number[] {
        const vec = new Array<number>(dims).fill(0);
        const tokens = text
            .toLowerCase()
            .replace(/[^a-z0-9_\s]/g, ' ')
            .split(/\s+/)
            .filter(Boolean);

        for (const tok of tokens) {
            let h = 2166136261;
            for (let i = 0; i < tok.length; i++) {
                h ^= tok.charCodeAt(i);
                h = Math.imul(h, 16777619);
            }
            const idx = Math.abs(h) % dims;
            vec[idx] += 1;
        }

        let norm = 0;
        for (const v of vec) norm += v * v;
        norm = Math.sqrt(norm) || 1;
        return vec.map(v => v / norm);
    }
}
