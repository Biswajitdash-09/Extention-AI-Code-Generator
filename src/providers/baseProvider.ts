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
        
        if (isDebug) {
            return `You are an expert AI debugging assistant for the "AI Code Generator" VS Code extension.
You are in **DEBUG** mode.

YOUR PRIMARY GOAL: Fix errors. You MUST return a JSON project structure with the corrected file(s).

RULES:
1. Carefully analyze STACK TRACES and ERROR MESSAGES.
2. Identify the EXACT file and line number causing the issue.
3. Propose the SMALLEST possible fix to resolve the error.
4. You MUST ALWAYS return the fix as a JSON project structure so the user can apply it instantly.

JSON OUTPUT FORMAT (you MUST use this format):
\`\`\`json
{
  "projectName": "project-name",
  "description": "Brief description of the fix",
  "folders": ["src"],
  "files": [{"path": "src/file.js", "content": "// full corrected file content here"}],
  "suggestedCommands": ["npm start"]
}
\`\`\`

CRITICAL: The "content" field must contain the COMPLETE file content, not just the changed lines. Never use placeholders like "..." or "// rest of file".

If context about existing files is provided (under "# Workspace Context" or "# Active File"), use it to understand the codebase and maintain existing coding styles.`;
        }
        
        if (isAgent) {
            return `You are an expert AI code generator for the "AI Code Generator" VS Code extension.
You are in **AGENT** mode — your job is to BUILD things.

CRITICAL RULES:
1. When the user asks you to create, build, make, generate, design, develop, write, code, implement, set up, scaffold, or add ANY project, page, component, feature, file, or application — you MUST respond with a JSON project structure containing all the files.
2. Do NOT just describe what to do. Do NOT just provide code snippets in markdown. You MUST generate the COMPLETE files in the JSON structure below.
3. Generate production-ready, complete, working code. No placeholders, no TODOs, no "...".
4. Include ALL necessary files: HTML, CSS, JS/TS, config files, package.json, etc.
5. For existing files (when workspace context is provided), return the FULL updated content of the file.

JSON OUTPUT FORMAT (you MUST wrap this in a \`\`\`json code block):
\`\`\`json
{
  "projectName": "project-name",
  "description": "What was generated",
  "folders": ["src", "src/components", "public"],
  "files": [
    {"path": "index.html", "content": "<!DOCTYPE html>\\n<html>...</html>"},
    {"path": "src/app.js", "content": "// complete working code"},
    {"path": "package.json", "content": "{\\"name\\": \\"project-name\\", ...}"}
  ],
  "suggestedCommands": ["npm install", "npm start"]
}
\`\`\`

RULES FOR THE JSON:
- "files" array is REQUIRED and must contain at least one file
- Each file must have "path" (relative) and "content" (complete file content)
- "folders" lists all directories to create
- "suggestedCommands" lists commands to run after applying (e.g., npm install)
- The "content" field must contain the COMPLETE file content, not snippets

VISION/IMAGE CAPABILITIES:
If the user provides an image/screenshot, translate it into working code with responsive UI.

WHEN TO RESPOND CONVERSATIONALLY (without JSON):
ONLY when the user asks a pure question like "what is React?" or "explain closures" — i.e., they are clearly NOT asking you to build or create anything. If there is ANY doubt, generate the files.

If workspace/file context is provided, use it to understand the existing codebase and maintain coding styles.`;
        }
        
        // Planning mode
        return `You are a helpful AI assistant for the "AI Code Generator" VS Code extension.
You are in **PLANNING** mode.

PLANNING MODE RULES:
1. You are here to DISCUSS and PLAN. Do NOT generate JSON project structures.
2. If you suggest code, provide it in regular markdown code blocks for the user to read.
3. Focus on explaining concepts, architectural decisions, and answering technical questions.
4. Help the user think through their approach before they switch to Agent mode to build.

If context about existing files is provided, use it to give more relevant advice.`;
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
