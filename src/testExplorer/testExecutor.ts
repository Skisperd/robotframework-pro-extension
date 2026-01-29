import * as vscode from 'vscode';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import { StackTraceFormatter, StackFrame } from './stackTraceFormatter';

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

    private updateFailureTreeView(testName: string, callStack: StackFrame[]): void {
        // Import getFailureTreeProvider dynamically to avoid circular dependency
        const ext = require('../extension');
        const failureTreeProvider = ext.getFailureTreeProvider();
        if (failureTreeProvider) {
            failureTreeProvider.updateFailures(testName, callStack);
            // Set context to show tree view
            vscode.commands.executeCommand('setContext', 'robotframework:hasFailures', true);
        }
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
                
                // Format error message with better visual separation and highlighting
                if (result.message) {
                    run.appendOutput(`\r\n${colors.brightRed}${colors.bold}📋 ERROR DETAILS:${colors.reset}\r\n`);
                    run.appendOutput(`${colors.brightRed}${colors.bold}${'═'.repeat(60)}${colors.reset}\r\n`);
                    run.appendOutput(`${colors.brightRed}${result.message}${colors.reset}\r\n`);
                    run.appendOutput(`${colors.brightRed}${colors.bold}${'═'.repeat(60)}${colors.reset}\r\n`);
                }
                
                // Show Expected vs Actual in a more organized layout
                if (result.expected || result.actual) {
                    run.appendOutput(`\r\n${colors.yellow}${colors.bold}📊 COMPARISON RESULT:${colors.reset}\r\n`);
                    run.appendOutput(`${colors.yellow}${'╔═══════════════════════════════════════════════════╗'}${colors.reset}\r\n`);
                    
                    run.appendOutput(`${colors.yellow}║${colors.reset} `);
                    run.appendOutput(`${colors.green}${colors.bold}✓ Expected:${colors.reset}\r\n`);
                    run.appendOutput(`${colors.yellow}║${colors.reset}   `);
                    run.appendOutput(`${colors.brightGreen}${result.expected || '(not specified)'}${colors.reset}\r\n`);
                    
                    run.appendOutput(`${colors.yellow}${'╟───────────────────────────────────────────────────╢'}${colors.reset}\r\n`);
                    
                    run.appendOutput(`${colors.yellow}║${colors.reset} `);
                    run.appendOutput(`${colors.red}${colors.bold}✗ Actual:${colors.reset}\r\n`);
                    run.appendOutput(`${colors.yellow}║${colors.reset}   `);
                    run.appendOutput(`${colors.brightRed}${result.actual || '(not specified)'}${colors.reset}\r\n`);
                    
                    run.appendOutput(`${colors.yellow}${'╚═══════════════════════════════════════════════════╝'}${colors.reset}\r\n`);
                }
                run.appendOutput('\r\n');

                // Create diff message with Expected/Actual
                const message = vscode.TestMessage.diff(
                    result.message || 'Test failed',
                    result.expected || '',
                    result.actual || ''
                );
                
                // Set location to the correct line in the file
                if (test.uri) {
                    if (result.line && result.line > 0) {
                        // Use the line from the XML output for more accurate error location
                        const failurePosition = new vscode.Position(result.line - 1, 0);
                        const failureRange = new vscode.Range(failurePosition, failurePosition);
                        message.location = new vscode.Location(test.uri, failureRange);
                    } else if (test.range) {
                        // Fallback to test range
                        message.location = new vscode.Location(test.uri, test.range);
                    }
                }
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

        // Get the listener path from extension resources
        const extensionPath = path.dirname(path.dirname(__dirname));
        const listenerPath = path.join(extensionPath, 'resources', 'test_listener.py');
        const listenerOutputPath = path.join(outputDir, 'listener_output.json');

        // Debug mode arguments - show all keyword executions and details
        const debugArgs = debugMode ? [
            '--loglevel', 'DEBUG:INFO',           // Show DEBUG level in log, INFO in console
            '--console', 'verbose',                // Verbose console output
            '--timestampoutputs',                  // Add timestamps to output files
            '--debugfile', path.join(outputDir, 'debug.log'),  // Create detailed debug file
        ] : [];

        // Add listener if available
        // Note: On Windows, use ';' as separator for listener arguments (not ':' which conflicts with drive letters)
        const listenerSeparator = process.platform === 'win32' ? ';' : ':';
        const listenerArgs = fs.existsSync(listenerPath) ? [
            '--listener', `${listenerPath}${listenerSeparator}${listenerOutputPath}`
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
            ...listenerArgs,
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
            // Set UTF-8 encoding for proper character display
            this.currentProcess = spawn(pythonExecutable, args, {
                cwd: cwd,
                shell: false,
                windowsHide: true,
                env: {
                    ...process.env,
                    PYTHONIOENCODING: 'utf-8',
                    PYTHONLEGACYWINDOWSSTDIO: '0'
                }
            });

            // Set encoding for stdout/stderr streams
            this.currentProcess.stdout?.setEncoding('utf8');
            this.currentProcess.stderr?.setEncoding('utf8');

            // Handle cancellation
            token.onCancellationRequested(() => {
                if (this.currentProcess) {
                    this.currentProcess.kill();
                    this.outputChannel.appendLine('Test execution cancelled\n');
                }
            });

            this.currentProcess.stdout?.on('data', (data: string) => {
                output += data;
                this.outputChannel.append(data);
                // Send colorized output to test run in real-time
                const colorizedText = this.colorizeRobotOutput(data);
                run.appendOutput(colorizedText.replace(/\n/g, '\r\n'));
            });

            this.currentProcess.stderr?.on('data', (data: string) => {
                errorOutput += data;
                this.outputChannel.append(data);
                // Send error output in red
                run.appendOutput(`${colors.red}${data.replace(/\n/g, '\r\n')}${colors.reset}`);
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
                        // Try listener output first - it has the most accurate line numbers
                        this.outputChannel.appendLine(`[DEBUG] Attempting to parse listener output: ${listenerOutputPath}`);
                        const listenerResult = this.parseListenerOutput(listenerOutputPath, testName);

                        if (listenerResult) {
                            this.outputChannel.appendLine(`[DEBUG] Listener result found: line=${listenerResult.line}, passed=${listenerResult.passed}`);
                            // Listener output has accurate line info
                            testResult = {
                                ...listenerResult,
                                duration: duration,
                                output: output
                            };
                        } else {
                            this.outputChannel.appendLine(`[DEBUG] Listener result not found, falling back to XML parsing`);
                            // Fallback to XML parsing
                            testResult = this.parseOutputXml(outputXmlPath, testName);
                            testResult.duration = duration;
                            testResult.output = output;

                            // If XML parsing failed, try text output as fallback
                            if (testResult.message === 'Test result not found in output' || testResult.message === 'Output XML not found') {
                                const textResult = this.parseTextOutput(output, testName);
                                if (textResult) {
                                    testResult = {
                                        ...textResult,
                                        duration: duration,
                                        output: output
                                    };
                                } else {
                                    // Ultimate fallback: use exit code
                                    testResult = {
                                        passed: code === 0,
                                        message: code === 0 ? 'Test passed' : `Test failed with exit code ${code}`,
                                        duration: duration,
                                        output: output
                                    };
                                }
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

    /**
     * Parse the listener output JSON file for test results with accurate line numbers
     */
    private parseListenerOutput(listenerOutputPath: string, testName: string): TestResult | null {
        try {
            if (!fs.existsSync(listenerOutputPath)) {
                this.outputChannel.appendLine(`[DEBUG] Listener output not found: ${listenerOutputPath}`);
                return null;
            }

            const content = fs.readFileSync(listenerOutputPath, 'utf-8');
            const data = JSON.parse(content);

            if (!data.test_results || !data.test_results[testName]) {
                this.outputChannel.appendLine(`[DEBUG] Test '${testName}' not found in listener output`);
                return null;
            }

            const testResult = data.test_results[testName];
            const passed = testResult.status === 'PASS';

            let message = testResult.message || (passed ? 'Test passed' : 'Test failed');
            let expected: string | undefined;
            let actual: string | undefined;
            let failureLine = testResult.lineno || 0;
            let failedKeyword: string | undefined;

            // NEW: Check for version 2 format with call stacks
            if (!passed && data.version === 2 && testResult.stack_trace_key && data.call_stacks) {
                const callStack: StackFrame[] = data.call_stacks[testResult.stack_trace_key];

                if (callStack && callStack.length > 0) {
                    this.outputChannel.appendLine(`[DEBUG] Using enhanced stack trace with ${callStack.length} frames`);

                    // Get the actual failure point (deepest)
                    const failurePoint = StackTraceFormatter.getFailurePoint(callStack);

                    if (failurePoint) {
                        failureLine = failurePoint.lineno;
                        failedKeyword = failurePoint.kwname || failurePoint.name;
                        const failureMessage = failurePoint.message || message;

                        this.outputChannel.appendLine(`[DEBUG] Failure point: ${failedKeyword} at line ${failureLine}`);

                        // Parse expected/actual from failure point
                        const { expected: exp, actual: act } = this.parseExpectedActual(
                            failureMessage,
                            failurePoint.args || [],
                            failedKeyword || ''
                        );
                        expected = exp;
                        actual = act;

                        // Format clean stack trace (no duplicate call path)
                        const stackTrace = StackTraceFormatter.formatStackTrace(callStack);

                        // Build detailed message with stack trace only
                        message = stackTrace;

                        this.outputChannel.appendLine(`[DEBUG] Stack trace:\n${stackTrace}`);
                        this.outputChannel.appendLine(`[DEBUG] Expected: ${expected}, Actual: ${actual}`);

                        // Update tree view with call stack
                        this.updateFailureTreeView(testName, callStack);
                    }
                }
            }
            // FALLBACK: Use old format with failed_keywords array
            else if (!passed && testResult.failed_keywords && testResult.failed_keywords.length > 0) {
                // Use LAST failed keyword (deepest) instead of first
                const deepestFailedKw = testResult.failed_keywords[testResult.failed_keywords.length - 1];
                failedKeyword = deepestFailedKw.kwname || deepestFailedKw.name;
                // IMPORTANT: Use the failed keyword's line number, not the test's line number
                failureLine = deepestFailedKw.lineno || testResult.lineno || 0;
                const failureMessage = deepestFailedKw.message || message;

                this.outputChannel.appendLine(`[DEBUG] Failed keyword (legacy): ${failedKeyword} at line ${failureLine}`);
                this.outputChannel.appendLine(`[DEBUG] Message: ${failureMessage}`);
                this.outputChannel.appendLine(`[DEBUG] Args: ${JSON.stringify(deepestFailedKw.args)}`);

                // Try to parse expected/actual from the message
                const { expected: exp, actual: act } = this.parseExpectedActual(
                    failureMessage,
                    deepestFailedKw.args || [],
                    failedKeyword || ''
                );
                expected = exp;
                actual = act;

                this.outputChannel.appendLine(`[DEBUG] Parsed - Expected: ${expected}, Actual: ${actual}`);

                // Build detailed message with line info
                if (failureLine > 0) {
                    message = `[Line ${failureLine}] ${failedKeyword ? `${failedKeyword}: ` : ''}${failureMessage}`;
                }
            }

            return {
                passed: passed,
                message: message,
                expected: expected,
                actual: actual,
                output: '',
                line: failureLine
            };
        } catch (error) {
            this.outputChannel.appendLine(`[DEBUG] Error parsing listener output: ${error}`);
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

            // Match test element - attributes can be in any order
            const escapedTestName = testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            
            // First, find the test element with the name
            const testRegex = new RegExp(
                `<test[^>]*name="${escapedTestName}"[^>]*>([\\s\\S]*?)</test>`,
                'i'
            );
            
            const testMatch = xmlContent.match(testRegex);
            
            if (!testMatch) {
                return {
                    passed: false,
                    message: 'Test result not found in output',
                    output: ''
                };
            }

            const fullTestElement = testMatch[0];
            const testContent = testMatch[1];
            
            // Extract line number from the test element's opening tag
            const lineMatch = fullTestElement.match(/<test[^>]*\sline="(\d+)"/i);
            const testLine = lineMatch ? parseInt(lineMatch[1]) : 0;
                
            // Check test status
            const statusMatch = testContent.match(/<status[^>]*status="(PASS|FAIL)"[^>]*>/);
            const status = statusMatch ? statusMatch[1] : 'FAIL';
            const passed = status === 'PASS';

            let message = passed ? 'Test passed' : 'Test failed';
            let expected: string | undefined;
            let actual: string | undefined;
            let failureLine = testLine;
            let failedKeyword: string | undefined;

            if (!passed) {
                // Find the failed keyword and extract details
                const failedKwResult = this.extractFailedKeywordInfo(testContent);
                
                if (failedKwResult) {
                    message = failedKwResult.message;
                    expected = failedKwResult.expected;
                    actual = failedKwResult.actual;
                    failedKeyword = failedKwResult.keywordName;
                    
                    // Try to find the exact line of the failed keyword in the source file
                    const sourceFilePath = this.extractSourcePath(xmlContent);
                    if (sourceFilePath && failedKeyword) {
                        const keywordLine = this.findKeywordLineInFile(sourceFilePath, failedKeyword, testLine);
                        if (keywordLine > 0) {
                            failureLine = keywordLine;
                        }
                    }
                    
                    // Build a detailed message with line info
                    if (failureLine > 0) {
                        message = `[Line ${failureLine}] ${failedKeyword ? `${failedKeyword}: ` : ''}${failedKwResult.message}`;
                    }
                }
            }

            return {
                passed: passed,
                message: message,
                expected: expected,
                actual: actual,
                output: '',
                line: failureLine
            };
        } catch (error) {
            return {
                passed: false,
                message: `Error parsing output: ${error instanceof Error ? error.message : String(error)}`,
                output: ''
            };
        }
    }

    /**
     * Extract information from a failed keyword in the test content
     */
    private extractFailedKeywordInfo(testContent: string): { 
        message: string; 
        expected?: string; 
        actual?: string; 
        keywordName?: string; 
    } | null {
        try {
            // Find keyword with FAIL status
            const kwRegex = /<kw\s+name="([^"]+)"[^>]*>[\s\S]*?<status\s+status="FAIL"[^>]*>([^<]*)<\/status>[\s\S]*?<\/kw>/gi;
            let kwMatch;
            
            while ((kwMatch = kwRegex.exec(testContent)) !== null) {
                const keywordName = this.decodeXmlEntities(kwMatch[1]);
                const statusMessage = this.decodeXmlEntities(kwMatch[2].trim());
                const kwContent = kwMatch[0];
                
                // Extract FAIL message
                const msgMatch = kwContent.match(/<msg[^>]*level="FAIL"[^>]*>([^<]*)<\/msg>/i);
                const failMessage = msgMatch ? this.decodeXmlEntities(msgMatch[1].trim()) : statusMessage;
                
                // Extract arguments to determine expected and actual
                const args: string[] = [];
                const argRegex = /<arg>([^<]*)<\/arg>/gi;
                let argMatch;
                while ((argMatch = argRegex.exec(kwContent)) !== null) {
                    args.push(this.decodeXmlEntities(argMatch[1]));
                }
                
                // Parse expected and actual from the failure message and arguments
                const { expected, actual } = this.parseExpectedActual(failMessage, args, keywordName);
                
                return {
                    message: failMessage,
                    expected: expected,
                    actual: actual,
                    keywordName: keywordName
                };
            }
            
            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Parse Expected and Actual values from failure message and keyword arguments
     */
    private parseExpectedActual(
        message: string,
        args: string[],
        keywordName: string
    ): { expected?: string; actual?: string } {
        let expected: string | undefined;
        let actual: string | undefined;

        // Log raw input for debugging
        this.outputChannel.appendLine(`[DEBUG parseExpectedActual] Raw message: ${message}`);
        this.outputChannel.appendLine(`[DEBUG parseExpectedActual] Keyword: ${keywordName}`);
        this.outputChannel.appendLine(`[DEBUG parseExpectedActual] Args count: ${args.length}`);
        if (args.length > 0) {
            this.outputChannel.appendLine(`[DEBUG parseExpectedActual] Args: ${JSON.stringify(args)}`);
        }

        // Clean message first - remove stacktraces and excessive whitespace
        const cleanMessage = this._cleanMessage(message);
        this.outputChannel.appendLine(`[DEBUG parseExpectedActual] Clean message: ${cleanMessage}`);

        // Common patterns in Robot Framework failure messages:
        // "45.0 != 42.0" - numeric comparison
        // "'actual' != 'expected'" - string comparison
        // "X should be Y" - various assertions

        // Selenium/WebDriver exceptions - extract main message only
        if (cleanMessage.includes('Exception:') || cleanMessage.includes('Error:')) {
            // Extract exception type and first meaningful message
            const exceptionMatch = cleanMessage.match(/([\w]+Exception|[\w]+Error):\s*Message:\s*(.+?)(?:\(Session|Stacktrace|$)/s);
            if (exceptionMatch) {
                const exceptionType = exceptionMatch[1];
                const exceptionMsg = exceptionMatch[2].trim().substring(0, 200);
                actual = exceptionType;
                expected = `No exception`;
                // Add shortened message to actual
                if (exceptionMsg) {
                    actual = `${exceptionType}: ${exceptionMsg}`;
                }
                this.outputChannel.appendLine(`[DEBUG parseExpectedActual] Exception pattern matched: expected="${expected}", actual="${actual}"`);
                return { expected, actual };
            }
        }

        // Pattern 1: "X != Y" format (most common for comparison failures)
        // But avoid matching if it's part of a long error message with stacktrace
        const neqMatch = cleanMessage.match(/^([^\n]+?)\s*!=\s*([^\n]+?)$/);
        if (neqMatch) {
            actual = neqMatch[1].trim();
            expected = neqMatch[2].trim();
            this.outputChannel.appendLine(`[DEBUG parseExpectedActual] Pattern 1 (!=) matched: actual="${actual}", expected="${expected}"`);
            return { expected, actual };
        }
        
        // Pattern 2: "'X' should be equal to 'Y'" format
        const shouldBeEqualMatch = message.match(/['"](.*?)['"].*should be equal.*['"](.*?)['"]/i);
        if (shouldBeEqualMatch) {
            actual = shouldBeEqualMatch[1];
            expected = shouldBeEqualMatch[2];
            return { expected, actual };
        }
        
        // Pattern 3: "X does not contain Y" format
        const containsMatch = message.match(/['"](.*?)['"].*does not contain.*['"](.*?)['"]/i);
        if (containsMatch) {
            actual = containsMatch[1];
            expected = `Contains: ${containsMatch[2]}`;
            return { expected, actual };
        }
        
        // Pattern 4: Use keyword arguments for Should Be Equal variants
        if (keywordName.toLowerCase().includes('should be equal') && args.length >= 2) {
            // First arg is typically actual, second is expected
            actual = args[0];
            expected = args[1];
            return { expected, actual };
        }
        
        // Pattern 5: Use keyword arguments for Should Contain
        if (keywordName.toLowerCase().includes('should contain') && args.length >= 2) {
            actual = args[0];
            expected = `Should contain: ${args[1]}`;
            return { expected, actual };
        }

        // Pattern 6: "is not true" / "is not false" for Should Be True/False
        if (keywordName.toLowerCase().includes('should be true')) {
            actual = 'False';
            expected = 'True';
            if (args.length > 0) {
                actual = `${args[0]} evaluated to False`;
                expected = `${args[0]} to be True`;
            }
            return { expected, actual };
        }

        if (keywordName.toLowerCase().includes('should be false')) {
            actual = 'True';
            expected = 'False';
            if (args.length > 0) {
                actual = `${args[0]} evaluated to True`;
                expected = `${args[0]} to be False`;
            }
            return { expected, actual };
        }
        
        // Pattern 7: Look for comparison operators in the message (45.0 != 42.0)
        const comparisonMatch = message.match(/([^\s,]+?)\s*(?:!=|==|<|>|<=|>=)\s*([^\s,]+?)(?:\s|,|$)/);
        if (comparisonMatch) {
            actual = comparisonMatch[1].trim();
            expected = comparisonMatch[2].trim();
            this.outputChannel.appendLine(`[DEBUG parseExpectedActual] Comparison operator matched: actual="${actual}", expected="${expected}"`);
            return { expected, actual };
        }
        
        // Generic fallback: use message parts
        const genericParts = message.split(/\s+(?:!=|is not|should be|expected|but was)\s+/i);
        if (genericParts.length >= 2) {
            actual = genericParts[0].trim().replace(/^['"]|['"]$/g, '');
            expected = genericParts.slice(1).join(' ').trim().replace(/^['"]|['"]$/g, '');
            this.outputChannel.appendLine(`[DEBUG parseExpectedActual] Generic fallback matched: actual="${actual}", expected="${expected}"`);
        }
        
        // Pattern 8: Try to extract from arguments if everything else fails
        if (!expected && !actual && args.length >= 2) {
            actual = args[0];
            expected = args[1];
            this.outputChannel.appendLine(`[DEBUG parseExpectedActual] Using arguments as fallback: actual="${actual}", expected="${expected}"`);
        }
        
        this.outputChannel.appendLine(`[DEBUG parseExpectedActual] Final result: expected="${expected}", actual="${actual}"`);
        return { expected, actual };
    }

    /**
     * Clean message by removing Selenium/WebDriver stacktraces and excessive formatting
     */
    private _cleanMessage(message: string): string {
        // Split into lines
        const lines = message.split('\n');
        const cleanLines: string[] = [];

        for (const line of lines) {
            const trimmed = line.trim();

            // Stop at stacktrace markers
            if (trimmed.startsWith('Stacktrace:') ||
                trimmed.startsWith('0x') ||
                line.match(/^\s+0x[0-9a-fA-F]+/) ||
                trimmed.startsWith('(Session info:') ||
                trimmed.startsWith('Build info:')) {
                break;
            }

            // Skip empty lines and excessive whitespace
            if (trimmed && trimmed.length > 0) {
                cleanLines.push(trimmed);
            }
        }

        // Join with space and limit length
        let cleaned = cleanLines.join(' ');

        // Limit to reasonable length
        if (cleaned.length > 500) {
            cleaned = cleaned.substring(0, 497) + '...';
        }

        return cleaned;
    }

    /**
     * Extract the source file path from the XML content
     */
    private extractSourcePath(xmlContent: string): string | null {
        try {
            // Look for source attribute in suite element
            const sourceMatch = xmlContent.match(/<suite[^>]*source="([^"]+)"[^>]*>/i);
            if (sourceMatch) {
                return sourceMatch[1];
            }
            return null;
        } catch {
            return null;
        }
    }

    /**
     * Find the line number of a keyword in the source file
     * Searches within the test case starting at testStartLine
     */
    private findKeywordLineInFile(filePath: string, keywordName: string, testStartLine: number): number {
        try {
            if (!fs.existsSync(filePath)) {
                return 0;
            }

            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');
            
            // Normalize keyword name for matching (Robot Framework is case-insensitive and allows flexible spacing)
            const normalizedKeyword = keywordName.toLowerCase().replace(/\s+/g, ' ').trim();
            
            // Search from the test start line onwards
            for (let i = testStartLine - 1; i < lines.length; i++) {
                const line = lines[i];
                const trimmedLine = line.trim().toLowerCase();
                
                // Skip empty lines and comments
                if (!trimmedLine || trimmedLine.startsWith('#')) {
                    continue;
                }
                
                // Check if we've reached the next test case or section (stop searching)
                if (i > testStartLine && (
                    trimmedLine.startsWith('***') || 
                    (trimmedLine.match(/^[a-z]/) && !trimmedLine.startsWith(' ') && !trimmedLine.startsWith('\t'))
                )) {
                    break;
                }
                
                // Normalize the line for comparison
                // Robot Framework keywords can be called with varying whitespace
                const normalizedLine = trimmedLine.replace(/\s+/g, ' ');
                
                // Check if the line contains the keyword
                // Keywords can be at the start of the line (after spaces) or after assignment
                if (normalizedLine.includes(normalizedKeyword)) {
                    return i + 1; // Return 1-based line number
                }
                
                // Also try matching without spaces (e.g., "ShouldBeEqual" matches "Should Be Equal")
                const keywordNoSpaces = normalizedKeyword.replace(/\s+/g, '');
                const lineNoSpaces = normalizedLine.replace(/\s+/g, '');
                if (lineNoSpaces.includes(keywordNoSpaces)) {
                    return i + 1;
                }
            }
            
            return 0;
        } catch {
            return 0;
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
    line?: number;
}
