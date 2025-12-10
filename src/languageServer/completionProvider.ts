import * as vscode from 'vscode';
import { KeywordIndexer, KeywordDefinition, VariableDefinition } from './keywordIndexer';

export class RobotCompletionProvider implements vscode.CompletionItemProvider {
    constructor(private indexer: KeywordIndexer) {}

    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        _context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        const line = document.lineAt(position.line).text;
        const linePrefix = line.substring(0, position.character);

        const completions: vscode.CompletionItem[] = [];

        // Section headers
        if (linePrefix.trim().startsWith('***') || linePrefix.trim() === '') {
            completions.push(...this.getSectionCompletions());
        }

        // Settings (after indentation)
        if (linePrefix.match(/^\s+\[/)) {
            completions.push(...this.getSettingsCompletions());
        }

        // Variable completion
        if (linePrefix.includes('${') || linePrefix.includes('@{') || linePrefix.includes('&{')) {
            completions.push(...this.getVariableCompletions());
        }

        // Keyword completion (main case)
        completions.push(...this.getKeywordCompletions());

        // Control structures
        completions.push(...this.getControlStructureCompletions());

        return completions;
    }

    resolveCompletionItem(
        item: vscode.CompletionItem,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.CompletionItem> {
        // Add detailed documentation when item is selected
        return item;
    }

    private getSectionCompletions(): vscode.CompletionItem[] {
        const sections = [
            { label: '*** Settings ***', kind: vscode.CompletionItemKind.Module },
            { label: '*** Variables ***', kind: vscode.CompletionItemKind.Module },
            { label: '*** Test Cases ***', kind: vscode.CompletionItemKind.Module },
            { label: '*** Keywords ***', kind: vscode.CompletionItemKind.Module },
            { label: '*** Tasks ***', kind: vscode.CompletionItemKind.Module },
            { label: '*** Comments ***', kind: vscode.CompletionItemKind.Module }
        ];

        return sections.map(s => {
            const item = new vscode.CompletionItem(s.label, s.kind);
            item.detail = 'Robot Framework Section';
            return item;
        });
    }

    private getSettingsCompletions(): vscode.CompletionItem[] {
        const settings = [
            { label: '[Documentation]', detail: 'Test/Keyword documentation', kind: vscode.CompletionItemKind.Property },
            { label: '[Tags]', detail: 'Test tags', kind: vscode.CompletionItemKind.Property },
            { label: '[Setup]', detail: 'Test/Keyword setup', kind: vscode.CompletionItemKind.Property },
            { label: '[Teardown]', detail: 'Test/Keyword teardown', kind: vscode.CompletionItemKind.Property },
            { label: '[Template]', detail: 'Test template', kind: vscode.CompletionItemKind.Property },
            { label: '[Timeout]', detail: 'Test/Keyword timeout', kind: vscode.CompletionItemKind.Property },
            { label: '[Arguments]', detail: 'Keyword arguments', kind: vscode.CompletionItemKind.Property },
            { label: '[Return]', detail: 'Keyword return value', kind: vscode.CompletionItemKind.Property },
        ];

        return settings.map(s => {
            const item = new vscode.CompletionItem(s.label, s.kind);
            item.detail = s.detail;
            return item;
        });
    }

    private getVariableCompletions(): vscode.CompletionItem[] {
        const variables = this.indexer.getAllVariables();

        return variables.map(v => this.createVariableCompletionItem(v));
    }

    private createVariableCompletionItem(variable: VariableDefinition): vscode.CompletionItem {
        const item = new vscode.CompletionItem(variable.name, vscode.CompletionItemKind.Variable);

        if (variable.value) {
            item.detail = variable.value;
        }

        item.documentation = new vscode.MarkdownString();
        item.documentation.appendCodeblock(`${variable.name}    ${variable.value || ''}`, 'robotframework');
        item.documentation.appendMarkdown(`\n\n**Scope:** ${variable.scope}`);

        return item;
    }

    private getKeywordCompletions(): vscode.CompletionItem[] {
        const keywords = this.indexer.getAllKeywords();

        return keywords.map(k => this.createKeywordCompletionItem(k));
    }

    private createKeywordCompletionItem(keyword: KeywordDefinition): vscode.CompletionItem {
        const item = new vscode.CompletionItem(keyword.name, vscode.CompletionItemKind.Function);

        // Set detail based on keyword type
        if (keyword.type === 'builtin') {
            item.detail = `Built-in keyword from ${keyword.library}`;
        } else if (keyword.type === 'library') {
            item.detail = `Library keyword from ${keyword.library}`;
        } else {
            const fileName = keyword.source.split(/[/\\]/).pop() || keyword.source;
            item.detail = `User keyword from ${fileName}`;
        }

        // Create snippet with arguments
        if (keyword.arguments.length > 0) {
            const snippetArgs = keyword.arguments.map((arg, index) => {
                const placeholder = arg.name.replace(/[{}$@&*]/g, '');
                return `\${${index + 1}:${placeholder}}`;
            }).join('    ');

            item.insertText = new vscode.SnippetString(`${keyword.name}    ${snippetArgs}`);
        }

        // Add documentation
        const doc = new vscode.MarkdownString();
        doc.appendCodeblock(this.formatKeywordSignature(keyword), 'robotframework');

        if (keyword.documentation) {
            doc.appendMarkdown('\n\n' + keyword.documentation);
        }

        item.documentation = doc;

        return item;
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

    private getControlStructureCompletions(): vscode.CompletionItem[] {
        const structures = [
            {
                label: 'FOR',
                snippet: 'FOR    ${1:\\${item}}    IN    ${2:@{list}}\n    ${3:Log}    ${1}\nEND',
                detail: 'FOR loop',
                documentation: 'Iterate over a list of items'
            },
            {
                label: 'FOR IN RANGE',
                snippet: 'FOR    ${1:\\${index}}    IN RANGE    ${2:10}\n    ${3:Log}    ${1}\nEND',
                detail: 'FOR loop with range',
                documentation: 'Iterate over a range of numbers'
            },
            {
                label: 'IF',
                snippet: 'IF    ${1:condition}\n    ${2:Log}    ${3:message}\nEND',
                detail: 'IF statement',
                documentation: 'Conditional execution'
            },
            {
                label: 'IF ELSE',
                snippet: 'IF    ${1:condition}\n    ${2:Log}    ${3:True branch}\nELSE\n    ${4:Log}    ${5:False branch}\nEND',
                detail: 'IF-ELSE statement',
                documentation: 'Conditional execution with alternative'
            },
            {
                label: 'TRY',
                snippet: 'TRY\n    ${1:Log}    ${2:Trying}\nEXCEPT\n    ${3:Log}    ${4:Error occurred}\nEND',
                detail: 'TRY-EXCEPT block',
                documentation: 'Error handling'
            },
            {
                label: 'WHILE',
                snippet: 'WHILE    ${1:condition}\n    ${2:Log}    ${3:message}\nEND',
                detail: 'WHILE loop',
                documentation: 'Loop while condition is true'
            }
        ];

        return structures.map(s => {
            const item = new vscode.CompletionItem(s.label, vscode.CompletionItemKind.Keyword);
            item.insertText = new vscode.SnippetString(s.snippet);
            item.detail = s.detail;
            item.documentation = new vscode.MarkdownString(s.documentation);
            return item;
        });
    }
}
