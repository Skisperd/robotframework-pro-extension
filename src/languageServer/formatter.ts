import { FormattingOptions } from 'vscode-languageserver/node';

export class RobotFormatter {
    format(text: string, options: FormattingOptions): string {
        const lines = text.split('\n');
        const formatted: string[] = [];
        let inSection = false;

        const tabSize = options.tabSize || 4;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Empty lines
            if (!trimmed) {
                formatted.push('');
                continue;
            }

            // Comments
            if (trimmed.startsWith('#')) {
                formatted.push(trimmed);
                continue;
            }

            // Sections
            if (trimmed.startsWith('***')) {
                formatted.push(trimmed);
                inSection = true;
                continue;
            }

            // Settings in Settings section
            if (inSection && !line.startsWith(' ') && !line.startsWith('\t')) {
                // This is a setting, test case, or keyword name
                const parts = this.splitLine(line);
                if (parts.length > 0) {
                    // Check if this is a setting (starts with common setting keywords)
                    const settingKeywords = ['Library', 'Resource', 'Variables', 'Documentation',
                                            'Metadata', 'Suite Setup', 'Suite Teardown',
                                            'Test Setup', 'Test Teardown', 'Test Template',
                                            'Test Timeout', 'Force Tags', 'Default Tags'];

                    if (settingKeywords.some(kw => parts[0].startsWith(kw))) {
                        formatted.push(this.formatParts(parts, 0, tabSize));
                    } else {
                        // Test case or keyword name
                        formatted.push(parts[0]);
                    }
                }
                continue;
            }

            // Indented lines (keyword calls, settings within test/keyword)
            if (line.startsWith(' ') || line.startsWith('\t')) {
                const parts = this.splitLine(trimmed);
                if (parts.length > 0) {
                    formatted.push(this.formatParts(parts, 1, tabSize));
                }
                continue;
            }

            // Default: keep the line as is (trimmed)
            formatted.push(trimmed);
        }

        return formatted.join('\n');
    }

    private splitLine(line: string): string[] {
        // Split by multiple spaces or tabs
        const parts = line.split(/\s{2,}|\t+/).map(p => p.trim()).filter(p => p.length > 0);
        return parts;
    }

    private formatParts(parts: string[], indentLevel: number, tabSize: number): string {
        const indent = ' '.repeat(tabSize * indentLevel);
        const separator = ' '.repeat(tabSize);

        if (parts.length === 1) {
            return indent + parts[0];
        }

        return indent + parts.join(separator);
    }

    formatRange(text: string, startLine: number, endLine: number, options: FormattingOptions): string {
        const lines = text.split('\n');
        const selectedLines = lines.slice(startLine, endLine + 1);
        const formattedSection = this.format(selectedLines.join('\n'), options);

        lines.splice(startLine, endLine - startLine + 1, ...formattedSection.split('\n'));

        return lines.join('\n');
    }
}
