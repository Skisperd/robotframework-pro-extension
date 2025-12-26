import * as vscode from 'vscode';
import * as path from 'path';
import { TestParser } from './testParser';
import { TestExecutor } from './testExecutor';

export class RobotFrameworkTestController {
    private controller: vscode.TestController;
    private testParser: TestParser;
    private testExecutor: TestExecutor;
    private fileWatcher: vscode.FileSystemWatcher;
    private tagToTestsMap: Map<string, Set<vscode.TestItem>> = new Map();

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

        // Create verbose run profile for detailed logging
        this.controller.createRunProfile(
            'Run Verbose',
            vscode.TestRunProfileKind.Run,
            (request, token) => this.runTestsVerbose(request, token),
            false
        );

        // Create tag-based run profile
        this.controller.createRunProfile(
            'Run by Tag',
            vscode.TestRunProfileKind.Run,
            (request, token) => this.runTestsByTag(request, token),
            false,
            new vscode.TestTag('filtered')
        );

        // Set up refresh handler
        this.controller.refreshHandler = async () => {
            await this.discoverAllTests();
        };

        // Set up resolve handler for lazy loading
        this.controller.resolveHandler = async (item) => {
            if (!item) {
                await this.discoverAllTests();
            } else if (item.uri) {
                await this.discoverTests(item.uri);
            }
        };

        // Initial test discovery
        this.discoverAllTests();
    }

    private async discoverAllTests(): Promise<void> {
        const config = vscode.workspace.getConfiguration('robotframework');
        const tagFilter = config.get<string>('testExplorer.filterByTag', '');
        
        const files = await vscode.workspace.findFiles('**/*.robot', '**/node_modules/**');

        // Clear tag map
        this.tagToTestsMap.clear();

        for (const file of files) {
            await this.discoverTests(file, tagFilter);
        }
    }

    private async discoverTests(uri: vscode.Uri, tagFilter?: string): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            const tests = await this.testParser.parseDocument(document);

            // Get or create test item for this file
            const fileItem = this.getOrCreateFileItem(uri);

            // Clear existing children
            fileItem.children.replace([]);

            const config = vscode.workspace.getConfiguration('robotframework');
            const showTags = config.get<boolean>('testExplorer.showTags', true);
            const filterPattern = tagFilter || config.get<string>('testExplorer.filterByTag', '');

            // Add test cases as children
            for (const test of tests) {
                // Check tag filter
                if (filterPattern && !this.matchesTagFilter(test.tags, filterPattern)) {
                    continue;
                }

                const testItem = this.controller.createTestItem(
                    `${uri.toString()}::${test.name}`,
                    test.name,
                    uri
                );

                testItem.range = test.range;
                
                // Build description with tags if enabled
                if (showTags && test.tags.length > 0) {
                    testItem.description = `[${test.tags.join(', ')}]`;
                } else if (test.description) {
                    testItem.description = test.description;
                }

                // Add test tags
                testItem.tags = test.tags.map(tag => new vscode.TestTag(tag));

                // Track tags for filtering
                for (const tag of test.tags) {
                    if (!this.tagToTestsMap.has(tag)) {
                        this.tagToTestsMap.set(tag, new Set());
                    }
                    this.tagToTestsMap.get(tag)!.add(testItem);
                }

                fileItem.children.add(testItem);
            }

            // If no tests found, remove the file item
            if (fileItem.children.size === 0 && !this.controller.items.get(fileItem.id)?.children.size) {
                this.controller.items.delete(fileItem.id);
            }
        } catch (error) {
            console.error(`Error discovering tests in ${uri.fsPath}:`, error);
        }
    }

    /**
     * Check if test tags match the filter pattern
     * Supports: tag, tag1 AND tag2, tag1 OR tag2, NOT tag
     */
    private matchesTagFilter(tags: string[], pattern: string): boolean {
        if (!pattern.trim()) {
            return true;
        }

        const normalizedTags = tags.map(t => t.toLowerCase());
        const normalizedPattern = pattern.toLowerCase();

        // Handle AND
        if (normalizedPattern.includes(' and ')) {
            const parts = normalizedPattern.split(' and ').map(p => p.trim());
            return parts.every(part => {
                if (part.startsWith('not ')) {
                    return !normalizedTags.includes(part.replace('not ', ''));
                }
                return normalizedTags.includes(part);
            });
        }

        // Handle OR
        if (normalizedPattern.includes(' or ')) {
            const parts = normalizedPattern.split(' or ').map(p => p.trim());
            return parts.some(part => {
                if (part.startsWith('not ')) {
                    return !normalizedTags.includes(part.replace('not ', ''));
                }
                return normalizedTags.includes(part);
            });
        }

        // Handle NOT
        if (normalizedPattern.startsWith('not ')) {
            return !normalizedTags.includes(normalizedPattern.replace('not ', ''));
        }

        // Simple tag match
        return normalizedTags.includes(normalizedPattern);
    }

    /**
     * Get all available tags in the workspace
     */
    public getAllTags(): string[] {
        return Array.from(this.tagToTestsMap.keys()).sort();
    }

    /**
     * Get tests by tag
     */
    public getTestsByTag(tag: string): vscode.TestItem[] {
        const tests = this.tagToTestsMap.get(tag);
        return tests ? Array.from(tests) : [];
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
        // Remove from tag map
        for (const [_, tests] of this.tagToTestsMap) {
            for (const test of tests) {
                if (test.uri?.toString() === uri.toString()) {
                    tests.delete(test);
                }
            }
        }
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
                    if (token.isCancellationRequested) {
                        break;
                    }
                    await this.runTestItem(test, run, token);
                }
            } else {
                // Run all tests
                for (const [_, fileItem] of this.controller.items) {
                    if (token.isCancellationRequested) {
                        break;
                    }
                    for (const [_, testItem] of fileItem.children) {
                        if (token.isCancellationRequested) {
                            break;
                        }
                        await this.testExecutor.runTest(testItem, run, token);
                    }
                }
            }
        } finally {
            run.end();
        }
    }

    /**
     * Run tests with verbose logging (shows all keyword executions)
     */
    private async runTestsVerbose(
        request: vscode.TestRunRequest,
        token: vscode.CancellationToken
    ): Promise<void> {
        const run = this.controller.createTestRun(request);
        
        // Show verbose mode indicator
        run.appendOutput(`\r\n${'\x1b[35m'}${'═'.repeat(80)}${'\x1b[0m'}\r\n`);
        run.appendOutput(`${'\x1b[35m'}${'\x1b[1m'}🔍 VERBOSE MODE - Detailed Logging Enabled${'\x1b[0m'}\r\n`);
        run.appendOutput(`${'\x1b[35m'}${'═'.repeat(80)}${'\x1b[0m'}\r\n\r\n`);

        try {
            if (request.include) {
                // Run specific tests with verbose mode
                for (const test of request.include) {
                    if (token.isCancellationRequested) {
                        break;
                    }
                    await this.runTestItem(test, run, token, true);
                }
            } else {
                // Run all tests with verbose mode
                for (const [_, fileItem] of this.controller.items) {
                    if (token.isCancellationRequested) {
                        break;
                    }
                    for (const [_, testItem] of fileItem.children) {
                        if (token.isCancellationRequested) {
                            break;
                        }
                        await this.testExecutor.runTest(testItem, run, token, true);
                    }
                }
            }
        } finally {
            run.end();
        }
    }

    /**
     * Run a test item, handling both file items and individual tests
     */
    private async runTestItem(
        item: vscode.TestItem,
        run: vscode.TestRun,
        token: vscode.CancellationToken,
        debugMode: boolean = false
    ): Promise<void> {
        // Check if this is a file item (ID is just the URI without "::" separator)
        const isFileItem = !item.id.includes('::');

        if (isFileItem && item.uri) {
            // It's a file item - ensure tests are discovered first
            await this.discoverTests(item.uri);

            // Get the item from controller to ensure we have the updated children
            const actualItem = this.controller.items.get(item.id) || item;

            // Now run each test in the file individually
            if (actualItem.children.size > 0) {
                // Run each test in the file
                for (const [_, testItem] of actualItem.children) {
                    if (token.isCancellationRequested) {
                        break;
                    }
                    await this.testExecutor.runTest(testItem, run, token, debugMode);
                }
            } else {
                // If still no children, run the entire file without test filter
                await this.testExecutor.runTest(actualItem, run, token, debugMode);
            }
        } else {
            // It's an individual test
            await this.testExecutor.runTest(item, run, token, debugMode);
        }
    }

    /**
     * Run tests filtered by tag
     */
    private async runTestsByTag(
        request: vscode.TestRunRequest,
        token: vscode.CancellationToken
    ): Promise<void> {
        const run = this.controller.createTestRun(request);

        try {
            // Ask user for tag
            const allTags = this.getAllTags();
            if (allTags.length === 0) {
                vscode.window.showInformationMessage('No tags found in test cases');
                return;
            }

            const selectedTag = await vscode.window.showQuickPick(allTags, {
                placeHolder: 'Select a tag to run tests',
                title: 'Run Tests by Tag'
            });

            if (!selectedTag || token.isCancellationRequested) {
                return;
            }

            const testsToRun = this.getTestsByTag(selectedTag);
            run.appendOutput(`Running ${testsToRun.length} tests with tag: ${selectedTag}\r\n\r\n`);

            for (const test of testsToRun) {
                if (token.isCancellationRequested) {
                    break;
                }
                await this.testExecutor.runTest(test, run, token);
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
                    // If it's a file item, debug the whole file
                    // If it's a test item, debug with --test filter
                    const isFileItem = !test.id.includes('::');
                    
                    const debugConfig: vscode.DebugConfiguration = {
                        type: 'robotframework',
                        name: 'Debug Robot Framework Test',
                        request: 'launch',
                        target: test.uri.fsPath,
                        cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
                    };

                    if (!isFileItem) {
                        // Add test name filter for individual tests
                        debugConfig.arguments = ['--test', test.label];
                    }

                    await vscode.debug.startDebugging(undefined, debugConfig);
                }
            }
        } finally {
            run.end();
        }
    }

    dispose(): void {
        this.controller.dispose();
        this.fileWatcher.dispose();
        this.tagToTestsMap.clear();
    }
}
