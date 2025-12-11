import * as vscode from 'vscode';
import { KeywordIndexer } from './keywordIndexer';

export class ImportCodeActionProvider implements vscode.CodeActionProvider {
    constructor(private indexer: KeywordIndexer) {}

    provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
        const actions: vscode.CodeAction[] = [];

        // Check if we're at the beginning of the document (for organize imports)
        if (range.start.line === 0) {
            const organizeAction = this.createOrganizeImportsAction(document);
            if (organizeAction) {
                actions.push(organizeAction);
            }
        }

        // Check for undefined keywords (for auto-import)
        const diagnostics = context.diagnostics.filter(
            d => d.message.includes('not found') || d.message.includes('undefined')
        );

        for (const diagnostic of diagnostics) {
            const word = document.getText(diagnostic.range);
            const importActions = this.createAutoImportActions(document, word, diagnostic.range);
            actions.push(...importActions);
        }

        // Always offer organize imports option
        const organizeAction = this.createOrganizeImportsAction(document);
        if (organizeAction && actions.length === 0) {
            actions.push(organizeAction);
        }

        return actions;
    }

    private createAutoImportActions(
        document: vscode.TextDocument,
        keywordName: string,
        _range: vscode.Range
    ): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];

        // Find all keywords with this name
        const keywords = this.indexer.findKeyword(keywordName);

        for (const keyword of keywords) {
            if (keyword.type === 'user') {
                // Create import action for user keywords
                const fileName = keyword.source.split(/[/\\]/).pop() || keyword.source;

                if (!fileName.endsWith(document.fileName)) {
                    const action = new vscode.CodeAction(
                        `Import '${keyword.name}' from ${fileName}`,
                        vscode.CodeActionKind.QuickFix
                    );

                    action.edit = this.createImportEdit(document, keyword.source, 'resource');
                    action.diagnostics = []; // This will fix the diagnostic
                    action.isPreferred = true;

                    actions.push(action);
                }
            }
        }

        return actions;
    }

    private createOrganizeImportsAction(document: vscode.TextDocument): vscode.CodeAction | null {
        const action = new vscode.CodeAction(
            'Organize Imports',
            vscode.CodeActionKind.SourceOrganizeImports
        );

        const edit = this.organizeImports(document);
        if (!edit) {
            return null;
        }

        action.edit = edit;
        return action;
    }

    private createImportEdit(
        document: vscode.TextDocument,
        resourcePath: string,
        importType: 'library' | 'resource'
    ): vscode.WorkspaceEdit {
        const edit = new vscode.WorkspaceEdit();

        // Find or create *** Settings *** section
        const text = document.getText();
        const lines = text.split('\n');

        let settingsStart = -1;
        let settingsEnd = -1;
        let insertLine = 0;

        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();

            if (trimmed.startsWith('***') && trimmed.toLowerCase().includes('setting')) {
                settingsStart = i;
            } else if (settingsStart >= 0 && trimmed.startsWith('***')) {
                settingsEnd = i;
                break;
            }
        }

        // Calculate relative path
        const docDir = document.uri.fsPath.split(/[/\\]/).slice(0, -1).join('/');
        const resDir = resourcePath.split(/[/\\]/).slice(0, -1).join('/');
        let relativePath = resourcePath;

        if (docDir === resDir) {
            relativePath = resourcePath.split(/[/\\]/).pop() || resourcePath;
        } else {
            // Simple relative path calculation
            relativePath = resourcePath.replace(docDir + '/', './');
        }

        if (settingsStart >= 0) {
            // Settings section exists, add import
            insertLine = settingsEnd >= 0 ? settingsEnd : lines.length;

            // Find last import line
            for (let i = settingsStart + 1; i < (settingsEnd >= 0 ? settingsEnd : lines.length); i++) {
                const trimmed = lines[i].trim();
                if (trimmed.startsWith('Library') || trimmed.startsWith('Resource')) {
                    insertLine = i + 1;
                }
            }

            const importStatement = importType === 'library'
                ? `Library    ${relativePath}\n`
                : `Resource    ${relativePath}\n`;

            edit.insert(
                document.uri,
                new vscode.Position(insertLine, 0),
                importStatement
            );
        } else {
            // No settings section, create it
            const settingsSection = `*** Settings ***\n${importType === 'library' ? 'Library' : 'Resource'}    ${relativePath}\n\n`;

            edit.insert(
                document.uri,
                new vscode.Position(0, 0),
                settingsSection
            );
        }

        return edit;
    }

    private organizeImports(document: vscode.TextDocument): vscode.WorkspaceEdit | null {
        const text = document.getText();
        const lines = text.split('\n');

        let settingsStart = -1;
        let settingsEnd = -1;

        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();

            if (trimmed.startsWith('***') && trimmed.toLowerCase().includes('setting')) {
                settingsStart = i;
            } else if (settingsStart >= 0 && trimmed.startsWith('***')) {
                settingsEnd = i;
                break;
            }
        }

        if (settingsStart < 0) {
            return null; // No settings section
        }

        const endLine = settingsEnd >= 0 ? settingsEnd : lines.length;

        // Extract import lines
        const libraries: string[] = [];
        const resources: string[] = [];
        const variables: string[] = [];
        const otherSettings: string[] = [];

        for (let i = settingsStart + 1; i < endLine; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed.startsWith('Library')) {
                libraries.push(line);
            } else if (trimmed.startsWith('Resource')) {
                resources.push(line);
            } else if (trimmed.startsWith('Variables')) {
                variables.push(line);
            } else if (trimmed !== '' && !trimmed.startsWith('#')) {
                otherSettings.push(line);
            } else if (trimmed === '' || trimmed.startsWith('#')) {
                // Preserve empty lines and comments
                otherSettings.push(line);
            }
        }

        // Sort imports alphabetically
        libraries.sort((a, b) => a.localeCompare(b));
        resources.sort((a, b) => a.localeCompare(b));
        variables.sort((a, b) => a.localeCompare(b));

        // Rebuild settings section
        const organized: string[] = [];

        if (libraries.length > 0) {
            organized.push(...libraries);
        }

        if (resources.length > 0) {
            if (libraries.length > 0) {
                organized.push('');  // Blank line between sections
            }
            organized.push(...resources);
        }

        if (variables.length > 0) {
            if (libraries.length > 0 || resources.length > 0) {
                organized.push('');
            }
            organized.push(...variables);
        }

        if (otherSettings.length > 0) {
            if (libraries.length > 0 || resources.length > 0 || variables.length > 0) {
                organized.push('');
            }
            organized.push(...otherSettings);
        }

        // Create edit
        const edit = new vscode.WorkspaceEdit();
        const range = new vscode.Range(
            new vscode.Position(settingsStart + 1, 0),
            new vscode.Position(endLine, 0)
        );

        edit.replace(document.uri, range, organized.join('\n') + '\n');

        return edit;
    }
}

export class RemoveUnusedImportsCodeAction implements vscode.CodeActionProvider {
    constructor(_indexer: KeywordIndexer) {
        // indexer will be used in future for detecting unused imports
    }

    provideCodeActions(
        document: vscode.TextDocument,
        _range: vscode.Range | vscode.Selection,
        _context: vscode.CodeActionContext,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
        const action = new vscode.CodeAction(
            'Remove Unused Imports',
            vscode.CodeActionKind.Source
        );

        const edit = this.removeUnusedImports(document);
        if (!edit) {
            return [];
        }

        action.edit = edit;
        return [action];
    }

    private removeUnusedImports(document: vscode.TextDocument): vscode.WorkspaceEdit | null {
        const text = document.getText();
        const lines = text.split('\n');

        // Find settings section
        let settingsStart = -1;

        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();

            if (trimmed.startsWith('***') && trimmed.toLowerCase().includes('setting')) {
                settingsStart = i;
                break;
            }
        }

        if (settingsStart < 0) {
            return null;
        }

        const edit = new vscode.WorkspaceEdit();

        // For now, we just mark it as available
        // Full implementation would require analyzing which imports are actually used

        return edit;
    }
}
