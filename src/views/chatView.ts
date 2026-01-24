import * as vscode from 'vscode';
import { ProviderManager } from '../providers';

export class ChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'aiCodeGenerator.chatView';
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) { }

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
            }
        });
    }

    private async handleMessage(content: string) {
        if (!this._view) return;

        // Echo user message (frontend handles this optimization usually, but good for sync)
        // this._view.webview.postMessage({ type: 'addMessage', role: 'user', content });

        try {
            const provider = ProviderManager.getProvider();

            // Send "Typing..." state
            this._view.webview.postMessage({ type: 'setLoading', value: true });

            // Call API
            // Note: We are reusing the 'chat' method which expects a list of messages.
            // Ideally we should maintain history here.
            // For MVP, we send just the user message as a prompt, or simple history if we had it.

            const result = await provider.chat([{ role: 'user', content }]);

            // Handle Result
            if (result.success) {
                if (result.projectStructure) {
                    this._view.webview.postMessage({
                        type: 'addMessage',
                        role: 'assistant',
                        content: `I've generated a project for you! Check the "Generated Project" notification to apply it. \n\n(Project: ${result.projectStructure.projectName})`
                    });
                    // Also trigger the project generation flow? 
                    // That's complex via Chat. For now, let's just show text responses.
                } else if (result.message) {
                    this._view.webview.postMessage({ type: 'addMessage', role: 'assistant', content: result.message });
                } else {
                    // Fallback if provider returns raw text in 'message' or we need to extract it
                    // Currently our providers return 'projectStructure' primarily.
                    // We need to update providers to return 'message' if it's not JSON.
                    this._view.webview.postMessage({ type: 'addMessage', role: 'assistant', content: "Response processing incomplete. (See console)" });
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
        body { font-family: var(--vscode-font-family); padding: 10px; color: var(--vscode-editor-foreground); background-color: var(--vscode-editor-background); display: flex; flex-direction: column; height: 100vh; margin: 0; box-sizing: border-box; }
        .chat-container { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding-bottom: 10px; }
        .message { padding: 8px 12px; border-radius: 6px; max-width: 85%; word-wrap: break-word; }
        .message.user { align-self: flex-end; background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); }
        .message.assistant { align-self: flex-start; background-color: var(--vscode-editor-inactiveSelectionBackground); color: var(--vscode-editor-foreground); }
        .message.system { align-self: center; background-color: var(--vscode-notificationsWarningIcon-foreground); color: white; font-size: 0.8em; }
        .input-container { display: flex; gap: 5px; padding-top: 10px; border-top: 1px solid var(--vscode-widget-border); }
        textarea { flex: 1; min-height: 40px; resize: vertical; padding: 5px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); font-family: inherit; }
        button { padding: 0 15px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; cursor: pointer; }
        button:hover { background: var(--vscode-button-hoverBackground); }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
      </style>
    </head>
    <body>
      <div class="chat-container" id="chat">
        <div class="message assistant">Hello! I'm your AI coding assistant. Ask me anything or describe a project to generate.</div>
      </div>
      <div class="input-container">
        <textarea id="input" placeholder="Type a message..." rows="1"></textarea>
        <button id="sendBtn">Send</button>
      </div>
      <script>
        const vscode = acquireVsCodeApi();
        const chatContainer = document.getElementById('chat');
        const input = document.getElementById('input');
        const sendBtn = document.getElementById('sendBtn');

        function addMessage(role, content) {
          const div = document.createElement('div');
          div.className = 'message ' + role;
          div.textContent = content;
          chatContainer.appendChild(div);
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        function sendMessage() {
          const text = input.value.trim();
          if (!text) return;
          
          addMessage('user', text);
          vscode.postMessage({ type: 'sendMessage', value: text });
          input.value = '';
        }

        sendBtn.addEventListener('click', sendMessage);
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
              addMessage(message.role, message.content);
              break;
            case 'setLoading':
              sendBtn.disabled = message.value;
              sendBtn.textContent = message.value ? '...' : 'Send';
              break;
          }
        });
      </script>
    </body>
    </html>`;
    }
}
