import * as vscode from 'vscode';
import * as path from 'path';
import { TestParser } from './testParser';
import { TestExecutor } from './testExecutor';

export class RobotFrameworkTestController {
    private controller: vscode.TestController;
    private testParser: TestParser;
    private testExecutor: TestExecutor;
    private fileWatcher: vscode.FileSystemWatcher;

    constructor(context: vscode.ExtensionContext) {
        // Create the test controller
        this.controller = vscode.tests.createTestController(
            'robotframeworkTestController',
            'Robot Framework'
        );

        this.testParser = new TestParser();
        this.testExecutor = new TestExecutor(this.controller);

        // Set up file watching
        this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.robot');

        this.fileWatcher.onDidCreate(uri => this.discoverTests(uri));
        this.fileWatcher.onDidChange(uri => this.discoverTests(uri));
        this.fileWatcher.onDidDelete(uri => this.removeTests(uri));

        context.subscriptions.push(this.controller, this.fileWatcher);

        // Set up test run handler
        this.controller.createRunProfile(
            'Run',
            vscode.TestRunProfileKind.Run,
            (request, token) => this.runTests(request, token),
            true
        );

        this.controller.createRunProfile(
            'Debug',
            vscode.TestRunProfileKind.Debug,
            (request, token) => this.debugTests(request, token),
            false
        );

        // Set up refresh handler
        this.controller.refreshHandler = async () => {
            await this.discoverAllTests();
        };

        // Initial test discovery
        this.discoverAllTests();
    }

    private async discoverAllTests(): Promise<void> {
        const files = await vscode.workspace.findFiles('**/*.robot', '**/node_modules/**');

        for (const file of files) {
            await this.discoverTests(file);
        }
    }

    private async discoverTests(uri: vscode.Uri): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            const tests = await this.testParser.parseDocument(document);

            // Get or create test item for this file
            const fileItem = this.getOrCreateFileItem(uri);

            // Clear existing children
            fileItem.children.replace([]);

            // Add test cases as children
            for (const test of tests) {
                const testItem = this.controller.createTestItem(
                    `${uri.toString()}::${test.name}`,
                    test.name,
                    uri
                );

                testItem.range = test.range;
                testItem.description = test.description;
                testItem.tags = test.tags.map(tag => new vscode.TestTag(tag));

                fileItem.children.add(testItem);
            }

            // If no tests found, remove the file item
            if (tests.length === 0 && fileItem.parent === undefined) {
                this.controller.items.delete(fileItem.id);
            }
        } catch (error) {
            console.error(`Error discovering tests in ${uri.fsPath}:`, error);
        }
    }

    private getOrCreateFileItem(uri: vscode.Uri): vscode.TestItem {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        const relativePath = workspaceFolder
            ? path.relative(workspaceFolder.uri.fsPath, uri.fsPath)
            : path.basename(uri.fsPath);

        let fileItem = this.controller.items.get(uri.toString());

        if (!fileItem) {
            fileItem = this.controller.createTestItem(
                uri.toString(),
                relativePath,
                uri
            );
            this.controller.items.add(fileItem);
        }

        return fileItem;
    }

    private removeTests(uri: vscode.Uri): void {
        this.controller.items.delete(uri.toString());
    }

    private async runTests(
        request: vscode.TestRunRequest,
        token: vscode.CancellationToken
    ): Promise<void> {
        const run = this.controller.createTestRun(request);

        try {
            if (request.include) {
                // Run specific tests
                for (const test of request.include) {
                    await this.testExecutor.runTest(test, run, token);
                }
            } else {
                // Run all tests
                for (const [_, fileItem] of this.controller.items) {
                    for (const [_, testItem] of fileItem.children) {
                        await this.testExecutor.runTest(testItem, run, token);
                    }
                }
            }
        } finally {
            run.end();
        }
    }

    private async debugTests(
        request: vscode.TestRunRequest,
        _token: vscode.CancellationToken
    ): Promise<void> {
        const run = this.controller.createTestRun(request);

        try {
            if (request.include && request.include.length > 0) {
                const test = request.include[0];

                if (test.uri) {
                    await vscode.debug.startDebugging(undefined, {
                        type: 'robotframework',
                        name: 'Debug Robot Framework Test',
                        request: 'launch',
                        target: test.uri.fsPath,
                        test: test.label,
                        cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
                    });
                }
            }
        } finally {
            run.end();
        }
    }

    dispose(): void {
        this.controller.dispose();
        this.fileWatcher.dispose();
    }
}
