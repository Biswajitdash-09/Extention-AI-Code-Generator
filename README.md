# AI Code Generator - VS Code Extension

Generate complete project structures and production-ready code from natural language using AI.

![Version](https://img.shields.io/badge/version-0.0.1-blue.svg)
![VS Code](https://img.shields.io/badge/VS%20Code-1.85%2B-green.svg)

## ✨ Features

- 🤖 **Multi-Model Support**: Choose from multiple AI providers
  - **OpenAI** (GPT-4o, GPT-4o-mini) - Best quality
  - **Google Gemini** - Free tier available
  - **Groq** - Fast inference, free tier
  - **Ollama** - Run locally, completely free

- 📁 **Auto Project Generation**: Automatically creates folders and files
- 📝 **Production-Ready Code**: Generates complete, working code
- ⚡ **Fast Setup**: Get started in seconds

## 🚀 Quick Start

1. Install the extension
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
3. Run `AI: Generate Project from Task`
4. Describe your project (e.g., "Create a React login page with form validation")
5. Watch your project get generated! 🎉

## ⚙️ Configuration

### Setting up API Keys

1. Open VS Code Settings (`Ctrl+,`)
2. Search for "AI Code Generator"
3. Enter your API key for your preferred provider:

| Provider | Get API Key | Free Tier |
|----------|-------------|-----------|
| Gemini | [aistudio.google.com](https://aistudio.google.com) | ✅ Yes |
| Groq | [console.groq.com](https://console.groq.com) | ✅ Yes |
| OpenAI | [platform.openai.com](https://platform.openai.com) | ❌ No |
| Ollama | [ollama.ai](https://ollama.ai) | ✅ Free (Local) |

### Selecting a Provider

Run `AI: Select AI Model` to switch between providers.

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
4. Select "Ollama (Local)" as your provider

## 📖 Commands

| Command | Description |
|---------|-------------|
| `AI: Generate Project from Task` | Generate a project from natural language |
| `AI: Select AI Model` | Switch between AI providers |

## 🛠️ Development

### Build from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/ai-code-generator

# Install dependencies
npm install

# Compile
npm run compile

# Run in development mode
# Press F5 in VS Code
```

### Package for Distribution

```bash
# Install vsce
npm install -g @vscode/vsce

# Package
vsce package

# Publish
vsce publish
```

## 📋 Settings Reference

| Setting | Description | Default |
|---------|-------------|---------|
| `aiCodeGenerator.provider` | Active AI provider | `gemini` |
| `aiCodeGenerator.openai.apiKey` | OpenAI API key | - |
| `aiCodeGenerator.openai.model` | OpenAI model | `gpt-4o-mini` |
| `aiCodeGenerator.gemini.apiKey` | Gemini API key | - |
| `aiCodeGenerator.gemini.model` | Gemini model | `gemini-1.5-flash` |
| `aiCodeGenerator.groq.apiKey` | Groq API key | - |
| `aiCodeGenerator.groq.model` | Groq model | `llama-3.3-70b-versatile` |
| `aiCodeGenerator.ollama.baseUrl` | Ollama server URL | `http://localhost:11434` |
| `aiCodeGenerator.ollama.model` | Ollama model | `codellama` |

## 🐛 Troubleshooting

### "API key is required"
- Go to Settings > AI Code Generator
- Enter your API key for the selected provider

### "Ollama is not running"
- Make sure Ollama is installed and running
- Start with: `ollama serve`

### "Model not found" (Ollama)
- Pull the model first: `ollama pull codellama`

## 📄 License

MIT License - feel free to use and modify!

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
