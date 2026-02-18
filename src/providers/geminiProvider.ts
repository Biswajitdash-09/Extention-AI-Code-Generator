import { BaseProvider } from './baseProvider';
import { ProviderConfig, ProviderResult, ChatMessage } from '../types';

/**
 * Google Gemini Provider
 * Free tier available - great for getting started
 */
export class GeminiProvider extends BaseProvider {

    get name(): string {
        return 'Google Gemini';
    }

    validate(): { valid: boolean; error?: string } {
        if (!this.config.apiKey) {
            return {
                valid: false,
                error: 'Gemini API key is required. Get a free key at aistudio.google.com and set it in Settings > CodeForge AI > Gemini API Key'
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
            const model = this.config.model || 'gemini-1.5-flash';
            
            // WARNING: Google Gemini REST API requires the API key in the URL as a query parameter.
            // This is their official authentication method - there is no header-based alternative.
            //
            // PRODUCTION SECURITY CONCERN: The API key in URLs can be exposed in logs, browser history,
            // and network traces. For production deployments, implement a proxy server that:
            // 1. Stores and validates API keys securely
            // 2. Handles requests to the Gemini API on behalf of the extension
            // 3. Never exposes API keys to client-side code
            //
            // Current implementation is acceptable for development but NOT production-ready.
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.config.apiKey}`;

            // Convert messages to Gemini format
            const contents = this.convertToGeminiFormat(messages);

            // Set timeout using AbortController
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents,
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 16000
                    }
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})) as Record<string, any>;
                const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
                return { success: false, error: `Gemini API error: ${errorMessage}` };
            }

            const data = await response.json() as Record<string, any>;
            const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!content) {
                return { success: false, error: 'No response content from Gemini' };
            }

            const parsed = this.parseJsonResponse(content);
            if (!parsed.success) {
                return {
                    success: true,
                    message: content,
                    tokensUsed: data.usageMetadata?.totalTokenCount
                };
            }

            return {
                success: true,
                projectStructure: parsed.data,
                tokensUsed: data.usageMetadata?.totalTokenCount
            };

        } catch (error) {
            return {
                success: false,
                error: `Gemini request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    async streamChat(messages: ChatMessage[], onDelta: (delta: string) => void): Promise<ProviderResult> {
        const validation = this.validate();
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        try {
            const model = this.config.model || 'gemini-2.0-flash';
            
            // WARNING: Google Gemini REST API requires the API key in the URL as a query parameter.
            // This is their official authentication method - there is no header-based alternative.
            //
            // PRODUCTION SECURITY CONCERN: The API key in URLs can be exposed in logs, browser history,
            // and network traces. For production deployments, implement a proxy server.
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${this.config.apiKey}`;

            const contents = this.convertToGeminiFormat(messages);

            // Set timeout using AbortController
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents,
                    generationConfig: { temperature: 0.7, maxOutputTokens: 16000 }
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})) as any;
                return { success: false, error: `Gemini API error: ${errorData.error?.message || response.statusText}` };
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
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.substring(6));
                            const delta = data.candidates?.[0]?.content?.parts?.[0]?.text;
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
            return { success: false, error: `Gemini streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
        }
    }

    /**
     * Convert OpenAI-style messages to Gemini format
     */
    private convertToGeminiFormat(messages: ChatMessage[]): any[] {
        const contents: any[] = [];

        // Gemini doesn't have a system role, prepend to first user message
        let systemContent = '';

        for (const msg of messages) {
            if (msg.role === 'system') {
                systemContent = msg.content + '\n\n';
            } else if (msg.role === 'user') {
                const parts: any[] = [{ text: systemContent + msg.content }];
                
                if (msg.image) {
                    parts.push({
                        inlineData: {
                            mimeType: 'image/jpeg',
                            data: msg.image
                        }
                    });
                }

                contents.push({
                    role: 'user',
                    parts
                });
                systemContent = ''; // Only prepend once
            } else if (msg.role === 'assistant') {
                contents.push({
                    role: 'model',
                    parts: [{ text: msg.content }]
                });
            }
        }

        return contents;
    }

    async getEmbeddings(text: string): Promise<number[]> {
        const model = 'text-embedding-004';
        
        // WARNING: Google Gemini REST API requires the API key in the URL as a query parameter.
        // For production deployments, implement a proxy server.
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${this.config.apiKey}`;

        // Set timeout using AbortController
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: `models/${model}`,
                content: { parts: [{ text }] }
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Gemini embedding failed: ${response.statusText}`);
        }

        const data = await response.json() as any;
        return data.embedding.values;
    }
}
