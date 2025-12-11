import * as vscode from 'vscode';
import { KeywordIndexer } from './keywordIndexer';

export class RobotDefinitionProvider implements vscode.DefinitionProvider {
    constructor(private indexer: KeywordIndexer) {}

    provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Definition | vscode.LocationLink[]> {
        const wordRange = document.getWordRangeAtPosition(position, /[\w\s\-\.]+/);
        if (!wordRange) {
            return null;
        }

        const word = document.getText(wordRange).trim();

        // Check if it's a variable
        if (word.match(/^[\$@&]\{[^}]+\}$/)) {
            return this.findVariableDefinition(word);
        }

        // Check if it's a keyword
        return this.findKeywordDefinition(word);
    }

    private findKeywordDefinition(keywordName: string): vscode.Location[] {
        const keywords = this.indexer.findKeyword(keywordName);
        return keywords.map(k => k.location);
    }

    private findVariableDefinition(variableName: string): vscode.Location[] {
        const variables = this.indexer.findVariable(variableName);
        return variables.map(v => v.location);
    }
}
