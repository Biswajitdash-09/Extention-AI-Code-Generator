import * as vscode from 'vscode';

export interface UsageEntry {
    timestamp: number;
    provider: string;
    model: string;
    tokensUsed: number;
    estimatedCost: number;
}

export interface UsageSummary {
    totalTokens: number;
    totalCost: number;
    byProvider: Record<string, { tokens: number; cost: number }>;
    daily: Record<string, { tokens: number; cost: number }>;
}

export class UsageTracker {
    private static readonly STORAGE_KEY = 'aiCodeGenerator.usage';

    // Pricing per 1M tokens (as of Feb 2026, approximate)
    private static readonly PRICING: Record<string, { input: number; output: number }> = {
        'gpt-4o-mini': { input: 0.15, output: 0.60 },
        'gpt-4o': { input: 2.50, output: 10.00 },
        'gemini-1.5-flash': { input: 0.075, output: 0.30 },
        'gemini-1.5-pro': { input: 1.25, output: 5.00 },
        'llama-3.3-70b': { input: 0.00, output: 0.00 }, // Groq is free
        'codellama': { input: 0.00, output: 0.00 } // Ollama is local/free
    };

    constructor(private context: vscode.ExtensionContext) { }

    /**
     * Track usage for a request
     */
    async trackUsage(provider: string, model: string, tokensUsed: number): Promise<void> {
        const pricing = UsageTracker.PRICING[model] || { input: 0, output: 0 };
        // Approximate 50/50 input/output split
        const cost = ((tokensUsed / 2) / 1000000) * pricing.input + ((tokensUsed / 2) / 1000000) * pricing.output;

        const entry: UsageEntry = {
            timestamp: Date.now(),
            provider,
            model,
            tokensUsed,
            estimatedCost: cost
        };

        const usage = this.getUsage();
        usage.push(entry);

        // Keep last 1000 entries
        if (usage.length > 1000) {
            usage.splice(0, usage.length - 1000);
        }

        await this.context.globalState.update(UsageTracker.STORAGE_KEY, usage);
    }

    /**
     * Get all usage entries
     */
    getUsage(): UsageEntry[] {
        return this.context.globalState.get<UsageEntry[]>(UsageTracker.STORAGE_KEY) || [];
    }

    /**
     * Get usage summary
     */
    getSummary(days: number = 30): UsageSummary {
        const usage = this.getUsage();
        const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
        const recentUsage = usage.filter(entry => entry.timestamp >= cutoffTime);

        const summary: UsageSummary = {
            totalTokens: 0,
            totalCost: 0,
            byProvider: {},
            daily: {}
        };

        for (const entry of recentUsage) {
            summary.totalTokens += entry.tokensUsed;
            summary.totalCost += entry.estimatedCost;

            // By provider
            if (!summary.byProvider[entry.provider]) {
                summary.byProvider[entry.provider] = { tokens: 0, cost: 0 };
            }
            summary.byProvider[entry.provider].tokens += entry.tokensUsed;
            summary.byProvider[entry.provider].cost += entry.estimatedCost;

            // By day
            const date = new Date(entry.timestamp).toISOString().split('T')[0];
            if (!summary.daily[date]) {
                summary.daily[date] = { tokens: 0, cost: 0 };
            }
            summary.daily[date].tokens += entry.tokensUsed;
            summary.daily[date].cost += entry.estimatedCost;
        }

        return summary;
    }

    /**
     * Clear all usage data
     */
    async clearUsage(): Promise<void> {
        await this.context.globalState.update(UsageTracker.STORAGE_KEY, []);
    }

    /**
     * Export usage data as JSON
     */
    exportUsage(): string {
        const usage = this.getUsage();
        return JSON.stringify(usage, null, 2);
    }
}
