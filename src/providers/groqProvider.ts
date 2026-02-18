import { BaseProvider } from './baseProvider';
import { ProviderConfig, ProviderResult, ChatMessage } from '../types';

/**
 * Groq Provider
 * Fast inference with free tier - great for quick iterations
 */
export class GroqProvider extends BaseProvider {

    get name(): string {
        return 'Groq';
    }

    validate(): { valid: boolean; error?: string } {
        if (!this.config.apiKey) {
            return {
                valid: false,
                error: 'Groq API key is required. Get a free key at console.groq.com and set it in Settings > AI Code Generator > Groq API Key'
            };
        }
        return { valid: true };
    }

    async chat(messages: ChatMessage[]): Promise<ProviderResult> {
        const validation = this.validate();
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        try {
            // Set timeout using AbortController
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout

            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify({
                    model: this.config.model || 'llama-3.3-70b-versatile',
                    messages: messages.map(m => ({
                        role: m.role,
                        content: m.content
                    })),
                    temperature: 0.7,
                    max_tokens: 16000
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})) as Record<string, any>;
                const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
                return { success: false, error: `Groq API error: ${errorMessage}` };
            }

            const data = await response.json() as Record<string, any>;
            const content = data.choices?.[0]?.message?.content;

            if (!content) {
                return { success: false, error: 'No response content from Groq' };
            }

            const parsed = this.parseJsonResponse(content);
            if (!parsed.success) {
                return {
                    success: true,
                    message: content,
                    tokensUsed: data.usage?.total_tokens
                };
            }

            return {
                success: true,
                projectStructure: parsed.data,
                tokensUsed: data.usage?.total_tokens
            };

        } catch (error) {
            return {
                success: false,
                error: `Groq request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    async streamChat(messages: ChatMessage[], onDelta: (delta: string) => void): Promise<ProviderResult> {
        const validation = this.validate();
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        try {
            // Set timeout using AbortController
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout

            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify({
                    model: this.config.model || 'llama-3.3-70b-versatile',
                    messages: messages.map(m => ({
                        role: m.role,
                        content: m.content
                    })),
                    temperature: 0.7,
                    max_tokens: 16000,
                    stream: true
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})) as any;
                return { success: false, error: `Groq API error: ${errorData.error?.message || response.statusText}` };
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
                    if (line.trim() === 'data: [DONE]') break;
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.substring(6));
                            const delta = data.choices?.[0]?.delta?.content;
                            if (delta) {
                                fullContent += delta;
                                onDelta(delta);
                            }
                        } catch (e) {
                            // Skip invalid JSON
                        }
                    }
                }
            }

            const parsed = this.parseJsonResponse(fullContent);
            if (!parsed.success) {
                return { success: true, message: fullContent };
            }

            return { success: true, projectStructure: parsed.data };

        } catch (error) {
            return { success: false, error: `Groq streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
        }
    }

    async getEmbeddings(text: string): Promise<number[]> {
        // Groq does not currently provide a stable embeddings API for this extension.
        // Use a deterministic local fallback embedding so semantic indexing still functions.
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

        // L2 normalize
        let norm = 0;
        for (const v of vec) norm += v * v;
        norm = Math.sqrt(norm) || 1;
        return vec.map(v => v / norm);
    }
}
