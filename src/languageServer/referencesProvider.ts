import * as vscode from 'vscode';
import { KeywordIndexer } from './keywordIndexer';

export class RobotReferencesProvider implements vscode.ReferenceProvider {
    constructor(private indexer: KeywordIndexer) {}

    async provideReferences(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.ReferenceContext,
        _token: vscode.CancellationToken
    ): Promise<vscode.Location[]> {
        const wordRange = document.getWordRangeAtPosition(position, /[\w\s\-\.]+/);
        if (!wordRange) {
            return [];
        }

        const word = document.getText(wordRange).trim();

        // Check if it's a variable
        if (word.match(/^[\$@&]\{[^}]+\}$/)) {
            return this.findVariableReferences(word);
        }

        // Check if it's a keyword
        return this.findKeywordReferences(word, context.includeDeclaration);
    }

    private async findKeywordReferences(
        keywordName: string,
        includeDeclaration: boolean
    ): Promise<vscode.Location[]> {
        const references: vscode.Location[] = [];

        // If includeDeclaration, add the definition
        if (includeDeclaration) {
            const definitions = this.indexer.findKeyword(keywordName);
            references.push(...definitions.map(d => d.location));
        }

        // Find all usages of this keyword in workspace
        const files = await vscode.workspace.findFiles('**/*.{robot,resource}', '**/node_modules/**');

        for (const file of files) {
            try {
                const document = await vscode.workspace.openTextDocument(file);
                const fileReferences = this.findKeywordReferencesInDocument(document, keywordName);
                references.push(...fileReferences);
            } catch (error) {
                console.error(`Error finding references in ${file.fsPath}:`, error);
            }
        }

        return references;
    }

    private findKeywordReferencesInDocument(
        document: vscode.TextDocument,
        keywordName: string
    ): vscode.Location[] {
        const references: vscode.Location[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        let inTestCasesOrKeywords = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();

            // Track if we're in test cases or keywords section
            if (trimmedLine.startsWith('***')) {
                const sectionName = trimmedLine.toLowerCase();
                inTestCasesOrKeywords = sectionName.includes('test case') || sectionName.includes('keyword');
                continue;
            }

            // Skip section headers and metadata
            if (!inTestCasesOrKeywords || trimmedLine.startsWith('[') || trimmedLine === '') {
                continue;
            }

            // Search for keyword usage (case-insensitive, with word boundaries)
            const keywordRegex = new RegExp(`\\b${this.escapeRegex(keywordName)}\\b`, 'gi');
            let match;

            while ((match = keywordRegex.exec(line)) !== null) {
                const startPos = new vscode.Position(i, match.index);
                const endPos = new vscode.Position(i, match.index + match[0].length);
                references.push(new vscode.Location(document.uri, new vscode.Range(startPos, endPos)));
            }
        }

        return references;
    }

    private async findVariableReferences(variableName: string): Promise<vscode.Location[]> {
        const references: vscode.Location[] = [];
        const files = await vscode.workspace.findFiles('**/*.{robot,resource}', '**/node_modules/**');

        for (const file of files) {
            try {
                const document = await vscode.workspace.openTextDocument(file);
                const text = document.getText();
                const lines = text.split('\n');

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];

                    // Search for variable usage
                    const varRegex = new RegExp(this.escapeRegex(variableName), 'g');
                    let match;

                    while ((match = varRegex.exec(line)) !== null) {
                        const startPos = new vscode.Position(i, match.index);
                        const endPos = new vscode.Position(i, match.index + match[0].length);
                        references.push(new vscode.Location(document.uri, new vscode.Range(startPos, endPos)));
                    }
                }
            } catch (error) {
                console.error(`Error finding variable references in ${file.fsPath}:`, error);
            }
        }

        return references;
    }

    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
