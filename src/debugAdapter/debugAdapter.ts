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
    private _breakpoints = new Map<string, DebugProtocol.Breakpoint[]>();
    
    // Runtime state for variable display
    private _currentTestName: string = '';
    private _currentSuiteName: string = '';
    private _currentSourceFile: string = '';
    private _outputDir: string = '';
    private _cwd: string = '';

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
        this._currentSourceFile = target;
        this._currentSuiteName = path.basename(target, path.extname(target));
        this._outputDir = cwd;

        // Get the path to the debug listener
        // The listener is bundled with the extension
        const listenerDir = path.join(__dirname, '..', '..', 'resources');
        const listenerPath = path.join(listenerDir, 'debug_listener.py');
        const listenerExists = fs.existsSync(listenerPath);

        // Build robot command arguments with verbose output for debugging
        const robotArgs = ['-m', 'robot'];
        
        // Add the debug listener for real-time keyword execution display
        // The listener needs to be specified as module.ClassName format
        if (listenerExists) {
            robotArgs.push('--pythonpath', listenerDir);
            robotArgs.push('--listener', 'debug_listener.DebugListener');
        }
        robotArgs.push('--loglevel', 'DEBUG:INFO'); // DEBUG level in log, INFO in console

        if (args.arguments) {
            robotArgs.push(...args.arguments);
        }

        robotArgs.push(target);

        // Send initial header to Debug Console (use stdout for color support)
        this.sendEvent(new OutputEvent(`\n${'='.repeat(80)}\n`, 'stdout'));
        this.sendEvent(new OutputEvent(`Robot Framework Debug Session\n`, 'stdout'));
        this.sendEvent(new OutputEvent(`${'='.repeat(80)}\n`, 'stdout'));
        this.sendEvent(new OutputEvent(`Python: ${python}\n`, 'stdout'));
        this.sendEvent(new OutputEvent(`Target: ${target}\n`, 'stdout'));
        this.sendEvent(new OutputEvent(`Working Directory: ${cwd}\n`, 'stdout'));
        if (listenerExists) {
            this.sendEvent(new OutputEvent(`Listener: debug_listener.DebugListener\n`, 'stdout'));
        }
        this.sendEvent(new OutputEvent(`Command: ${python} ${robotArgs.join(' ')}\n`, 'stdout'));
        this.sendEvent(new OutputEvent(`${'='.repeat(80)}\n\n`, 'stdout'));

        // Spawn robot process
        this._robotProcess = spawn(python, robotArgs, {
            cwd: cwd,
            env: { ...process.env, ...args.env, PYTHONIOENCODING: 'utf-8', FORCE_COLOR: '1' },
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
        const path = args.source.path as string;
        const clientLines = args.lines || [];

        const breakpoints = clientLines.map(line => {
            const bp = <DebugProtocol.Breakpoint>new Breakpoint(true, line);
            bp.id = this._variableHandles.create(path);
            return bp;
        });

        this._breakpoints.set(path, breakpoints);

        response.body = {
            breakpoints: breakpoints
        };
        this.sendResponse(response);
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

        if (scopeRef === 'test') {
            // Test-level variables
            variables.push(
                { name: '${TEST NAME}', value: this._currentTestName || 'Unknown', variablesReference: 0 },
                { name: '${TEST DOCUMENTATION}', value: '', variablesReference: 0 },
                { name: '${TEST TAGS}', value: '[]', variablesReference: 0 },
                { name: '${TEST STATUS}', value: 'RUNNING', variablesReference: 0 }
            );
        } else if (scopeRef === 'suite') {
            // Suite-level variables
            variables.push(
                { name: '${SUITE NAME}', value: this._currentSuiteName || 'Unknown', variablesReference: 0 },
                { name: '${SUITE SOURCE}', value: this._currentSourceFile || '', variablesReference: 0 },
                { name: '${SUITE DOCUMENTATION}', value: '', variablesReference: 0 },
                { name: '${SUITE STATUS}', value: 'RUNNING', variablesReference: 0 }
            );
        } else if (scopeRef === 'global') {
            // Global variables  
            variables.push(
                { name: '${OUTPUT DIR}', value: this._outputDir || '', variablesReference: 0 },
                { name: '${OUTPUT FILE}', value: 'output.xml', variablesReference: 0 },
                { name: '${LOG FILE}', value: 'log.html', variablesReference: 0 },
                { name: '${REPORT FILE}', value: 'report.html', variablesReference: 0 },
                { name: '${LOG LEVEL}', value: 'INFO', variablesReference: 0 }
            );
        } else if (scopeRef === 'builtin') {
            // Built-in variables
            variables.push(
                { name: '${CURDIR}', value: this._cwd || '', variablesReference: 0 },
                { name: '${TEMPDIR}', value: process.env.TEMP || '/tmp', variablesReference: 0 },
                { name: '${EXECDIR}', value: this._cwd || '', variablesReference: 0 },
                { name: '${/}', value: require('path').sep, variablesReference: 0 },
                { name: '${:}', value: require('path').delimiter, variablesReference: 0 },
                { name: '${\\n}', value: '\\n', variablesReference: 0 },
                { name: '${SPACE}', value: ' ', variablesReference: 0 },
                { name: '${EMPTY}', value: '', variablesReference: 0 },
                { name: '${True}', value: 'True', variablesReference: 0 },
                { name: '${False}', value: 'False', variablesReference: 0 },
                { name: '${None}', value: 'None', variablesReference: 0 },
                { name: '${null}', value: 'None', variablesReference: 0 }
            );
        }

        response.body = {
            variables: variables
        };
        this.sendResponse(response);
    }

    protected continueRequest(response: DebugProtocol.ContinueResponse, _args: DebugProtocol.ContinueArguments): void {
        this.sendResponse(response);
    }

    protected nextRequest(response: DebugProtocol.NextResponse, _args: DebugProtocol.NextArguments): void {
        this.sendResponse(response);
    }

    protected stepInRequest(response: DebugProtocol.StepInResponse, _args: DebugProtocol.StepInArguments): void {
        this.sendResponse(response);
    }

    protected stepOutRequest(response: DebugProtocol.StepOutResponse, _args: DebugProtocol.StepOutArguments): void {
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
        this.sendResponse(response);
    }
}

// Start debug adapter
RobotFrameworkDebugSession.run(RobotFrameworkDebugSession);
