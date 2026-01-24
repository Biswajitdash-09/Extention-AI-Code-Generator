import * as vscode from 'vscode';
import { AuthManager } from '../services/authManager';
import { LoginPanel } from '../views/loginPanel';

export async function loginCommand(extensionUri: vscode.Uri, authManager: AuthManager): Promise<void> {
    const isAuthenticated = authManager.isAuthenticated;

    if (isAuthenticated) {
        const email = authManager.userEmail;
        const logoutAction = 'Logout';
        const result = await vscode.window.showInformationMessage(
            `Currently logged in as ${email}`,
            logoutAction
        );

        if (result === logoutAction) {
            await authManager.logout();
            vscode.window.showInformationMessage('Logged out successfully');
        }
    } else {
        LoginPanel.createOrShow(extensionUri, authManager);
    }
}
