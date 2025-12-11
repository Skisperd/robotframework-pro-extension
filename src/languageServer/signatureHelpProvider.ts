import * as vscode from 'vscode';
import { KeywordIndexer, KeywordDefinition } from './keywordIndexer';

export class RobotSignatureHelpProvider implements vscode.SignatureHelpProvider {
    constructor(private indexer: KeywordIndexer) {}

    provideSignatureHelp(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        _context: vscode.SignatureHelpContext
    ): vscode.ProviderResult<vscode.SignatureHelp> {
        const line = document.lineAt(position.line).text;
        const textBeforeCursor = line.substring(0, position.character);

        // Find the keyword being called
        const keywordMatch = this.findKeywordAtPosition(textBeforeCursor);
        if (!keywordMatch) {
            return null;
        }

        const keywordName = keywordMatch.name;
        const keywords = this.indexer.findKeyword(keywordName);

        if (keywords.length === 0) {
            return null;
        }

        // Prefer user keywords over built-ins
        const keyword = keywords.find(k => k.type === 'user') || keywords[0];

        // Count current argument position
        const argumentPosition = this.calculateArgumentPosition(textBeforeCursor, keywordMatch.endIndex);

        const signatureHelp = new vscode.SignatureHelp();
        signatureHelp.signatures = [this.createSignature(keyword)];
        signatureHelp.activeSignature = 0;
        signatureHelp.activeParameter = Math.min(argumentPosition, keyword.arguments.length - 1);

        return signatureHelp;
    }

    private findKeywordAtPosition(text: string): { name: string; startIndex: number; endIndex: number } | null {
        // Look backwards for keyword name (typically at start of line after indentation)
        const trimmed = text.trimStart();
        const indentLength = text.length - trimmed.length;

        // Match keyword name at beginning (before any arguments)
        const match = trimmed.match(/^([\w\s\-\.]+?)(?:\s{2,}|\t|$)/);
        if (match) {
            return {
                name: match[1].trim(),
                startIndex: indentLength,
                endIndex: indentLength + match[0].length
            };
        }

        return null;
    }

    private calculateArgumentPosition(text: string, keywordEndIndex: number): number {
        const argsText = text.substring(keywordEndIndex);

        // Count arguments by splitting on 2+ spaces or tabs
        const args = argsText.split(/\s{2,}|\t/).filter(a => a.trim().length > 0);

        return args.length;
    }

    private createSignature(keyword: KeywordDefinition): vscode.SignatureInformation {
        const label = this.formatSignatureLabel(keyword);
        const signature = new vscode.SignatureInformation(label, keyword.documentation);

        // Add parameter information
        signature.parameters = keyword.arguments.map(arg => {
            let paramLabel = arg.name;
            if (arg.defaultValue) {
                paramLabel += `=${arg.defaultValue}`;
            }

            const paramInfo = new vscode.ParameterInformation(
                paramLabel,
                arg.isOptional ? `Optional parameter${arg.defaultValue ? ` (default: ${arg.defaultValue})` : ''}` : 'Required parameter'
            );

            return paramInfo;
        });

        return signature;
    }

    private formatSignatureLabel(keyword: KeywordDefinition): string {
        if (keyword.arguments.length === 0) {
            return keyword.name;
        }

        const args = keyword.arguments.map(arg => {
            let formatted = arg.name;
            if (arg.defaultValue) {
                formatted += `=${arg.defaultValue}`;
            }
            if (arg.isOptional) {
                formatted = `[${formatted}]`;
            }
            return formatted;
        }).join('    ');

        return `${keyword.name}    ${args}`;
    }
}
