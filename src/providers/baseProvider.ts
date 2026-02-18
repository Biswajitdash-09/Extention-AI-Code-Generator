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
     * Generate embeddings for a piece of text
     */
    abstract getEmbeddings(text: string): Promise<number[]>;

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
    public getSystemPrompt(): string {
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
  ],
  "suggestedCommands": ["npm install", "npm start"]
}`;
    }

    /**
     * System prompt for chat-based interactions
     */
    public getChatSystemPrompt(mode: string = 'agent'): string {
        const isAgent = mode === 'agent';
        const isDebug = mode === 'debug';
        
        return `You are a helpful AI assistant for the "AI Code Generator" extension.
You are currently in **${mode.toUpperCase()}** mode.

${isDebug ? 
`DEBUG MODE CAPABILITIES:
1. You are an expert debugger. Your goal is to fix errors provided by the user or terminal.
2. Carefully analyze STACK TRACES and ERROR MESSAGES.
3. Identify the EXACT file and line number causing the issue.
4. Propose the SMALLEST possible fix to resolve the error.
5. ALWAYS return a JSON project structure with the fixed file content so the user can apply it.` :
isAgent ? 
`AGENT MODE CAPABILITIES:
1. You can answer questions AND generate/modify project files.
2. If the user asks to create, generate, add, or modify files/projects (or provides a screenshot):
   - You MUST include a valid JSON project structure in your response.
   - For existing files, return the FULL updated content.` :
`PLANNING MODE CAPABILITIES:
1. You are here to DISCUSS and PLAN. 
2. You MUST NOT include the JSON project structure for automatic file changes.
3. If you suggest code, provide it in regular markdown code blocks for the user to read.
4. Focus on explaining concepts, architectural decisions, and answering technical questions.`}

VISION/IMAGE CAPABILITIES:
1. If the user provides an image/screenshot, your primary task is to translate it into code.
2. Generate modern, responsive UI using HTML, Tailwind CSS, or the user's preferred framework.
3. Be precise with colors, spacing, and layout to match the provided image.

IF context about existing files is provided (under "# Workspace Context" or "# Active File"):
1. Use this context to understand the current codebase.
2. When asked to modify or fix a file (in Agent or Debug mode), you MUST return the FULL updated content of the file.
3. Maintain existing coding styles, indentation, and patterns.

${(isAgent || isDebug) ? `
FOR FILE UPDATES (${mode.charAt(0).toUpperCase() + mode.slice(1)} Mode):
1. Include a valid JSON structure in a markdown code block tagged with 'json'.
2. Structure: 
{
  "projectName": "project-name",
  "description": "Brief description of the fix/change",
  "folders": ["src"],
  "files": [{"path": "src/file.js", "content": "..."}],
  "suggestedCommands": ["npm start"]
}` : ''}

Otherwise, respond conversationally.`;
    }

    /**
     * User prompt template
     */
    public getUserPrompt(taskDescription: string): string {
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
