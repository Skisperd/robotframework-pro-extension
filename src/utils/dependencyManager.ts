import * as vscode from 'vscode';
import { spawn } from 'child_process';

export interface DependencyStatus {
    name: string;
    displayName: string;
    installed: boolean;
    version: string | null;
    required: boolean;
    installCommand: string;
}

export class DependencyManager implements vscode.Disposable {
    private outputChannel: vscode.OutputChannel;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Robot Framework Dependencies');
    }

    /**
     * Check the status of all Robot Framework dependencies
     */
    async checkDependencies(): Promise<DependencyStatus[]> {
        const config = vscode.workspace.getConfiguration('robotframework');
        const pythonPath = config.get<string>('python.executable', 'python');

        const dependencies: DependencyStatus[] = [
            {
                name: 'robotframework',
                displayName: 'Robot Framework',
                installed: false,
                version: null,
                required: true,
                installCommand: 'pip install robotframework'
            },
            {
                name: 'robotframework-robocop',
                displayName: 'Robocop (Linting)',
                installed: false,
                version: null,
                required: false,
                installCommand: 'pip install robotframework-robocop'
            },
            {
                name: 'robotframework-tidy',
                displayName: 'Robotidy (Formatting)',
                installed: false,
                version: null,
                required: false,
                installCommand: 'pip install robotframework-tidy'
            },
            {
                name: 'robotframework-seleniumlibrary',
                displayName: 'SeleniumLibrary (Web Testing)',
                installed: false,
                version: null,
                required: false,
                installCommand: 'pip install robotframework-seleniumlibrary'
            },
            {
                name: 'robotframework-requests',
                displayName: 'RequestsLibrary (API Testing)',
                installed: false,
                version: null,
                required: false,
                installCommand: 'pip install robotframework-requests'
            },
            {
                name: 'robotframework-databaselibrary',
                displayName: 'DatabaseLibrary (Database Testing)',
                installed: false,
                version: null,
                required: false,
                installCommand: 'pip install robotframework-databaselibrary'
            }
        ];

        // Check each dependency using pip show
        for (const dep of dependencies) {
            try {
                const result = await this.executeCommand(pythonPath, ['-m', 'pip', 'show', dep.name]);
                if (result.exitCode === 0) {
                    dep.installed = true;
                    // Extract version from pip show output
                    const versionMatch = result.stdout.match(/Version:\s*(.+)/);
                    if (versionMatch) {
                        dep.version = versionMatch[1].trim();
                    }
                }
            } catch {
                // Package not installed
            }
        }

        return dependencies;
    }

    /**
     * Get missing required dependencies
     */
    async getMissingRequired(): Promise<DependencyStatus[]> {
        const deps = await this.checkDependencies();
        return deps.filter(d => d.required && !d.installed);
    }

    /**
     * Get missing optional dependencies
     */
    async getMissingOptional(): Promise<DependencyStatus[]> {
        const deps = await this.checkDependencies();
        return deps.filter(d => !d.required && !d.installed);
    }

    /**
     * Show a QuickPick to select and install dependencies
     */
    async installDependencies(): Promise<boolean> {
        const deps = await this.checkDependencies();
        const missingDeps = deps.filter(d => !d.installed);

        if (missingDeps.length === 0) {
            vscode.window.showInformationMessage('All Robot Framework dependencies are already installed!');
            return true;
        }

        const items: vscode.QuickPickItem[] = missingDeps.map(d => ({
            label: d.displayName,
            description: d.required ? '(Required)' : '(Optional)',
            detail: d.installCommand,
            picked: d.required
        }));

        const selected = await vscode.window.showQuickPick(items, {
            canPickMany: true,
            placeHolder: 'Select dependencies to install',
            title: 'Install Robot Framework Dependencies'
        });

        if (!selected || selected.length === 0) {
            return false;
        }

        // Build install command
        const packagesToInstall = selected.map(s => {
            const dep = missingDeps.find(d => d.displayName === s.label);
            return dep?.name || '';
        }).filter(name => name !== '');

        if (packagesToInstall.length === 0) {
            return false;
        }

        // Open terminal and run pip install
        const terminal = vscode.window.createTerminal('Robot Framework Dependencies');
        terminal.show();

        const config = vscode.workspace.getConfiguration('robotframework');
        const pythonPath = config.get<string>('python.executable', 'python');

        const installCommand = `${pythonPath} -m pip install ${packagesToInstall.join(' ')}`;
        terminal.sendText(installCommand);

        vscode.window.showInformationMessage(
            `Installing: ${packagesToInstall.join(', ')}. Check the terminal for progress.`
        );

        return true;
    }

    /**
     * Install specific packages
     */
    async installPackages(packages: string[]): Promise<void> {
        if (packages.length === 0) {
            return;
        }

        const terminal = vscode.window.createTerminal('Robot Framework Dependencies');
        terminal.show();

        const config = vscode.workspace.getConfiguration('robotframework');
        const pythonPath = config.get<string>('python.executable', 'python');

        const installCommand = `${pythonPath} -m pip install ${packages.join(' ')}`;
        terminal.sendText(installCommand);
    }

    /**
     * Upgrade all installed Robot Framework packages
     */
    async upgradeAll(): Promise<void> {
        const deps = await this.checkDependencies();
        const installedDeps = deps.filter(d => d.installed);

        if (installedDeps.length === 0) {
            vscode.window.showWarningMessage('No Robot Framework packages installed to upgrade.');
            return;
        }

        const terminal = vscode.window.createTerminal('Robot Framework Dependencies');
        terminal.show();

        const config = vscode.workspace.getConfiguration('robotframework');
        const pythonPath = config.get<string>('python.executable', 'python');

        const packages = installedDeps.map(d => d.name).join(' ');
        const upgradeCommand = `${pythonPath} -m pip install --upgrade ${packages}`;
        terminal.sendText(upgradeCommand);

        vscode.window.showInformationMessage('Upgrading Robot Framework packages. Check the terminal for progress.');
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

            // Timeout after 30 seconds
            setTimeout(() => {
                process.kill();
                reject(new Error('Command timed out'));
            }, 30000);
        });
    }

    dispose(): void {
        this.outputChannel.dispose();
    }
}
