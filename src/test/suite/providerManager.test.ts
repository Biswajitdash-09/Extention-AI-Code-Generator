import * as assert from 'assert';
import * as vscode from 'vscode';
import { ProviderManager } from '../../providers/providerManager';
import { OpenAIProvider } from '../../providers/openaiProvider';
import { GeminiProvider } from '../../providers/geminiProvider';
import { GroqProvider } from '../../providers/groqProvider';
import { OllamaProvider } from '../../providers/ollamaProvider';
import { ProviderType } from '../../types';

suite('ProviderManager', () => {
    const originalGetConfiguration = vscode.workspace.getConfiguration;

    function mockConfig(values: Record<string, any>): vscode.WorkspaceConfiguration {
        return {
            get: (section: string, defaultValue?: any) => {
                const key = section.replace(/^aiCodeGenerator\./, '');
                return (values[key] ?? values[section]) ?? defaultValue;
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
    }

    setup(() => {
        (vscode.workspace as any).getConfiguration = (section?: string) => {
            if (section !== 'aiCodeGenerator') {
                return originalGetConfiguration(section);
            }
            return mockConfig({
                provider: 'openai',
                'openai.apiKey': 'test-openai',
                'openai.model': 'gpt-4o-mini',
                'gemini.apiKey': 'test-gemini',
                'gemini.model': 'gemini-1.5-flash',
                'groq.apiKey': 'test-groq',
                'groq.model': 'llama-3.3-70b-versatile',
                'ollama.model': 'codellama',
                'ollama.baseUrl': 'http://localhost:11434'
            });
        };
    });

    teardown(() => {
        (vscode.workspace as any).getConfiguration = originalGetConfiguration;
    });

    function createWithType(type: ProviderType) {
        const cfg = vscode.workspace.getConfiguration('aiCodeGenerator');
        return ProviderManager.createProvider(type, cfg as any);
    }

    test('createProvider returns OpenAIProvider for openai', () => {
        const provider = createWithType('openai');
        assert.ok(provider instanceof OpenAIProvider);
    });

    test('createProvider returns GeminiProvider for gemini', () => {
        const provider = createWithType('gemini');
        assert.ok(provider instanceof GeminiProvider);
    });

    test('createProvider returns GroqProvider for groq', () => {
        const provider = createWithType('groq');
        assert.ok(provider instanceof GroqProvider);
    });

    test('createProvider returns OllamaProvider for ollama', () => {
        const provider = createWithType('ollama');
        assert.ok(provider instanceof OllamaProvider);
    });

    test('createProvider throws for unknown type', () => {
        assert.throws(() => ProviderManager.createProvider('unknown' as any), /Unknown provider type/);
    });
});

