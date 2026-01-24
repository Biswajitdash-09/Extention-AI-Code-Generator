import * as vscode from 'vscode';
import { AuthManager } from '../services/authManager';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { app } from '../firebase/config';

export class LoginPanel {
    public static currentPanel: LoginPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, private authManager: AuthManager) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._panel.webview.html = this._getWebviewContent();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'login':
                        await this.handleLogin(message.email, message.password);
                        return;
                    case 'signup':
                        await this.handleSignup(message.email, message.password);
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public static createOrShow(extensionUri: vscode.Uri, authManager: AuthManager) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (LoginPanel.currentPanel) {
            LoginPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'loginPanel',
            'AI Code Gen Login',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
            }
        );

        LoginPanel.currentPanel = new LoginPanel(panel, extensionUri, authManager);
    }

    private async handleLogin(email: string, pass: string) {
        try {
            const auth = getAuth(app);
            const userCredential = await signInWithEmailAndPassword(auth, email, pass);
            const token = await userCredential.user.getIdToken();

            await this.authManager.login(token, email);
            vscode.window.showInformationMessage(`Successfully logged in as ${email}`);
            this.dispose();
        } catch (error) {
            vscode.window.showErrorMessage(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async handleSignup(email: string, pass: string) {
        try {
            const auth = getAuth(app);
            const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
            const token = await userCredential.user.getIdToken();

            await this.authManager.login(token, email);
            vscode.window.showInformationMessage(`Account created! Logged in as ${email}`);
            this.dispose();
        } catch (error) {
            vscode.window.showErrorMessage(`Signup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    public dispose() {
        LoginPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _getWebviewContent() {
        return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Login</title>
      <style>
        body { font-family: sans-serif; padding: 20px; color: var(--vscode-editor-foreground); background-color: var(--vscode-editor-background); }
        .container { max-width: 300px; margin: 0 auto; display: flex; flex-direction: column; gap: 10px; }
        input { padding: 8px; border: 1px solid var(--vscode-input-border); background: var(--vscode-input-background); color: var(--vscode-input-foreground); }
        button { padding: 10px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; cursor: pointer; }
        button:hover { background: var(--vscode-button-hoverBackground); }
        h2 { text-align: center; }
        .toggle { text-align: center; margin-top: 10px; font-size: 0.9em; cursor: pointer; text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2 id="title">Login</h2>
        <input type="email" id="email" placeholder="Email" />
        <input type="password" id="password" placeholder="Password" />
        <button id="submitBtn" onclick="submit()">Login</button>
        <div class="toggle" onclick="toggleMode()" id="toggleText">Need an account? Sign up</div>
      </div>
      <script>
        const vscode = acquireVsCodeApi();
        let isLogin = true;

        function toggleMode() {
          isLogin = !isLogin;
          document.getElementById('title').innerText = isLogin ? 'Login' : 'Sign Up';
          document.getElementById('submitBtn').innerText = isLogin ? 'Login' : 'Sign Up';
          document.getElementById('toggleText').innerText = isLogin ? 'Need an account? Sign up' : 'Already have an account? Login';
        }

        function submit() {
          const email = document.getElementById('email').value;
          const password = document.getElementById('password').value;
          vscode.postMessage({
            command: isLogin ? 'login' : 'signup',
            email: email,
            password: password
          });
        }
      </script>
    </body>
    </html>`;
    }
}
