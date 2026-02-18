export interface Template {
    id: string;
    name: string;
    description: string;
    icon: string;
    tags: string[];
    prompt: string;
}

export class TemplateService {
    private static templates: Template[] = [
        {
            id: 'nextjs-supabase',
            name: 'Fullstack Next.js + Supabase',
            description: 'Modern web app with auth, database, and edge functions.',
            icon: '⚡',
            tags: ['React', 'Next.js', 'Supabase', 'Tailwind'],
            prompt: 'Generate a full-stack Next.js application integrated with Supabase. Include authentication, a dashboard page, and a database schema for a simple todo app.'
        },
        {
            id: 'fastapi-tailwind',
            name: 'Python FastAPI + Tailwind',
            description: 'High-performance API with a beautiful frontend.',
            icon: '🐍',
            tags: ['Python', 'FastAPI', 'HTML', 'Tailwind'],
            prompt: 'Generate a Python FastAPI backend with a modern HTML/Tailwind CSS frontend. Include a few example API endpoints and a responsive landing page.'
        },
        {
            id: 'typescript-library',
            name: 'Modern TS Library',
            description: 'Best practices for building npm packages.',
            icon: '📦',
            tags: ['TypeScript', 'Testing', 'npm'],
            prompt: 'Generate a modern TypeScript library boilerplate with Vitest for testing, Prettier, and ESLint configured.'
        },
        {
            id: 'chrome-extension',
            name: 'AI Chrome Extension',
            description: 'Template for building AI-powered browser extensions.',
            icon: '🌐',
            tags: ['JavaScript', 'API', 'Chrome'],
            prompt: 'Generate a manifest v3 Chrome extension with a popup UI and background script configured for AI API interactions.'
        }
    ];

    public static getTemplates(): Template[] {
        return this.templates;
    }

    public static getTemplate(id: string): Template | undefined {
        return this.templates.find(t => t.id === id);
    }
}
