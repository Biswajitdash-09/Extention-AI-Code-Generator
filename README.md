# CodeForge AI - VS Code Extension

Generate complete project structures, modify existing code, and get AI-powered coding assistance — all from natural language. Supports multiple AI providers including OpenAI, Gemini, Groq, and local Ollama models.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![VS Code](https://img.shields.io/badge/VS%20Code-1.85%2B-green.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

---

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

### 💡 Semantic Code Indexing

Build a vector index of your workspace for intelligent, context-aware code search. Find relevant files and functions based on semantic similarity rather than just keywords.

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

---

## 🏢 Architecture & Design Patterns

CodeForge AI follows a modular architecture with clear separation of concerns and enterprise-grade design patterns:

```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Extension Host                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   Views     │  │  Providers  │  │  Services   │          │
│  │  (UI Layer) │  │  (AI Layer) │  │ (Logic)     │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│         │                  │                 │               │
│         ▼                  ▼                 �▼               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  Features   │  │  Commands   │  │   Types     │          │
│  │ (Sub-Mods)  │  │ (11 Hosts)  │  │ (Shared)    │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

### Design Patterns

**1. Abstract Factory Pattern** (Providers)
- [`BaseProvider`](src/providers/baseProvider.ts:7) defines the contract for all AI providers
- Each provider implements: [`name`](src/providers/baseProvider.ts:21), [`validate()`](src/providers/baseProvider.ts:26), [`chat()`](src/providers/baseProvider.ts:31), [`streamChat()`](src/providers/baseProvider.ts:36), [`getEmbeddings()`](src/providers/baseProvider.ts:41)
- [`ProviderManager`](src/providers/providerManager.ts) handles provider selection and configuration

**2. Strategy Pattern** (Chat Modes)
- Three distinct system prompts for different modes via [`getChatSystemPrompt()`](src/providers/baseProvider.ts:95)
  - **Agent Mode**: Generates complete JSON project structures
  - **Debug Mode**: Analyzes stack traces and produces minimal fixes
  - **Planning Mode**: Conversational archetype discussions
- Mode switching preserves context while changing AI behavior

**3. Decorator Pattern** (Ghost Text)
- [`SuggestionDecorator`](src/features/ghost/suggestionDecorator.ts) manages VS Code decorations
- Renders ghost text at cursor position without modifying document
- Applied/Removed through decoration type ranges

**4. Singleton Pattern** (Services)
- [`IndexingService`](src/services/indexingService.ts:13), [`WorkspaceAnalyzer`](src/services/workspaceAnalyzer.ts:26) use static methods
- Centralized state management for workspace-wide operations
- Ensures single indexing instance per workspace

**5. Observer Pattern** (Chat Interaction)
- Streaming responses use callback pattern: `onDelta: (delta: string) => void`
- Real-time token delivery enables progressive UI updates
- WebSocket-style SSE (Server-Sent Events) implementation

### Core Components

- **Views Layer** — Chat UI with 4 tabs (CHAT, BUILD, TERMINAL, HISTORY)
- **Providers Layer** — Multi-provider abstraction with unified interface
- **Services Layer** — Workspace analysis, vector indexing, deployment orchestration
- **Features Layer** — Ghost text suggestions with lifecycle management
- **Commands Layer** — 11 command handlers mapping to user actions

---

## 🧪 Technical Implementation Details

### AI Provider Architecture

All providers implement the [`BaseProvider`](src/providers/baseProvider.ts:7) abstract class:

```typescript
abstract class BaseProvider {
  abstract chat(messages: ChatMessage[]): Promise<ProviderResult>
  abstract streamChat(messages: ChatMessage[], onDelta: (delta: string) => void): Promise<ProviderResult>
  abstract getEmbeddings(text: string): Promise<number[]>
  abstract validate(): { valid: boolean; error?: string }
}
```

**Provider implementations:**
- **OpenAI**: Uses official OpenAI SDK 4.x with streaming support
- **Gemini**: REST API with custom SSE parser for streaming
- **Groq**: REST API with ultra-fast inference (3-4x faster than OpenAI)
- **Ollama**: Local model inference with zero network latency

### System Prompt Engineering

The extension uses highly optimized system prompts for each mode ([`baseProvider.ts:95`](src/providers/baseProvider.ts:95)):

**Agent Mode Prompt:**
```
You are in AGENT mode — your job is to BUILD things.
CRITICAL RULES:
1. Generate JSON project structures
2. Production-ready code, no placeholders
3. Include ALL necessary files (HTML, CSS, JS/TS, configs)
4. Complete file content, never "..."
```

**Debug Mode Prompt:**
```
You are in DEBUG mode.
PRIMARY GOAL: Fix errors.
RULES:
1. Analyze STACK TRACES and ERROR MESSAGES
2. Identify EXACT file and line causing issue
3. Propose SMALLEST possible fix
```

**Planning Mode Prompt:**
```
You are in PLANNING mode.
RULES:
1. DISCUSS and PLAN — do NOT generate JSON
2. Provide code in markdown blocks for reading
3. Focus on architecture and design decisions
```

### JSON Response Standardization

All AI responses are parsed through [`parseJsonResponse()`](src/providers/baseProvider.ts:200) with robust error handling:

```typescript
{
  "projectName": "project-name",
  "description": "Brief description",
  "folders": ["src", "src/components", "public"],
  "files": [
    {
      "path": "index.html",
      "content": "<!DOCTYPE html>\\n<html>...</html>"
    }
  ],
  "suggestedCommands": ["npm install", "npm start"]
}
```

**Parsing logic:**
- Removes markdown code blocks (`\`\`\`json`)
- Extracts JSON object with regex
- Validates required fields: `files`, `folders`
- Ensures `files` array exists and contains complete content

### Workspace Analysis & Context Building

[`WorkspaceAnalyzer`](src/services/workspaceAnalyzer.ts:26) intelligently constructs context:

**Token Management:**
- Conservative limit: **8,000 tokens** per context
- File size limit: **50KB** per file
- Priority extensions: `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.java`, `.go`, `.rs`, `.cpp`, `.c`
- Ignored directories: `node_modules`, `.git`, `dist`, `build`, `.next`, `coverage`, `__pycache__`
- Ignored files: `.DS_Store`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`

**Smart File Selection:**
- Builds async file tree using [`vscode.workspace.fs.readDirectory()`](src/services/workspaceAnalyzer.ts:83) to avoid blocking
- Framework detection from [`package.json`](src/services/workspaceAnalyzer.ts:235) and import statements
- Estimates tokens with rough approximation (1 token ≈ 4 characters) via [`estimateTokens()`](src/services/workspaceAnalyzer.ts:204)
- Formats context with language-aware markdown code blocks via [`formatContextForPrompt()`](src/services/workspaceAnalyzer.ts:261)

**Framework Detection:**
```typescript
// Automatically detects: React, Vue, Angular, Next.js, Express, Fastify
// by scanning package.json dependencies and import statements
```

**Workspace Context Format:**
```markdown
# Workspace Context

Workspace contains 5 files with 150 total lines of code.
Languages: typescript, javascript
Detected frameworks: React

## Relevant Files

### src/app.ts (typescript, 45 lines)
```typescript
// file content here
```
```

### Vector Embeddings & Semantic Search

[`IndexingService`](src/services/indexingService.ts:13) implements semantic code search:

**Chunking Strategy:**
- **50 lines** per code chunk via [`chunkFile()`](src/services/indexingService.ts:123)
- **10 lines** overlapping context between chunks for continuity
- Preserves function and class boundaries
- Stores in `.ai-code-generator/vector-index.json`

**Cosine Similarity Search:**
```typescript
cosineSimilarity(a, b) = dot(a, b) / (||a|| * ||b||)
```
- Implemented via [`cosineSimilarity()`](src/services/indexingService.ts:105)
- Compares query embedding with all indexed chunks
- Returns top 5 most semantically similar code sections
- Enables "find similar implementations" queries

**Benefits:**
- Search by **meaning**, not just keywords
- Finds related patterns across your codebase
- AI understands your architectural style
- Faster context retrieval for complex projects

**Indexing Process:**
1. Recursively finds relevant files matching priority extensions
2. Reads each file and chunks into 50-line segments
3. Generates embeddings using selected AI provider's [`getEmbeddings()`](src/providers/baseProvider.ts:41)
4. Stores chunks + embeddings + line ranges to disk
5. Loads index on-demand via [`loadIndex()`](src/services/indexingService.ts:89)

### Ghost Text Lifecycle

[`SuggestionManager`](src/features/ghost/suggestionManager.ts:11) manages inline suggestions:

**Quick Task (Ctrl+I):** [`generateQuickSuggestion()`](src/features/ghost/suggestionManager.ts:40)
- User provides explicit prompt
- AI generates concise completion
- Single suggestion rendered at cursor

**Smart Inline (Ctrl+L):** [`generateSmartSuggestion()`](src/features/ghost/suggestionManager.ts:74)
- No user prompt required
- Extracts 10 lines before/after cursor via [`buildSuggestionRequest()`](src/features/ghost/suggestionManager.ts:206)
- AI analyzes surrounding code context
- Generates contextually appropriate completion

**State Management:**
```typescript
interface SuggestionState {
  suggestions: Suggestion[]
  currentIndex: number
  isProcessing: boolean
  activeEditor: TextEditor | undefined
}
```

**Navigation:**
- `Tab` → [`applyCurrentSuggestion()`](src/features/ghost/suggestionManager.ts:108) Accept current suggestion
- `Shift+Tab` → [`applyAllSuggestions()`](src/features/ghost/suggestionManager.ts:126) Accept all pending suggestions
- `Escape` → [`cancelSuggestions()`](src/features/ghost/suggestionManager.ts:172) Dismiss all suggestions
- Arrows → Navigate between suggestions via [`goToNextSuggestion()`](src/features/ghost/suggestionManager.ts:145) / [`goToPreviousSuggestion()`](src/features/ghost/suggestionManager.ts:158)

**VS Code Context Updates:**
- [`updateContext()`](src/features/ghost/suggestionManager.ts:267) sets `ghost.hasSuggestions` and `ghost.isProcessing` for keybinding conditions

### Streaming Response Architecture

WebSocket-style streaming for real-time token delivery:

```typescript
await provider.streamChat(
  messages, 
  (delta: string) => {
    // Called incrementally as tokens arrive
    appendToChatUI(delta);
  }
);
```

**Benefits:**
- Time-to-first-token reduced by ~80%
- Progressive rendering of long responses
- User can stop generation mid-response
- Reduces perceived latency for better UX

**Implementation:**
- OpenAI SDK: Native streaming with `stream: true` option
- Gemini/Groq: Custom SSE (Server-Sent Events) parser
- Token chunks appended to chat UI as they arrive
- Allows real-time feedback and interaction interruption

---

## 📁 Project Structure

```
src/
├── extension.ts                    # Entry point — activate/deactivate, 11 command registrations
├── commands/                       # 11 command handlers
│   ├── generateProject.ts          # Core project generation, JSON parsing
│   ├── auth.ts                     # Firebase login/logout
│   ├── contextMenu.ts              # Right-click editor actions (explain, fix, improve)
│   ├── refactor.ts                 # Refactor/optimize/explain code
│   ├── gitCommit.ts                # AI commit messages from diff
│   ├── ollama.ts                   # Local model management (list, pull)
│   ├── chatFocus.ts                # Chat UI controls (focus, new session)
│   ├── terminalCommand.ts          # Generate CLI commands from description
│   ├── terminalContext.ts          # Terminal right-click (fix, explain)
│   └── showDiff.ts                 # Diff view for file modifications
├── providers/                      # AI provider abstraction
│   ├── baseProvider.ts             # Abstract base class with 5 required methods
│   ├── openaiProvider.ts           # OpenAI SDK 4.x implementation
│   ├── geminiProvider.ts           # Google Gemini REST API
│   ├── groqProvider.ts             # Groq REST API (ultra-fast)
│   ├── ollamaProvider.ts           # Local Ollama REST API
│   └── providerManager.ts          # Factory pattern, provider switching
├── services/                       # Business logic
│   ├── workspaceAnalyzer.ts        # Analyze workspace structure, build context
│   ├── indexingService.ts          # Vector embeddings, semantic search
│   ├── deploymentService.ts        # Deploy to Vercel/Netlify/Firebase
│   ├── historyManager.ts           # Project generation history persistence
│   ├── authManager.ts              # Firebase auth state management
│   ├── firebaseService.ts          # Firebase SDK wrapper (Firestore, Auth)
│   ├── usageTracker.ts             # Track API usage & costs per provider
│   └── templateService.ts          # Starter templates for quick generation
├── features/                       # Feature modules
│   ├── ghost/                      # Inline suggestions
│   │   ├── ghostProvider.ts         # VS Code文字DecorationProvider
│   │   ├── suggestionManager.ts     # Lifecycle: generate, accept, reject, navigate
│   │   ├── suggestionDecorator.ts   # VS Code decoration rendering
│   │   └── aiProviderAdapter.ts     # Bridge to provider infrastructure
│   └── diff/
│       └── diffViewProvider.ts      # Side-by-side diff view
├── types/                          # Shared types
│   ├── provider.ts                 # ProviderConfig, ProviderResult, ChatMessage
│   └── project.ts                  # ProjectFile, ProjectFolder, GenerationResult
├── utils/
│   ├── fileSystem.ts               # File system operations
│   └── testGenerator.ts            # Test file generation
└── views/
    ├── chatView.ts                 # Multi-tab chat UI (CHAT, BUILD, TERMINAL, HISTORY)
    ├── historyView.ts              # Tree data provider for generation history
    └── loginPanel.ts               # Firebase login panel
```

---

## 🚀 Quick Start

1. **Install** the extension from the VS Code Marketplace
2. **Set your API key**: Open Settings (`Ctrl+,`) → Search "CodeForge AI" → Enter your key
3. **Start chatting**: Click the CodeForge AI icon in the sidebar Activity Bar
4. **Generate a project**: Type a description like _"Create a React dashboard with charts and dark mode"_
5. **Review & apply**: Inspect the generated files in the Build tab, then click Apply

---

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

---

## 📖 All Commands

### Command Palette Commands

| Command                                 | Description                                   | Handler                      |
| --------------------------------------- | --------------------------------------------- | ---------------------------- |
| `AI: Generate Project from Task`        | Generate a full project from a description    | [`generateProject.ts`](src/commands/generateProject.ts) |
| `AI: Select AI Model`                   | Switch between AI providers                   | [`providerManager.ts`](src/providers/providerManager.ts) |
| `AI: Login / Sign Up`                   | Authenticate with Firebase                    | [`auth.ts`](src/commands/auth.ts) |
| `AI: Refactor Selection`                | AI-powered code refactoring                   | [`refactor.ts`](src/commands/refactor.ts) |
| `AI: Add Documentation`                 | Generate JSDoc comments                       | [`refactor.ts`](src/commands/refactor.ts) |
| `AI: Optimize Code`                     | Optimize selected code                        | [`refactor.ts`](src/commands/refactor.ts) |
| `AI: Explain Code`                      | Get explanation of selected code              | [`refactor.ts`](src/commands/refactor.ts) |
| `AI: Generate Terminal Command`         | Describe a task and get the CLI command       | [`terminalCommand.ts`](src/commands/terminalCommand.ts) |
| `AI: Generate Commit Message`           | AI-written commit message from staged changes | [`gitCommit.ts`](src/commands/gitCommit.ts) |
| `AI: Index Workspace`                   | Build semantic index for intelligent search   | [`indexingService.ts`](src/services/indexingService.ts) |

### Ghost Text Commands

| Command                                 | Description                                   | Handler                      |
| --------------------------------------- | --------------------------------------------- | ---------------------------- |
| `AI: Quick Task (Inline Suggestion)`    | Get a quick inline code suggestion            | [`suggestionManager.ts`](src/features/ghost/suggestionManager.ts:40) |
| `AI: Generate Smart Inline Suggestions` | Generate contextual ghost text                | [`suggestionManager.ts`](src/features/ghost/suggestionManager.ts:74) |
| `AI: Apply Current Suggestion`          | Apply the currently shown suggestion          | [`suggestionManager.ts`](src/features/ghost/suggestionManager.ts:108) |
| `AI: Apply All Suggestions`             | Apply all pending suggestions                 | [`suggestionManager.ts`](src/features/ghost/suggestionManager.ts:126) |
| `AI: Cancel Suggestions`                | Dismiss ghost text suggestions                | [`suggestionManager.ts`](src/features/ghost/suggestionManager.ts:172) |
| `AI: Go to Next/Previous Suggestion`    | Navigate between suggestions                  | [`suggestionManager.ts`](src/features/ghost/suggestionManager.ts:145) |
| `AI: Accept/Reject Suggestion`          | Accept or reject individual suggestions       | Ghost text keyring bindings |
| `AI: Accept/Reject All Suggestions`     | Batch accept or reject                        | Ghost text keyring bindings |

### Chat Commands

| Command                                 | Description                                   | Handler                      |
| --------------------------------------- | --------------------------------------------- | ---------------------------- |
| `AI: Focus Chat Input`                  | Jump to the chat input box                    | [`chatFocus.ts`](src/commands/chatFocus.ts) |
| `AI: New Chat Session`                  | Start a fresh conversation                    | [`chatFocus.ts`](src/commands/chatFocus.ts) |

### Code Action Commands

| Command                                 | Description                                   | Handler                      |
| --------------------------------------- | --------------------------------------------- | ---------------------------- |
| `AI: Apply Quick Fix`                   | Apply AI-suggested quick fix                  | Refactor code action provider |
| `AI: Refactor Code`                     | AI-powered code refactoring                   | Refactor code action provider |
| `AI: Show Suggestion Diff`              | View diff of suggested changes                | [`showDiff.ts`](src/commands/showDiff.ts) |

### History Commands

| Command                                 | Description                                   | Handler                      |
| --------------------------------------- | --------------------------------------------- | ---------------------------- |
| `Refresh History`                       | Refresh project generation history            | History tree view provider  |
| `Clear History`                         | Clear all project generation history          | [`historyManager.ts`](src/services/historyManager.ts) |
| `Open Folder`                           | Open folder for a history item                | History tree view provider  |

### Right-Click Context Menu (Editor)

| Command        | Description                     | Handler                      |
| -------------- | ------------------------------- | ---------------------------- |
| Explain Code   | Get a plain-English explanation | [`contextMenu.ts`](src/commands/contextMenu.ts) |
| Fix Code       | AI-powered bug fix              | [`contextMenu.ts`](src/commands/contextMenu.ts) |
| Improve Code   | Optimize and refactor           | [`contextMenu.ts`](src/commands/contextMenu.ts) |
| Add to Context | Include in AI chat context      | [`contextMenu.ts`](src/commands/contextMenu.ts) |

### Right-Click Context Menu (Terminal)

| Command                         | Description                        | Handler                      |
| ------------------------------- | ---------------------------------- | ---------------------------- |
| Add Terminal Content to Context | Include terminal output in context | [`terminalContext.ts`](src/commands/terminalContext.ts) |
| Fix This Command                | Fix a failed command               | [`terminalContext.ts`](src/commands/terminalContext.ts) |
| Explain This Command            | Understand a complex command       | [`terminalContext.ts`](src/commands/terminalContext.ts) |

---

## ⚙️ Configuration

### Setting up API Keys

1. Open VS Code Settings (`Ctrl+,`)
2. Search for "CodeForge AI"
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

---

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

---

## 🔄 Semantic Code Indexing

The extension can build a vector index of your workspace for intelligent, context-aware code search:

1. Run `AI: Index Workspace` from the command palette
2. The extension processes all files in your workspace
3. Creates embeddings using your selected AI provider's [`getEmbeddings()`](src/providers/baseProvider.ts:41) method
4. Saves index to `.ai-code-generator/vector-index.json`
5. Use AI commands with `@workspace` to search semantically

**Technical Details:**
- Files are chunked into 50-line segments with 10-line overlap
- Cosine similarity search finds semantically related code
- Enables "find related implementations" queries
- AI understands your codebase architecture better with indexed context

**Benefits:**
- Find relevant code based on meaning, not just keywords
- AI understands your codebase structure better
- Faster context retrieval for complex projects
- Maintains contextual relationships between code sections

---

## 🚀 Deployment

Deploy generated projects directly from the Build tab:

### Vercel
```bash
# Install CLI (once)
npm i -g vercel

# Login (once)
vercel login
```

### Netlify
```bash
# Install CLI (once)
npm i -g netlify-cli

# Login (once)
netlify login
```

### Firebase
```bash
# Install CLI (once)
npm i -g firebase-tools

# Login (once)
firebase login
```

---

## 🧪 Testing

The project includes Mocha-based unit tests:

```bash
# Run tests
npm test

# Run specific test file
npm test -- --grep "JSON Response"
```

**Test Coverage:**
- Extension activation (3 tests)
- JSON response parsing (6 tests)
- Provider validation (5 tests)

---

## 🐛 Troubleshooting

### "API key is required"

- Go to Settings > CodeForge AI and enter your API key for the selected provider
- Ensure provider is set correctly in `aiCodeGenerator.provider`

### "Ollama is not running"

- Make sure Ollama is installed and running: `ollama serve`
- Check Ollama URL in settings: default is `http://localhost:11434`

### "Model not found" (Ollama)

- Pull the model first: `ollama pull codellama`
- Verify model name matches `aiCodeGenerator.ollama.model` setting

### Ghost text not appearing

- Ensure the cursor is in an editor and the file is not read-only
- Try pressing `Ctrl+L` to trigger suggestions manually
- Check that AI provider is configured with valid API key
- Verify `ghost.hasSuggestions` and `ghost.isProcessing` context keys

### Slow indexing

- Workspace indexing depends on file count and AI provider speed
- Consider using a faster provider (Groq, Gemini Flash) for indexing
- Large workspaces (>1000 files) may take several minutes
- Index is cached in `.ai-code-generator/vector-index.json` for reuse

### JSON parsing errors

- If AI returns malformed JSON, the extension's [`parseJsonResponse()`](src/providers/baseProvider.ts:200) attempts recovery
- Check that AI provider model supports JSON output format
- Some providers may need additional prompt engineering for reliable JSON

---

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

### Watch Mode for Development

```bash
npm run watch
```

This will recompile TypeScript files on change during development.

---

## 📖 Technology Stack

| Layer          | Technology                                         |
| -------------- | -------------------------------------------------- |
| **Runtime**    | VS Code Extension Host (Node.js)                   |
| **Language**   | TypeScript 5.x                                     |
| **Bundler**    | Webpack 5.x                                        |
| **Testing**    | Mocha + VS Code Test Electron                      |
| **AI Providers**| OpenAI SDK 4.x, Gemini/Groq REST APIs              |
| **Local AI**   | Ollama REST API                                    |
| **Auth**       | Firebase 12.x (Firestore, Authentication)          |
| **Deployment** | Vercel CLI, Netlify CLI, Firebase CLI               |
| **Git**        | simple-git 3.x                                     |
| **Utilities**  | nanoid (ID generation), archiver (zip creation)    |

---

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

## 📞 Support

For issues, questions, or feature requests, please visit:
- [GitHub Issues](https://github.com/AmarPradhanDash/ai-code-generator/issues)
- Check the [Technical Documentation](TECHNICAL_DOCUMENTATION.md) for deep architecture details

---

## 🎉 Authors

**Amar Pradhan & Biswajit Dash**

Created with ❤️ for developers who want AI-powered code generation in VS Code.
