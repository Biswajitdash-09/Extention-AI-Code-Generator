import * as vscode from 'vscode';
import { ProviderManager } from '../providers';
import { HistoryManager } from '../services/historyManager';
import { applyProjectStructure } from '../commands/generateProject';
import { FileSystemUtils } from '../utils';
import { WorkspaceAnalyzer, WorkspaceContext } from '../services/workspaceAnalyzer';
import { DeploymentService } from '../services/deploymentService';
import * as path from 'path';
import * as fs from 'fs';
import { ChatMessage } from '../types';
import { IndexingService } from '../services/indexingService';
import { TemplateService } from '../services/templateService';
import { UsageTracker } from '../services/usageTracker';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'aiCodeGenerator.chatView';
  private _view?: vscode.WebviewView;
  private _currentProjectStructure: any | undefined;
  private _currentMetadata: any | undefined;
  private _messages: ChatMessage[] = [];
  private _workspaceContext: WorkspaceContext | null = null;
  private _autoIncludeWorkspace: boolean = false;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _historyManager: HistoryManager,
    private readonly _usageTracker?: UsageTracker
  ) { }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'sendMessage': {
          await this.handleMessage(data.value, data.image, data.mode);
          break;
        }
        case 'getHistory': {
          this.updateHistory();
          break;
        }
        case 'applyProject': {
          await this.handleApplyProject();
          break;
        }
        case 'newChat': {
          this._messages = [];
          this._currentProjectStructure = undefined;
          this._currentMetadata = undefined;
          this._workspaceContext = null;
          break;
        }
        case 'deployProject': {
          await this.handleDeployProject();
          break;
        }
        case 'diffFile': {
          await this.handleDiffFile(data.path, data.content);
          break;
        }
        case 'openHistory': {
          // Logic to open a history item could go here
          vscode.commands.executeCommand('ai-code-generator.refreshHistory');
          break;
        }
        case 'runCommand': {
          this.handleRunCommand(data.value);
          break;
        }
        case 'openSettings': {
          vscode.commands.executeCommand('workbench.action.openSettings', 'aiCodeGenerator');
          break;
        }
        case 'searchFiles': {
          await this.handleSearchFiles(data.query);
          break;
        }
        case 'selectTemplate': {
          await this.handleSelectTemplate(data.id);
          break;
        }
        case 'fixLastError': {
          await this.handleFixLastError();
          break;
        }
      }
    });

    // Initial history and templates load
    this.updateHistory();
    this.sendTemplates();
  }

  private sendTemplates() {
    if (this._view) {
      const templates = TemplateService.getTemplates();
      this._view.webview.postMessage({ type: 'updateTemplates', value: templates });
    }
  }

  private updateHistory() {
    if (this._view) {
      const history = this._historyManager.getHistory();
      this._view.webview.postMessage({ type: 'updateHistory', value: history });
    }
  }

  private async handleApplyProject() {
    if (!this._currentProjectStructure || !this._currentMetadata) {
      vscode.window.showErrorMessage('No project to apply');
      return;
    }

    const workspaceRoot = await FileSystemUtils.getWorkspaceRoot();
    if (!workspaceRoot) {
      vscode.window.showWarningMessage('Please select a folder to workspace to apply the project.');
      return;
    }

    await applyProjectStructure(workspaceRoot, this._currentProjectStructure, this._currentMetadata);

    // Clear state after application
    this._currentProjectStructure = undefined;
    this._currentMetadata = undefined;

    if (this._view) {
      this._view.webview.postMessage({ type: 'projectApplied' });
    }
  }

  private async handleDeployProject() {
    const workspaceRoot = await FileSystemUtils.getWorkspaceRoot();
    if (!workspaceRoot) {
      vscode.window.showWarningMessage('Please select a folder to deploy.');
      return;
    }

    const result = await DeploymentService.deploy(workspaceRoot);

    if (result.success && result.url) {
      vscode.window.showInformationMessage(`Deployed to ${result.platform}: ${result.url}`, 'Open URL').then(selection => {
        if (selection === 'Open URL' && result.url) {
          vscode.env.openExternal(vscode.Uri.parse(result.url));
        }
      });

      if (this._view) {
        this._view.webview.postMessage({
          type: 'deploymentComplete',
          platform: result.platform,
          url: result.url
        });
      }
    } else {
      vscode.window.showErrorMessage(`Deployment failed: ${result.error}`);
    }
  }

  private async handleDiffFile(filePath: string, newContent: string) {
    const workspaceRoot = await FileSystemUtils.getWorkspaceRoot();
    if (!workspaceRoot) return;

    const fullPath = path.join(workspaceRoot, filePath);
    if (fs.existsSync(fullPath)) {
      const uri = vscode.Uri.file(fullPath);
      const doc = await vscode.workspace.openTextDocument(uri);

      // Create temp file for new content to show diff
      const tempUri = uri.with({ scheme: 'untitled', path: filePath + '.new' });
      const edit = new vscode.WorkspaceEdit();
      edit.insert(tempUri, new vscode.Position(0, 0), newContent);
      await vscode.workspace.applyEdit(edit);

      await vscode.commands.executeCommand('vscode.diff', uri, tempUri, `Diff: ${filePath}`);
    } else {
      vscode.window.showInformationMessage('File does not exist on disk yet.');
    }
  }
  private handleRunCommand(command: string) {
    const terminal = vscode.window.terminals.find(t => t.name === 'CodeForge AI') || vscode.window.createTerminal('CodeForge AI');
    terminal.show();
    terminal.sendText(command);
    
    // Show the fix button in the webview
    if (this._view) {
      this._view.webview.postMessage({ type: 'showFixButton', value: true });
    }
  }

  private async handleFixLastError() {
    if (!this._view) return;

    // Since we can't easily read terminal buffer, we'll ask the AI to "Fix the last error"
    // and instruct it to look for recent stack traces if the user pastes them, 
    // or to scan the workspace for recent changes that might have caused a break.
    
    const debugPrompt = "I encountered an error in the terminal while running the last command. Please analyze the workspace and help me fix it. If you need the specific error message, ask me to paste it, otherwise check my recent files for potential issues.";
    
    // Switch to debug mode and send message
    await this.handleMessage(debugPrompt, undefined, 'debug');
  }
  private async handleSelectTemplate(id: string) {
    const template = TemplateService.getTemplate(id);
    if (!template) return;
    
    // Switch to Chat tab and start generation
    if (this._view) {
      this._view.webview.postMessage({ type: 'startTemplate', value: template.name });
    }
    
    await this.handleMessage(template.prompt);
  }

  private async handleSearchFiles(query: string) {
    if (!this._view) return;
    
    const workspaceRoot = await FileSystemUtils.getWorkspaceRoot();
    if (!workspaceRoot) return;

    // Use a fast file search or IndexingService
    const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**');
    const filteredFiles = files
      .map(f => ({
        name: path.basename(f.fsPath),
        path: path.relative(workspaceRoot, f.fsPath)
      }))
      .filter(f => f.path.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 10); // Limit results

    this._view.webview.postMessage({
      type: 'contextSearchResults',
      value: filteredFiles
    });
  }

  private async handleMessage(content: string, image?: string, mode: string = 'agent') {
    if (!this._view) return;

    try {
      const provider = ProviderManager.getProvider();
      this._view.webview.postMessage({ type: 'setLoading', value: true });

      // Check for @workspace mention or auto-include setting
      const includeWorkspace = content.includes('@workspace') || this._autoIncludeWorkspace;
      
      // Remove @workspace mention from content
      const cleanedContent = content.replace(/@workspace/g, '').trim();

      // Gather additional context for iterative edits
      const activeFileContext = this.getActiveFileContext();
      const referencedFilesContext = await this.resolveReferencedFiles(cleanedContent);
      
      let contextPrompt = '';

      // Use semantic search for @workspace if available
      if (includeWorkspace) {
        try {
          const relevantChunks = await IndexingService.search(cleanedContent);
          if (relevantChunks.length > 0) {
            contextPrompt += `# Semantic Workspace Context (Top Matches)\n\n`;
            for (const chunk of relevantChunks) {
              contextPrompt += `### ${chunk.path} (lines ${chunk.range.start}-${chunk.range.end})\n\`\`\`\n${chunk.content}\n\`\`\`\n\n`;
            }
          } else if (!this._workspaceContext) {
            // Fallback to basic summary if no semantic matches or not indexed
            this._workspaceContext = await WorkspaceAnalyzer.analyzeWorkspace(3, true);
            if (this._workspaceContext) {
              contextPrompt += WorkspaceAnalyzer.formatContextForPrompt(this._workspaceContext);
              this._view.webview.postMessage({
                type: 'showWorkspaceContext',
                value: this._workspaceContext.summary
              });
            }
          }
        } catch (e) {
          console.error('Semantic search failed, falling back:', e);
          if (!this._workspaceContext) {
            this._workspaceContext = await WorkspaceAnalyzer.analyzeWorkspace(3, true);
            if (this._workspaceContext) {
              contextPrompt += WorkspaceAnalyzer.formatContextForPrompt(this._workspaceContext);
            }
          }
        }
      }

      // Prepend chat-specific system prompt to ensure AI knows its capabilities
      const messagesToSend: ChatMessage[] = [
        { role: 'system', content: provider.getChatSystemPrompt(mode) }
      ];
      
      // Add existing history
      messagesToSend.push(...this._messages);
      
      if (activeFileContext) {
        contextPrompt += `# Active File\n\n### ${activeFileContext.path} (${activeFileContext.language})\n\`\`\`${activeFileContext.language}\n${activeFileContext.content}\n\`\`\`\n\n`;
      }
      
      if (referencedFilesContext.length > 0) {
        contextPrompt += `# Referenced Files\n\n`;
        for (const file of referencedFilesContext) {
          // Avoid duplicating active file
          if (activeFileContext && file.path === activeFileContext.path) continue;
          contextPrompt += `### ${file.path} (${file.language})\n\`\`\`${file.language}\n${file.content}\n\`\`\`\n\n`;
        }
      }

      // Add user message to local history (without context to keep it clean)
      this._messages.push({ role: 'user', content: cleanedContent, image });

      // Prepend workspace context to the user message if available
      if (includeWorkspace && this._workspaceContext) {
        const workspacePrompt = WorkspaceAnalyzer.formatContextForPrompt(this._workspaceContext);
        contextPrompt = `${workspacePrompt}\n${contextPrompt}`;
      }

      if (contextPrompt) {
        messagesToSend[messagesToSend.length - 1].content = `${contextPrompt}\nUser Request: ${cleanedContent}`;
      }

      if (image) {
        messagesToSend[messagesToSend.length - 1].image = image;
      }
      let fullAssistantContent = '';
      this._view.webview.postMessage({ type: 'addMessage', role: 'assistant', content: '', isStreaming: true });

      const result = await provider.streamChat(messagesToSend, (delta) => {
        fullAssistantContent += delta;
        if (this._view) {
          this._view.webview.postMessage({ type: 'updateDelta', value: delta });
        }
      });

      if (result.success) {
        // If provider didn't extract a projectStructure, try fallback extraction from streamed content
        let projectStructure = result.projectStructure;
        if (!projectStructure && fullAssistantContent) {
          const extracted = this.tryExtractProjectStructure(fullAssistantContent);
          if (extracted) {
            projectStructure = extracted;
          }
        }

        if (projectStructure) {
          // Check for existing files to mark as modified
          const workspaceRoot = await FileSystemUtils.getWorkspaceRoot();
          if (workspaceRoot) {
            for (const file of projectStructure.files) {
              // Ensure status property exists
              if (!file.status) {
                const fullPath = path.join(workspaceRoot, file.path);
                file.status = fs.existsSync(fullPath) ? 'modified' : 'new';
              }
            }
          }

          this._currentProjectStructure = projectStructure;

          const providerConfig = vscode.workspace.getConfiguration('aiCodeGenerator');
          let model = 'unknown';
          if (provider.name.includes('OpenAI')) model = providerConfig.get('openai.model') || 'gpt-4o-mini';
          else if (provider.name.includes('Gemini')) model = providerConfig.get('gemini.model') || 'gemini-1.5-flash';
          else if (provider.name.includes('Groq')) model = providerConfig.get('groq.model') || 'llama-3.3-70b';
          else if (provider.name.includes('Ollama')) model = providerConfig.get('ollama.model') || 'codellama';

          this._currentMetadata = {
            prompt: cleanedContent,
            provider: provider.name,
            model: model
          };

          const assistantMessage = `Project generated: ${projectStructure.projectName}. Review in the Build tab.`;
          this._messages.push({ role: 'assistant', content: assistantMessage });

          this._view.webview.postMessage({
            type: 'addMessage',
            role: 'assistant',
            content: assistantMessage
          });

          this._view.webview.postMessage({
            type: 'showBuild',
            value: projectStructure
          });

          if (projectStructure.suggestedCommands && projectStructure.suggestedCommands.length > 0) {
            this._view.webview.postMessage({
              type: 'showCommands',
              value: projectStructure.suggestedCommands
            });
          }

        } else if (result.message || fullAssistantContent) {
          const finalContent = result.message || fullAssistantContent;
          this._messages.push({ role: 'assistant', content: finalContent });
          this._view.webview.postMessage({ type: 'finishStreaming' });
        }

        // Track token usage if available
        if (result.tokensUsed && this._usageTracker) {
          const providerConfig = vscode.workspace.getConfiguration('aiCodeGenerator');
          const providerType = providerConfig.get<string>('provider') || 'gemini';
          let modelName = 'unknown';
          if (providerType === 'openai') modelName = providerConfig.get('openai.model') || 'gpt-4o-mini';
          else if (providerType === 'gemini') modelName = providerConfig.get('gemini.model') || 'gemini-1.5-flash';
          else if (providerType === 'groq') modelName = providerConfig.get('groq.model') || 'llama-3.3-70b';
          else if (providerType === 'ollama') modelName = providerConfig.get('ollama.model') || 'codellama';
          this._usageTracker.trackUsage(providerType, modelName, result.tokensUsed);
        }
      } else {
        this._view.webview.postMessage({ type: 'addMessage', role: 'system', content: `Error: ${result.error}` });
      }
    } catch (e) {
      this._view.webview.postMessage({ type: 'addMessage', role: 'system', content: `Error: ${e instanceof Error ? e.message : 'Unknown'}` });
    } finally {
      this._view.webview.postMessage({ type: 'setLoading', value: false });
    }
  }

  private getActiveFileContext(): { path: string, content: string, language: string } | null {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return null;

    const document = editor.document;
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!workspaceRoot) return null;

    return {
      path: path.relative(workspaceRoot, document.uri.fsPath),
      content: document.getText(),
      language: document.languageId
    };
  }

  private async resolveReferencedFiles(content: string): Promise<{ path: string, content: string, language: string }[]> {
    const workspaceRoot = await FileSystemUtils.getWorkspaceRoot();
    if (!workspaceRoot) return [];

    // Simple regex to find potential file paths (e.g., src/main.py, index.js, etc.)
    const fileRegex = /([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)/g;
    const matches = content.match(fileRegex) || [];
    const uniqueMatches = [...new Set(matches)];
    
    const results: { path: string, content: string, language: string }[] = [];

    for (const match of uniqueMatches) {
      const fullPath = path.join(workspaceRoot, match);
      if (fs.existsSync(fullPath) && fs.lstatSync(fullPath).isFile()) {
        try {
          const fileContent = fs.readFileSync(fullPath, 'utf-8');
          results.push({
            path: match,
            content: fileContent,
            language: path.extname(match).slice(1) || 'plaintext'
          });
        } catch (e) {
          console.error(`Error reading referenced file ${match}:`, e);
        }
      }
    }

    return results;
  }

  /**
   * Fallback: try to extract a project structure JSON from AI response text.
   * This catches cases where the AI wraps valid JSON in explanatory markdown.
   */
  private tryExtractProjectStructure(content: string): any | null {
    try {
      let cleaned = content.trim();

      // Strategy 1: Extract from ```json code block
      const jsonBlockMatch = cleaned.match(/```json\s*\n?([\s\S]*?)```/);
      if (jsonBlockMatch) {
        cleaned = jsonBlockMatch[1].trim();
      } else {
        // Strategy 2: Find the outermost JSON object in the response
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleaned = jsonMatch[0];
        } else {
          return null;
        }
      }

      const parsed = JSON.parse(cleaned);

      // Validate it's actually a project structure
      if (!parsed.files || !Array.isArray(parsed.files) || parsed.files.length === 0) {
        return null;
      }

      // Validate each file has path and content
      for (const file of parsed.files) {
        if (!file.path || typeof file.content !== 'string') {
          return null;
        }
      }

      // Ensure folders array exists
      if (!parsed.folders) {
        parsed.folders = [];
      }

      // Ensure projectName exists
      if (!parsed.projectName) {
        parsed.projectName = 'generated-project';
      }

      return parsed;
    } catch (e) {
      return null;
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="
        default-src 'self';
        script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com;
        style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com;
        img-src 'self' data: https:;
        connect-src 'self' https://api.openai.com https://generativelanguage.googleapis.com https://api.groq.com https://ollama.api;
        frame-src 'self';
        base-uri 'self';
        form-action 'self';
      ">
      <meta http-equiv="X-Content-Type-Options" content="nosniff">
      <meta http-equiv="X-Frame-Options" content="DENY">
      <meta http-equiv="Referrer-Policy" content="strict-origin-when-cross-origin">
      <title>AI Chat</title>
      <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
      <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css" rel="stylesheet" />
      <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-typescript.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-css.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-json.min.js"></script>
      <style>
        :root {
            --input-bg: rgba(255, 255, 255, 0.05);
            --container-bg: transparent;
            --text-secondary: #888;
            --accent: #007acc;
            --border: rgba(255, 255, 255, 0.1);
            --glass-bg: rgba(30, 30, 30, 0.7);
            --glass-border: rgba(255, 255, 255, 0.1);
            --user-bubble: linear-gradient(135deg, #007acc 0%, #005a9e 100%);
        }

        body { 
            font-family: var(--vscode-font-family); 
            padding: 0; 
            color: var(--vscode-editor-foreground); 
            background-color: var(--vscode-sideBar-background); 
            display: flex; 
            flex-direction: column; 
            height: 100vh; 
            margin: 0; 
            box-sizing: border-box; 
            overflow: hidden;
        }

        /* Glassmorphism Sidebar */
        .header-tabs {
            display: flex;
            align-items: center;
            padding: 8px 16px;
            background: var(--glass-bg);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid var(--glass-border);
            gap: 16px;
            font-size: 11px;
            flex-shrink: 0;
            z-index: 100;
        }

        .tab { 
            color: var(--text-secondary); 
            cursor: pointer; 
            position: relative; 
            padding: 6px 0;
            transition: color 0.2s;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.8px;
        }

        .tab.active { color: white; }
        .tab.active::after {
            content: '';
            position: absolute;
            bottom: -2px;
            left: 0;
            width: 100%;
            height: 2px;
            background: var(--accent);
            box-shadow: 0 0 10px var(--accent);
        }

        .header-actions { margin-left: auto; display: flex; gap: 8px; align-items: center; }
        .new-chat-btn {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid var(--glass-border);
            color: white;
            padding: 4px 10px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 10px;
            transition: background 0.2s;
        }
        .new-chat-btn:hover { background: rgba(255, 255, 255, 0.15); }

        /* Main Content */
        .content {
            flex: 1;
            display: flex;
            flex-direction: column;
            padding: 16px;
            overflow-y: auto;
            box-sizing: border-box;
            width: 100%;
            scrollbar-width: thin;
        }

        .landing-title {
            font-size: 22px;
            font-weight: 700;
            margin: 40px 0 10px 0;
            text-align: center;
            background: linear-gradient(135deg, #fff 0%, #888 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .landing-subtitle {
            text-align: center;
            color: var(--text-secondary);
            font-size: 13px;
            margin-bottom: 40px;
        }
        
        /* Suggestion Cards */
        .suggestion-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
            margin-bottom: 30px;
        }

        .suggestion-card {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid var(--glass-border);
            padding: 12px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
            text-align: left;
        }

        .suggestion-card:hover {
            background: rgba(255, 255, 255, 0.07);
            border-color: var(--accent);
            transform: translateY(-2px);
        }

        .suggestion-title { font-weight: 600; font-size: 13px; margin-bottom: 4px; color: #eee; }
        .suggestion-desc { font-size: 11px; color: #888; }

        /* Recent Chats */
        .recent-section { width: 100%; margin-bottom: 20px; }
        .section-label { 
            color: var(--text-secondary); 
            font-size: 10px; 
            margin-bottom: 12px; 
            text-transform: uppercase; 
            letter-spacing: 1px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .section-label::after { content: ''; flex: 1; height: 1px; background: var(--glass-border); }

        .history-list { display: flex; flex-direction: column; gap: 6px; }
        .history-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid transparent;
        }
        .history-item:hover { 
            background: rgba(255, 255, 255, 0.05); 
            border-color: var(--glass-border); 
            transform: translateX(4px);
        }
        .history-icon { color: var(--accent); font-size: 14px; }
        .history-text { flex: 1; font-size: 12px; color: #ccc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .history-date { color: #555; font-size: 10px; }

        /* Auto-approve row */
        .auto-approve-row {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px;
            background: rgba(0, 122, 204, 0.05);
            border: 1px solid rgba(0, 122, 204, 0.2);
            border-radius: 8px;
            font-size: 11px;
            margin: 20px 0;
            color: #ccc;
        }
        .checkbox { width: 14px; height: 14px; margin: 0; accent-color: var(--accent); cursor: pointer; }

        /* Input Area */
        .input-sticky-container {
            padding: 16px;
            background: var(--vscode-sideBar-background);
            border-top: 1px solid var(--glass-border);
            width: 100%;
            box-sizing: border-box;
        }
        .input-wrapper {
            width: 100%;
            background: var(--input-bg);
            border: 1px solid var(--glass-border);
            border-radius: 12px;
            padding: 10px;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            gap: 10px;
            transition: border-color 0.2s;
        }
        .input-wrapper:focus-within { border-color: var(--accent); }

        .input-area {
            width: 100%;
            background: transparent;
            border: none;
            color: white;
            font-size: 13px;
            resize: none;
            outline: none;
            font-family: inherit;
            padding: 4px;
            box-sizing: border-box;
            max-height: 150px;
            scrollbar-width: none;
        }
        .input-footer { display: flex; align-items: center; justify-content: space-between; }
        .input-actions-left { display: flex; gap: 10px; align-items: center; }
        
        .agent-pill {
            display: flex;
            align-items: center;
            gap: 6px;
            background: rgba(255, 255, 255, 0.1);
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 10px;
            color: #eee;
            cursor: pointer;
        }
        .icon-btn { color: var(--text-secondary); cursor: pointer; font-size: 16px; opacity: 0.6; transition: all 0.2s; }
        .icon-btn:hover { opacity: 1; color: white; transform: scale(1.1); }
        
        .send-btn { 
            background: var(--accent); 
            color: white; 
            border: none; 
            width: 32px;
            height: 32px;
            border-radius: 8px; 
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
        }
        .send-btn:hover { background: #005a9e; transform: translateY(-1px); }
        .send-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        /* Chat View */
        #chatMessages {
            display: none;
            flex: 1;
            flex-direction: column;
            width: 100%;
            overflow-y: auto;
            padding: 16px;
            box-sizing: border-box;
            gap: 20px;
            scroll-behavior: smooth;
        }

        .message { 
            font-size: 13px; 
            line-height: 1.6; 
            max-width: 90%; 
            position: relative;
            animation: fadeIn 0.3s ease-out;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .message.user { 
            align-self: flex-end; 
            background: var(--user-bubble); 
            padding: 10px 14px; 
            border-radius: 16px 16px 2px 16px; 
            color: white;
            box-shadow: 0 4px 12px rgba(0, 122, 204, 0.2);
        }

        .message.assistant { 
            align-self: flex-start; 
            width: 100%;
            max-width: 100%;
            padding: 0;
        }

        .message.system { 
            align-self: center; 
            font-size: 11px; 
            color: #d7ba7d;
            background: rgba(215, 186, 125, 0.1);
            padding: 4px 12px;
            border-radius: 4px;
            border: 1px solid rgba(215, 186, 125, 0.2);
        }

        /* Markdown Styling */
        .markdown-content h1, .markdown-content h2, .markdown-content h3 { margin-top: 16px; margin-bottom: 8px; color: #fff; border-bottom: 1px solid var(--glass-border); padding-bottom: 4px; }
        .markdown-content p { margin-bottom: 12px; }
        .markdown-content ul, .markdown-content ol { margin-bottom: 12px; padding-left: 20px; }
        .markdown-content code { 
            background: rgba(255, 255, 255, 0.1); 
            padding: 2px 4px; 
            border-radius: 4px; 
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
        }
        .markdown-content pre {
            background: #1e1e1e;
            padding: 12px;
            border-radius: 8px;
            overflow-x: auto;
            border: 1px solid var(--glass-border);
            margin: 12px 0;
            position: relative;
        }
        .markdown-content pre code { background: transparent; padding: 0; }
        
        /* Build View Enhancements */
        .build-header {
            background: rgba(0, 122, 204, 0.1);
            border: 1px solid rgba(0, 122, 204, 0.3);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 24px;
            text-align: center;
        }
        .build-status-badge {
            display: inline-block;
            background: #4ec9b033;
            color: #4ec9b0;
            font-size: 10px;
            padding: 2px 8px;
            border-radius: 10px;
            font-weight: 700;
            margin-bottom: 8px;
        }

        .file-item {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid var(--glass-border);
            border-radius: 8px;
            padding: 10px;
            display: flex;
            align-items: center;
            gap: 12px;
            transition: all 0.2s;
            cursor: pointer;
        }
        .file-item:hover { background: rgba(255, 255, 255, 0.06); transform: scale(1.02); }
        .file-icon { font-size: 18px; }
        .file-info { flex: 1; }
        .file-name { font-size: 12px; color: #eee; font-weight: 500; }
        .file-path { font-size: 10px; color: #666; }
        .file-badge { font-size: 9px; padding: 2px 6px; border-radius: 4px; font-weight: 700; }
        .badge-new { background: #4ec9b022; color: #4ec9b0; }
        .badge-mod { background: #d7ba7d22; color: #d7ba7d; }

        /* Loading Animation */
        .typing { display: flex; gap: 4px; padding: 8px 0; }
        .dot { width: 6px; height: 6px; background: #666; border-radius: 50%; animation: pulse 1.5s infinite; }
        .dot:nth-child(2) { animation-delay: 0.2s; }
        .dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes pulse { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.1); } }

        /* Image Preview Styles */
        .image-preview-container {
            display: none;
            padding: 8px;
            background: rgba(255, 255, 255, 0.05);
            border-bottom: 1px solid var(--glass-border);
            position: relative;
            flex-direction: row;
            gap: 8px;
            overflow-x: auto;
        }
        .image-preview-item {
            position: relative;
            width: 60px;
            height: 60px;
            border-radius: 4px;
            overflow: hidden;
            border: 1px solid var(--glass-border);
        }
        .image-preview-item img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .remove-image {
            position: absolute;
            top: 2px;
            right: 2px;
            background: rgba(0,0,0,0.6);
            color: white;
            border-radius: 50%;
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 10px;
        }
        .chat-image {
            max-width: 200px;
            border-radius: 8px;
            margin-top: 8px;
            border: 1px solid var(--glass-border);
        }

        /* Dropdown & Context Menu Styles */
        .dropdown-menu {
            position: absolute;
            bottom: 100%;
            left: 0;
            background: #252526;
            border: 1px solid var(--glass-border);
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            display: none;
            flex-direction: column;
            min-width: 140px;
            z-index: 1000;
            margin-bottom: 8px;
        }
        .dropdown-item {
            padding: 8px 12px;
            font-size: 12px;
            color: #ccc;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s;
        }
        .dropdown-item:hover { background: rgba(255, 255, 255, 0.05); color: white; }
        .dropdown-item.active { color: var(--accent); font-weight: 700; background: rgba(0, 122, 204, 0.1); }

        .context-picker {
            position: absolute;
            bottom: 100%;
            right: 0;
            background: #252526;
            border: 1px solid var(--glass-border);
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            display: none;
            flex-direction: column;
            width: 200px;
            max-height: 300px;
            z-index: 1000;
            margin-bottom: 8px;
            overflow-y: auto;
        }
        .context-item {
            padding: 8px 12px;
            font-size: 11px;
            color: #888;
            cursor: pointer;
            border-bottom: 1px solid rgba(255,255,255,0.03);
            display: flex;
            flex-direction: column;
            transition: all 0.1s;
        }
        .context-item:hover { background: rgba(255, 255, 255, 0.05); color: #eee; }
        .context-item-name { color: #eee; font-weight: 500; }
        .context-item-path { font-size: 9px; opacity: 0.6; }

        .agent-pill { cursor: pointer; position: relative; transition: all 0.2s; }
        .agent-pill:hover { background: rgba(255, 255, 255, 0.1); }
        .icon-btn { cursor: pointer; transition: all 0.2s; }
        .icon-btn:hover { color: var(--accent); transform: scale(1.1); }

        /* Template Marketplace Styles */
        .template-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
            gap: 12px;
            margin-top: 12px;
        }
        .template-card {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid var(--glass-border);
            border-radius: 12px;
            padding: 12px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .template-card:hover { border-color: var(--accent); background: rgba(0, 122, 204, 0.05); transform: translateY(-2px); }
        .template-icon { font-size: 20px; }
        .template-name { font-size: 11px; font-weight: 700; color: #fff; }
        .template-desc { font-size: 9px; color: #888; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      </style>
    </head>
    <body>
      <div class="header-tabs">
        <div class="tab active" data-tab="Chat">Chat</div>
        <div class="tab" data-tab="Build">Build</div>
        <div class="tab" data-tab="Terminal">Terminal</div>
        <div class="tab" data-tab="History">History</div>
        <div class="header-actions">
           <button class="new-chat-btn" id="newChatBtn">+ New</button>
        </div>
      </div>

      <div class="content" id="landingPage">
        <div class="landing-title">CodeForge AI</div>
        <div class="landing-subtitle">What would you like to build today?</div>

        <div class="suggestion-grid">
            <div class="suggestion-card" data-prompt="Create a React login page with Tailwind CSS and form validation">
                <div class="suggestion-title">React Login Page</div>
                <div class="suggestion-desc">With Tailwind CSS and validation</div>
            </div>
            <div class="suggestion-card" data-prompt="Build a Node.js Express API for a task manager with MongoDB integration">
                <div class="suggestion-title">Express API</div>
                <div class="suggestion-desc">Node.js, Express, and MongoDB</div>
            </div>
            <div class="suggestion-card" data-prompt="Generate a neat portfolio website template with dark mode support">
                <div class="suggestion-title">Portfolio Website</div>
                <div class="suggestion-desc">Responsive, modern design</div>
            </div>
        </div>

        <div class="recent-section">
            <div class="section-label">Golden Path Starters</div>
            <div id="templateGrid" class="template-grid">
                <!-- Templates will be rendered here -->
            </div>
        </div>

        <div class="recent-section">
            <div class="section-label">Recent Explorations</div>
            <div class="history-list" id="historyList">
                <div style="color: #444; font-size: 11px; text-align: center; padding: 20px;">No recent history</div>
            </div>
        </div>

        <div class="auto-approve-row">
            <input type="checkbox" class="checkbox" checked>
            <span>Auto-approve critical system operations</span>
        </div>
      </div>

      <div id="chatMessages"></div>

      <div class="content" id="buildView" style="display: none;">
        <div class="build-header">
            <div class="build-status-badge">READY TO BUILD</div>
            <div id="buildProjectName" style="font-size: 18px; font-weight: 700; color: #fff; margin-bottom: 4px;">No project generated</div>
            <div id="buildProjectDesc" style="font-size: 12px; color: #888;">Generate something to see it here</div>
        </div>

        <div class="recent-section">
            <div class="section-label">Proposed Filesystem</div>
            <div id="buildFileList" style="display: flex; flex-direction: column; gap: 8px;"></div>
        </div>

        <div style="margin-top: auto; display: flex; gap: 10px; padding-top: 20px;">
            <button class="send-btn" id="applyBtn" style="flex: 1; height: 42px; width: auto;">Apply to Workspace</button>
            <button class="send-btn" id="deployBtn" style="flex: 1; height: 42px; width: auto; background: var(--vscode-button-secondaryBackground);">🚀 Deploy</button>
        </div>
      </div>

      <div class="content" id="terminalView" style="display: none;">
        <div class="build-header">
            <div class="build-status-badge">TERMINAL</div>
            <div style="font-size: 18px; font-weight: 700; color: #fff; margin-bottom: 4px;">Automation Hub</div>
            <div style="font-size: 12px; color: #888;">Run suggested tasks for your project</div>
            <button class="send-btn" id="fixErrorBtn" style="margin-top: 10px; width: 100%; height: 32px; font-size: 11px; background: #e51400; display: none;">🐞 Fix Last Error</button>
        </div>

        <div class="recent-section">
            <div class="section-label">Suggested Commands</div>
            <div id="commandList" style="display: flex; flex-direction: column; gap: 8px;">
                <div style="color: #444; font-size: 11px; text-align: center; padding: 20px;">No commands suggested yet</div>
            </div>
        </div>
      </div>

      <div class="content" id="historyView" style="display: none;">
        <div class="landing-title">History</div>
        <div class="recent-section">
            <div id="fullHistoryList" class="history-list"></div>
        </div>
      </div>

      <div class="input-sticky-container">
        <div class="input-wrapper">
            <div id="imagePreviewContainer" class="image-preview-container"></div>
            <textarea class="input-area" id="input" placeholder="Type a message..." rows="1"></textarea>
            <input type="file" id="imageInput" accept="image/*" style="display: none;">
            <div class="input-footer">
                <div class="input-actions-left" style="position: relative;">
                    <div class="agent-pill" id="modeBtn">
                        <span id="currentModeLabel">🤖 Agent</span>
                        <span style="font-size: 8px; opacity: 0.5; margin-left: 4px;">▼</span>
                    </div>
                    <div id="modeDropdown" class="dropdown-menu">
                        <div class="dropdown-item active" data-mode="agent">🤖 Agent (Auto-Edit)</div>
                        <div class="dropdown-item" data-mode="planning">🧠 Planning (Chat Only)</div>
                        <div class="dropdown-item" data-mode="debug">🐞 Debug (Fix Errors)</div>
                    </div>
                    <span class="icon-btn" id="settingsBtn">⚙️</span>
                </div>
                <div style="display: flex; gap: 16px; align-items: center; position: relative;">
                    <span class="icon-btn" id="uploadBtn">🖼️</span>
                    <span class="icon-btn" id="contextBtn">@</span>
                    <div id="contextPicker" class="context-picker">
                        <div style="padding: 8px; border-bottom: 1px solid var(--glass-border);">
                            <input type="text" id="contextSearch" placeholder="Search files..."
                                style="width: 100%; background: #1e1e1e; border: 1px solid #333; color: white; border-radius: 4px; padding: 4px 8px; font-size: 11px; outline: none;">
                        </div>
                        <div id="contextResults"></div>
                    </div>
                    <button class="send-btn" id="sendBtn">➤</button>
                </div>
            </div>
        </div>
      </div>

      <script>
        const vscode = acquireVsCodeApi();
        const input = document.getElementById('input');
        const sendBtn = document.getElementById('sendBtn');
        const applyBtn = document.getElementById('applyBtn');
        const deployBtn = document.getElementById('deployBtn');
        const landingPage = document.getElementById('landingPage');
        const chatMessages = document.getElementById('chatMessages');
        const buildView = document.getElementById('buildView');
        const historyView = document.getElementById('historyView');
        const historyList = document.getElementById('historyList');
        const newChatBtn = document.getElementById('newChatBtn');
        const terminalView = document.getElementById('terminalView');
        const commandList = document.getElementById('commandList');
        const uploadBtn = document.getElementById('uploadBtn');
        const imageInput = document.getElementById('imageInput');
        const imagePreviewContainer = document.getElementById('imagePreviewContainer');
        const tabs = document.querySelectorAll('.tab');

        const modeBtn = document.getElementById('modeBtn');
        const modeDropdown = document.getElementById('modeDropdown');
        const currentModeLabel = document.getElementById('currentModeLabel');
        const settingsBtn = document.getElementById('settingsBtn');
        const contextBtn = document.getElementById('contextBtn');
        const contextPicker = document.getElementById('contextPicker');
        const contextSearch = document.getElementById('contextSearch');
        const contextResults = document.getElementById('contextResults');

        let currentImageData = null;
        let currentMode = 'agent';

        function switchTab(tabName) {
            tabs.forEach(t => t.classList.remove('active'));
            let activeTab;
            tabs.forEach(t => {
                if (t.getAttribute('data-tab') === tabName || t.textContent === tabName) {
                    activeTab = t;
                }
            });
            if (activeTab) activeTab.classList.add('active');

            [landingPage, chatMessages, buildView, historyView, terminalView].forEach(v => v.style.display = 'none');

            if (tabName === 'Chat') {
                if (chatMessages.children.length > 0) chatMessages.style.display = 'flex';
                else landingPage.style.display = 'flex';
            } else if (tabName === 'Build') {
                buildView.style.display = 'flex';
            } else if (tabName === 'Terminal') {
                terminalView.style.display = 'flex';
            } else if (tabName === 'History') {
                historyView.style.display = 'flex';
            }
        }

        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => switchTab(e.target.getAttribute('data-tab') || e.target.textContent));
        });

        document.querySelectorAll('.suggestion-card').forEach(card => {
            card.addEventListener('click', () => {
                input.value = card.getAttribute('data-prompt');
                input.focus();
                input.dispatchEvent(new Event('input'));
            });
        });

        uploadBtn.addEventListener('click', () => imageInput.click());

        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                // Strip the data:image/jpeg;base64, part
                currentImageData = event.target.result.split(',')[1];
                renderImagePreview(event.target.result);
            };
            reader.readAsDataURL(file);
        });

        function renderImagePreview(src) {
            imagePreviewContainer.innerHTML = [
                '<div class="image-preview-item">',
                '<img src="' + src + '">',
                '<div class="remove-image" onclick="removeImage()">×</div>',
                '</div>'
            ].join('').trim();
            imagePreviewContainer.style.display = 'flex';
        }

        window.removeImage = function() {
            currentImageData = null;
            imageInput.value = '';
            imagePreviewContainer.innerHTML = '';
            imagePreviewContainer.style.display = 'none';
        };

        // Mode Management
        modeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            modeDropdown.style.display = modeDropdown.style.display === 'flex' ? 'none' : 'flex';
            contextPicker.style.display = 'none';
        });

        document.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                currentMode = item.getAttribute('data-mode');
                document.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                let label = '🤖 Agent';
                if (currentMode === 'planning') label = '🧠 Planning';
                if (currentMode === 'debug') label = '🐞 Debug';

                currentModeLabel.textContent = label;
                modeDropdown.style.display = 'none';
            });
        });

        // Settings
        settingsBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'openSettings' });
        });

        // Debug Fix
        const fixErrorBtn = document.getElementById('fixErrorBtn');
        fixErrorBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'fixLastError' });
            switchTab('Chat');
        });

        // Context Picker (@)
        contextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            contextPicker.style.display = contextPicker.style.display === 'flex' ? 'none' : 'flex';
            modeDropdown.style.display = 'none';
            if (contextPicker.style.display === 'flex') {
                contextSearch.focus();
                // Load default results if search empty
                if (!contextSearch.value) {
                    vscode.postMessage({ type: 'searchFiles', query: '' });
                }
            }
        });

        contextSearch.addEventListener('input', (e) => {
            const query = e.target.value;
            vscode.postMessage({ type: 'searchFiles', query: query });
        });

        // Close dropdowns on outside click
        document.addEventListener('click', () => {
            modeDropdown.style.display = 'none';
            contextPicker.style.display = 'none';
        });

        modeDropdown.addEventListener('click', (e) => e.stopPropagation());
        contextPicker.addEventListener('click', (e) => e.stopPropagation());
        let currentAssistantMessageDiv = null;
        let currentAssistantContent = '';

        function addMessage(role, content, isStreaming = false, image = null) {
          landingPage.style.display = 'none';
          chatMessages.style.display = 'flex';
          buildView.style.display = 'none';
          historyView.style.display = 'none';

          const div = document.createElement('div');
          div.className = 'message ' + role;

          if (role === 'assistant') {
            div.className += ' markdown-content';
            currentAssistantMessageDiv = div;
            currentAssistantContent = content || '';
            div.innerHTML = content ? marked.parse(content) : '<div class="typing"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>';
          } else if (role === 'system') {
            div.textContent = content;
          } else {
            // User message
            const textDiv = document.createElement('div');
            textDiv.textContent = content;
            div.appendChild(textDiv);

            if (image) {
                const img = document.createElement('img');
                img.src = 'data:image/jpeg;base64,' + image;
                img.className = 'chat-image';
                div.appendChild(img);
            }
          }

          chatMessages.appendChild(div);
          chatMessages.scrollTop = chatMessages.scrollHeight;
          if (role === 'assistant' && content) Prism.highlightAllUnder(div);

          switchTab('Chat');
        }

        function sendMessage() {
          const text = input.value.trim();
          if (!text && !currentImageData) return;

          addMessage('user', text, false, currentImageData);

          vscode.postMessage({
            type: 'sendMessage',
            value: text,
            image: currentImageData,
            mode: currentMode
          });

          input.value = '';
          removeImage();
          input.style.height = 'auto';
        }

        applyBtn.addEventListener('click', () => {
            applyBtn.disabled = true;
            applyBtn.textContent = 'Applying...';
            vscode.postMessage({ type: 'applyProject' });
        });

        deployBtn.addEventListener('click', () => {
            deployBtn.disabled = true;
            deployBtn.textContent = 'Deploying...';
            vscode.postMessage({ type: 'deployProject' });
        });

        newChatBtn.addEventListener('click', () => {
            chatMessages.innerHTML = '';
            chatMessages.style.display = 'none';
            landingPage.style.display = 'flex';
            vscode.postMessage({ type: 'newChat' });
            switchTab('Chat');
        });

        sendBtn.addEventListener('click', sendMessage);

        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 150) + 'px';
        });

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
          }
        });

        window.addEventListener('message', event => {
          const data = event.data;
          switch (data.type) {
            case 'addMessage':
              addMessage(data.role, data.content, data.isStreaming);
              break;
            case 'updateDelta':
              if (currentAssistantMessageDiv) {
                currentAssistantContent += data.value;
                currentAssistantMessageDiv.innerHTML = marked.parse(currentAssistantContent);
                chatMessages.scrollTop = chatMessages.scrollHeight;
              }
              break;
            case 'finishStreaming':
              if (currentAssistantMessageDiv) {
                  Prism.highlightAllUnder(currentAssistantMessageDiv);
              }
              currentAssistantMessageDiv = null;
              currentAssistantContent = '';
              break;
            case 'setLoading':
              sendBtn.disabled = data.value;
              sendBtn.style.opacity = data.value ? '0.5' : '1';
              break;
            case 'updateHistory':
              renderHistory(data.value);
              break;
            case 'updateTemplates':
              renderTemplates(data.value);
              break;
            case 'startTemplate':
                chatMessages.innerHTML = '';
                landingPage.style.display = 'none';
                chatMessages.style.display = 'flex';
                addMessage('assistant', '🚀 Initializing ' + data.value + ' template...');
                break;
            case 'showBuild':
              renderBuild(data.value);
              switchTab('Build');
              break;
            case 'projectApplied':
                applyBtn.disabled = false;
                applyBtn.textContent = 'Apply to Workspace';
                addMessage('system', 'Project applied successfully!');
                switchTab('Chat');
                break;
            case 'showCommands':
                renderCommands(data.value);
                switchTab('Terminal');
                break;
            case 'contextSearchResults':
                renderContextResults(data.value);
                break;
            case 'showFixButton':
                fixErrorBtn.style.display = data.value ? 'block' : 'none';
                break;
          }
        });

        function renderCommands(commands) {
            if (!commands || commands.length === 0) {
                commandList.innerHTML = '<div style="color: #444; font-size: 11px; text-align: center; padding: 20px;">No commands suggested</div>';
                return;
            }

            commandList.innerHTML = '';
            commands.forEach(cmd => {
                const div = document.createElement('div');
                div.className = 'file-item';
                div.style.justifyContent = 'space-between';

                const cmdInfo = document.createElement('div');
                cmdInfo.style.display = 'flex';
                cmdInfo.style.alignItems = 'center';
                cmdInfo.style.gap = '12px';

                const icon = document.createElement('div');
                icon.className = 'file-icon';
                icon.textContent = '🚀';

                const text = document.createElement('div');
                text.className = 'file-name';
                text.textContent = cmd;

                cmdInfo.appendChild(icon);
                cmdInfo.appendChild(text);

                const runBtn = document.createElement('button');
                runBtn.className = 'new-chat-btn';
                runBtn.textContent = 'Run';
                runBtn.style.padding = '4px 12px';
                runBtn.addEventListener('click', () => {
                    vscode.postMessage({ type: 'runCommand', value: cmd });
                });

                div.appendChild(cmdInfo);
                div.appendChild(runBtn);
                commandList.appendChild(div);
            });
        }

        function renderBuild(structure) {
            document.getElementById('buildProjectName').textContent = structure.projectName;
            document.getElementById('buildProjectDesc').textContent = structure.description || 'Custom generated project';
            buildFileList.innerHTML = '';

            structure.files.forEach(file => {
                const div = document.createElement('div');
                div.className = 'file-item';

                const icon = document.createElement('div');
                icon.className = 'file-icon';
                icon.textContent = getFileIcon(file.path);

                const info = document.createElement('div');
                info.className = 'file-info';

                const name = document.createElement('div');
                name.className = 'file-name';
                name.textContent = file.path.split('/').pop();

                const pathDiv = document.createElement('div');
                pathDiv.className = 'file-path';
                pathDiv.textContent = file.path;

                info.appendChild(name);
                info.appendChild(pathDiv);

                div.appendChild(icon);
                div.appendChild(info);

                const badge = document.createElement('div');
                badge.className = 'file-badge ' + (file.status === 'modified' ? 'badge-mod' : 'badge-new');
                badge.textContent = file.status === 'modified' ? 'MODIFIED' : 'NEW';
                div.appendChild(badge);

                if (file.status === 'modified') {
                    div.title = 'Click to view diff';
                    div.addEventListener('click', () => {
                        vscode.postMessage({ type: 'diffFile', path: file.path, content: file.content });
                    });
                }

                buildFileList.appendChild(div);
            });
        }

        function getFileIcon(filename) {
            if (filename.endsWith('.ts') || filename.endsWith('.tsx')) return '🟦';
            if (filename.endsWith('.js') || filename.endsWith('.jsx')) return '🟨';
            if (filename.endsWith('.css')) return '🎨';
            if (filename.endsWith('.html')) return '🌐';
            if (filename.endsWith('.json')) return '⚙️';
            if (filename.endsWith('.md')) return '📝';
            return '📄';
        }

        function renderHistory(items) {
            if (!items || items.length === 0) return;

            historyList.innerHTML = '';
            fullHistoryList.innerHTML = '';

            items.forEach((item, index) => {
                const div = createHistoryElement(item);
                if (index < 4) historyList.appendChild(div.cloneNode(true));
                fullHistoryList.appendChild(div);
            });

            // Re-bind events to landing page items
            Array.from(historyList.children).forEach((child, index) => {
                child.addEventListener('click', () => {
                    input.value = items[index].prompt;
                    input.focus();
                    input.dispatchEvent(new Event('input'));
                });
            });
        }

        function createHistoryElement(item) {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.addEventListener('click', () => {
                input.value = item.prompt;
                input.focus();
                input.dispatchEvent(new Event('input'));
            });

            const icon = document.createElement('div');
            icon.className = 'history-icon';
            icon.textContent = '⚡';

            const text = document.createElement('div');
            text.className = 'history-text';
            text.textContent = item.prompt;

            const date = document.createElement('div');
            date.className = 'history-date';
            date.textContent = formatDate(item.timestamp);

            div.appendChild(icon);
            div.appendChild(text);
            div.appendChild(date);
            return div;
        }

        function formatDate(ts) {
            const date = new Date(ts);
            const now = new Date();
            if (date.toDateString() === now.toDateString()) return 'today';
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }

        function renderContextResults(items) {
            contextResults.innerHTML = '';
            if (!items || items.length === 0) {
                contextResults.innerHTML = '<div style="padding: 12px; font-size: 11px; color: #555; text-align: center;">No files found</div>';
                return;
            }

            items.forEach(item => {
                const div = document.createElement('div');
                div.className = 'context-item';
                div.innerHTML = [
                    '<div class="context-item-name">' + item.name + '</div>',
                    '<div class="context-item-path">' + item.path + '</div>'
                ].join('');
                div.addEventListener('click', () => {
                    selectContextItem(item.path);
                });
                contextResults.appendChild(div);
            });
        }

        function selectContextItem(path) {
            const start = input.selectionStart;
            const end = input.selectionEnd;
            const text = input.value;

            // If the @ triggered it, try to replace from @ to current cursor
            const lastAt = text.lastIndexOf('@', start - 1);
            if (lastAt !== -1 && lastAt >= start - 10) { // Only replace if @ is close to cursor (e.g. typing @filename)
                input.value = text.substring(0, lastAt) + path + ' ' + text.substring(end);
            } else {
                input.value = text.substring(0, start) + path + ' ' + text.substring(end);
            }

            contextPicker.style.display = 'none';
            input.focus();
            input.dispatchEvent(new Event('input'));
        }
        vscode.postMessage({ type: 'getHistory' });
        vscode.postMessage({ type: 'getTemplates' });

        function renderTemplates(templates) {
            const grid = document.getElementById('templateGrid');
            grid.innerHTML = '';
            templates.forEach(t => {
                const card = document.createElement('div');
                card.className = 'template-card';
                card.innerHTML = [
                    '<div class="template-icon">' + t.icon + '</div>',
                    '<div class="template-name">' + t.name + '</div>',
                    '<div class="template-desc">' + t.description + '</div>'
                ].join('');
                card.addEventListener('click', () => {
                    vscode.postMessage({ type: 'selectTemplate', id: t.id });
                });
                grid.appendChild(card);
            });
        }
      </script>
    </body>
    </html>`;
  }
}
