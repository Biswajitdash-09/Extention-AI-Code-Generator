import { ProviderConfig, ProviderResult, ChatMessage } from '../types';

/**
 * Abstract base class for AI providers
 * All providers must implement this interface
 */
export abstract class BaseProvider {
    protected _config: ProviderConfig;

    constructor(config: ProviderConfig) {
        this._config = config;
    }

    public get config(): ProviderConfig {
        return this._config;
    }

    /**
     * Get the provider type
     */
    abstract get name(): string;

    /**
     * Validate provider configuration
     */
    abstract validate(): { valid: boolean; error?: string };

    /**
     * Send a chat completion request
     */
    abstract chat(messages: ChatMessage[]): Promise<ProviderResult>;

    /**
     * Send a streaming chat completion request
     */
    abstract streamChat(messages: ChatMessage[], onDelta: (delta: string) => void): Promise<ProviderResult>;

    /**
     * Generate project structure from a task description
     */
    async generateProject(taskDescription: string): Promise<ProviderResult> {
        const systemPrompt = this.getSystemPrompt();
        const userPrompt = this.getUserPrompt(taskDescription);

        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];

        return this.chat(messages);
    }

    /**
     * System prompt for code generation
     */
    protected getSystemPrompt(): string {
        return `You are an expert software engineer and code generator. Your task is to generate complete, production-ready project structures based on user descriptions.

CRITICAL RULES:
1. Return ONLY valid JSON, no markdown, no explanations, no code blocks
2. Use the exact JSON structure specified
3. Generate complete, working code - no placeholders or TODOs
4. Include all necessary imports and dependencies
5. Follow best practices for the chosen technology stack
6. Include proper error handling and validation
7. Add helpful comments in the code

JSON OUTPUT FORMAT (follow exactly):
{
  "projectName": "project-name",
  "description": "Brief description of what was generated",
  "folders": [
    "src",
    "src/components",
    "src/utils"
  ],
  "files": [
    {
      "path": "src/index.js",
      "content": "// actual code here"
    }
  ]
}`;
    }

    /**
     * User prompt template
     */
    protected getUserPrompt(taskDescription: string): string {
        return `Generate a complete project for the following task:

${taskDescription}

Remember:
- Return ONLY the JSON object
- Include ALL necessary files
- Write complete, working code
- No placeholders or TODOs`;
    }

    /**
     * Parse JSON from AI response, handling common issues
     */
    protected parseJsonResponse(response: string): { success: boolean; data?: any; error?: string } {
        try {
            // Remove markdown code blocks if present
            let cleaned = response.trim();

            // Remove ```json or ``` wrapper
            if (cleaned.startsWith('```')) {
                cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
            }

            // Try to find JSON object in the response
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cleaned = jsonMatch[0];
            }

            const parsed = JSON.parse(cleaned);

            // Validate required fields
            if (!parsed.files || !Array.isArray(parsed.files)) {
                return { success: false, error: 'Invalid response: missing files array' };
            }

            // Ensure folders array exists
            if (!parsed.folders) {
                parsed.folders = [];
            }

            return { success: true, data: parsed };
        } catch (e) {
            return {
                success: false,
                error: `Failed to parse AI response as JSON: ${e instanceof Error ? e.message : 'Unknown error'}`
            };
        }
    }
}
