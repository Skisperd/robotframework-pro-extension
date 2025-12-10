import * as vscode from 'vscode';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';

export class TestExecutor {
    private currentProcess: ChildProcess | undefined;
    private outputChannel: vscode.OutputChannel;

    constructor(_controller: vscode.TestController) {
        this.outputChannel = vscode.window.createOutputChannel('Robot Framework Tests');
    }

    async runTest(
        test: vscode.TestItem,
        run: vscode.TestRun,
        token: vscode.CancellationToken
    ): Promise<void> {
        // Mark test as enqueued
        run.enqueued(test);

        // Check for cancellation
        if (token.isCancellationRequested) {
            run.skipped(test);
            return;
        }

        // Mark test as started
        run.started(test);

        try {
            const result = await this.executeTest(test, token);

            if (token.isCancellationRequested) {
                run.skipped(test);
                return;
            }

            // Update test result based on execution
            if (result.passed) {
                run.passed(test, result.duration);
            } else {
                const message = vscode.TestMessage.diff(
                    result.message || 'Test failed',
                    result.expected || '',
                    result.actual || ''
                );
                message.location = new vscode.Location(test.uri!, test.range!);
                run.failed(test, message, result.duration);
            }

            // Append output
            if (result.output) {
                run.appendOutput(result.output);
            }
        } catch (error) {
            const message = new vscode.TestMessage(
                `Error executing test: ${error instanceof Error ? error.message : String(error)}`
            );
            run.failed(test, message);
        }
    }

    private async executeTest(
        test: vscode.TestItem,
        token: vscode.CancellationToken
    ): Promise<TestResult> {
        const config = vscode.workspace.getConfiguration('robotframework');
        const pythonExecutable = config.get<string>('python.executable', 'python');
        const additionalArgs = config.get<string[]>('execution.arguments', []);

        if (!test.uri) {
            throw new Error('Test has no URI');
        }

        const filePath = test.uri.fsPath;
        const testName = test.label;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(test.uri);
        const cwd = workspaceFolder?.uri.fsPath || path.dirname(filePath);

        // Create unique output directory for this test run
        const outputDir = path.join(cwd, '.robot-test-output', Date.now().toString());

        // Ensure output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Build robot command with test name filter
        const args = [
            '-m', 'robot',
            '--outputdir', outputDir,
            '--output', 'output.xml',
            '--log', 'log.html',
            '--report', 'report.html',
            '--test', testName,
            ...additionalArgs,
            filePath
        ];

        this.outputChannel.appendLine(`\nRunning test: ${testName}`);
        this.outputChannel.appendLine(`Command: ${pythonExecutable} ${args.join(' ')}`);
        this.outputChannel.appendLine(`Working directory: ${cwd}\n`);

        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            let output = '';
            let errorOutput = '';

            this.currentProcess = spawn(pythonExecutable, args, {
                cwd: cwd,
                shell: true
            });

            // Handle cancellation
            token.onCancellationRequested(() => {
                if (this.currentProcess) {
                    this.currentProcess.kill();
                    this.outputChannel.appendLine('Test execution cancelled\n');
                }
            });

            this.currentProcess.stdout?.on('data', (data) => {
                const text = data.toString();
                output += text;
                this.outputChannel.append(text);
            });

            this.currentProcess.stderr?.on('data', (data) => {
                const text = data.toString();
                errorOutput += text;
                this.outputChannel.append(text);
            });

            this.currentProcess.on('exit', (code) => {
                const duration = Date.now() - startTime;
                this.currentProcess = undefined;

                // Parse output.xml to get detailed results
                const outputXmlPath = path.join(outputDir, 'output.xml');
                let testResult: TestResult;

                try {
                    testResult = this.parseOutputXml(outputXmlPath, testName);
                    testResult.duration = duration;
                    testResult.output = output;
                } catch (parseError) {
                    // Fallback if XML parsing fails
                    testResult = {
                        passed: code === 0,
                        message: code === 0 ? 'Test passed' : `Test failed with exit code ${code}`,
                        duration: duration,
                        output: output
                    };
                }

                this.outputChannel.appendLine(`\nTest ${testResult.passed ? 'PASSED' : 'FAILED'} (${duration}ms)\n`);

                resolve(testResult);
            });

            this.currentProcess.on('error', (err) => {
                this.currentProcess = undefined;
                this.outputChannel.appendLine(`\nError: ${err.message}\n`);
                reject(err);
            });
        });
    }

    private parseOutputXml(xmlPath: string, testName: string): TestResult {
        try {
            if (!fs.existsSync(xmlPath)) {
                return {
                    passed: false,
                    message: 'Output XML not found',
                    output: ''
                };
            }

            const xmlContent = fs.readFileSync(xmlPath, 'utf-8');

            // Simple XML parsing (you might want to use a proper XML parser library)
            // Look for test status in the XML
            const testRegex = new RegExp(
                `<test[^>]*name="${testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>.*?<status[^>]*status="(PASS|FAIL)"[^>]*>.*?</status>.*?</test>`,
                's'
            );

            const match = xmlContent.match(testRegex);

            if (match) {
                const status = match[1];
                const passed = status === 'PASS';

                // Extract failure message if test failed
                let message = passed ? 'Test passed' : 'Test failed';

                if (!passed) {
                    const messageRegex = /<msg[^>]*>(.*?)<\/msg>/s;
                    const messageMatch = match[0].match(messageRegex);
                    if (messageMatch) {
                        message = this.decodeXmlEntities(messageMatch[1]);
                    }
                }

                return {
                    passed: passed,
                    message: message,
                    output: ''
                };
            }

            return {
                passed: false,
                message: 'Test result not found in output',
                output: ''
            };
        } catch (error) {
            return {
                passed: false,
                message: `Error parsing output: ${error instanceof Error ? error.message : String(error)}`,
                output: ''
            };
        }
    }

    private decodeXmlEntities(text: string): string {
        return text
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'");
    }

    dispose(): void {
        if (this.currentProcess) {
            this.currentProcess.kill();
        }
        this.outputChannel.dispose();
    }
}

interface TestResult {
    passed: boolean;
    message?: string;
    expected?: string;
    actual?: string;
    duration?: number;
    output?: string;
}
