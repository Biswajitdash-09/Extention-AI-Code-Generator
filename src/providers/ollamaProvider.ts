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
                })
            });

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
}
