export interface ParseResult {
    sections: Section[];
    variables: Variable[];
    keywords: Keyword[];
    testCases: TestCase[];
}

export interface Section {
    type: 'settings' | 'variables' | 'testcases' | 'keywords';
    startLine: number;
    endLine: number;
}

export interface Variable {
    name: string;
    value: string;
    line: number;
}

export interface Keyword {
    name: string;
    line: number;
    arguments: string[];
    documentation?: string;
}

export interface TestCase {
    name: string;
    line: number;
    tags: string[];
    documentation?: string;
}

export class RobotParser {
    parse(text: string): ParseResult {
        const lines = text.split('\n');
        const result: ParseResult = {
            sections: [],
            variables: [],
            keywords: [],
            testCases: []
        };

        let currentSection: Section | null = null;
        let lineNumber = 0;

        for (const line of lines) {
            const trimmed = line.trim();

            // Detect sections
            if (trimmed.startsWith('***') && trimmed.endsWith('***')) {
                if (currentSection) {
                    currentSection.endLine = lineNumber - 1;
                    result.sections.push(currentSection);
                }

                const sectionName = trimmed.replace(/\*/g, '').trim().toLowerCase();
                let sectionType: Section['type'] | null = null;

                if (sectionName.includes('setting')) {
                    sectionType = 'settings';
                } else if (sectionName.includes('variable')) {
                    sectionType = 'variables';
                } else if (sectionName.includes('test')) {
                    sectionType = 'testcases';
                } else if (sectionName.includes('keyword')) {
                    sectionType = 'keywords';
                }

                if (sectionType) {
                    currentSection = {
                        type: sectionType,
                        startLine: lineNumber,
                        endLine: lineNumber
                    };
                }
            }
            // Parse variables
            else if (currentSection?.type === 'variables') {
                const varMatch = trimmed.match(/^(\$\{[^}]+\}|@\{[^}]+\}|&\{[^}]+\})\s+(.+)$/);
                if (varMatch) {
                    result.variables.push({
                        name: varMatch[1],
                        value: varMatch[2],
                        line: lineNumber
                    });
                }
            }
            // Parse test cases
            else if (currentSection?.type === 'testcases' && trimmed && !trimmed.startsWith('[') && !line.startsWith(' ')) {
                result.testCases.push({
                    name: trimmed,
                    line: lineNumber,
                    tags: [],
                    documentation: undefined
                });
            }
            // Parse keywords
            else if (currentSection?.type === 'keywords' && trimmed && !trimmed.startsWith('[') && !line.startsWith(' ')) {
                result.keywords.push({
                    name: trimmed,
                    line: lineNumber,
                    arguments: [],
                    documentation: undefined
                });
            }

            lineNumber++;
        }

        if (currentSection) {
            currentSection.endLine = lineNumber - 1;
            result.sections.push(currentSection);
        }

        return result;
    }

    getWordAtPosition(text: string, line: number, character: number): string | null {
        const lines = text.split('\n');
        if (line >= lines.length) {
            return null;
        }

        const lineText = lines[line];
        const wordRegex = /[\w${}\[\]@&]+/g;
        let match;

        while ((match = wordRegex.exec(lineText)) !== null) {
            const start = match.index;
            const end = start + match[0].length;

            if (character >= start && character <= end) {
                return match[0];
            }
        }

        return null;
    }
}
