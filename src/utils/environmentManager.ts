import * as vscode from 'vscode';
import { spawn } from 'child_process';

export interface EnvironmentInfo {
    pythonPath: string;
    pythonVersion: string | null;
    robotFrameworkVersion: string | null;
    robocopVersion: string | null;
    robotidyVersion: string | null;
    isValid: boolean;
    errors: string[];
}

export class EnvironmentManager implements vscode.Disposable {
    private outputChannel: vscode.OutputChannel;
    private cachedInfo: EnvironmentInfo | null = null;
    private cacheTimeout: NodeJS.Timeout | null = null;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Robot Framework Environment');
    }

    /**
     * Check and validate the Robot Framework environment
     */
    async checkEnvironment(): Promise<EnvironmentInfo> {
        const config = vscode.workspace.getConfiguration('robotframework');
        const pythonPath = config.get<string>('python.executable', 'python');

        const info: EnvironmentInfo = {
            pythonPath,
            pythonVersion: null,
            robotFrameworkVersion: null,
            robocopVersion: null,
            robotidyVersion: null,
            isValid: false,
            errors: []
        };

        // Check Python
        try {
            const pythonResult = await this.executeCommand(pythonPath, ['--version']);
            if (pythonResult.exitCode === 0) {
                info.pythonVersion = pythonResult.stdout.trim() || pythonResult.stderr.trim();
                this.outputChannel.appendLine(`Python found: ${info.pythonVersion}`);
            } else {
                info.errors.push(`Python not found at: ${pythonPath}`);
            }
        } catch (error) {
            info.errors.push(`Failed to execute Python: ${error}`);
        }

        // Check Robot Framework
        if (info.pythonVersion) {
            try {
                const rfResult = await this.executeCommand(pythonPath, ['-m', 'robot', '--version']);
                // robot --version may return non-zero exit code, check output instead
                const version = rfResult.stdout.trim() || rfResult.stderr.trim();
                if (version && version.toLowerCase().includes('robot framework')) {
                    info.robotFrameworkVersion = this.extractVersion(version, 'Robot Framework');
                    this.outputChannel.appendLine(`Robot Framework found: ${info.robotFrameworkVersion}`);
                } else {
                    info.errors.push('Robot Framework not installed');
                }
            } catch {
                info.errors.push('Robot Framework not installed');
            }

            // Check Robocop
            try {
                const robocopResult = await this.executeCommand(pythonPath, ['-m', 'robocop', '--version']);
                // Check output instead of exit code
                const robocopVersion = robocopResult.stdout.trim() || robocopResult.stderr.trim();
                if (robocopVersion && (robocopVersion.includes('Robocop') || robocopVersion.match(/^\d+\.\d+/))) {
                    info.robocopVersion = robocopVersion;
                    this.outputChannel.appendLine(`Robocop found: ${info.robocopVersion}`);
                }
            } catch {
                // Robocop is optional
            }

            // Check Robotidy
            try {
                const robotidyResult = await this.executeCommand(pythonPath, ['-m', 'robotidy', '--version']);
                // Check output instead of exit code
                const robotidyVersion = robotidyResult.stdout.trim() || robotidyResult.stderr.trim();
                if (robotidyVersion && (robotidyVersion.includes('robotidy') || robotidyVersion.match(/^\d+\.\d+/))) {
                    info.robotidyVersion = robotidyVersion;
                    this.outputChannel.appendLine(`Robotidy found: ${info.robotidyVersion}`);
                }
            } catch {
                // Robotidy is optional
            }
        }

        // Determine if environment is valid
        info.isValid = info.pythonVersion !== null && info.robotFrameworkVersion !== null;

        // Cache the result
        this.cachedInfo = info;

        return info;
    }

    /**
     * Get cached environment info or check fresh
     */
    async getEnvironmentInfo(useCache: boolean = true): Promise<EnvironmentInfo> {
        if (useCache && this.cachedInfo) {
            return this.cachedInfo;
        }
        return this.checkEnvironment();
    }

    /**
     * Extract version from command output
     */
    private extractVersion(output: string, prefix: string): string {
        // Try to find version number pattern
        const match = output.match(/(\d+\.\d+(\.\d+)?)/);
        if (match) {
            return `${prefix} ${match[1]}`;
        }
        return output;
    }

    /**
     * Show environment information in a WebView panel
     */
    async showEnvironmentInfo(_context: vscode.ExtensionContext): Promise<void> {
        const info = await this.checkEnvironment();

        const panel = vscode.window.createWebviewPanel(
            'robotframeworkEnvironment',
            'Robot Framework Environment',
            vscode.ViewColumn.One,
            {
                enableScripts: true
            }
        );

        panel.webview.html = this.getWebviewContent(info);
    }

    /**
     * Generate HTML content for the environment info WebView
     */
    private getWebviewContent(info: EnvironmentInfo): string {
        const statusIcon = (value: string | null) => value ? '✅' : '❌';
        const optionalIcon = (value: string | null) => value ? '✅' : '⚠️';

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Robot Framework Environment</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        .status-card {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 16px;
        }
        .status-header {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
        }
        .status-icon {
            font-size: 24px;
            margin-right: 12px;
        }
        .status-title {
            font-size: 16px;
            font-weight: bold;
        }
        .status-value {
            margin-left: 36px;
            color: var(--vscode-descriptionForeground);
        }
        .section-title {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 8px;
        }
        .error-list {
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            border-radius: 4px;
            padding: 12px;
            margin-top: 16px;
        }
        .error-item {
            margin-bottom: 4px;
        }
        .install-hint {
            margin-top: 16px;
            padding: 12px;
            background-color: var(--vscode-textBlockQuote-background);
            border-radius: 4px;
        }
        code {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
        }
        .overall-status {
            font-size: 24px;
            text-align: center;
            padding: 20px;
            margin-bottom: 20px;
            border-radius: 8px;
        }
        .status-valid {
            background-color: var(--vscode-testing-iconPassed);
            color: white;
        }
        .status-invalid {
            background-color: var(--vscode-testing-iconFailed);
            color: white;
        }
    </style>
</head>
<body>
    <div class="overall-status ${info.isValid ? 'status-valid' : 'status-invalid'}">
        ${info.isValid ? '✅ Environment Ready' : '❌ Environment Issues Found'}
    </div>

    <div class="section-title">Required Components</div>

    <div class="status-card">
        <div class="status-header">
            <span class="status-icon">${statusIcon(info.pythonVersion)}</span>
            <span class="status-title">Python</span>
        </div>
        <div class="status-value">
            ${info.pythonVersion || 'Not found'}
            <br><small>Path: ${info.pythonPath}</small>
        </div>
    </div>

    <div class="status-card">
        <div class="status-header">
            <span class="status-icon">${statusIcon(info.robotFrameworkVersion)}</span>
            <span class="status-title">Robot Framework</span>
        </div>
        <div class="status-value">${info.robotFrameworkVersion || 'Not installed'}</div>
    </div>

    <div class="section-title">Optional Components</div>

    <div class="status-card">
        <div class="status-header">
            <span class="status-icon">${optionalIcon(info.robocopVersion)}</span>
            <span class="status-title">Robocop (Linting)</span>
        </div>
        <div class="status-value">${info.robocopVersion || 'Not installed'}</div>
    </div>

    <div class="status-card">
        <div class="status-header">
            <span class="status-icon">${optionalIcon(info.robotidyVersion)}</span>
            <span class="status-title">Robotidy (Formatting)</span>
        </div>
        <div class="status-value">${info.robotidyVersion || 'Not installed'}</div>
    </div>

    ${info.errors.length > 0 ? `
    <div class="error-list">
        <strong>Errors:</strong>
        ${info.errors.map(e => `<div class="error-item">• ${e}</div>`).join('')}
    </div>
    ` : ''}

    <div class="install-hint">
        <strong>Installation Commands:</strong><br><br>
        <code>pip install robotframework</code> - Install Robot Framework<br>
        <code>pip install robotframework-robocop</code> - Install Robocop linting<br>
        <code>pip install robotframework-tidy</code> - Install Robotidy formatting
    </div>
</body>
</html>`;
    }

    /**
     * Show startup notification about environment status
     */
    async showStartupNotification(): Promise<void> {
        const config = vscode.workspace.getConfiguration('robotframework');
        const showNotifications = config.get<boolean>('environment.showNotifications', true);

        if (!showNotifications) {
            return;
        }

        const info = await this.checkEnvironment();

        if (!info.isValid) {
            const action = await vscode.window.showWarningMessage(
                'Robot Framework environment has issues. Some features may not work correctly.',
                'Show Details',
                'Install Dependencies',
                'Ignore'
            );

            if (action === 'Show Details') {
                vscode.commands.executeCommand('robotframework.showEnvironmentInfo');
            } else if (action === 'Install Dependencies') {
                vscode.commands.executeCommand('robotframework.installDependencies');
            }
        } else if (!info.robocopVersion || !info.robotidyVersion) {
            // Optional dependencies missing
            const missing: string[] = [];
            if (!info.robocopVersion) missing.push('Robocop (linting)');
            if (!info.robotidyVersion) missing.push('Robotidy (formatting)');

            vscode.window.showInformationMessage(
                `Robot Framework ready. Optional: ${missing.join(', ')} not installed.`,
                'Install Now'
            ).then(action => {
                if (action === 'Install Now') {
                    vscode.commands.executeCommand('robotframework.installDependencies');
                }
            });
        }
    }

    /**
     * Execute a command and return the result
     */
    private executeCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
        return new Promise((resolve, reject) => {
            const process = spawn(command, args, {
                shell: true,
                windowsHide: true
            });

            let stdout = '';
            let stderr = '';

            process.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('exit', (code) => {
                resolve({
                    stdout,
                    stderr,
                    exitCode: code || 0
                });
            });

            process.on('error', (error) => {
                reject(error);
            });

            // Timeout after 10 seconds
            setTimeout(() => {
                process.kill();
                reject(new Error('Command timed out'));
            }, 10000);
        });
    }

    dispose(): void {
        this.outputChannel.dispose();
        if (this.cacheTimeout) {
            clearTimeout(this.cacheTimeout);
        }
    }
}
