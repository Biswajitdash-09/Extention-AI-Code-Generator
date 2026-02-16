import * as vscode from 'vscode';
import { ProviderManager } from '../providers';
import { HistoryManager } from '../services/historyManager';
import { applyProjectStructure } from '../commands/generateProject';
import { FileSystemUtils } from '../utils';
import { WorkspaceAnalyzer, WorkspaceContext } from '../services/workspaceAnalyzer';
import { DeploymentService } from '../services/deploymentService';
import * as path from 'path';
import * as fs from 'fs';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'aiCodeGenerator.chatView';
  private _view?: vscode.WebviewView;
  private _currentProjectStructure: any | undefined;
  private _currentMetadata: any | undefined;
  private _messages: any[] = [];
  private _workspaceContext: WorkspaceContext | null = null;
  private _autoIncludeWorkspace: boolean = false;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _historyManager: HistoryManager
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
          await this.handleMessage(data.value);
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
      }
    });

    // Initial history load
    this.updateHistory();
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

  private async handleMessage(content: string) {
    if (!this._view) return;

    try {
      const provider = ProviderManager.getProvider();
      this._view.webview.postMessage({ type: 'setLoading', value: true });

      // Check for @workspace mention or auto-include setting
      const includeWorkspace = content.includes('@workspace') || this._autoIncludeWorkspace;

      // Load workspace context if needed
      if (includeWorkspace && !this._workspaceContext) {
        this._workspaceContext = await WorkspaceAnalyzer.analyzeWorkspace(3, true);
        if (this._workspaceContext) {
          this._view.webview.postMessage({
            type: 'showWorkspaceContext',
            value: this._workspaceContext.summary
          });
        }
      }

      // Remove @workspace mention from content
      const cleanedContent = content.replace(/@workspace/g, '').trim();

      // Prepare messages with workspace context
      const messagesToSend = [...this._messages];
      messagesToSend.push({ role: 'user', content: cleanedContent });

      // Prepend workspace context to the first user message if available
      if (includeWorkspace && this._workspaceContext) {
        const contextPrompt = WorkspaceAnalyzer.formatContextForPrompt(this._workspaceContext);
        messagesToSend[messagesToSend.length - 1].content = `${contextPrompt}\n\n${cleanedContent}`;
      }

      // Add user message to local history (without context to keep it clean)
      this._messages.push({ role: 'user', content: cleanedContent });

      let fullAssistantContent = '';
      this._view.webview.postMessage({ type: 'addMessage', role: 'assistant', content: '', isStreaming: true });

      const result = await provider.streamChat(messagesToSend, (delta) => {
        fullAssistantContent += delta;
        if (this._view) {
          this._view.webview.postMessage({ type: 'updateDelta', value: delta });
        }
      });

      if (result.success) {
        if (result.projectStructure) {
          // Check for existing files to mark as modified
          const workspaceRoot = await FileSystemUtils.getWorkspaceRoot();
          if (workspaceRoot) {
            for (const file of result.projectStructure.files) {
              // Ensure status property exists
              if (!file.status) {
                const fullPath = path.join(workspaceRoot, file.path);
                file.status = fs.existsSync(fullPath) ? 'modified' : 'new';
              }
            }
          }

          this._currentProjectStructure = result.projectStructure;

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

          const assistantMessage = `Project generated: ${result.projectStructure.projectName}. Review in the Build tab.`;
          this._messages.push({ role: 'assistant', content: assistantMessage });

          this._view.webview.postMessage({
            type: 'addMessage',
            role: 'assistant',
            content: assistantMessage
          });

          this._view.webview.postMessage({
            type: 'showBuild',
            value: result.projectStructure
          });

        } else if (result.message || fullAssistantContent) {
          const finalContent = result.message || fullAssistantContent;
          this._messages.push({ role: 'assistant', content: finalContent });
          this._view.webview.postMessage({ type: 'finishStreaming' });
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

  private _getHtmlForWebview(webview: vscode.Webview) {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>AI Chat</title>
      <style>
        :root {
            --input-bg: rgba(255, 255, 255, 0.05);
            --container-bg: transparent;
            --text-secondary: #888;
            --accent: var(--vscode-button-background);
            --border: rgba(255, 255, 255, 0.1);
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
        
        /* Tabs/Header */
        .header-tabs {
            display: flex;
            align-items: center;
            padding: 4px 8px;
            border-bottom: 1px solid var(--border);
            gap: 12px;
            font-size: 11px;
            flex-shrink: 0;
            overflow-x: auto;
            white-space: nowrap;
        }
        .tab { color: var(--text-secondary); cursor: pointer; position: relative; padding: 4px 0; }
        .tab.active { color: white; }
        .tab.active::after {
            content: '';
            position: absolute;
            bottom: -5px;
            left: 0;
            width: 100%;
            height: 2px;
            background: var(--vscode-button-background);
        }
        .header-actions { margin-left: auto; display: flex; gap: 8px; align-items: center; }
        .new-chat-btn {
            background: rgba(255, 255, 255, 0.1);
            border: none;
            color: white;
            padding: 2px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 10px;
        }

        /* Main Content */
        .content {
            flex: 1;
            display: flex;
            flex-direction: column;
            padding: 12px;
            overflow-y: auto;
            box-sizing: border-box;
            width: 100%;
        }
        .landing-title {
            font-size: 20px;
            font-weight: 600;
            margin: 20px 0 30px 0;
            color: var(--vscode-editor-foreground);
            text-align: center;
        }
        
        /* Recent Chats */
        .recent-section {
            width: 100%;
            text-align: left;
            margin-bottom: 20px;
        }
        .section-label { color: var(--text-secondary); font-size: 11px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
        .history-list { display: flex; flex-direction: column; gap: 4px; }
        .history-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px;
            border-radius: 6px;
            cursor: pointer;
            transition: background 0.2s;
            border: 1px solid transparent;
        }
        .history-item:hover { background: rgba(255, 255, 255, 0.05); border-color: var(--border); }
        .history-icon { color: var(--text-secondary); font-size: 14px; }
        .history-text { flex: 1; font-size: 12px; color: #ccc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .history-date { color: #555; font-size: 10px; }

        /* Auto-approve row */
        .auto-approve-row {
            width: 100%;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 0;
            border-top: 1px solid var(--border);
            border-bottom: 1px solid var(--border);
            font-size: 11px;
            margin: 15px 0;
            color: #888;
            box-sizing: border-box;
        }
        .checkbox { width: 14px; height: 14px; margin: 0; accent-color: var(--accent); cursor: pointer; }

        /* Input Area - Weighted to bottom */
        .input-sticky-container {
            padding: 12px;
            background: var(--vscode-sideBar-background);
            border-top: 1px solid var(--border);
            width: 100%;
            box-sizing: border-box;
        }
        .input-wrapper {
            width: 100%;
            background: var(--input-bg);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 8px;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
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
        }
        .input-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
        }
        .input-actions-left { display: flex; gap: 8px; align-items: center; }
        .agent-pill {
            display: flex;
            align-items: center;
            gap: 4px;
            background: rgba(255, 255, 255, 0.1);
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 10px;
            color: #ccc;
        }
        .icon-btn { color: var(--text-secondary); cursor: pointer; font-size: 14px; opacity: 0.7; }
        .icon-btn:hover { opacity: 1; }
        
        .send-btn { 
            background: var(--accent); 
            color: var(--vscode-button-foreground); 
            border: none; 
            padding: 4px 8px; 
            border-radius: 4px; 
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .send-btn:hover { filter: brightness(1.2); }
        .send-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        /* Chat View */
        #chatMessages {
            display: none;
            flex: 1;
            flex-direction: column;
            width: 100%;
            overflow-y: auto;
            padding: 12px;
            box-sizing: border-box;
            gap: 16px;
        }
        .message { font-size: 13px; line-height: 1.4; max-width: 95%; }
        .message.user { align-self: flex-end; background: rgba(255, 255, 255, 0.05); padding: 8px 12px; border-radius: 12px 12px 0 12px; border: 1px solid var(--border); }
        .message.assistant { align-self: flex-start; }
        .message.system { align-self: center; font-size: 11px; color: var(--vscode-notificationsWarningIcon-foreground); }
      </style>
    </head>
    <body>
      <div class="header-tabs">
        <div class="tab active">Chat</div>
        <div class="tab">Build</div>
        <div class="tab">History</div>
        <div class="header-actions">
           <button class="new-chat-btn" id="newChatBtn">+ New Chat</button>
        </div>
      </div>

      <div class="content" id="landingPage">
        <div class="landing-title">What should we build today?</div>
        
        <div class="recent-section">
            <div class="section-label">Recent Chats</div>
            <div class="history-list" id="historyList">
                <div style="color: #444; font-size: 11px;">No recent chats</div>
            </div>
        </div>

        <div class="auto-approve-row">
            <input type="checkbox" class="checkbox" checked>
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Auto-approve: <span style="color: #666">Read, Write, Execute...</span></span>
        </div>
      </div>

      <div id="chatMessages"></div>

      <div class="content" id="buildView" style="display: none;">
        <div class="landing-title">Generated Project</div>
        <div id="buildProjectInfo" style="margin-bottom: 20px; text-align: center; color: var(--text-secondary); font-size: 13px;"></div>
        <div class="recent-section">
            <div class="section-label">Files to be created</div>
            <div id="buildFileList" class="history-list"></div>
        </div>
        <div style="margin-top: 20px; display: flex; gap: 8px;">
            <button class="send-btn" id="applyBtn" style="flex: 1; padding: 10px;">Apply to Workspace</button>
            <button class="send-btn" id="deployBtn" style="flex: 1; padding: 10px; background: var(--vscode-button-secondaryBackground);">🚀 Deploy</button>
        </div>
      </div>

      <div class="content" id="historyView" style="display: none;">
        <div class="landing-title">Generation History</div>
        <div class="recent-section">
            <div id="fullHistoryList" class="history-list"></div>
        </div>
      </div>

      <div class="input-sticky-container">
        <div class="input-wrapper">
            <textarea class="input-area" id="input" placeholder="@ to add context..." rows="1"></textarea>
            <div class="input-footer">
                <div class="input-actions-left">
                    <div class="agent-pill">🤖 <span>Agent</span> ⌄</div>
                    <span class="icon-btn">⚙️</span>
                </div>
                <div style="display: flex; gap: 12px; align-items: center;">
                    <span class="icon-btn">@</span>
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
        const fullHistoryList = document.getElementById('fullHistoryList');
        const buildFileList = document.getElementById('buildFileList');
        const buildProjectInfo = document.getElementById('buildProjectInfo');
        const newChatBtn = document.getElementById('newChatBtn');
        const tabs = document.querySelectorAll('.tab');

        function switchTab(tabName) {
            tabs.forEach(t => t.classList.remove('active'));
            event?.target?.classList?.add('active'); // This might be null if called programmatically
            
            // Or find by name
            if (!event) {
                tabs.forEach(t => {
                    if (t.textContent === tabName) t.classList.add('active');
                });
            }

            [landingPage, chatMessages, buildView, historyView].forEach(v => v.style.display = 'none');
            
            if (tabName === 'Chat') {
                if (chatMessages.children.length > 0) chatMessages.style.display = 'flex';
                else landingPage.style.display = 'flex';
            } else if (tabName === 'Build') {
                buildView.style.display = 'flex';
            } else if (tabName === 'History') {
                historyView.style.display = 'flex';
            }
        }

        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => switchTab(e.target.textContent));
        });

        let currentStreamingMessage = null;

        function addMessage(role, content, isStreaming = false) {
          landingPage.style.display = 'none';
          chatMessages.style.display = 'flex';
          buildView.style.display = 'none';
          historyView.style.display = 'none';
          
          const div = document.createElement('div');
          div.className = 'message ' + role;
          div.textContent = content;
          chatMessages.appendChild(div);
          chatMessages.scrollTop = chatMessages.scrollHeight;

          if (isStreaming) {
            currentStreamingMessage = div;
          } else {
            currentStreamingMessage = null;
          }
          
          tabs.forEach(t => t.classList.remove('active'));
          tabs[0].classList.add('active');
        }

        function sendMessage() {
          const text = input.value.trim();
          if (!text) return;
          
          addMessage('user', text);
          vscode.postMessage({ type: 'sendMessage', value: text });
          input.value = '';
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

        function resetChat() {
            chatMessages.innerHTML = '';
            chatMessages.style.display = 'none';
            buildView.style.display = 'none';
            historyView.style.display = 'none';
            landingPage.style.display = 'flex';
            vscode.postMessage({ type: 'getHistory' });
            vscode.postMessage({ type: 'newChat' });
            switchTab('Chat');
        }

        newChatBtn.addEventListener('click', resetChat);
        sendBtn.addEventListener('click', sendMessage);
        
        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = input.scrollHeight + 'px';
        });

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
          }
        });

        window.addEventListener('message', event => {
          const message = event.data;
          switch (message.type) {
            case 'addMessage':
              addMessage(message.role, message.content, message.isStreaming);
              break;
            case 'updateDelta':
              if (currentStreamingMessage) {
                currentStreamingMessage.textContent += message.value;
                chatMessages.scrollTop = chatMessages.scrollHeight;
              }
              break;
            case 'finishStreaming':
              currentStreamingMessage = null;
              break;
            case 'setLoading':
              sendBtn.disabled = message.value;
              sendBtn.style.opacity = message.value ? '0.5' : '1';
              break;
            case 'updateHistory':
              renderHistory(message.value);
              break;
            case 'showBuild':
              renderBuild(message.value);
              switchTab('Build');
              break;
            case 'projectApplied':
                applyBtn.disabled = false;
                applyBtn.textContent = 'Apply to Workspace';
                addMessage('system', 'Project applied successfully!');
                switchTab('Chat');
                break;
          }
        });

        function renderBuild(structure) {
            buildProjectInfo.textContent = structure.description || structure.projectName;
            buildFileList.innerHTML = '';
            structure.files.forEach(file => {
                const div = document.createElement('div');
                div.className = 'history-item';
                
                const icon = document.createElement('div');
                icon.className = 'history-icon';
                icon.textContent = '📄';
                
                const text = document.createElement('div');
                text.className = 'history-text';
                text.textContent = file.path;

                div.appendChild(icon);
                div.appendChild(text);

                if (file.status === 'modified') {
                    const badge = document.createElement('div');
                    badge.textContent = 'MODIFIED';
                    badge.style.fontSize = '9px';
                    badge.style.padding = '2px 4px';
                    badge.style.borderRadius = '3px';
                    badge.style.background = '#d7ba7d'; // VS Code modification color-ish
                    badge.style.color = '#1e1e1e';
                    badge.style.marginLeft = '8px';
                    div.appendChild(badge);

                    div.style.cursor = 'pointer';
                    div.title = 'Click to view diff';
                    div.addEventListener('click', () => {
                        vscode.postMessage({ type: 'diffFile', path: file.path, content: file.content });
                    });
                } else {
                    const badge = document.createElement('div');
                    badge.textContent = 'NEW';
                    badge.style.fontSize = '9px';
                    badge.style.padding = '2px 4px';
                    badge.style.borderRadius = '3px';
                    badge.style.background = '#4ec9b0'; // VS Code new file color-ish
                    badge.style.color = '#1e1e1e';
                    badge.style.marginLeft = '8px';
                    div.appendChild(badge);
                }
                
                buildFileList.appendChild(div);
            });
        }

        function renderHistory(items) {
            if (!items || items.length === 0) {
                historyList.innerHTML = '<div style="color: #444; font-size: 11px;">No recent chats</div>';
                fullHistoryList.innerHTML = '<div style="color: #444; font-size: 11px;">No history yet</div>';
                return;
            }
            
            historyList.innerHTML = '';
            fullHistoryList.innerHTML = '';
            
            items.forEach((item, index) => {
                const div = createHistoryElement(item);
                if (index < 4) historyList.appendChild(div.cloneNode(true));
                fullHistoryList.appendChild(div);
            });

            // Re-add click events for cloned nodes
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
            icon.textContent = '💬';
            
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

        // Request history on load
        vscode.postMessage({ type: 'getHistory' });
      </script>
    </body>
    </html>`;
  }
}
