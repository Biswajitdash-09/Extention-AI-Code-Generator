# AI Code Generator - VS Code Extension

Generate complete project structures, modify existing code, and get AI-powered coding assistance — all from natural language. Supports multiple AI providers including OpenAI, Gemini, Groq, and local Ollama models.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![VS Code](https://img.shields.io/badge/VS%20Code-1.85%2B-green.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## ✨ Features

### 🤖 Multi-Provider AI Chat

Choose from multiple AI providers — switch anytime:

| Provider          | Models                                          | Free Tier     |
| ----------------- | ----------------------------------------------- | ------------- |
| **OpenAI**        | GPT-4o, GPT-4o-mini, GPT-4-turbo, GPT-3.5-turbo | ❌ Paid       |
| **Google Gemini** | Gemini 2.0 Flash, 1.5 Flash, 1.5 Pro            | ✅ Yes        |
| **Groq**          | Llama 3.3 70B, Llama 3.1 8B, Mixtral 8x7B       | ✅ Yes        |
| **Ollama**        | CodeLlama, DeepSeek Coder, Llama3, Mistral      | ✅ Local/Free |

### 💬 Three Chat Modes

- **Agent Mode** — Generate and modify project files from conversation
- **Planning Mode** — Discuss architecture and design without auto-applying changes
- **Debug Mode** — Paste stack traces and errors for targeted fix suggestions

### 📁 Project Generation

Describe what you want in natural language and get a complete project with folders, files, and working code — ready to run.

### 👻 Ghost Text Inline Suggestions

AI-powered code completions appear as ghost text while you type. Accept with `Tab`, navigate with arrows, dismiss with `Escape`.

### 🖼️ Vision / Image-to-Code

Upload a screenshot or UI design and let AI convert it into responsive code using your preferred framework.

### 🔧 Code Actions & Quick Fixes

AI-powered lightbulb suggestions for fixing errors, refactoring code, and improving quality — integrated directly into the VS Code editor.

### 📋 Context Menu Integration

Right-click in the editor to:

- **Explain Code** — Get a plain-English explanation of selected code
- **Fix Code** — AI-powered bug fix suggestions
- **Improve Code** — Optimize and refactor selected code
- **Add to Context** — Include selected code in the AI chat context

### 🖥️ Terminal Integration

- **Generate Terminal Command** — Describe what you want and get the CLI command
- **Fix Command** — Right-click a failed command for AI-powered fixes
- **Explain Command** — Understand what a complex command does

### 🔀 Git Integration

- **Generate Commit Message** — AI analyzes your staged changes and writes a descriptive commit message

### 📊 Diff View

Side-by-side comparison view when modifying existing files, showing exactly what changed.

### 🚀 One-Click Deployment

Deploy generated projects directly to **Vercel**, **Netlify**, or **Firebase** from within VS Code.

### 🔐 Firebase Authentication

Optional login to sync your generation history across devices via Firebase.

### 📈 Usage Tracking

Monitor API token usage and estimated costs per provider to keep spending under control.

### 🧩 Template Marketplace

Quick-start templates for common project types to speed up generation.

## 🚀 Quick Start

1. **Install** the extension from the VS Code Marketplace
2. **Set your API key**: Open Settings (`Ctrl+,`) → Search "AI Code Generator" → Enter your key
3. **Start chatting**: Click the AI Code Generator icon in the sidebar Activity Bar
4. **Generate a project**: Type a description like _"Create a React dashboard with charts and dark mode"_
5. **Review & apply**: Inspect the generated files in the Build tab, then click Apply

## ⌨️ Keyboard Shortcuts

| Shortcut                       | Action                            |
| ------------------------------ | --------------------------------- |
| `Ctrl+I` / `Cmd+I`             | Quick Task — Inline Suggestion    |
| `Ctrl+L` / `Cmd+L`             | Generate Smart Inline Suggestions |
| `Tab`                          | Accept Current Ghost Suggestion   |
| `Shift+Tab`                    | Accept All Ghost Suggestions      |
| `Escape`                       | Cancel Ghost Suggestions          |
| `Ctrl+Shift+G` / `Cmd+Shift+G` | Generate Terminal Command         |
| `Ctrl+Shift+A` / `Cmd+Shift+A` | Focus Chat Input                  |
| `Alt+Ctrl+C` / `Alt+Cmd+C`     | New Chat Session                  |
| `Alt+A`                        | Accept Suggestion                 |
| `Alt+R`                        | Reject Suggestion                 |
| `Ctrl+Alt+A` / `Cmd+Alt+A`     | Accept All Suggestions            |
| `Ctrl+Alt+R` / `Cmd+Alt+R`     | Reject All Suggestions            |

## 📖 All Commands

| Command                                 | Description                                   |
| --------------------------------------- | --------------------------------------------- |
| `AI: Generate Project from Task`        | Generate a full project from a description    |
| `AI: Select AI Model`                   | Switch between AI providers                   |
| `AI: Login / Sign Up`                   | Authenticate with Firebase                    |
| `AI: Quick Task (Inline Suggestion)`    | Get a quick inline code suggestion            |
| `AI: Generate Smart Inline Suggestions` | Generate contextual ghost text                |
| `AI: Apply Current Suggestion`          | Apply the currently shown suggestion          |
| `AI: Apply All Suggestions`             | Apply all pending suggestions                 |
| `AI: Cancel Suggestions`                | Dismiss ghost text suggestions                |
| `AI: Go to Next/Previous Suggestion`    | Navigate between suggestions                  |
| `AI: Generate Terminal Command`         | Describe a task and get the CLI command       |
| `AI: Generate Commit Message`           | AI-written commit message from staged changes |
| `AI: Focus Chat Input`                  | Jump to the chat input box                    |
| `AI: New Chat Session`                  | Start a fresh conversation                    |
| `AI: Accept/Reject Suggestion`          | Accept or reject individual suggestions       |
| `AI: Accept/Reject All Suggestions`     | Batch accept or reject                        |
| `AI: Apply Quick Fix`                   | Apply AI-suggested quick fix                  |
| `AI: Refactor Code`                     | AI-powered code refactoring                   |
| `AI: Show Suggestion Diff`              | View diff of suggested changes                |

### Right-Click Context Menu (Editor)

| Command        | Description                     |
| -------------- | ------------------------------- |
| Explain Code   | Get a plain-English explanation |
| Fix Code       | AI-powered bug fix              |
| Improve Code   | Optimize and refactor           |
| Add to Context | Include in AI chat context      |

### Right-Click Context Menu (Terminal)

| Command                         | Description                        |
| ------------------------------- | ---------------------------------- |
| Add Terminal Content to Context | Include terminal output in context |
| Fix This Command                | Fix a failed command               |
| Explain This Command            | Understand a complex command       |

## ⚙️ Configuration

### Setting up API Keys

1. Open VS Code Settings (`Ctrl+,`)
2. Search for "AI Code Generator"
3. Enter your API key for your preferred provider:

| Provider | Get API Key                                        | Free Tier       |
| -------- | -------------------------------------------------- | --------------- |
| Gemini   | [aistudio.google.com](https://aistudio.google.com) | ✅ Yes          |
| Groq     | [console.groq.com](https://console.groq.com)       | ✅ Yes          |
| OpenAI   | [platform.openai.com](https://platform.openai.com) | ❌ No           |
| Ollama   | [ollama.ai](https://ollama.ai)                     | ✅ Free (Local) |

### Ollama Setup (Free Local AI)

1. Install Ollama from [ollama.ai](https://ollama.ai)
2. Pull a coding model:
   ```bash
   ollama pull codellama
   ```
3. Start Ollama:
   ```bash
   ollama serve
   ```
4. Select "Ollama (Local)" as your provider in Settings

## 📋 Settings Reference

| Setting                             | Description           | Default                   |
| ----------------------------------- | --------------------- | ------------------------- |
| `aiCodeGenerator.provider`          | Active AI provider    | `gemini`                  |
| `aiCodeGenerator.openai.apiKey`     | OpenAI API key        | —                         |
| `aiCodeGenerator.openai.model`      | OpenAI model          | `gpt-4o-mini`             |
| `aiCodeGenerator.gemini.apiKey`     | Gemini API key        | —                         |
| `aiCodeGenerator.gemini.model`      | Gemini model          | `gemini-1.5-flash`        |
| `aiCodeGenerator.groq.apiKey`       | Groq API key          | —                         |
| `aiCodeGenerator.groq.model`        | Groq model            | `llama-3.3-70b-versatile` |
| `aiCodeGenerator.ollama.baseUrl`    | Ollama server URL     | `http://localhost:11434`  |
| `aiCodeGenerator.ollama.model`      | Ollama model          | `codellama`               |
| `aiCodeGenerator.enableCodeActions` | Enable AI quick fixes | `true`                    |

## 🐛 Troubleshooting

### "API key is required"

- Go to Settings > AI Code Generator and enter your API key for the selected provider

### "Ollama is not running"

- Make sure Ollama is installed and running: `ollama serve`

### "Model not found" (Ollama)

- Pull the model first: `ollama pull codellama`

### Ghost text not appearing

- Ensure the cursor is in an editor and the file is not read-only
- Try pressing `Ctrl+L` to trigger suggestions manually

## 🛠️ Development

### Build from Source

```bash
git clone https://github.com/AmarPradhanDash/ai-code-generator
cd ai-code-generator
npm install
npm run compile
# Press F5 in VS Code to launch Extension Development Host
```

### Package for Distribution

```bash
npm install -g @vscode/vsce
vsce package
vsce publish
```

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Copy `.env.example` to `.env` and add your API keys
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request
