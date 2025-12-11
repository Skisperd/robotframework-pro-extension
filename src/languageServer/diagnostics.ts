import { Diagnostic, DiagnosticSeverity, Range, Position } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ParseResult } from './parser';

export class DiagnosticsProvider {
    validate(parseResult: ParseResult, document: TextDocument): Diagnostic[] {
        const diagnostics: Diagnostic[] = [];

        // Check for duplicate test cases
        const testCaseNames = new Set<string>();
        for (const testCase of parseResult.testCases) {
            const lowerName = testCase.name.toLowerCase();
            if (testCaseNames.has(lowerName)) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: this.getLineRange(document, testCase.line),
                    message: `Duplicate test case name: ${testCase.name}`,
                    source: 'robotframework'
                });
            }
            testCaseNames.add(lowerName);
        }

        // Check for duplicate keywords
        const keywordNames = new Set<string>();
        for (const keyword of parseResult.keywords) {
            const lowerName = keyword.name.toLowerCase();
            if (keywordNames.has(lowerName)) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: this.getLineRange(document, keyword.line),
                    message: `Duplicate keyword name: ${keyword.name}`,
                    source: 'robotframework'
                });
            }
            keywordNames.add(lowerName);
        }

        // Check for empty test cases (warning)
        const text = document.getText();
        const lines = text.split('\n');

        for (const testCase of parseResult.testCases) {
            const nextLines = this.getNextNonEmptyLines(lines, testCase.line, 3);
            const hasKeywordCall = nextLines.some(line =>
                line.startsWith(' ') || line.startsWith('\t')
            );

            if (!hasKeywordCall) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range: this.getLineRange(document, testCase.line),
                    message: `Test case "${testCase.name}" appears to be empty`,
                    source: 'robotframework'
                });
            }
        }

        // Check for undefined variables (basic check)
        const definedVars = new Set(parseResult.variables.map(v => v.name));
        const varPattern = /(\$\{[^}]+\}|@\{[^}]+\}|&\{[^}]+\})/g;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            let match;

            while ((match = varPattern.exec(line)) !== null) {
                const varName = match[1];
                // Skip built-in variables
                if (this.isBuiltInVariable(varName) || definedVars.has(varName)) {
                    continue;
                }

                // This is a potential undefined variable
                diagnostics.push({
                    severity: DiagnosticSeverity.Information,
                    range: {
                        start: Position.create(i, match.index),
                        end: Position.create(i, match.index + varName.length)
                    },
                    message: `Variable ${varName} is not defined in Variables section`,
                    source: 'robotframework'
                });
            }
        }

        return diagnostics;
    }

    private getLineRange(document: TextDocument, line: number): Range {
        const lineText = document.getText({
            start: Position.create(line, 0),
            end: Position.create(line + 1, 0)
        });

        return Range.create(
            Position.create(line, 0),
            Position.create(line, lineText.trimEnd().length)
        );
    }

    private getNextNonEmptyLines(lines: string[], startLine: number, count: number): string[] {
        const result: string[] = [];
        let currentLine = startLine + 1;

        while (result.length < count && currentLine < lines.length) {
            const line = lines[currentLine].trim();
            if (line && !line.startsWith('#') && !line.startsWith('***')) {
                result.push(lines[currentLine]);
            }
            currentLine++;
        }

        return result;
    }

    private isBuiltInVariable(varName: string): boolean {
        const builtInVars = [
            '${CURDIR}', '${TEMPDIR}', '${EXECDIR}', '${/}', '${:}',
            '${SPACE}', '${EMPTY}', '${True}', '${False}', '${None}',
            '${null}', '${TEST NAME}', '${TEST STATUS}', '${TEST MESSAGE}',
            '${PREV TEST NAME}', '${PREV TEST STATUS}', '${PREV TEST MESSAGE}',
            '${SUITE NAME}', '${SUITE SOURCE}', '${SUITE DOCUMENTATION}',
            '${SUITE STATUS}', '${SUITE MESSAGE}', '${KEYWORD STATUS}',
            '${KEYWORD MESSAGE}', '${LOG LEVEL}', '${OUTPUT FILE}',
            '${LOG FILE}', '${REPORT FILE}', '${DEBUG FILE}',
            '${OUTPUT DIR}'
        ];

        return builtInVars.some(bv => varName.toUpperCase().includes(bv.toUpperCase()));
    }
}
