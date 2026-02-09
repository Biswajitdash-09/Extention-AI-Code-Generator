import * as vscode from 'vscode';
import { FirebaseService, auth } from './firebaseService';

export class AuthManager {
    private static readonly SECRET_KEY = 'aiCodeGenerator.authToken';
    private _isAuthenticated: boolean = false;
    private _userEmail: string | undefined;
    private _userRole: string | undefined;

    constructor(private context: vscode.ExtensionContext) {
        this.checkSession();
    }

    /**
     * Check if a valid session exists
     */
    async checkSession(): Promise<boolean> {
        return new Promise((resolve) => {
            auth.onAuthStateChanged(async (user: any) => {
                if (user) {
                    this._isAuthenticated = true;
                    this._userEmail = user.email || undefined;

                    const profile = await FirebaseService.getUserProfile(user.uid);
                    this._userRole = profile?.role || 'user';

                    vscode.commands.executeCommand('setContext', 'aiCodeGenerator.isAuthenticated', true);
                    vscode.commands.executeCommand('setContext', 'aiCodeGenerator.userRole', this._userRole);
                    resolve(true);
                } else {
                    this._isAuthenticated = false;
                    this._userEmail = undefined;
                    this._userRole = undefined;
                    vscode.commands.executeCommand('setContext', 'aiCodeGenerator.isAuthenticated', false);
                    vscode.commands.executeCommand('setContext', 'aiCodeGenerator.userRole', undefined);
                    resolve(false);
                }
            });
        });
    }

    /**
     * Signup using Firebase
     */
    async signup(email: string, password: string, role: string = 'user'): Promise<void> {
        try {
            const user = await FirebaseService.signup(email, password, role);
            this._isAuthenticated = true;
            this._userEmail = email;
            this._userRole = role;
            vscode.commands.executeCommand('setContext', 'aiCodeGenerator.isAuthenticated', true);
            vscode.commands.executeCommand('setContext', 'aiCodeGenerator.userRole', role);
        } catch (error) {
            console.error('Firebase Signup Error:', error);
            throw error;
        }
    }

    /**
     * Login using Firebase
     */
    async login(email: string, password: string): Promise<void> {
        try {
            const user = await FirebaseService.login(email, password);
            this._isAuthenticated = true;
            this._userEmail = email;

            const profile = await FirebaseService.getUserProfile(user.uid);
            this._userRole = profile?.role || 'user';

            vscode.commands.executeCommand('setContext', 'aiCodeGenerator.isAuthenticated', true);
            vscode.commands.executeCommand('setContext', 'aiCodeGenerator.userRole', this._userRole);
        } catch (error) {
            console.error('Firebase Login Error:', error);
            throw error;
        }
    }

    /**
     * Clear session
     */
    async logout(): Promise<void> {
        await FirebaseService.logout();
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

    get userRole(): string | undefined {
        return this._userRole;
    }

    get userId(): string | undefined {
        return auth.currentUser?.uid;
    }
}
