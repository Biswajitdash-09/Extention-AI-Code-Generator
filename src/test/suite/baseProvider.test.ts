import * as assert from 'assert';
import { BaseProvider } from '../../providers/baseProvider';
import { ProviderConfig, ChatMessage, ProviderResult } from '../../types';

class TestProvider extends BaseProvider {
    get name(): string {
        return 'TestProvider';
    }

    validate(): { valid: boolean; error?: string | undefined } {
        return { valid: true };
    }

    async chat(_messages: ChatMessage[]): Promise<ProviderResult> {
        return { success: true, message: 'ok' };
    }

    async streamChat(_messages: ChatMessage[], _onDelta: (delta: string) => void): Promise<ProviderResult> {
        return { success: true, message: 'ok' };
    }

    async getEmbeddings(_text: string): Promise<number[]> {
        return [0];
    }

    // Expose protected helper for testing
    public parse(response: string) {
        return this.parseJsonResponse(response);
    }
}

suite('BaseProvider.parseJsonResponse', () => {
    const config: ProviderConfig = {
        type: 'openai',
        apiKey: 'test',
        model: 'gpt-4o-mini'
    };

    test('parses valid JSON with files/folders', () => {
        const provider = new TestProvider(config);
        const response = JSON.stringify({
            projectName: 'test',
            folders: ['src'],
            files: [{ path: 'src/index.ts', content: 'console.log("hi");' }],
            suggestedCommands: ['npm install']
        });

        const result = provider.parse(response);
        assert.strictEqual(result.success, true);
        assert.ok(result.data);
        assert.deepStrictEqual(result.data.files[0].path, 'src/index.ts');
        assert.ok(Array.isArray(result.data.folders));
    });

    test('extracts JSON from markdown code block', () => {
        const provider = new TestProvider(config);
        const response = '```json\n{"folders":[],"files":[{"path":"a","content":"b"}]}\n```';

        const result = provider.parse(response);
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.files.length, 1);
    });

    test('fails when files array is missing', () => {
        const provider = new TestProvider(config);
        const response = JSON.stringify({ folders: [] });

        const result = provider.parse(response);
        assert.strictEqual(result.success, false);
        assert.ok(result.error?.includes('missing files array'));
    });

    test('fails gracefully on invalid JSON', () => {
        const provider = new TestProvider(config);
        const response = 'this is not json';

        const result = provider.parse(response);
        assert.strictEqual(result.success, false);
        assert.ok(result.error?.startsWith('Failed to parse AI response as JSON'));
    });
});

