import * as vscode from 'vscode';
import * as path from 'path';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';
import { TestRunner } from './testRunner/testRunner';
import { DebugConfigurationProvider } from './debugAdapter/debugConfigProvider';
import { RobotFrameworkTestController } from './testExplorer/testController';
import { KeywordIndexer } from './languageServer/keywordIndexer';
import { RobotDefinitionProvider } from './languageServer/definitionProvider';
import { RobotReferencesProvider } from './languageServer/referencesProvider';
import { RobotHoverProvider } from './languageServer/hoverProvider';
import { RobotSignatureHelpProvider } from './languageServer/signatureHelpProvider';
import { RobotCompletionProvider } from './languageServer/completionProvider';
import { RobotRenameProvider } from './languageServer/renameProvider';
import { RobocopIntegration } from './languageServer/robocopIntegration';
import { ReportViewerProvider } from './reportViewer/reportViewer';
import { ImportCodeActionProvider, RemoveUnusedImportsCodeAction } from './languageServer/importManager';
import { MultiRootWorkspaceManager } from './workspace/workspaceManager';

let client: LanguageClient;
let testRunner: TestRunner;
// @ts-ignore - testController is used for its side effects (registering test explorer)
let testController: RobotFrameworkTestController;
let outputChannel: vscode.OutputChannel;
let keywordIndexer: KeywordIndexer;
// @ts-ignore - robocopIntegration will be used for future diagnostics integration
let robocopIntegration: RobocopIntegration;
// @ts-ignore - reportViewer is used for report viewing commands
let reportViewer: ReportViewerProvider;
let workspaceManager: MultiRootWorkspaceManager;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    console.log('Robot Framework Pro extension is now active!');
    vscode.window.showInformationMessage('Robot Framework Pro: Extension activated!');

    // Create output channel
    outputChannel = vscode.window.createOutputChannel('Robot Framework');
    context.subscriptions.push(outputChannel);
    outputChannel.appendLine('Extension activation started...');

    try {
        // Initialize multi-root workspace manager
        workspaceManager = new MultiRootWorkspaceManager(context);
        await workspaceManager.initialize();
        outputChannel.appendLine('Workspace manager initialized');

        // Initialize keyword indexer (for backward compatibility with single workspace)
        keywordIndexer = new KeywordIndexer();
        robocopIntegration = new RobocopIntegration();
        reportViewer = new ReportViewerProvider(context);

        // Index workspace
        await indexWorkspace();
        outputChannel.appendLine('Workspace indexed');

        // Register language feature providers
        registerLanguageFeatureProviders(context);
        outputChannel.appendLine('Language providers registered');

        // Initialize test runner
        testRunner = new TestRunner(outputChannel);
        outputChannel.appendLine('Test runner initialized');

        // Initialize test controller (Test Explorer)
        testController = new RobotFrameworkTestController(context);
        outputChannel.appendLine('Test controller initialized - Test Explorer should now be visible');

        // Start language server
        await startLanguageServer(context);

        // Register commands
        registerCommands(context);

        // Register debug configuration provider
        registerDebugger(context);

        // Register formatters
        registerFormatters(context);

        // Watch for file changes to update index
        watchFileChanges(context);

        // Initialize Robocop integration for linting
        await robocopIntegration.initialize();
        context.subscriptions.push(robocopIntegration);

        // Show welcome message on first install
        showWelcomeMessage(context);
        
        outputChannel.appendLine('Extension fully activated!');
        outputChannel.show();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Failed to activate extension:', errorMessage);
        vscode.window.showErrorMessage(`Robot Framework Pro: Activation failed - ${errorMessage}`);
    }
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}

async function startLanguageServer(context: vscode.ExtensionContext): Promise<void> {
    const config = vscode.workspace.getConfiguration('robotframework');

    if (!config.get<boolean>('language.server.enabled', true)) {
        return;
    }

    // The server is implemented in node
    const serverModule = context.asAbsolutePath(
        path.join('out', 'languageServer', 'server.js')
    );

    // The debug options for the server
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: debugOptions
        }
    };

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
        // Register the server for robot framework documents
        documentSelector: [
            { scheme: 'file', language: 'robotframework' }
        ],
        synchronize: {
            // Notify the server about file changes to '.robot' files contained in the workspace
            fileEvents: vscode.workspace.createFileSystemWatcher('**/*.{robot,resource}')
        },
        outputChannel: outputChannel
    };

    // Create the language client and start the client
    client = new LanguageClient(
        'robotframeworkLanguageServer',
        'Robot Framework Language Server',
        serverOptions,
        clientOptions
    );

    // Start the client. This will also launch the server
    await client.start();
}

function registerCommands(context: vscode.ExtensionContext): void {
    // Run commands
    context.subscriptions.push(
        vscode.commands.registerCommand('robotframework.run', async () => {
            await testRunner.runTest();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('robotframework.runFile', async (uri?: vscode.Uri) => {
            await testRunner.runFile(uri);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('robotframework.runSuite', async (uri?: vscode.Uri) => {
            await testRunner.runSuite(uri);
        })
    );

    // Debug commands
    context.subscriptions.push(
        vscode.commands.registerCommand('robotframework.debug', async () => {
            await vscode.commands.executeCommand('workbench.action.debug.start');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('robotframework.debugFile', async (uri?: vscode.Uri) => {
            const fileUri = uri || vscode.window.activeTextEditor?.document.uri;
            if (fileUri) {
                await vscode.debug.startDebugging(undefined, {
                    type: 'robotframework',
                    name: 'Debug Robot Framework Test',
                    request: 'launch',
                    target: fileUri.fsPath,
                    cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
                });
            }
        })
    );

    // Format command
    context.subscriptions.push(
        vscode.commands.registerCommand('robotframework.format', async () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'robotframework') {
                await vscode.commands.executeCommand('editor.action.formatDocument');
            }
        })
    );

    // Show output command
    context.subscriptions.push(
        vscode.commands.registerCommand('robotframework.showOutput', () => {
            outputChannel.show();
        })
    );

    // Clear cache command
    context.subscriptions.push(
        vscode.commands.registerCommand('robotframework.clearCache', async () => {
            if (client) {
                await client.sendRequest('workspace/executeCommand', {
                    command: 'clearCache'
                });
                vscode.window.showInformationMessage('Robot Framework cache cleared');
            }
        })
    );

    // Restart language server command
    context.subscriptions.push(
        vscode.commands.registerCommand('robotframework.restartLanguageServer', async () => {
            if (client) {
                await client.stop();
                await client.start();
                vscode.window.showInformationMessage('Robot Framework Language Server restarted');
            }
        })
    );

    // Show Report command
    context.subscriptions.push(
        vscode.commands.registerCommand('robotframework.showReport', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder open');
                return;
            }

            const found = await ReportViewerProvider.findAndShowRecentReport(workspaceFolder, 'report');
            if (!found) {
                vscode.window.showInformationMessage('No report.html found. Run tests first!');
            }
        })
    );

    // Show Log command
    context.subscriptions.push(
        vscode.commands.registerCommand('robotframework.showLog', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder open');
                return;
            }

            const found = await ReportViewerProvider.findAndShowRecentReport(workspaceFolder, 'log');
            if (!found) {
                vscode.window.showInformationMessage('No log.html found. Run tests first!');
            }
        })
    );

    // Organize Imports command
    context.subscriptions.push(
        vscode.commands.registerCommand('robotframework.organizeImports', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'robotframework') {
                vscode.window.showErrorMessage('No Robot Framework file is active');
                return;
            }

            await vscode.commands.executeCommand('editor.action.sourceAction', {
                kind: vscode.CodeActionKind.SourceOrganizeImports.value,
                apply: 'first'
            });
        })
    );

    // Reindex Workspace command
    context.subscriptions.push(
        vscode.commands.registerCommand('robotframework.reindexWorkspace', async () => {
            await workspaceManager.reindexAll();
            vscode.window.showInformationMessage('Robot Framework workspace re-indexed');
        })
    );
}

function registerDebugger(context: vscode.ExtensionContext): void {
    const provider = new DebugConfigurationProvider();
    context.subscriptions.push(
        vscode.debug.registerDebugConfigurationProvider('robotframework', provider)
    );
}

function registerFormatters(context: vscode.ExtensionContext): void {
    const config = vscode.workspace.getConfiguration('robotframework');

    if (config.get<boolean>('formatting.enabled', true)) {
        context.subscriptions.push(
            vscode.languages.registerDocumentFormattingEditProvider('robotframework', {
                async provideDocumentFormattingEdits(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
                    if (client) {
                        const result = await client.sendRequest<vscode.TextEdit[]>('textDocument/formatting', {
                            textDocument: { uri: document.uri.toString() },
                            options: {
                                tabSize: config.get<number>('formatting.spaceCount', 4),
                                insertSpaces: true
                            }
                        });
                        return result || [];
                    }
                    return [];
                }
            })
        );

        context.subscriptions.push(
            vscode.languages.registerDocumentRangeFormattingEditProvider('robotframework', {
                async provideDocumentRangeFormattingEdits(
                    document: vscode.TextDocument,
                    range: vscode.Range
                ): Promise<vscode.TextEdit[]> {
                    if (client) {
                        const result = await client.sendRequest<vscode.TextEdit[]>('textDocument/rangeFormatting', {
                            textDocument: { uri: document.uri.toString() },
                            range: range,
                            options: {
                                tabSize: config.get<number>('formatting.spaceCount', 4),
                                insertSpaces: true
                            }
                        });
                        return result || [];
                    }
                    return [];
                }
            })
        );
    }
}

async function indexWorkspace(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return;
    }

    for (const folder of workspaceFolders) {
        await keywordIndexer.indexWorkspace(folder);
    }
}

function registerLanguageFeatureProviders(context: vscode.ExtensionContext): void {
    const selector: vscode.DocumentSelector = { language: 'robotframework', scheme: 'file' };

    // Go to Definition
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(
            selector,
            new RobotDefinitionProvider(keywordIndexer)
        )
    );

    // Find References
    context.subscriptions.push(
        vscode.languages.registerReferenceProvider(
            selector,
            new RobotReferencesProvider(keywordIndexer)
        )
    );

    // Hover Documentation
    context.subscriptions.push(
        vscode.languages.registerHoverProvider(
            selector,
            new RobotHoverProvider(keywordIndexer)
        )
    );

    // Signature Help
    context.subscriptions.push(
        vscode.languages.registerSignatureHelpProvider(
            selector,
            new RobotSignatureHelpProvider(keywordIndexer),
            ' ', '\t' // Trigger characters
        )
    );

    // Enhanced Completion
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            selector,
            new RobotCompletionProvider(keywordIndexer),
            ' ', '\t', '{', '$', '@', '&' // Trigger characters
        )
    );

    // Rename Refactoring
    context.subscriptions.push(
        vscode.languages.registerRenameProvider(
            selector,
            new RobotRenameProvider(keywordIndexer)
        )
    );

    // Import Management - Code Actions
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            selector,
            new ImportCodeActionProvider(keywordIndexer),
            {
                providedCodeActionKinds: [
                    vscode.CodeActionKind.QuickFix,
                    vscode.CodeActionKind.SourceOrganizeImports
                ]
            }
        )
    );

    // Remove Unused Imports - Code Action
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            selector,
            new RemoveUnusedImportsCodeAction(keywordIndexer),
            {
                providedCodeActionKinds: [vscode.CodeActionKind.Source]
            }
        )
    );
}

function watchFileChanges(context: vscode.ExtensionContext): void {
    // Watch for file changes to update index
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.{robot,resource}');

    watcher.onDidCreate(async (uri) => {
        await keywordIndexer.indexFile(uri);
    });

    watcher.onDidChange(async (uri) => {
        keywordIndexer.clearFile(uri);
        await keywordIndexer.indexFile(uri);
    });

    watcher.onDidDelete((uri) => {
        keywordIndexer.clearFile(uri);
    });

    context.subscriptions.push(watcher);
}

function showWelcomeMessage(context: vscode.ExtensionContext): void {
    const key = 'robotframework.welcomeShown';
    const shown = context.globalState.get<boolean>(key, false);

    if (!shown) {
        vscode.window.showInformationMessage(
            'Welcome to Robot Framework Pro! Your complete RF development environment is ready.',
            'Get Started',
            'Documentation'
        ).then(selection => {
            if (selection === 'Get Started') {
                vscode.env.openExternal(vscode.Uri.parse('https://github.com/Skisperd/robotframework-pro-extension'));
            } else if (selection === 'Documentation') {
                vscode.env.openExternal(vscode.Uri.parse('https://robotframework.org'));
            }
        });

        context.globalState.update(key, true);
    }
}
