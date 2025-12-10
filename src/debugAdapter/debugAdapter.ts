import {
    LoggingDebugSession,
    InitializedEvent, TerminatedEvent, StoppedEvent, OutputEvent,
    Thread, StackFrame, Scope, Source, Handles, Breakpoint
} from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

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

        // Build robot command arguments
        const robotArgs = ['-m', 'robot'];

        if (args.arguments) {
            robotArgs.push(...args.arguments);
        }

        robotArgs.push(target);

        // Spawn robot process
        this._robotProcess = spawn(python, robotArgs, {
            cwd: cwd,
            env: { ...process.env, ...args.env }
        });

        this._robotProcess.stdout?.on('data', (data) => {
            this.sendEvent(new OutputEvent(data.toString(), 'stdout'));
        });

        this._robotProcess.stderr?.on('data', (data) => {
            this.sendEvent(new OutputEvent(data.toString(), 'stderr'));
        });

        this._robotProcess.on('exit', (code) => {
            this.sendEvent(new OutputEvent(`\nRobot Framework exited with code ${code}\n`, 'console'));
            this.sendEvent(new TerminatedEvent());
        });

        this._robotProcess.on('error', (err) => {
            this.sendEvent(new OutputEvent(`Error: ${err.message}\n`, 'stderr'));
            this.sendEvent(new TerminatedEvent());
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
                new Scope("Local", this._variableHandles.create("local"), false),
                new Scope("Global", this._variableHandles.create("global"), true)
            ]
        };
        this.sendResponse(response);
    }

    protected variablesRequest(response: DebugProtocol.VariablesResponse, _args: DebugProtocol.VariablesArguments): void {
        const variables: DebugProtocol.Variable[] = [];

        // Mock variables for demonstration
        variables.push({
            name: '${TEST_VAR}',
            value: 'test value',
            variablesReference: 0
        });

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
        response.body = {
            result: `Evaluation of '${args.expression}' not implemented`,
            variablesReference: 0
        };
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
