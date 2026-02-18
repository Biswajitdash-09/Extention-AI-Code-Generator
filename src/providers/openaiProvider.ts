import { BaseProvider } from './baseProvider';
import { ProviderConfig, ProviderResult, ChatMessage } from '../types';
import OpenAI from 'openai';

/**
 * OpenAI Provider (GPT-4o, GPT-4o-mini, etc.)
 * Uses the official OpenAI SDK for robust API interactions
 */
export class OpenAIProvider extends BaseProvider {
    private client: OpenAI | undefined;

    get name(): string {
        return 'OpenAI';
    }

    private getClient(): OpenAI {
        if (!this.client) {
            this.client = new OpenAI({
                apiKey: this.config.apiKey,
                timeout: 120000 // 120 second timeout for all requests
            });
        }
        return this.client;
    }

    validate(): { valid: boolean; error?: string } {
        if (!this.config.apiKey) {
            return {
                valid: false,
                error: 'OpenAI API key is required. Set it in Settings > CodeForge AI > OpenAI API Key'
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
            const client = this.getClient();
            
            const messagesWithVision = messages.map(m => {
                if (m.role === 'user' && m.image) {
                    return {
                        role: m.role,
                        content: [
                            { type: 'text', text: m.content },
                            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${m.image}` } }
                        ]
                    } as any;
                }
                return { role: m.role, content: m.content };
            });

            const response = await client.chat.completions.create({
                model: this.config.model || 'gpt-4o-mini',
                messages: messagesWithVision,
                temperature: 0.7,
                max_tokens: 16000
            });

            const content = response.choices[0]?.message?.content;

            if (!content) {
                return { success: false, error: 'No response content from OpenAI' };
            }

            const parsed = this.parseJsonResponse(content);
            if (!parsed.success) {
                // If parsing failed, assume it might be a chat response
                return {
                    success: true,
                    message: content,
                    tokensUsed: response.usage?.total_tokens
                };
            }

            return {
                success: true,
                projectStructure: parsed.data,
                tokensUsed: response.usage?.total_tokens
            };

        } catch (error) {
            return {
                success: false,
                error: `OpenAI request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    async streamChat(messages: ChatMessage[], onDelta: (delta: string) => void): Promise<ProviderResult> {
        const validation = this.validate();
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        try {
            const client = this.getClient();
            const messagesWithVision = messages.map(m => {
                if (m.role === 'user' && m.image) {
                    return {
                        role: m.role,
                        content: [
                            { type: 'text', text: m.content },
                            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${m.image}` } }
                        ]
                    } as any;
                }
                return { role: m.role, content: m.content };
            });

            const stream = await client.chat.completions.create({
                model: this.config.model || 'gpt-4o-mini',
                messages: messagesWithVision,
                temperature: 0.7,
                max_tokens: 16000,
                stream: true
            });

            let fullContent = '';
            for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta?.content || '';
                if (delta) {
                    fullContent += delta;
                    onDelta(delta);
                }
            }

            const parsed = this.parseJsonResponse(fullContent);
            if (!parsed.success) {
                return { success: true, message: fullContent };
            }

            return { success: true, projectStructure: parsed.data };

        } catch (error) {
            return { 
                success: false, 
                error: `OpenAI streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
            };
        }
    }

    async getEmbeddings(text: string): Promise<number[]> {
        const client = this.getClient();
        const response = await client.embeddings.create({
            model: 'text-embedding-3-small',
            input: text.replace(/\n/g, ' ')
        });
        return response.data[0].embedding;
    }
}
