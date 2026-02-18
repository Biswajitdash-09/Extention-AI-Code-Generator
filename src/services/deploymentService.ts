import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

export interface DeploymentResult {
    success: boolean;
    url?: string;
    error?: string;
    platform: string;
}

export class DeploymentService {
    /**
     * Deploy project to Vercel
     */
    static async deployToVercel(projectPath: string, apiToken?: string): Promise<DeploymentResult> {
        try {
            const config = vscode.workspace.getConfiguration('aiCodeGenerator');
            const token = apiToken || config.get<string>('deployment.vercelToken');

            if (!token) {
                return {
                    success: false,
                    error: 'Vercel API token not configured. Set it in extension settings.',
                    platform: 'Vercel'
                };
            }

            // Install Vercel CLI if not present
            try {
                await execAsync('vercel --version');
            } catch {
                vscode.window.showInformationMessage('Installing Vercel CLI...');
                await execAsync('npm install -g vercel');
            }

            // Deploy using Vercel CLI - pass token via environment variable
            const { stdout } = await execAsync('vercel --yes', {
                cwd: projectPath,
                env: { ...process.env, VERCEL_TOKEN: token }
            });

            // Extract deployment URL from output
            const urlMatch = stdout.match(/https:\/\/[^\s]+/);
            const deployUrl = urlMatch ? urlMatch[0] : undefined;

            return {
                success: true,
                url: deployUrl,
                platform: 'Vercel'
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Deployment failed',
                platform: 'Vercel'
            };
        }
    }

    /**
     * Deploy project to Netlify
     */
    static async deployToNetlify(projectPath: string, apiToken?: string): Promise<DeploymentResult> {
        try {
            const config = vscode.workspace.getConfiguration('aiCodeGenerator');
            const token = apiToken || config.get<string>('deployment.netlifyToken');

            if (!token) {
                return {
                    success: false,
                    error: 'Netlify API token not configured. Set it in extension settings.',
                    platform: 'Netlify'
                };
            }

            // Find build directory (dist, build, out, etc.)
            const buildDir = this.findBuildDirectory(projectPath) || '.';

            // Deploy using Netlify API
            const fetch = (await import('node-fetch')).default;
            const FormData = (await import('form-data')).default;

            // Create zip of build directory
            const zipPath = path.join(projectPath, 'deploy.zip');
            await this.createZip(path.join(projectPath, buildDir), zipPath);

            // Upload to Netlify
            const formData = new FormData();
            formData.append('file', fs.createReadStream(zipPath));

            const response = await fetch('https://api.netlify.com/api/v1/sites', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    ...formData.getHeaders()
                },
                body: formData
            }) as any;

            const data = await response.json();

            // Clean up zip file
            fs.unlinkSync(zipPath);

            if (data.url) {
                return {
                    success: true,
                    url: data.url,
                    platform: 'Netlify'
                };
            } else {
                return {
                    success: false,
                    error: 'Deployment succeeded but no URL returned',
                    platform: 'Netlify'
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Deployment failed',
                platform: 'Netlify'
            };
        }
    }

    /**
     * Deploy project to Firebase
     */
    static async deployToFirebase(projectPath: string): Promise<DeploymentResult> {
        try {
            // Check if Firebase CLI is installed
            try {
                await execAsync('firebase --version');
            } catch {
                return {
                    success: false,
                    error: 'Firebase CLI not installed. Run: npm install -g firebase-tools',
                    platform: 'Firebase'
                };
            }

            // Check if firebase.json exists
            const firebaseConfigPath = path.join(projectPath, 'firebase.json');
            if (!fs.existsSync(firebaseConfigPath)) {
                return {
                    success: false,
                    error: 'firebase.json not found. Initialize Firebase in your project first.',
                    platform: 'Firebase'
                };
            }

            // Deploy using Firebase CLI
            const { stdout } = await execAsync('firebase deploy --only hosting', {
                cwd: projectPath
            });

            // Extract hosting URL from output
            const urlMatch = stdout.match(/Hosting URL: (https:\/\/[^\s]+)/);
            const deployUrl = urlMatch ? urlMatch[1] : undefined;

            return {
                success: true,
                url: deployUrl,
                platform: 'Firebase'
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Deployment failed',
                platform: 'Firebase'
            };
        }
    }

    /**
     * Find common build directory
     */
    private static findBuildDirectory(projectPath: string): string | null {
        const commonDirs = ['dist', 'build', 'out', '.next', 'public'];
        for (const dir of commonDirs) {
            if (fs.existsSync(path.join(projectPath, dir))) {
                return dir;
            }
        }
        return null;
    }

    /**
     * Create a zip file from a directory
     */
    private static async createZip(sourceDir: string, outputPath: string): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                // Dynamic import to avoid build errors if package is missing
                // In production, 'archiver' must be installed
                const archiverModule = await import('archiver');
                const archiver = archiverModule.default;

                const output = fs.createWriteStream(outputPath);
                const archive = archiver('zip', { zlib: { level: 9 } });

                output.on('close', resolve);
                archive.on('error', reject);

                archive.pipe(output);
                archive.directory(sourceDir, false);
                archive.finalize();
            } catch (error) {
                reject(new Error(`Failed to load archiver: ${error instanceof Error ? error.message : String(error)}`));
            }
        });
    }

    /**
     * Select platform and deploy
     */
    static async deploy(projectPath: string): Promise<DeploymentResult> {
        const platform = await vscode.window.showQuickPick(
            ['Vercel', 'Netlify', 'Firebase'],
            { placeHolder: 'Select deployment platform' }
        );

        if (!platform) {
            return {
                success: false,
                error: 'No platform selected',
                platform: 'None'
            };
        }

        return await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Deploying to ${platform}...`,
            cancellable: false
        }, async () => {
            switch (platform) {
                case 'Vercel':
                    return await this.deployToVercel(projectPath);
                case 'Netlify':
                    return await this.deployToNetlify(projectPath);
                case 'Firebase':
                    return await this.deployToFirebase(projectPath);
                default:
                    return {
                        success: false,
                        error: 'Unknown platform',
                        platform
                    };
            }
        });
    }
}
