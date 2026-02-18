import * as vscode from 'vscode';
import { BaseProvider } from './baseProvider';
import { OpenAIProvider } from './openaiProvider';
import { GeminiProvider } from './geminiProvider';
import { GroqProvider } from './groqProvider';
import { OllamaProvider } from './ollamaProvider';
import { ProviderConfig, ProviderType, PROVIDER_INFO } from '../types';

/**
 * Factory for creating and managing AI providers
 */
export class ProviderManager {

    /**
     * Get the currently configured provider based on VS Code settings
     */
    static getProvider(): BaseProvider {
        const config = vscode.workspace.getConfiguration('aiCodeGenerator');
        const providerType = config.get<ProviderType>('provider') || 'gemini';

        return this.createProvider(providerType, config);
    }

    /**
     * Create a provider by type
     */
    static createProvider(type: ProviderType, config?: vscode.WorkspaceConfiguration): BaseProvider {
        const wsConfig = config || vscode.workspace.getConfiguration('aiCodeGenerator');

        switch (type) {
            case 'openai':
                return new OpenAIProvider({
                    type: 'openai',
                    apiKey: wsConfig.get<string>('openai.apiKey') || process.env.OPENAI_API_KEY || '',
                    model: wsConfig.get<string>('openai.model') || 'gpt-4o-mini'
                });

            case 'gemini':
                return new GeminiProvider({
                    type: 'gemini',
                    apiKey: wsConfig.get<string>('gemini.apiKey') || process.env.GEMINI_API_KEY || '',
                    model: wsConfig.get<string>('gemini.model') || 'gemini-1.5-flash'
                });

            case 'groq':
                return new GroqProvider({
                    type: 'groq',
                    apiKey: wsConfig.get<string>('groq.apiKey') || process.env.GROQ_API_KEY || '',
                    model: wsConfig.get<string>('groq.model') || 'llama-3.3-70b-versatile'
                });

            case 'ollama':
                return new OllamaProvider({
                    type: 'ollama',
                    model: wsConfig.get<string>('ollama.model') || 'codellama',
                    baseUrl: wsConfig.get<string>('ollama.baseUrl') || 'http://localhost:11434'
                });

            default:
                throw new Error(`Unknown provider type: ${type}`);
        }
    }

    /**
     * Show quick pick to select a provider
     */
    static async selectProvider(): Promise<ProviderType | undefined> {
        const items = Object.values(PROVIDER_INFO).map(info => ({
            label: `$(${info.freeAvailable ? 'star-empty' : 'credit-card'}) ${info.name}`,
            description: info.freeAvailable ? 'Free tier available' : 'Paid',
            detail: info.description,
            type: info.type
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select an AI provider',
            title: 'CodeForge AI - Select Provider'
        });

        return selected?.type;
    }

    /**
     * Get provider info by type
     */
    static getProviderInfo(type: ProviderType) {
        return PROVIDER_INFO[type];
    }
}
