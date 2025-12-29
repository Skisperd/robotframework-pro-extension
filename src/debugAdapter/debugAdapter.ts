import {
    LoggingDebugSession,
    InitializedEvent, TerminatedEvent, StoppedEvent, OutputEvent,
    Thread, StackFrame, Scope, Source, Handles, Breakpoint
} from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
    target: string;
    arguments?: string[];
    cwd?: string;
    env?: { [key: string]: string };
    python?: string;
    stopOnEntry?: boolean;
}

export class RobotFrameworkDebugSession extends LoggingDebugSession {
    private static THREAD_ID = 1;

    private _variableHandles = new Handles<string>();
    private _configurationDone = new Promise<void>((resolve) => {
        this._configurationDoneResolve = resolve;
    });
    private _configurationDoneResolve!: () => void;

    private _robotProcess: ChildProcess | undefined;
    private _currentLine = 0;
    private _breakpoints = new Map<string, number[]>();

    // Runtime state for variable display
    private _currentTestName: string = '';
    private _currentSuiteName: string = '';
    private _cwd: string = '';

    // Debug communication files
    private _pauseFile: string = '';
    private _breakpointFile: string = '';
    private _variableFile: string = '';
    private _stepFile: string = '';
    private _pauseWatcher: fs.FSWatcher | undefined;
    private _currentVariables: any = {};

    public constructor() {
        super();

        this.setDebuggerLinesStartAt1(true);
        this.setDebuggerColumnsStartAt1(true);
    }

    protected initializeRequest(response: DebugProtocol.InitializeResponse, _args: DebugProtocol.InitializeRequestArguments): void {
        
        response.body = response.body || {};

        response.body.supportsConfigurationDoneRequest = true;
        response.body.supportsEvaluateForHovers = true;
        response.body.supportsStepBack = false;
        response.body.supportsDataBreakpoints = false;
        response.body.supportsCompletionsRequest = false;
        response.body.supportsCancelRequest = false;
        response.body.supportsBreakpointLocationsRequest = false;
        response.body.supportsStepInTargetsRequest = false;
        response.body.supportsExceptionFilterOptions = false;
        response.body.exceptionBreakpointFilters = [];
        response.body.supportsDelayedStackTraceLoading = false;
        response.body.supportsLoadedSourcesRequest = false;
        response.body.supportsLogPoints = false;
        response.body.supportsTerminateRequest = true;
        response.body.supportsRestartRequest = false;

        this.sendResponse(response);
        this.sendEvent(new InitializedEvent());
    }

    protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments): void {
        super.configurationDoneRequest(response, args);
        this._configurationDoneResolve();
    }

    protected async launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments) {
        await this._configurationDone;

        const python = args.python || 'python';
        const target = args.target;
        const cwd = args.cwd || path.dirname(target);

        // Store state for variable display
        this._cwd = cwd;
        this._currentSuiteName = path.basename(target, path.extname(target));

        // Setup debug communication files
        this._pauseFile = path.join(cwd, '.rf_debug_pause');
        this._breakpointFile = path.join(cwd, '.rf_debug_breakpoints.json');
        this._variableFile = path.join(cwd, '.rf_debug_variables.json');
        this._stepFile = path.join(cwd, '.rf_debug_step');

        // Clean up old debug files
        this._cleanupDebugFiles();

        // Write breakpoints to file for listener
        this._writeBreakpointsFile();

        // Setup file watcher for pause events
        this._setupPauseWatcher();

        // Get the path to the enhanced debug listener v2
        const listenerDir = path.join(__dirname, '..', '..', 'resources');
        const listenerPath = path.join(listenerDir, 'debug_listener_v2.py');
        const listenerExists = fs.existsSync(listenerPath);

        // Build robot command arguments with debug listener v2
        const robotArgs = ['-m', 'robot'];

        // Add the enhanced debug listener with file-based communication
        if (listenerExists) {
            robotArgs.push('--pythonpath', listenerDir);
            robotArgs.push('--listener', 'debug_listener_v2.DebugListener');
        }
        robotArgs.push('--loglevel', 'DEBUG:INFO');

        if (args.arguments) {
            robotArgs.push(...args.arguments);
        }

        robotArgs.push(target);

        // Send initial header to Debug Console
        this.sendEvent(new OutputEvent(`\n${'='.repeat(80)}\n`, 'stdout'));
        this.sendEvent(new OutputEvent(`Robot Framework Enhanced Debug Session\n`, 'stdout'));
        this.sendEvent(new OutputEvent(`${'='.repeat(80)}\n`, 'stdout'));
        this.sendEvent(new OutputEvent(`Python: ${python}\n`, 'stdout'));
        this.sendEvent(new OutputEvent(`Target: ${target}\n`, 'stdout'));
        this.sendEvent(new OutputEvent(`Working Directory: ${cwd}\n`, 'stdout'));
        if (listenerExists) {
            this.sendEvent(new OutputEvent(`Listener: debug_listener_v2.DebugListener (Enhanced)\n`, 'stdout'));
            this.sendEvent(new OutputEvent(`Breakpoints: ${this._getTotalBreakpointsCount()} active\n`, 'stdout'));
        }
        this.sendEvent(new OutputEvent(`Command: ${python} ${robotArgs.join(' ')}\n`, 'stdout'));
        this.sendEvent(new OutputEvent(`${'='.repeat(80)}\n\n`, 'stdout'));

        // Spawn robot process with debug communication environment variables
        const debugEnv = {
            ...process.env,
            ...args.env,
            PYTHONIOENCODING: 'utf-8',
            FORCE_COLOR: '1',
            RF_DEBUG_PAUSE_FILE: this._pauseFile,
            RF_DEBUG_BP_FILE: this._breakpointFile,
            RF_DEBUG_VAR_FILE: this._variableFile
        };

        this._robotProcess = spawn(python, robotArgs, {
            cwd: cwd,
            env: debugEnv,
            shell: false
        });

        // Capture stdout - use 'stdout' category for ANSI color support
        this._robotProcess.stdout?.on('data', (data) => {
            const text = data.toString();
            this.sendEvent(new OutputEvent(text, 'stdout'));
        });

        // Capture stderr
        this._robotProcess.stderr?.on('data', (data) => {
            const text = data.toString();
            this.sendEvent(new OutputEvent(text, 'stderr'));
        });

        // Handle process exit
        this._robotProcess.on('exit', (code) => {
            this.sendEvent(new OutputEvent(`\n${'='.repeat(80)}\n`, 'stdout'));
            this.sendEvent(new OutputEvent(`Robot Framework exited with code ${code}\n`, 'stdout'));
            this.sendEvent(new OutputEvent(`${'='.repeat(80)}\n\n`, 'stdout'));
            
            setTimeout(() => {
                this.sendEvent(new TerminatedEvent());
            }, 100);
        });

        // Handle process errors
        this._robotProcess.on('error', (err) => {
            this.sendEvent(new OutputEvent(`\nERROR: ${err.message}\n`, 'stderr'));
            this.sendEvent(new OutputEvent(`${'='.repeat(80)}\n\n`, 'stderr'));
            
            setTimeout(() => {
                this.sendEvent(new TerminatedEvent());
            }, 100);
        });

        if (args.stopOnEntry) {
            this.sendEvent(new StoppedEvent('entry', RobotFrameworkDebugSession.THREAD_ID));
        }

        this.sendResponse(response);
    }

    protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {
        const sourcePath = args.source.path as string;
        const clientLines = args.lines || [];

        // Store breakpoint line numbers
        this._breakpoints.set(sourcePath, clientLines);

        // Write breakpoints to file for listener to read
        this._writeBreakpointsFile();

        // Return verified breakpoints to VS Code
        const breakpoints = clientLines.map(line => {
            const bp = <DebugProtocol.Breakpoint>new Breakpoint(true, line);
            bp.id = this._variableHandles.create(`${sourcePath}:${line}`);
            bp.verified = true;
            return bp;
        });

        response.body = {
            breakpoints: breakpoints
        };
        this.sendResponse(response);

        this.sendEvent(new OutputEvent(`Breakpoints updated: ${clientLines.length} in ${path.basename(sourcePath)}\n`, 'console'));
    }

    protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
        response.body = {
            threads: [
                new Thread(RobotFrameworkDebugSession.THREAD_ID, "Robot Framework Main Thread")
            ]
        };
        this.sendResponse(response);
    }

    protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, _args: DebugProtocol.StackTraceArguments): void {
        const frames: StackFrame[] = [
            new StackFrame(0, 'Robot Framework', new Source('robot', ''), this._currentLine, 0)
        ];

        response.body = {
            stackFrames: frames,
            totalFrames: frames.length
        };
        this.sendResponse(response);
    }

    protected scopesRequest(response: DebugProtocol.ScopesResponse, _args: DebugProtocol.ScopesArguments): void {
        response.body = {
            scopes: [
                new Scope("Test Variables", this._variableHandles.create("test"), false),
                new Scope("Suite Variables", this._variableHandles.create("suite"), false),
                new Scope("Global Variables", this._variableHandles.create("global"), true),
                new Scope("Built-in Variables", this._variableHandles.create("builtin"), true)
            ]
        };
        this.sendResponse(response);
    }

    protected variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments): void {
        const variables: DebugProtocol.Variable[] = [];
        const scopeRef = this._variableHandles.get(args.variablesReference);

        // Load live variables from JSON file exported by listener
        const liveVars = this._loadVariablesFromFile();

        if (scopeRef === 'test' && liveVars && liveVars.test) {
            // Test-level variables from listener
            for (const [name, value] of Object.entries(liveVars.test)) {
                variables.push({ name, value: String(value), variablesReference: 0 });
            }
        } else if (scopeRef === 'suite' && liveVars && liveVars.suite) {
            // Suite-level variables from listener
            for (const [name, value] of Object.entries(liveVars.suite)) {
                variables.push({ name, value: String(value), variablesReference: 0 });
            }
        } else if (scopeRef === 'local' && liveVars && liveVars.local) {
            // Local variables (user-defined) from listener
            for (const [name, value] of Object.entries(liveVars.local)) {
                variables.push({ name, value: String(value), variablesReference: 0 });
            }
        } else if (scopeRef === 'global' && liveVars && liveVars.global) {
            // Global variables from listener
            for (const [name, value] of Object.entries(liveVars.global)) {
                variables.push({ name, value: String(value), variablesReference: 0 });
            }
        } else if (scopeRef === 'builtin') {
            // Built-in variables (hardcoded fallback)
            variables.push(
                { name: '${CURDIR}', value: this._cwd || '', variablesReference: 0 },
                { name: '${TEMPDIR}', value: process.env.TEMP || '/tmp', variablesReference: 0 },
                { name: '${EXECDIR}', value: this._cwd || '', variablesReference: 0 },
                { name: '${/}', value: require('path').sep, variablesReference: 0 },
                { name: '${:}', value: require('path').delimiter, variablesReference: 0 },
                { name: '${SPACE}', value: ' ', variablesReference: 0 },
                { name: '${EMPTY}', value: '', variablesReference: 0 },
                { name: '${True}', value: 'True', variablesReference: 0 },
                { name: '${False}', value: 'False', variablesReference: 0 },
                { name: '${None}', value: 'None', variablesReference: 0 }
            );
        }

        response.body = {
            variables: variables
        };
        this.sendResponse(response);
    }

    protected continueRequest(response: DebugProtocol.ContinueResponse, _args: DebugProtocol.ContinueArguments): void {
        // Resume execution by deleting pause file
        if (fs.existsSync(this._pauseFile)) {
            try {
                fs.unlinkSync(this._pauseFile);
                this.sendEvent(new OutputEvent(`▶  Continue\n`, 'console'));
            } catch (error) {
                this.sendEvent(new OutputEvent(`ERROR: Failed to resume execution: ${error}\n`, 'stderr'));
            }
        }
        this.sendResponse(response);
    }

    protected nextRequest(response: DebugProtocol.NextResponse, _args: DebugProtocol.NextArguments): void {
        // Step Over - write 'over' to step file
        try {
            fs.writeFileSync(this._stepFile, 'over', { encoding: 'utf-8' });
            if (fs.existsSync(this._pauseFile)) {
                fs.unlinkSync(this._pauseFile);
            }
            this.sendEvent(new OutputEvent(`▶  Step Over\n`, 'console'));
        } catch (error) {
            this.sendEvent(new OutputEvent(`ERROR: Failed to step over: ${error}\n`, 'stderr'));
        }
        this.sendResponse(response);
    }

    protected stepInRequest(response: DebugProtocol.StepInResponse, _args: DebugProtocol.StepInArguments): void {
        // Step Into - write 'into' to step file
        try {
            fs.writeFileSync(this._stepFile, 'into', { encoding: 'utf-8' });
            if (fs.existsSync(this._pauseFile)) {
                fs.unlinkSync(this._pauseFile);
            }
            this.sendEvent(new OutputEvent(`▶  Step Into\n`, 'console'));
        } catch (error) {
            this.sendEvent(new OutputEvent(`ERROR: Failed to step into: ${error}\n`, 'stderr'));
        }
        this.sendResponse(response);
    }

    protected stepOutRequest(response: DebugProtocol.StepOutResponse, _args: DebugProtocol.StepOutArguments): void {
        // Step Out - write 'out' to step file
        try {
            fs.writeFileSync(this._stepFile, 'out', { encoding: 'utf-8' });
            if (fs.existsSync(this._pauseFile)) {
                fs.unlinkSync(this._pauseFile);
            }
            this.sendEvent(new OutputEvent(`▶  Step Out\n`, 'console'));
        } catch (error) {
            this.sendEvent(new OutputEvent(`ERROR: Failed to step out: ${error}\n`, 'stderr'));
        }
        this.sendResponse(response);
    }

    protected evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): void {
        // Handle variable evaluation in hover and watch expressions
        const expression = args.expression.trim();
        
        // Check for built-in variables
        const builtinVars: Record<string, string> = {
            '${CURDIR}': this._cwd || '',
            '${TEMPDIR}': process.env.TEMP || '/tmp',
            '${EXECDIR}': this._cwd || '',
            '${True}': 'True',
            '${False}': 'False',
            '${None}': 'None',
            '${SPACE}': ' ',
            '${EMPTY}': '',
            '${TEST NAME}': this._currentTestName || 'Unknown',
            '${SUITE NAME}': this._currentSuiteName || 'Unknown'
        };

        if (builtinVars.hasOwnProperty(expression)) {
            response.body = {
                result: builtinVars[expression],
                variablesReference: 0
            };
        } else {
            response.body = {
                result: `Variable '${expression}' - runtime value not available in this debug session`,
                variablesReference: 0
            };
        }
        this.sendResponse(response);
    }

    protected terminateRequest(response: DebugProtocol.TerminateResponse, _args: DebugProtocol.TerminateArguments): void {
        if (this._robotProcess) {
            this._robotProcess.kill();
        }
        this.sendResponse(response);
    }

    protected disconnectRequest(response: DebugProtocol.DisconnectResponse, _args: DebugProtocol.DisconnectArguments): void {
        if (this._robotProcess) {
            this._robotProcess.kill();
        }
        // Cleanup debug files and watcher
        this._cleanupDebugFiles();
        if (this._pauseWatcher) {
            this._pauseWatcher.close();
        }
        this.sendResponse(response);
    }

    // Helper methods for file-based debug communication

    private _cleanupDebugFiles(): void {
        /**
         * Clean up debug communication files
         */
        const files = [this._pauseFile, this._breakpointFile, this._variableFile, this._stepFile];
        for (const file of files) {
            if (file && fs.existsSync(file)) {
                try {
                    fs.unlinkSync(file);
                } catch (error) {
                    // Ignore cleanup errors
                }
            }
        }
    }

    private _writeBreakpointsFile(): void {
        /**
         * Write breakpoints to JSON file for listener to read
         */
        if (!this._breakpointFile) return;

        const data: Record<string, number[]> = {};
        for (const [sourcePath, lines] of this._breakpoints) {
            // Normalize path for cross-platform compatibility
            const normalized = path.normalize(sourcePath);
            data[normalized] = lines;
        }

        try {
            fs.writeFileSync(this._breakpointFile, JSON.stringify(data, null, 2), { encoding: 'utf-8' });
        } catch (error) {
            this.sendEvent(new OutputEvent(`ERROR: Failed to write breakpoints file: ${error}\n`, 'stderr'));
        }
    }

    private _setupPauseWatcher(): void {
        /**
         * Setup file watcher to detect when listener pauses execution
         */
        if (!this._pauseFile) return;

        const watchDir = path.dirname(this._pauseFile);

        try {
            this._pauseWatcher = fs.watch(watchDir, (_eventType, filename) => {
                if (!filename || filename !== path.basename(this._pauseFile)) {
                    return;
                }

                // Check if pause file was created (execution paused)
                if (fs.existsSync(this._pauseFile)) {
                    // Read pause reason
                    try {
                        const reason = fs.readFileSync(this._pauseFile, { encoding: 'utf-8' });
                        this.sendEvent(new OutputEvent(`\n⏸  Paused: ${reason}\n`, 'console'));
                    } catch (error) {
                        this.sendEvent(new OutputEvent(`\n⏸  Paused\n`, 'console'));
                    }

                    // Load current variables
                    this._loadVariablesFromFile();

                    // Notify VS Code that execution stopped
                    this.sendEvent(new StoppedEvent('breakpoint', RobotFrameworkDebugSession.THREAD_ID));
                }
            });
        } catch (error) {
            this.sendEvent(new OutputEvent(`WARNING: Failed to setup pause watcher: ${error}\n`, 'console'));
        }
    }

    private _loadVariablesFromFile(): any {
        /**
         * Load current variables from JSON file exported by listener
         */
        if (!this._variableFile || !fs.existsSync(this._variableFile)) {
            return null;
        }

        try {
            const content = fs.readFileSync(this._variableFile, { encoding: 'utf-8' });
            this._currentVariables = JSON.parse(content);
            return this._currentVariables;
        } catch (error) {
            this.sendEvent(new OutputEvent(`WARNING: Failed to load variables: ${error}\n`, 'console'));
            return null;
        }
    }

    private _getTotalBreakpointsCount(): number {
        /**
         * Get total number of breakpoints across all files
         */
        let total = 0;
        for (const lines of this._breakpoints.values()) {
            total += lines.length;
        }
        return total;
    }
}

// Start debug adapter
RobotFrameworkDebugSession.run(RobotFrameworkDebugSession);
