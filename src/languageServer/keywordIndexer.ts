import * as vscode from 'vscode';

export interface KeywordDefinition {
    name: string;
    documentation: string;
    arguments: ArgumentInfo[];
    location: vscode.Location;
    type: 'user' | 'library' | 'builtin';
    library?: string;
    source: string; // File path or library name
}

export interface ArgumentInfo {
    name: string;
    defaultValue?: string;
    isOptional: boolean;
}

export interface VariableDefinition {
    name: string;
    value?: string;
    location: vscode.Location;
    scope: 'suite' | 'test' | 'keyword' | 'global';
}

export interface TestCaseDefinition {
    name: string;
    documentation: string;
    location: vscode.Location;
    tags: string[];
}

export class KeywordIndexer {
    private keywords: Map<string, KeywordDefinition[]> = new Map();
    private variables: Map<string, VariableDefinition[]> = new Map();
    private testCases: Map<string, TestCaseDefinition[]> = new Map();
    private builtinKeywords: Map<string, KeywordDefinition> = new Map();

    constructor() {
        this.initializeBuiltinKeywords();
    }

    private initializeBuiltinKeywords(): void {
        const builtins: Array<{name: string, args: string[], doc: string}> = [
            { name: 'Log', args: ['message', 'level=INFO'], doc: 'Logs the given message with the given level' },
            { name: 'Should Be Equal', args: ['first', 'second', 'msg=None'], doc: 'Fails if the given objects are unequal' },
            { name: 'Should Contain', args: ['container', 'item', 'msg=None'], doc: 'Fails if container does not contain item' },
            { name: 'Should Be True', args: ['condition', 'msg=None'], doc: 'Fails if the given condition is not true' },
            { name: 'Should Not Be Equal', args: ['first', 'second', 'msg=None'], doc: 'Fails if the given objects are equal' },
            { name: 'Set Variable', args: ['*values'], doc: 'Returns the given values which can then be assigned to a variables' },
            { name: 'Set Test Variable', args: ['name', '*values'], doc: 'Makes a variable available everywhere within the scope of the current test' },
            { name: 'Set Suite Variable', args: ['name', '*values'], doc: 'Makes a variable available everywhere within the scope of the current suite' },
            { name: 'Set Global Variable', args: ['name', '*values'], doc: 'Makes a variable available globally in all tests and suites' },
            { name: 'Get Length', args: ['item'], doc: 'Returns the length of the given item' },
            { name: 'Get Time', args: ['format=timestamp', 'time_=NOW'], doc: 'Returns the given time in the requested format' },
            { name: 'Sleep', args: ['time', 'reason=None'], doc: 'Pauses the test execution for the given time' },
            { name: 'Wait Until Keyword Succeeds', args: ['retry', 'retry_interval', 'name', '*args'], doc: 'Runs the specified keyword and retries if it fails' },
            { name: 'Run Keyword', args: ['name', '*args'], doc: 'Executes the given keyword with the given arguments' },
            { name: 'Run Keyword If', args: ['condition', 'name', '*args'], doc: 'Runs the given keyword with the given arguments, if condition is true' },
            { name: 'Run Keywords', args: ['*keywords'], doc: 'Executes all the given keywords in a sequence' },
            { name: 'Fail', args: ['msg=None'], doc: 'Fails the test immediately with the given message' },
            { name: 'Pass Execution', args: ['msg=None'], doc: 'Skips rest of the current test and sets its status to PASS' },
            { name: 'Return From Keyword', args: ['*return_values'], doc: 'Returns from the enclosing user keyword' },
            { name: 'Import Library', args: ['name', '*args'], doc: 'Imports a library with the given name and optional arguments' },
            { name: 'Import Resource', args: ['path'], doc: 'Imports a resource file with the given path' },
            { name: 'Import Variables', args: ['path', '*args'], doc: 'Imports a Python module with variable definitions' },
        ];

        for (const builtin of builtins) {
            const args: ArgumentInfo[] = builtin.args.map(arg => {
                const hasDefault = arg.includes('=');
                const [name, defaultValue] = hasDefault ? arg.split('=') : [arg, undefined];
                return {
                    name: name,
                    defaultValue: defaultValue,
                    isOptional: hasDefault || name.startsWith('*')
                };
            });

            this.builtinKeywords.set(builtin.name.toLowerCase(), {
                name: builtin.name,
                documentation: builtin.doc,
                arguments: args,
                location: new vscode.Location(vscode.Uri.parse('builtin://BuiltIn'), new vscode.Range(0, 0, 0, 0)),
                type: 'builtin',
                library: 'BuiltIn',
                source: 'BuiltIn'
            });
        }
    }

    async indexWorkspace(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
        const files = await vscode.workspace.findFiles(
            new vscode.RelativePattern(workspaceFolder, '**/*.{robot,resource}'),
            '**/node_modules/**'
        );

        for (const file of files) {
            await this.indexFile(file);
        }
    }

    async indexFile(uri: vscode.Uri): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            this.parseDocument(document);
        } catch (error) {
            console.error(`Error indexing file ${uri.fsPath}:`, error);
        }
    }

    private parseDocument(document: vscode.TextDocument): void {
        const text = document.getText();
        const lines = text.split('\n');

        let currentSection: 'settings' | 'variables' | 'testcases' | 'keywords' | null = null;
        let currentKeyword: Partial<KeywordDefinition> | null = null;
        let currentTest: Partial<TestCaseDefinition> | null = null;
        let currentKeywordStartLine = 0;
        let currentTestStartLine = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();

            // Detect section headers
            if (trimmedLine.startsWith('***')) {
                // Save previous keyword or test
                if (currentKeyword && currentKeyword.name) {
                    this.addKeyword(document.uri, this.finalizeKeyword(currentKeyword, currentKeywordStartLine, i - 1, document));
                    currentKeyword = null;
                }
                if (currentTest && currentTest.name) {
                    this.addTestCase(document.uri, this.finalizeTestCase(currentTest, currentTestStartLine, i - 1, document));
                    currentTest = null;
                }

                const sectionName = trimmedLine.replace(/\*/g, '').trim().toLowerCase();
                if (sectionName.includes('setting')) {
                    currentSection = 'settings';
                } else if (sectionName.includes('variable')) {
                    currentSection = 'variables';
                } else if (sectionName.includes('test case')) {
                    currentSection = 'testcases';
                } else if (sectionName.includes('keyword')) {
                    currentSection = 'keywords';
                }
                continue;
            }

            // Skip empty lines and comments
            if (trimmedLine === '' || trimmedLine.startsWith('#')) {
                continue;
            }

            const startsWithoutWhitespace = line.length > 0 && !/^\s/.test(line);

            // Parse based on current section
            if (currentSection === 'variables' && startsWithoutWhitespace) {
                this.parseVariable(trimmedLine, document, i);
            } else if (currentSection === 'keywords' && startsWithoutWhitespace) {
                // Save previous keyword
                if (currentKeyword && currentKeyword.name) {
                    this.addKeyword(document.uri, this.finalizeKeyword(currentKeyword, currentKeywordStartLine, i - 1, document));
                }

                // Start new keyword
                currentKeyword = {
                    name: trimmedLine,
                    documentation: '',
                    arguments: [],
                    type: 'user',
                    source: document.uri.fsPath
                };
                currentKeywordStartLine = i;
            } else if (currentSection === 'testcases' && startsWithoutWhitespace) {
                // Save previous test
                if (currentTest && currentTest.name) {
                    this.addTestCase(document.uri, this.finalizeTestCase(currentTest, currentTestStartLine, i - 1, document));
                }

                // Start new test
                currentTest = {
                    name: trimmedLine,
                    documentation: '',
                    tags: []
                };
                currentTestStartLine = i;
            } else if (line.match(/^\s+\[(\w+)\]/)) {
                // Parse metadata
                const metadataMatch = line.match(/^\s+\[(\w+)\]\s+(.+)/);
                if (metadataMatch) {
                    const [, key, value] = metadataMatch;
                    const keyLower = key.toLowerCase();

                    if (currentKeyword) {
                        if (keyLower === 'documentation') {
                            currentKeyword.documentation = value.trim();
                        } else if (keyLower === 'arguments') {
                            currentKeyword.arguments = this.parseArguments(value);
                        }
                    } else if (currentTest) {
                        if (keyLower === 'documentation') {
                            currentTest.documentation = value.trim();
                        } else if (keyLower === 'tags') {
                            currentTest.tags = value.split(/\s+/).filter(t => t.length > 0);
                        }
                    }
                }
            }
        }

        // Save last keyword or test
        if (currentKeyword && currentKeyword.name) {
            this.addKeyword(document.uri, this.finalizeKeyword(currentKeyword, currentKeywordStartLine, lines.length - 1, document));
        }
        if (currentTest && currentTest.name) {
            this.addTestCase(document.uri, this.finalizeTestCase(currentTest, currentTestStartLine, lines.length - 1, document));
        }
    }

    private parseVariable(line: string, document: vscode.TextDocument, lineNumber: number): void {
        const varMatch = line.match(/^([\$@&]\{[^}]+\})\s*(.*)/);
        if (varMatch) {
            const [, name, value] = varMatch;
            const location = new vscode.Location(
                document.uri,
                new vscode.Range(lineNumber, 0, lineNumber, line.length)
            );

            const varDef: VariableDefinition = {
                name: name,
                value: value.trim(),
                location: location,
                scope: 'suite'
            };

            this.addVariable(document.uri, varDef);
        }
    }

    private parseArguments(argsString: string): ArgumentInfo[] {
        const args: ArgumentInfo[] = [];
        const argTokens = argsString.split(/\s{2,}/).filter(a => a.trim());

        for (const token of argTokens) {
            const hasDefault = token.includes('=');
            const [name, defaultValue] = hasDefault ? token.split('=') : [token, undefined];

            args.push({
                name: name.trim(),
                defaultValue: defaultValue?.trim(),
                isOptional: hasDefault || name.trim().startsWith('*')
            });
        }

        return args;
    }

    private finalizeKeyword(
        keyword: Partial<KeywordDefinition>,
        startLine: number,
        endLine: number,
        document: vscode.TextDocument
    ): KeywordDefinition {
        return {
            name: keyword.name!,
            documentation: keyword.documentation || '',
            arguments: keyword.arguments || [],
            location: new vscode.Location(
                document.uri,
                new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length)
            ),
            type: keyword.type || 'user',
            library: keyword.library,
            source: keyword.source || document.uri.fsPath
        };
    }

    private finalizeTestCase(
        test: Partial<TestCaseDefinition>,
        startLine: number,
        endLine: number,
        document: vscode.TextDocument
    ): TestCaseDefinition {
        return {
            name: test.name!,
            documentation: test.documentation || '',
            location: new vscode.Location(
                document.uri,
                new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length)
            ),
            tags: test.tags || []
        };
    }

    private addKeyword(_uri: vscode.Uri, keyword: KeywordDefinition): void {
        const key = keyword.name.toLowerCase();
        if (!this.keywords.has(key)) {
            this.keywords.set(key, []);
        }
        this.keywords.get(key)!.push(keyword);
    }

    private addVariable(_uri: vscode.Uri, variable: VariableDefinition): void {
        const key = variable.name.toLowerCase();
        if (!this.variables.has(key)) {
            this.variables.set(key, []);
        }
        this.variables.get(key)!.push(variable);
    }

    private addTestCase(_uri: vscode.Uri, testCase: TestCaseDefinition): void {
        const key = testCase.name.toLowerCase();
        if (!this.testCases.has(key)) {
            this.testCases.set(key, []);
        }
        this.testCases.get(key)!.push(testCase);
    }

    // Public query methods
    findKeyword(name: string): KeywordDefinition[] {
        const key = name.toLowerCase();
        const userKeywords = this.keywords.get(key) || [];
        const builtin = this.builtinKeywords.get(key);
        return builtin ? [...userKeywords, builtin] : userKeywords;
    }

    findVariable(name: string): VariableDefinition[] {
        return this.variables.get(name.toLowerCase()) || [];
    }

    findTestCase(name: string): TestCaseDefinition[] {
        return this.testCases.get(name.toLowerCase()) || [];
    }

    getAllKeywords(): KeywordDefinition[] {
        const all: KeywordDefinition[] = [];
        for (const keywords of this.keywords.values()) {
            all.push(...keywords);
        }
        for (const builtin of this.builtinKeywords.values()) {
            all.push(builtin);
        }
        return all;
    }

    getAllVariables(): VariableDefinition[] {
        const all: VariableDefinition[] = [];
        for (const variables of this.variables.values()) {
            all.push(...variables);
        }
        return all;
    }

    clear(): void {
        this.keywords.clear();
        this.variables.clear();
        this.testCases.clear();
        // Keep builtin keywords
    }

    clearFile(uri: vscode.Uri): void {
        // Remove all entries from this file
        for (const [key, keywords] of this.keywords.entries()) {
            const filtered = keywords.filter(k => k.location.uri.toString() !== uri.toString());
            if (filtered.length === 0) {
                this.keywords.delete(key);
            } else {
                this.keywords.set(key, filtered);
            }
        }

        for (const [key, variables] of this.variables.entries()) {
            const filtered = variables.filter(v => v.location.uri.toString() !== uri.toString());
            if (filtered.length === 0) {
                this.variables.delete(key);
            } else {
                this.variables.set(key, filtered);
            }
        }

        for (const [key, tests] of this.testCases.entries()) {
            const filtered = tests.filter(t => t.location.uri.toString() !== uri.toString());
            if (filtered.length === 0) {
                this.testCases.delete(key);
            } else {
                this.testCases.set(key, filtered);
            }
        }
    }
}
