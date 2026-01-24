import { ProjectStructure } from './project';

/**
 * Supported AI provider types
 */
export type ProviderType = 'openai' | 'gemini' | 'groq' | 'ollama';

/**
 * Configuration for an AI provider
 */
export interface ProviderConfig {
    type: ProviderType;
    apiKey?: string;
    model: string;
    baseUrl?: string;
}

/**
 * Message format for AI chat
 */
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/**
 * Result from AI provider
 */
export interface ProviderResult {
    success: boolean;
    projectStructure?: ProjectStructure;
    message?: string; // Conversational response
    error?: string;
    tokensUsed?: number;
}

/**
 * Provider information for UI display
 */
export interface ProviderInfo {
    type: ProviderType;
    name: string;
    description: string;
    requiresApiKey: boolean;
    freeAvailable: boolean;
    models: string[];
}

/**
 * All available providers info
 */
export const PROVIDER_INFO: Record<ProviderType, ProviderInfo> = {
    openai: {
        type: 'openai',
        name: 'OpenAI',
        description: 'GPT-4o, GPT-4o-mini - Best quality code generation',
        requiresApiKey: true,
        freeAvailable: false,
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']
    },
    gemini: {
        type: 'gemini',
        name: 'Google Gemini',
        description: 'Gemini 1.5/2.0 - Free tier available',
        requiresApiKey: true,
        freeAvailable: true,
        models: ['gemini-2.0-flash-exp', 'gemini-1.5-flash', 'gemini-1.5-pro']
    },
    groq: {
        type: 'groq',
        name: 'Groq',
        description: 'Llama 3.3, Mixtral - Fast & free tier',
        requiresApiKey: true,
        freeAvailable: true,
        models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768']
    },
    ollama: {
        type: 'ollama',
        name: 'Ollama (Local)',
        description: 'Run models locally - Completely free',
        requiresApiKey: false,
        freeAvailable: true,
        models: ['codellama', 'deepseek-coder', 'llama3', 'mistral']
    }
};
