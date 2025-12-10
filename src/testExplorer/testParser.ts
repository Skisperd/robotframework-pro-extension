import * as vscode from 'vscode';

export interface RobotTest {
    name: string;
    description: string;
    range: vscode.Range;
    tags: string[];
}

export class TestParser {
    async parseDocument(document: vscode.TextDocument): Promise<RobotTest[]> {
        const tests: RobotTest[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        let inTestCases = false;
        let currentTest: Partial<RobotTest> | null = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();

            // Check if we're entering Test Cases section
            if (trimmedLine.startsWith('***') && trimmedLine.toLowerCase().includes('test case')) {
                inTestCases = true;
                continue;
            }

            // Check if we're leaving Test Cases section
            if (inTestCases && trimmedLine.startsWith('***')) {
                // Save current test if exists
                if (currentTest && currentTest.name) {
                    tests.push(this.finalizeTest(currentTest, i - 1, document));
                }
                inTestCases = false;
                currentTest = null;
                continue;
            }

            if (!inTestCases) {
                continue;
            }

            // Check for empty line or comment
            if (trimmedLine === '' || trimmedLine.startsWith('#')) {
                continue;
            }

            // Check if line starts with whitespace (it's part of current test)
            const startsWithWhitespace = line.length > 0 && /^\s/.test(line);

            if (!startsWithWhitespace && trimmedLine !== '') {
                // Save previous test if exists
                if (currentTest && currentTest.name) {
                    tests.push(this.finalizeTest(currentTest, i - 1, document));
                }

                // Start new test
                currentTest = {
                    name: trimmedLine,
                    description: '',
                    tags: []
                };
            } else if (currentTest && startsWithWhitespace) {
                // Parse test metadata
                const metadataMatch = line.match(/^\s+\[(\w+)\]\s+(.+)/);

                if (metadataMatch) {
                    const [, key, value] = metadataMatch;

                    if (key.toLowerCase() === 'documentation') {
                        currentTest.description = value.trim();
                    } else if (key.toLowerCase() === 'tags') {
                        const tags = value.split(/\s+/).filter(t => t.length > 0);
                        currentTest.tags = [...(currentTest.tags || []), ...tags];
                    }
                }
            }
        }

        // Save last test if exists
        if (currentTest && currentTest.name) {
            tests.push(this.finalizeTest(currentTest, lines.length - 1, document));
        }

        return tests;
    }

    private finalizeTest(
        test: Partial<RobotTest>,
        endLine: number,
        document: vscode.TextDocument
    ): RobotTest {
        // Find the actual start line of the test name
        let startLine = 0;
        const text = document.getText();
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line === test.name) {
                startLine = i;
                break;
            }
        }

        const range = new vscode.Range(
            new vscode.Position(startLine, 0),
            new vscode.Position(endLine, lines[endLine]?.length || 0)
        );

        return {
            name: test.name || 'Unknown Test',
            description: test.description || '',
            range: range,
            tags: test.tags || []
        };
    }

    /**
     * Parse a single test case name from a line
     * This is useful for quick checks without parsing the whole document
     */
    parseTestName(line: string): string | null {
        const trimmed = line.trim();

        // Test names don't start with whitespace in their line and aren't metadata
        if (!trimmed.startsWith('[') && !trimmed.startsWith('#') && trimmed.length > 0) {
            return trimmed;
        }

        return null;
    }

    /**
     * Find test case at a specific position in the document
     */
    async findTestAtPosition(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<RobotTest | null> {
        const tests = await this.parseDocument(document);

        for (const test of tests) {
            if (test.range.contains(position)) {
                return test;
            }
        }

        return null;
    }
}
