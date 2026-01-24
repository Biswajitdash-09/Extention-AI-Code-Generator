import * as vscode from 'vscode';

export class AuthManager {
    private static readonly SECRET_KEY = 'aiCodeGenerator.authToken';
    private _isAuthenticated: boolean = false;
    private _userEmail: string | undefined;

    constructor(private context: vscode.ExtensionContext) {
        this.checkSession();
    }

    /**
     * Check if a valid session exists
     */
    async checkSession(): Promise<boolean> {
        const token = await this.context.secrets.get(AuthManager.SECRET_KEY);
        this._isAuthenticated = !!token;
        return this._isAuthenticated;
    }

    /**
     * Save session token
     */
    async login(token: string, email: string): Promise<void> {
        await this.context.secrets.store(AuthManager.SECRET_KEY, token);
        this._isAuthenticated = true;
        this._userEmail = email;
        vscode.commands.executeCommand('setContext', 'aiCodeGenerator.isAuthenticated', true);
    }

    /**
     * Clear session
     */
    async logout(): Promise<void> {
        await this.context.secrets.delete(AuthManager.SECRET_KEY);
        this._isAuthenticated = false;
        this._userEmail = undefined;
        vscode.commands.executeCommand('setContext', 'aiCodeGenerator.isAuthenticated', false);
    }

    get isAuthenticated(): boolean {
        return this._isAuthenticated;
    }

    get userEmail(): string | undefined {
        return this._userEmail;
    }
}
