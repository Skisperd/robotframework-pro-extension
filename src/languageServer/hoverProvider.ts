import * as vscode from 'vscode';
import { KeywordIndexer, KeywordDefinition, VariableDefinition } from './keywordIndexer';

export class RobotHoverProvider implements vscode.HoverProvider {
    constructor(private indexer: KeywordIndexer) {}

    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Hover> {
        const wordRange = document.getWordRangeAtPosition(position, /[\w\s\-\.]+/);
        if (!wordRange) {
            return null;
        }

        const word = document.getText(wordRange).trim();

        // Check if it's a variable
        if (word.match(/^[\$@&]\{[^}]+\}$/)) {
            return this.createVariableHover(word, wordRange);
        }

        // Check if it's a keyword
        return this.createKeywordHover(word, wordRange);
    }

    private createKeywordHover(keywordName: string, range: vscode.Range): vscode.Hover | null {
        const keywords = this.indexer.findKeyword(keywordName);

        if (keywords.length === 0) {
            return null;
        }

        // Prefer user keywords over built-ins
        const keyword = keywords.find(k => k.type === 'user') || keywords[0];

        const markdown = this.formatKeywordMarkdown(keyword);
        return new vscode.Hover(markdown, range);
    }

    private createVariableHover(variableName: string, range: vscode.Range): vscode.Hover | null {
        const variables = this.indexer.findVariable(variableName);

        if (variables.length === 0) {
            return null;
        }

        const variable = variables[0];
        const markdown = this.formatVariableMarkdown(variable);
        return new vscode.Hover(markdown, range);
    }

    private formatKeywordMarkdown(keyword: KeywordDefinition): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.supportHtml = true;
        md.isTrusted = true;

        // Keyword signature
        md.appendCodeblock(this.formatKeywordSignature(keyword), 'robotframework');

        // Documentation
        if (keyword.documentation) {
            md.appendMarkdown('\n\n---\n\n');
            md.appendMarkdown(keyword.documentation);
        }

        // Source information
        md.appendMarkdown('\n\n---\n\n');
        if (keyword.type === 'builtin') {
            md.appendMarkdown(`**Built-in keyword** from \`${keyword.library}\``);
        } else if (keyword.type === 'library') {
            md.appendMarkdown(`**Library keyword** from \`${keyword.library}\``);
        } else {
            const fileName = keyword.source.split(/[/\\]/).pop() || keyword.source;
            md.appendMarkdown(`**User keyword** defined in \`${fileName}\``);
        }

        return md;
    }

    private formatKeywordSignature(keyword: KeywordDefinition): string {
        const args = keyword.arguments.map(arg => {
            let formatted = arg.name;
            if (arg.defaultValue) {
                formatted += `=${arg.defaultValue}`;
            }
            return formatted;
        }).join('    ');

        return args ? `${keyword.name}    ${args}` : keyword.name;
    }

    private formatVariableMarkdown(variable: VariableDefinition): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.supportHtml = true;
        md.isTrusted = true;

        // Variable declaration
        let declaration = variable.name;
        if (variable.value) {
            declaration += `    ${variable.value}`;
        }
        md.appendCodeblock(declaration, 'robotframework');

        // Scope information
        md.appendMarkdown('\n\n---\n\n');
        md.appendMarkdown(`**Scope:** ${variable.scope}`);

        // Source information
        const fileName = variable.location.uri.fsPath.split(/[/\\]/).pop() || variable.location.uri.fsPath;
        md.appendMarkdown(`\n\n**Defined in:** \`${fileName}\``);

        return md;
    }
}
