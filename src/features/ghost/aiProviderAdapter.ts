/**
 * AI Provider Adapter
 * Adapts existing AI providers (OpenAI, Gemini, Groq, Ollama) for Ghost suggestions
 */

import * as vscode from 'vscode';

export interface AIProviderAdapter {
    generateCode(prompt: string): Promise<string>;
}

class AIProviderAdapterImpl implements AIProviderAdapter {
    /**
     * Generate code using the configured provider
     */
    async generateCode(prompt: string): Promise<string> {
        const config = vscode.workspace.getConfiguration('aiCodeGenerator');
        const provider = config.get<string>('provider', 'gemini');

        try {
            // Dynamically import and use the appropriate provider
            switch (provider) {
                case 'openai':
                    return await this.callOpenAI(prompt, config);
                case 'gemini':
                    return await this.callGemini(prompt, config);
                case 'groq':
                    return await this.callGroq(prompt, config);
                case 'ollama':
                    return await this.callOllama(prompt, config);
                default:
                    return await this.callGemini(prompt, config);
            }
        } catch (error) {
            throw new Error(`AI provider error: ${error}`);
        }
    }

    private async callOpenAI(prompt: string, config: vscode.WorkspaceConfiguration): Promise<string> {
        const { OpenAIProvider } = await import('../../providers/openaiProvider');
        const providerConfig = { type: 'openai' as const, apiKey: config.get('openai.apiKey', ''), model: config.get('openai.model', 'gpt-4o-mini') };
        const provider = new OpenAIProvider(providerConfig);
        const result = await provider.chat([{ role: 'user', content: prompt }]);
        return result.message || '';
    }

    private async callGemini(prompt: string, config: vscode.WorkspaceConfiguration): Promise<string> {
        const { GeminiProvider } = await import('../../providers/geminiProvider');
        const providerConfig = { type: 'gemini' as const, apiKey: config.get('gemini.apiKey', ''), model: config.get('gemini.model', 'gemini-1.5-flash') };
        const provider = new GeminiProvider(providerConfig);
        const result = await provider.chat([{ role: 'user', content: prompt }]);
        return result.message || '';
    }

    private async callGroq(prompt: string, config: vscode.WorkspaceConfiguration): Promise<string> {
        const { GroqProvider } = await import('../../providers/groqProvider');
        const providerConfig = { type: 'groq' as const, apiKey: config.get('groq.apiKey', ''), model: config.get('groq.model', 'llama-3.3-70b-versatile') };
        const provider = new GroqProvider(providerConfig);
        const result = await provider.chat([{ role: 'user', content: prompt }]);
        return result.message || '';
    }

    private async callOllama(prompt: string, config: vscode.WorkspaceConfiguration): Promise<string> {
        const { OllamaProvider } = await import('../../providers/ollamaProvider');
        const providerConfig = { type: 'ollama' as const, baseUrl: config.get('ollama.baseUrl', 'http://localhost:11434'), model: config.get('ollama.model', 'codellama') };
        const provider = new OllamaProvider(providerConfig);
        const result = await provider.chat([{ role: 'user', content: prompt }]);
        return result.message || '';
    }
}

/**
 * Create an AI provider adapter instance
 */
export function createAIProviderAdapter(): AIProviderAdapter {
    return new AIProviderAdapterImpl();
}
