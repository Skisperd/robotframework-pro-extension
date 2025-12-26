import * as vscode from 'vscode';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';

// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    // Foreground colors
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
    // Bright colors
    brightRed: '\x1b[91m',
    brightGreen: '\x1b[92m',
    brightYellow: '\x1b[93m',
    brightBlue: '\x1b[94m',
    brightCyan: '\x1b[96m',
    // Background colors
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
};

export class TestExecutor {
    private currentProcess: ChildProcess | undefined;
    private outputChannel: vscode.OutputChannel;

    constructor(_controller: vscode.TestController) {
        this.outputChannel = vscode.window.createOutputChannel('Robot Framework Tests');
    }

    async runTest(
        test: vscode.TestItem,
        run: vscode.TestRun,
        token: vscode.CancellationToken,
        debugMode: boolean = false
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

        // Append initial output with colors
        const modeLabel = debugMode ? `${colors.magenta}[DEBUG MODE]${colors.reset} ` : '';
        run.appendOutput(`\r\n${modeLabel}${colors.brightCyan}${colors.bold}Running test: ${test.label}${colors.reset}\r\n`);
        run.appendOutput(`${colors.gray}File: ${test.uri?.fsPath}${colors.reset}\r\n`);
        run.appendOutput(`${colors.cyan}${'─'.repeat(80)}${colors.reset}\r\n`);

        try {
            const result = await this.executeTest(test, run, token, debugMode);

            if (token.isCancellationRequested) {
                run.skipped(test);
                return;
            }

            // Append final output with colors
            run.appendOutput(`${colors.cyan}${'─'.repeat(80)}${colors.reset}\r\n`);

            // Update test result based on execution
            if (result.passed) {
                run.appendOutput(`${colors.brightGreen}${colors.bold}✓ Test passed${colors.reset} ${colors.gray}(${result.duration}ms)${colors.reset}\r\n\r\n`);
                run.passed(test, result.duration);
            } else {
                run.appendOutput(`${colors.brightRed}${colors.bold}✗ Test failed${colors.reset} ${colors.gray}(${result.duration}ms)${colors.reset}\r\n`);
                if (result.message) {
                    run.appendOutput(`${colors.red}Error: ${result.message}${colors.reset}\r\n\r\n`);
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
            run.appendOutput(`\r\n${colors.brightRed}${colors.bold}✗ Error:${colors.reset} ${colors.red}${error instanceof Error ? error.message : String(error)}${colors.reset}\r\n\r\n`);
            const message = new vscode.TestMessage(
                `Error executing test: ${error instanceof Error ? error.message : String(error)}`
            );
            run.failed(test, message);
        }
    }

    private async executeTest(
        test: vscode.TestItem,
        run: vscode.TestRun,
        token: vscode.CancellationToken,
        debugMode: boolean = false
    ): Promise<TestResult> {
        const config = vscode.workspace.getConfiguration('robotframework');
        const pythonExecutable = config.get<string>('python.executable', 'python');
        const additionalArgs = config.get<string[]>('execution.arguments', []);

        if (!test.uri) {
            throw new Error('Test has no URI');
        }

        const filePath = test.uri.fsPath;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(test.uri);
        const cwd = workspaceFolder?.uri.fsPath || path.dirname(filePath);

        // Determine if this is an individual test or a file item
        // Most reliable way: check if test.id equals test.uri (file items have ID = URI)
        const isFileItemByUri = test.uri && test.id === test.uri.toString();

        // Backup checks for safety
        const hasDoubleSeparator = test.id.includes('::');
        const hasFileExtension = test.label.endsWith('.robot') || test.label.endsWith('.resource');
        const hasPathSeparators = test.label.includes('\\') || test.label.includes('/');
        const hasChildren = test.children.size > 0;

        // It's a file item if ANY of these conditions are true:
        // 1. ID equals URI (most reliable) OR
        // 2. ID doesn't have "::" separator OR
        // 3. Label has .robot/.resource extension OR
        // 4. Label has path separators OR
        // 5. Item has children
        const isFileItem = isFileItemByUri || !hasDoubleSeparator || hasFileExtension || hasPathSeparators || hasChildren;

        // Only use test name for individual tests, not for file items
        const testName = isFileItem ? null : test.label;

        this.outputChannel.appendLine(`[DEBUG] Running: id=${test.id}, label=${test.label}, isFileItem=${isFileItem}, testName=${testName || 'null'}, debugMode=${debugMode}`);

        // Create unique output directory for this test run
        const outputDir = path.join(cwd, '.robot-test-output', Date.now().toString());

        // Ensure output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Debug mode arguments - show all keyword executions and details
        const debugArgs = debugMode ? [
            '--loglevel', 'DEBUG:INFO',           // Show DEBUG level in log, INFO in console
            '--console', 'verbose',                // Verbose console output
            '--timestampoutputs',                  // Add timestamps to output files
            '--debugfile', path.join(outputDir, 'debug.log'),  // Create detailed debug file
        ] : [];

        // Build robot command
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
            ...debugArgs,
            ...additionalArgs,
            // Only add --test filter if running an individual test
            ...(testName ? ['--test', testName] : []),
            filePath
        ];

        const displayName = testName || path.basename(filePath);
        const modeStr = debugMode ? ' [DEBUG]' : '';
        this.outputChannel.appendLine(`\nRunning${modeStr}: ${displayName}`);
        if (testName) {
            this.outputChannel.appendLine(`Command: ${pythonExecutable} -m robot${debugMode ? ' --loglevel DEBUG:INFO --console verbose' : ''} --test "${testName}" "${filePath}"`);
        } else {
            this.outputChannel.appendLine(`Command: ${pythonExecutable} -m robot${debugMode ? ' --loglevel DEBUG:INFO --console verbose' : ''} "${filePath}"`);
        }
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
                // Send colorized output to test run in real-time
                const colorizedText = this.colorizeRobotOutput(text);
                run.appendOutput(colorizedText.replace(/\n/g, '\r\n'));
            });

            this.currentProcess.stderr?.on('data', (data) => {
                const text = data.toString();
                errorOutput += text;
                this.outputChannel.append(text);
                // Send error output in red
                run.appendOutput(`${colors.red}${text.replace(/\n/g, '\r\n')}${colors.reset}`);
            });

            this.currentProcess.on('exit', (code) => {
                const duration = Date.now() - startTime;
                this.currentProcess = undefined;

                // Parse output.xml to get detailed results
                const outputXmlPath = path.join(outputDir, 'output.xml');
                let testResult: TestResult;

                try {
                    // If running entire file (testName is null), use exit code
                    if (testName === null) {
                        testResult = {
                            passed: code === 0,
                            message: code === 0 ? 'All tests passed' : `Tests failed with exit code ${code}`,
                            duration: duration,
                            output: output
                        };
                    } else {
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

    /**
     * Colorize Robot Framework output for better readability
     */
    private colorizeRobotOutput(text: string): string {
        let result = text;
        
        // Colorize PASS results
        result = result.replace(/\| PASS \|/g, `${colors.bgGreen}${colors.bold}| PASS |${colors.reset}`);
        result = result.replace(/(\d+ passed)/gi, `${colors.brightGreen}$1${colors.reset}`);
        
        // Colorize FAIL results
        result = result.replace(/\| FAIL \|/g, `${colors.bgRed}${colors.bold}| FAIL |${colors.reset}`);
        result = result.replace(/(\d+ failed)/gi, `${colors.brightRed}$1${colors.reset}`);
        
        // Colorize WARN messages
        result = result.replace(/\[ WARN \]/g, `${colors.bgYellow}${colors.bold}[ WARN ]${colors.reset}`);
        
        // Colorize DEBUG messages (for debug mode)
        result = result.replace(/\[ DEBUG \]/g, `${colors.magenta}[ DEBUG ]${colors.reset}`);
        result = result.replace(/\[ INFO \]/g, `${colors.blue}[ INFO ]${colors.reset}`);
        result = result.replace(/\[ ERROR \]/g, `${colors.brightRed}[ ERROR ]${colors.reset}`);
        result = result.replace(/\[ TRACE \]/g, `${colors.gray}[ TRACE ]${colors.reset}`);
        
        // Colorize timestamp in verbose mode (format: YYYYMMDD HH:MM:SS.mmm)
        result = result.replace(/^(\d{8}\s+\d{2}:\d{2}:\d{2}\.\d{3})/gm, `${colors.gray}$1${colors.reset}`);
        
        // Colorize keyword execution lines (starts with spaces and contains ::)
        result = result.replace(/^(\s+)(\S+::\S+)/gm, `$1${colors.yellow}$2${colors.reset}`);
        
        // Colorize separator lines
        result = result.replace(/^(=+)$/gm, `${colors.cyan}$1${colors.reset}`);
        result = result.replace(/^(-+)$/gm, `${colors.gray}$1${colors.reset}`);
        
        // Colorize test/suite names in output
        result = result.replace(/^(.*?)\.\.\./gm, `${colors.brightBlue}$1${colors.reset}...`);
        
        // Colorize Output/Log/Report paths
        result = result.replace(/^(Output:)\s+(.*)$/gm, `${colors.gray}$1${colors.reset} ${colors.cyan}$2${colors.reset}`);
        result = result.replace(/^(Log:)\s+(.*)$/gm, `${colors.gray}$1${colors.reset} ${colors.cyan}$2${colors.reset}`);
        result = result.replace(/^(Report:)\s+(.*)$/gm, `${colors.gray}$1${colors.reset} ${colors.cyan}$2${colors.reset}`);
        result = result.replace(/^(Debug:)\s+(.*)$/gm, `${colors.gray}$1${colors.reset} ${colors.magenta}$2${colors.reset}`);
        
        // Colorize common keywords
        result = result.replace(/^(\s+)(Log|Should Be Equal|Should Contain|Should Not|Click|Wait|Open|Close|Input|Select|Get|Set|Sleep|Run Keyword|FOR|IF|ELSE|END|TRY|EXCEPT|FINALLY)/gm, 
            `$1${colors.yellow}$2${colors.reset}`);
        
        // Colorize variable values in debug output (${var} = value)
        result = result.replace(/(\$\{[^}]+\})\s*(=)\s*(.+)$/gm, 
            `${colors.cyan}$1${colors.reset} ${colors.white}$2${colors.reset} ${colors.brightYellow}$3${colors.reset}`);
        
        // Colorize element locators
        result = result.replace(/(xpath=|css=|id=|name=|class=)([^\s]+)/gi, 
            `${colors.magenta}$1${colors.reset}${colors.brightCyan}$2${colors.reset}`);
        
        return result;
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
