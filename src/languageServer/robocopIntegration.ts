import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';

export interface RobocopIssue {
    line: number;
    column: number;
    severity: 'error' | 'warning' | 'info';
    rule: string;
    message: string;
}

export class RobocopIntegration implements vscode.Disposable {
    private outputChannel: vscode.OutputChannel;
    private isRobocopAvailable: boolean | null = null;
    private isRobotidyAvailable: boolean | null = null;
    private diagnosticCollection: vscode.DiagnosticCollection;
    private fileWatcher: vscode.FileSystemWatcher | undefined;
    private lintDebounceTimers: Map<string, NodeJS.Timeout> = new Map();
    private formatOnSaveDisposable: vscode.Disposable | undefined;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Robocop');
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('robocop');
    }

    /**
     * Initialize Robocop integration with file watching and auto-linting
     */
    async initialize(): Promise<void> {
        const config = vscode.workspace.getConfiguration('robotframework');
        const enableRobocop = config.get<boolean>('robocop.enabled', true);

        if (!enableRobocop) {
            this.outputChannel.appendLine('Robocop integration is disabled');
            return;
        }

        const available = await this.checkRobocopAvailability();
        if (!available) {
            return;
        }

        // Also check for robotidy
        await this.checkRobotidyAvailability();

        // Set up file watcher for auto-linting
        this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.{robot,resource}');

        this.fileWatcher.onDidChange(uri => this.debouncedLint(uri));
        this.fileWatcher.onDidCreate(uri => this.debouncedLint(uri));

        // Lint all open documents
        vscode.window.visibleTextEditors.forEach(editor => {
            if (editor.document.languageId === 'robotframework') {
                this.lintDocument(editor.document);
            }
        });

        // Lint on document open
        vscode.workspace.onDidOpenTextDocument(doc => {
            if (doc.languageId === 'robotframework') {
                this.lintDocument(doc);
            }
        });

        // Clear diagnostics when document is closed
        vscode.workspace.onDidCloseTextDocument(doc => {
            this.diagnosticCollection.delete(doc.uri);
        });

        // Set up format-on-save if enabled
        this.setupFormatOnSave();

        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('robotframework.formatting.formatOnSave')) {
                this.setupFormatOnSave();
            }
        });

        this.outputChannel.appendLine('Robocop integration initialized');
    }

    /**
     * Set up or tear down format-on-save based on configuration
     */
    private setupFormatOnSave(): void {
        const config = vscode.workspace.getConfiguration('robotframework');
        const formatOnSave = config.get<boolean>('formatting.formatOnSave', false);
        const robotidyEnabled = config.get<boolean>('robotidy.enabled', true);

        // Dispose existing listener if any
        if (this.formatOnSaveDisposable) {
            this.formatOnSaveDisposable.dispose();
            this.formatOnSaveDisposable = undefined;
        }

        if (formatOnSave && robotidyEnabled && this.isRobotidyAvailable) {
            this.formatOnSaveDisposable = vscode.workspace.onWillSaveTextDocument(async (event) => {
                if (event.document.languageId === 'robotframework') {
                    const formattedContent = await this.formatFile(event.document.uri.fsPath);
                    if (formattedContent !== null) {
                        const fullRange = new vscode.Range(
                            event.document.positionAt(0),
                            event.document.positionAt(event.document.getText().length)
                        );
                        event.waitUntil(Promise.resolve([vscode.TextEdit.replace(fullRange, formattedContent)]));
                    }
                }
            });
            this.outputChannel.appendLine('Format-on-save enabled with robotidy');
        }
    }

    /**
     * Debounced lint to prevent excessive linting during rapid changes
     */
    private debouncedLint(uri: vscode.Uri): void {
        const key = uri.toString();
        const existingTimer = this.lintDebounceTimers.get(key);
        
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        const timer = setTimeout(async () => {
            this.lintDebounceTimers.delete(key);
            try {
                const doc = await vscode.workspace.openTextDocument(uri);
                await this.lintDocument(doc);
            } catch (error) {
                // Document might have been deleted
            }
        }, 500);

        this.lintDebounceTimers.set(key, timer);
    }

    /**
     * Lint a document and update diagnostics
     */
    async lintDocument(document: vscode.TextDocument): Promise<void> {
        if (document.languageId !== 'robotframework') {
            return;
        }

        const issues = await this.lintFile(document.uri.fsPath);
        const diagnostics = issues.map(issue => this.issueToDiagnostic(issue));
        this.diagnosticCollection.set(document.uri, diagnostics);
    }

    /**
     * Convert RobocopIssue to VS Code Diagnostic
     */
    private issueToDiagnostic(issue: RobocopIssue): vscode.Diagnostic {
        const range = new vscode.Range(
            issue.line, issue.column,
            issue.line, issue.column + 100 // Approximate line end
        );

        let severity: vscode.DiagnosticSeverity;
        switch (issue.severity) {
            case 'error':
                severity = vscode.DiagnosticSeverity.Error;
                break;
            case 'warning':
                severity = vscode.DiagnosticSeverity.Warning;
                break;
            default:
                severity = vscode.DiagnosticSeverity.Information;
        }

        const diagnostic = new vscode.Diagnostic(range, issue.message, severity);
        diagnostic.source = 'robocop';
        diagnostic.code = issue.rule;
        return diagnostic;
    }

    /**
     * Check if robotidy is available
     */
    async checkRobotidyAvailability(): Promise<boolean> {
        if (this.isRobotidyAvailable !== null) {
            return this.isRobotidyAvailable;
        }

        try {
            const config = vscode.workspace.getConfiguration('robotframework');
            const pythonPath = config.get<string>('python.executable', 'python');

            const result = await this.executeCommand(pythonPath, ['-m', 'robotidy', '--version']);
            this.isRobotidyAvailable = result.exitCode === 0;

            if (this.isRobotidyAvailable) {
                this.outputChannel.appendLine(`robotidy available: ${result.stdout.trim()}`);
            } else {
                this.outputChannel.appendLine('robotidy not available. Install with: pip install robotframework-tidy');
            }

            return this.isRobotidyAvailable;
        } catch (error) {
            this.isRobotidyAvailable = false;
            return false;
        }
    }

    /**
     * Get diagnostic collection for external access
     */
    getDiagnosticCollection(): vscode.DiagnosticCollection {
        return this.diagnosticCollection;
    }

    /**
     * Clear all Robocop diagnostics
     */
    clearDiagnostics(): void {
        this.diagnosticCollection.clear();
    }

    /**
     * Manually trigger linting for all open Robot Framework files
     */
    async lintAllOpenFiles(): Promise<void> {
        for (const editor of vscode.window.visibleTextEditors) {
            if (editor.document.languageId === 'robotframework') {
                await this.lintDocument(editor.document);
            }
        }
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
            const excludeRules = config.get<string[]>('robocop.exclude', []);
            const includeRules = config.get<string[]>('robocop.include', []);

            // Run robocop with custom format
            const args = [
                '-m', 'robocop',
                '--format', '{source}:{line}:{col}:{severity}:{rule_id}:{desc}'
            ];

            // Add exclude rules
            for (const rule of excludeRules) {
                args.push('--exclude', rule);
            }

            // Add include rules (if specified, only these rules run)
            for (const rule of includeRules) {
                args.push('--include', rule);
            }

            args.push(filePath);

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
        const available = await this.checkRobotidyAvailability();
        if (!available) {
            this.outputChannel.appendLine('robotidy not available. Install with: pip install robotframework-tidy');
            return null;
        }

        try {
            const config = vscode.workspace.getConfiguration('robotframework');
            const pythonPath = config.get<string>('python.executable', 'python');
            const robotidyEnabled = config.get<boolean>('robotidy.enabled', true);
            const lineLength = config.get<number>('robotidy.lineLength', 120);

            if (!robotidyEnabled) {
                return null;
            }

            // Create a temporary file to hold the content for formatting
            const tempDir = os.tmpdir();
            const tempFileName = `robotidy_${Date.now()}_${path.basename(filePath)}`;
            const tempFilePath = path.join(tempDir, tempFileName);

            // Copy the original file to temp location
            const originalContent = fs.readFileSync(filePath, 'utf8');
            fs.writeFileSync(tempFilePath, originalContent, 'utf8');

            // Run robotidy on the temp file (it modifies in place)
            const args = [
                '-m', 'robotidy',
                '--line-length', lineLength.toString(),
                tempFilePath
            ];

            const result = await this.executeCommand(pythonPath, args);

            // Exit code 1 means file was changed, which is OK
            // Exit code 0 means no changes needed
            // Other exit codes indicate errors
            if (result.exitCode !== 0 && result.exitCode !== 1) {
                if (result.stderr.includes('No module named')) {
                    this.outputChannel.appendLine('robotidy not available. Install with: pip install robotframework-tidy');
                    this.isRobotidyAvailable = false;
                } else {
                    this.outputChannel.appendLine(`robotidy error: ${result.stderr}`);
                }
                // Clean up temp file
                try { fs.unlinkSync(tempFilePath); } catch { /* ignore */ }
                return null;
            }

            // Read the formatted content from temp file
            const formattedContent = fs.readFileSync(tempFilePath, 'utf8');

            // Clean up temp file
            try { fs.unlinkSync(tempFilePath); } catch { /* ignore */ }

            return formattedContent;
        } catch (error) {
            this.outputChannel.appendLine(`Error formatting with robotidy: ${error}`);
            return null;
        }
    }

    /**
     * Format a document using robotidy
     */
    async formatDocument(document: vscode.TextDocument): Promise<vscode.TextEdit[] | null> {
        const formattedContent = await this.formatFile(document.uri.fsPath);
        if (formattedContent === null) {
            return null;
        }

        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
        );

        return [vscode.TextEdit.replace(fullRange, formattedContent)];
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
        this.diagnosticCollection.dispose();
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
        }
        if (this.formatOnSaveDisposable) {
            this.formatOnSaveDisposable.dispose();
        }
        for (const timer of this.lintDebounceTimers.values()) {
            clearTimeout(timer);
        }
        this.lintDebounceTimers.clear();
    }

    /**
     * Check if robotidy is available
     */
    isRobotidyEnabled(): boolean {
        return this.isRobotidyAvailable === true;
    }

    /**
     * Check if robocop is available
     */
    isRobocopEnabled(): boolean {
        return this.isRobocopAvailable === true;
    }
}
