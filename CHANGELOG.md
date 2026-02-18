# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-02-18

### Added

- **Multi-Provider AI Chat** — OpenAI (GPT-4o, GPT-4o-mini), Google Gemini (2.0 Flash, 1.5 Flash/Pro), Groq (Llama 3.3, Mixtral), and Ollama (local models)
- **Chat Modes** — Agent, Planning, and Debug modes with tailored prompts
- **Ghost Text Inline Suggestions** — AI-powered code completions with Tab/Escape/Arrow key navigation
- **Project Generation** — Generate full project structures from natural language descriptions
- **Vision/Image-to-Code** — Upload screenshots and convert them to working code
- **Context Menu Integration** — Explain, Fix, Improve code and Add to Context from the editor
- **Terminal Integration** — Explain/Fix terminal commands, generate CLI commands
- **Git Integration** — AI-generated commit messages from staged changes
- **Code Actions** — AI-powered quick fixes and refactoring via lightbulb suggestions
- **Diff View** — Side-by-side comparison for file modifications
- **Deployment Support** — One-click deploy to Vercel, Netlify, or Firebase
- **Firebase Authentication** — Login/Signup with cloud history sync
- **Workspace Analysis** — Semantic search and context-aware code understanding
- **Usage Tracking** — Monitor API usage and estimated costs per provider
- **Template Marketplace** — Quick-start project templates
- **Keyboard Shortcuts** — Ctrl+I (quick task), Ctrl+L (suggestions), Ctrl+Shift+A (focus chat), and more

### Security

- Firebase client config embedded directly (no `.env` dependency in production)
- Content Security Policy headers in webview
- API keys stored via VS Code settings (per-user, encrypted)

## [0.0.1] - 2026-01-24

### Added

- Initial release
- Multi-model AI support (OpenAI, Gemini, Groq, Ollama)
- Command: "AI: Generate Project from Task"
- Command: "AI: Select AI Model"
- Auto folder and file generation
- VS Code settings for API keys and model selection
- Progress indicator during generation
- Error handling with user-friendly messages
