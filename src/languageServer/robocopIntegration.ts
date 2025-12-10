import * as vscode from 'vscode';
import { spawn } from 'child_process';

export interface RobocopIssue {
    line: number;
    column: number;
    severity: 'error' | 'warning' | 'info';
    rule: string;
    message: string;
}

export class RobocopIntegration {
    private outputChannel: vscode.OutputChannel;
    private isRobocopAvailable: boolean | null = null;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Robocop');
    }

    async checkRobocopAvailability(): Promise<boolean> {
        if (this.isRobocopAvailable !== null) {
            return this.isRobocopAvailable;
        }

        try {
            const config = vscode.workspace.getConfiguration('robotframework');
            const pythonPath = config.get<string>('python.executable', 'python');

            const result = await this.executeCommand(pythonPath, ['-m', 'robocop', '--version']);
            this.isRobocopAvailable = result.exitCode === 0;

            if (this.isRobocopAvailable) {
                this.outputChannel.appendLine(`Robocop available: ${result.stdout.trim()}`);
            } else {
                this.outputChannel.appendLine('Robocop not available. Install with: pip install robotframework-robocop');
            }

            return this.isRobocopAvailable;
        } catch (error) {
            this.isRobocopAvailable = false;
            this.outputChannel.appendLine(`Robocop check failed: ${error}`);
            return false;
        }
    }

    async lintFile(filePath: string): Promise<RobocopIssue[]> {
        const available = await this.checkRobocopAvailability();
        if (!available) {
            return [];
        }

        try {
            const config = vscode.workspace.getConfiguration('robotframework');
            const pythonPath = config.get<string>('python.executable', 'python');

            // Run robocop with JSON output
            const args = [
                '-m', 'robocop',
                '--format', '{source}:{line}:{col}:{severity}:{rule_id}:{desc}',
                filePath
            ];

            const result = await this.executeCommand(pythonPath, args);
            return this.parseRobocopOutput(result.stdout);
        } catch (error) {
            this.outputChannel.appendLine(`Error running Robocop on ${filePath}: ${error}`);
            return [];
        }
    }

    private parseRobocopOutput(output: string): RobocopIssue[] {
        const issues: RobocopIssue[] = [];
        const lines = output.split('\n');

        for (const line of lines) {
            if (!line.trim()) {
                continue;
            }

            // Format: file:line:col:severity:rule:message
            const match = line.match(/^(.+?):(\d+):(\d+):(E|W|I):(\w+):(.+)$/);
            if (match) {
                const [, , lineStr, colStr, severityChar, rule, message] = match;

                let severity: 'error' | 'warning' | 'info';
                switch (severityChar) {
                    case 'E':
                        severity = 'error';
                        break;
                    case 'W':
                        severity = 'warning';
                        break;
                    default:
                        severity = 'info';
                }

                issues.push({
                    line: parseInt(lineStr) - 1, // VS Code uses 0-based lines
                    column: parseInt(colStr) - 1, // VS Code uses 0-based columns
                    severity: severity,
                    rule: rule,
                    message: message.trim()
                });
            }
        }

        return issues;
    }

    async formatFile(filePath: string): Promise<string | null> {
        const available = await this.checkRobocopAvailability();
        if (!available) {
            return null;
        }

        try {
            const config = vscode.workspace.getConfiguration('robotframework');
            const pythonPath = config.get<string>('python.executable', 'python');

            // Try to use robotidy (Robocop's formatter)
            const args = [
                '-m', 'robotidy',
                '--check',
                '--no-overwrite',
                filePath
            ];

            const result = await this.executeCommand(pythonPath, args);

            // If robotidy is not available, return null
            if (result.exitCode === 127 || result.stderr.includes('No module named')) {
                this.outputChannel.appendLine('robotidy not available. Install with: pip install robotframework-tidy');
                return null;
            }

            // Return formatted content from stdout
            return result.stdout;
        } catch (error) {
            this.outputChannel.appendLine(`Error formatting with robotidy: ${error}`);
            return null;
        }
    }

    private executeCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
        return new Promise((resolve, reject) => {
            const process = spawn(command, args, {
                shell: false,
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
                    stdout: stdout,
                    stderr: stderr,
                    exitCode: code || 0
                });
            });

            process.on('error', (error) => {
                reject(error);
            });
        });
    }

    dispose(): void {
        this.outputChannel.dispose();
    }
}
