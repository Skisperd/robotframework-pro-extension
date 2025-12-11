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

        // Append initial output
        run.appendOutput(`\r\nRunning test: ${test.label}\r\n`);
        run.appendOutput(`File: ${test.uri?.fsPath}\r\n`);
        run.appendOutput('─'.repeat(80) + '\r\n');

        try {
            const result = await this.executeTest(test, run, token);

            if (token.isCancellationRequested) {
                run.skipped(test);
                return;
            }

            // Append final output
            run.appendOutput('─'.repeat(80) + '\r\n');

            // Update test result based on execution
            if (result.passed) {
                run.appendOutput(`✓ Test passed (${result.duration}ms)\r\n\r\n`);
                run.passed(test, result.duration);
            } else {
                run.appendOutput(`✗ Test failed (${result.duration}ms)\r\n`);
                if (result.message) {
                    run.appendOutput(`Error: ${result.message}\r\n\r\n`);
                }

                const message = vscode.TestMessage.diff(
                    result.message || 'Test failed',
                    result.expected || '',
                    result.actual || ''
                );
                message.location = new vscode.Location(test.uri!, test.range!);
                run.failed(test, message, result.duration);
            }
        } catch (error) {
            run.appendOutput(`\r\n✗ Error: ${error instanceof Error ? error.message : String(error)}\r\n\r\n`);
            const message = new vscode.TestMessage(
                `Error executing test: ${error instanceof Error ? error.message : String(error)}`
            );
            run.failed(test, message);
        }
    }

    private async executeTest(
        test: vscode.TestItem,
        run: vscode.TestRun,
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
        // Note: We don't use shell:true to avoid issues with spaces in test names
        const args = [
            '-m',
            'robot',
            '--outputdir',
            outputDir,
            '--output',
            'output.xml',
            '--log',
            'log.html',
            '--report',
            'report.html',
            '--test',
            testName,  // spawn handles spaces correctly without shell
            ...additionalArgs,
            filePath
        ];

        this.outputChannel.appendLine(`\nRunning test: ${testName}`);
        this.outputChannel.appendLine(`Command: ${pythonExecutable} -m robot --test "${testName}" "${filePath}"`);
        this.outputChannel.appendLine(`Working directory: ${cwd}\n`);

        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            let output = '';
            let errorOutput = '';

            // Don't use shell:true - let spawn handle arguments properly
            this.currentProcess = spawn(pythonExecutable, args, {
                cwd: cwd,
                shell: false,
                windowsHide: true
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
                // Send output to test run in real-time (convert \n to \r\n for VS Code)
                run.appendOutput(text.replace(/\n/g, '\r\n'));
            });

            this.currentProcess.stderr?.on('data', (data) => {
                const text = data.toString();
                errorOutput += text;
                this.outputChannel.append(text);
                // Send error output to test run in real-time
                run.appendOutput(text.replace(/\n/g, '\r\n'));
            });

            this.currentProcess.on('exit', (code) => {
                const duration = Date.now() - startTime;
                this.currentProcess = undefined;

                // Parse output.xml to get detailed results
                const outputXmlPath = path.join(outputDir, 'output.xml');
                let testResult: TestResult;

                try {
                    // Try to parse text output first (more reliable for failure detection)
                    const textResult = this.parseTextOutput(output, testName);
                    
                    if (textResult) {
                        // Text output found a clear result
                        testResult = {
                            ...textResult,
                            duration: duration,
                            output: output
                        };
                    } else {
                        // Fallback to XML parsing
                        testResult = this.parseOutputXml(outputXmlPath, testName);
                        testResult.duration = duration;
                        testResult.output = output;
                        
                        // If XML also didn't find result, use exit code
                        if (testResult.message === 'Test result not found in output' || testResult.message === 'Output XML not found') {
                            testResult = {
                                passed: code === 0,
                                message: code === 0 ? 'Test passed' : `Test failed with exit code ${code}`,
                                duration: duration,
                                output: output
                            };
                        }
                    }
                } catch (parseError) {
                    // Ultimate fallback: use exit code
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

    private parseTextOutput(output: string, testName: string): TestResult | null {
        try {
            // Look for test result in the text output
            // Format: "TestName :: Description | PASS |" or "TestName :: Description | FAIL |"
            const lines = output.split('\n');

            for (const line of lines) {
                // Check if this line contains our test name and status
                if (line.includes(testName)) {
                    if (line.includes('| PASS |')) {
                        return {
                            passed: true,
                            message: 'Test passed',
                            output: ''
                        };
                    } else if (line.includes('| FAIL |')) {
                        // Try to extract failure message from next lines
                        const lineIndex = lines.indexOf(line);
                        let failureMessage = 'Test failed';

                        // Check the next few lines for the error message
                        for (let i = lineIndex + 1; i < Math.min(lineIndex + 5, lines.length); i++) {
                            const nextLine = lines[i].trim();
                            // Skip separator lines and empty lines
                            if (nextLine && !nextLine.startsWith('---') && !nextLine.startsWith('===') && !nextLine.includes('|')) {
                                failureMessage = nextLine;
                                break;
                            }
                        }

                        return {
                            passed: false,
                            message: failureMessage,
                            output: ''
                        };
                    }
                }
            }

            // Alternative: Check summary line "X test, Y passed, Z failed"
            const summaryRegex = /(\d+)\s+test(?:s)?,\s+(\d+)\s+passed,\s+(\d+)\s+failed/;
            const summaryMatch = output.match(summaryRegex);

            if (summaryMatch) {
                const failedTests = parseInt(summaryMatch[3]);
                const passedTests = parseInt(summaryMatch[2]);

                // If any test failed, return failure
                if (failedTests > 0) {
                    // Try to find failure message in output
                    let failureMessage = 'Test failed';
                    
                    // Look for failure message before the summary
                    const beforeSummary = output.substring(0, output.indexOf(summaryMatch[0]));
                    const failLines = beforeSummary.split('\n').reverse();
                    
                    for (const line of failLines) {
                        const trimmed = line.trim();
                        // Skip separator lines and empty lines
                        if (trimmed && 
                            !trimmed.startsWith('---') && 
                            !trimmed.startsWith('===') && 
                            !trimmed.includes('|') &&
                            !trimmed.match(/^[A-Z][a-z]+\s+::/) &&
                            trimmed.length > 10) {
                            failureMessage = trimmed;
                            break;
                        }
                    }
                    
                    return {
                        passed: false,
                        message: failureMessage,
                        output: ''
                    };
                } else if (passedTests > 0) {
                    return {
                        passed: true,
                        message: 'Test passed',
                        output: ''
                    };
                }
            }

            return null;
        } catch (error) {
            return null;
        }
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
