import * as vscode from 'vscode';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';

export class TestRunner {
    private _outputChannel: vscode.OutputChannel;
    private _currentProcess: ChildProcess | undefined;
    private _statusBarItem: vscode.StatusBarItem;

    constructor(outputChannel: vscode.OutputChannel) {
        this._outputChannel = outputChannel;
        this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    }

    async runTest(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'robotframework') {
            vscode.window.showErrorMessage('No Robot Framework file is active');
            return;
        }

        await this.runFile(editor.document.uri);
    }

    async runFile(uri?: vscode.Uri): Promise<void> {
        const fileUri = uri || vscode.window.activeTextEditor?.document.uri;

        if (!fileUri) {
            vscode.window.showErrorMessage('No file specified');
            return;
        }

        if (!fileUri.fsPath.endsWith('.robot')) {
            vscode.window.showErrorMessage('File is not a Robot Framework test file');
            return;
        }

        await this.executeRobot(fileUri.fsPath);
    }

    async runSuite(uri?: vscode.Uri): Promise<void> {
        let targetPath: string;

        if (uri) {
            targetPath = uri.fsPath;
        } else {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder open');
                return;
            }
            targetPath = workspaceFolder.uri.fsPath;
        }

        await this.executeRobot(targetPath);
    }

    private async executeRobot(target: string): Promise<void> {
        // Stop any running process
        if (this._currentProcess) {
            this._currentProcess.kill();
        }

        const config = vscode.workspace.getConfiguration('robotframework');
        const pythonExecutable = config.get<string>('python.executable', 'python');
        const additionalArgs = config.get<string[]>('execution.arguments', []);
        const showOutput = config.get<boolean>('execution.showOutputOnRun', true);
        const clearOutput = config.get<boolean>('execution.clearOutputBeforeRun', true);

        if (clearOutput) {
            this._outputChannel.clear();
        }

        if (showOutput) {
            this._outputChannel.show(true);
        }

        // Get working directory
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const cwd = workspaceFolder?.uri.fsPath || path.dirname(target);

        // Build command
        const args = ['-m', 'robot', ...additionalArgs, target];

        this._outputChannel.appendLine(`Running: ${pythonExecutable} ${args.join(' ')}`);
        this._outputChannel.appendLine(`Working directory: ${cwd}`);
        this._outputChannel.appendLine('─'.repeat(80));

        // Update status bar
        this._statusBarItem.text = '$(sync~spin) Running Robot Framework...';
        this._statusBarItem.show();

        // Spawn process
        this._currentProcess = spawn(pythonExecutable, args, {
            cwd: cwd,
            shell: true
        });

        this._currentProcess.stdout?.on('data', (data) => {
            this._outputChannel.append(data.toString());
        });

        this._currentProcess.stderr?.on('data', (data) => {
            this._outputChannel.append(data.toString());
        });

        this._currentProcess.on('exit', (code) => {
            this._outputChannel.appendLine('─'.repeat(80));
            if (code === 0) {
                this._outputChannel.appendLine(`✓ All tests passed`);
                this._statusBarItem.text = '$(check) Tests passed';
                this._statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                vscode.window.showInformationMessage('All Robot Framework tests passed!');
            } else {
                this._outputChannel.appendLine(`✗ Tests failed with exit code ${code}`);
                this._statusBarItem.text = '$(x) Tests failed';
                this._statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
                vscode.window.showErrorMessage(`Robot Framework tests failed with exit code ${code}`);
            }

            // Clear status bar after 5 seconds
            setTimeout(() => {
                this._statusBarItem.hide();
            }, 5000);

            this._currentProcess = undefined;

            // Try to open report
            this.tryOpenReport(cwd);
        });

        this._currentProcess.on('error', (err) => {
            this._outputChannel.appendLine(`Error: ${err.message}`);
            this._statusBarItem.text = '$(x) Execution error';
            this._statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            vscode.window.showErrorMessage(`Error running Robot Framework: ${err.message}`);

            setTimeout(() => {
                this._statusBarItem.hide();
            }, 5000);

            this._currentProcess = undefined;
        });
    }

    private async tryOpenReport(cwd: string): Promise<void> {
        const reportPath = path.join(cwd, 'report.html');
        const logPath = path.join(cwd, 'log.html');

        // Ask user if they want to open the report
        const choice = await vscode.window.showInformationMessage(
            'Test execution completed. Would you like to open the report?',
            'Open Report',
            'Open Log',
            'No'
        );

        if (choice === 'Open Report') {
            await vscode.env.openExternal(vscode.Uri.file(reportPath));
        } else if (choice === 'Open Log') {
            await vscode.env.openExternal(vscode.Uri.file(logPath));
        }
    }

    dispose(): void {
        if (this._currentProcess) {
            this._currentProcess.kill();
        }
        this._statusBarItem.dispose();
    }
}
