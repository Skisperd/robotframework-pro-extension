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
        // indexer parameter reserved for future use
    }

    provideCodeActions(
        document: vscode.TextDocument,
        _range: vscode.Range | vscode.Selection,
        _context: vscode.CodeActionContext,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
        const actions: vscode.CodeAction[] = [];

        // Analyze document for unused imports
        const unusedImports = this.findUnusedImports(document);
        
        if (unusedImports.length > 0) {
            const action = new vscode.CodeAction(
                `Remove ${unusedImports.length} Unused Import${unusedImports.length > 1 ? 's' : ''}`,
                vscode.CodeActionKind.Source
            );

            action.edit = this.createRemoveImportsEdit(document, unusedImports);
            action.diagnostics = [];
            actions.push(action);
        }

        // Always add "Organize Imports" action
        const organizeAction = new vscode.CodeAction(
            'Organize and Clean Imports',
            vscode.CodeActionKind.SourceOrganizeImports
        );
        
        const cleanEdit = this.createCleanImportsEdit(document);
        if (cleanEdit) {
            organizeAction.edit = cleanEdit;
            actions.push(organizeAction);
        }

        return actions;
    }

    /**
     * Find unused imports in the document
     */
    private findUnusedImports(document: vscode.TextDocument): ImportInfo[] {
        const unusedImports: ImportInfo[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        // Find settings section
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
            return [];
        }

        const endLine = settingsEnd >= 0 ? settingsEnd : lines.length;

        // Extract Library and Resource imports
        const imports: ImportInfo[] = [];
        for (let i = settingsStart + 1; i < endLine; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed.startsWith('Library')) {
                const libMatch = trimmed.match(/^Library\s+(\S+)/);
                if (libMatch) {
                    imports.push({
                        type: 'library',
                        name: libMatch[1],
                        line: i,
                        fullLine: line
                    });
                }
            } else if (trimmed.startsWith('Resource')) {
                const resMatch = trimmed.match(/^Resource\s+(\S+)/);
                if (resMatch) {
                    imports.push({
                        type: 'resource',
                        name: resMatch[1],
                        line: i,
                        fullLine: line
                    });
                }
            }
        }

        // Get content after settings section
        const contentAfterSettings = lines.slice(endLine).join('\n');

        // Check each import for usage
        for (const imp of imports) {
            const isUsed = this.isImportUsed(imp, contentAfterSettings);
            if (!isUsed) {
                unusedImports.push(imp);
            }
        }

        return unusedImports;
    }

    /**
     * Check if an import is used in the content
     */
    private isImportUsed(imp: ImportInfo, content: string): boolean {
        if (imp.type === 'library') {
            // For libraries, check if any keyword from the library is used
            // Check for qualified keyword calls (Library.Keyword)
            const libName = imp.name.split('/').pop()?.split('.')[0] || imp.name;
            const qualifiedPattern = new RegExp(`\\b${this.escapeRegex(libName)}\\.\\w+`, 'i');
            if (qualifiedPattern.test(content)) {
                return true;
            }

            // Check for common library keywords (simplified check)
            // This is a basic heuristic - a complete solution would require parsing the library
            const commonLibraryKeywords: Record<string, string[]> = {
                'Collections': ['Append To List', 'Get From Dictionary', 'List Should Contain'],
                'String': ['Convert To Lower Case', 'Convert To Upper Case', 'Split String'],
                'OperatingSystem': ['File Should Exist', 'Create File', 'Get File'],
                'DateTime': ['Get Current Date', 'Convert Date', 'Add Time To Date'],
                'Process': ['Run Process', 'Start Process', 'Terminate Process'],
                'XML': ['Parse Xml', 'Get Element', 'Element Should Exist'],
                'Browser': ['Open Browser', 'Close Browser', 'Click Element'],
                'SeleniumLibrary': ['Open Browser', 'Close Browser', 'Click Element'],
                'RequestsLibrary': ['Create Session', 'GET Request', 'POST Request']
            };

            const keywords = commonLibraryKeywords[libName];
            if (keywords) {
                for (const keyword of keywords) {
                    if (content.toLowerCase().includes(keyword.toLowerCase())) {
                        return true;
                    }
                }
            }

            // Conservative: if we can't determine, assume it's used
            return true;
        } else {
            // For resources, check if any keyword from the resource is used
            // This requires the indexer to know what keywords come from what file
            const resourcePath = imp.name;
            const resourceName = resourcePath.split(/[/\\]/).pop()?.replace('.resource', '').replace('.robot', '') || '';

            // Check for qualified calls
            const qualifiedPattern = new RegExp(`\\b${this.escapeRegex(resourceName)}\\.\\w+`, 'i');
            if (qualifiedPattern.test(content)) {
                return true;
            }

            // Conservative: if we can't determine, assume it's used
            return true;
        }
    }

    /**
     * Create edit to remove unused imports
     */
    private createRemoveImportsEdit(document: vscode.TextDocument, imports: ImportInfo[]): vscode.WorkspaceEdit {
        const edit = new vscode.WorkspaceEdit();

        // Sort by line number descending to avoid offset issues
        const sortedImports = [...imports].sort((a, b) => b.line - a.line);

        for (const imp of sortedImports) {
            const range = new vscode.Range(
                new vscode.Position(imp.line, 0),
                new vscode.Position(imp.line + 1, 0)
            );
            edit.delete(document.uri, range);
        }

        return edit;
    }

    /**
     * Create edit to clean and organize imports
     */
    private createCleanImportsEdit(document: vscode.TextDocument): vscode.WorkspaceEdit | null {
        const text = document.getText();
        const lines = text.split('\n');

        // Find settings section
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
            return null;
        }

        const endLine = settingsEnd >= 0 ? settingsEnd : lines.length;

        // Extract and categorize imports
        const libraries: string[] = [];
        const resources: string[] = [];
        const variables: string[] = [];
        const otherSettings: string[] = [];

        for (let i = settingsStart + 1; i < endLine; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed.startsWith('Library')) {
                libraries.push(this.normalizeImportLine(line, 'Library'));
            } else if (trimmed.startsWith('Resource')) {
                resources.push(this.normalizeImportLine(line, 'Resource'));
            } else if (trimmed.startsWith('Variables')) {
                variables.push(this.normalizeImportLine(line, 'Variables'));
            } else if (trimmed !== '' && !trimmed.startsWith('#')) {
                otherSettings.push(line);
            }
        }

        // Sort imports alphabetically (case-insensitive)
        libraries.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        resources.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        variables.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

        // Remove duplicates
        const uniqueLibraries = [...new Set(libraries)];
        const uniqueResources = [...new Set(resources)];
        const uniqueVariables = [...new Set(variables)];

        // Build organized section
        const organized: string[] = [];

        if (uniqueLibraries.length > 0) {
            organized.push(...uniqueLibraries);
        }

        if (uniqueResources.length > 0) {
            if (uniqueLibraries.length > 0) {
                organized.push('');
            }
            organized.push(...uniqueResources);
        }

        if (uniqueVariables.length > 0) {
            if (uniqueLibraries.length > 0 || uniqueResources.length > 0) {
                organized.push('');
            }
            organized.push(...uniqueVariables);
        }

        if (otherSettings.length > 0) {
            if (uniqueLibraries.length > 0 || uniqueResources.length > 0 || uniqueVariables.length > 0) {
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

    /**
     * Normalize import line formatting
     */
    private normalizeImportLine(line: string, type: string): string {
        const trimmed = line.trim();
        const match = trimmed.match(new RegExp(`^${type}\\s+(.+)$`));
        if (match) {
            const importPath = match[1].trim();
            return `${type}    ${importPath}`;
        }
        return trimmed;
    }

    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

/**
 * Import information interface
 */
interface ImportInfo {
    type: 'library' | 'resource' | 'variables';
    name: string;
    line: number;
    fullLine: string;
}
