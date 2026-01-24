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
                error: 'Gemini API key is required. Get a free key at aistudio.google.com and set it in Settings > AI Code Generator > Gemini API Key'
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
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.config.apiKey}`;

            // Convert messages to Gemini format
            const contents = this.convertToGeminiFormat(messages);

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
                })
            });

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
                contents.push({
                    role: 'user',
                    parts: [{ text: systemContent + msg.content }]
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
}
