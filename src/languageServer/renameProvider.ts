import * as vscode from 'vscode';
import { KeywordIndexer } from './keywordIndexer';

export class RobotRenameProvider implements vscode.RenameProvider {
    constructor(private indexer: KeywordIndexer) {}

    prepareRename(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Range | { range: vscode.Range; placeholder: string }> {
        const wordRange = document.getWordRangeAtPosition(position, /[\w\s\-\.]+/);
        if (!wordRange) {
            throw new Error('Cannot rename this element');
        }

        const word = document.getText(wordRange).trim();

        // Check if it's something we can rename
        const isVariable = word.match(/^[\$@&]\{[^}]+\}$/);
        const isKeyword = this.indexer.findKeyword(word).length > 0;

        if (!isVariable && !isKeyword) {
            throw new Error('Can only rename keywords and variables');
        }

        return { range: wordRange, placeholder: word };
    }

    async provideRenameEdits(
        document: vscode.TextDocument,
        position: vscode.Position,
        newName: string,
        _token: vscode.CancellationToken
    ): Promise<vscode.WorkspaceEdit | undefined> {
        const wordRange = document.getWordRangeAtPosition(position, /[\w\s\-\.]+/);
        if (!wordRange) {
            return undefined;
        }

        const oldName = document.getText(wordRange).trim();
        const workspaceEdit = new vscode.WorkspaceEdit();

        // Check if it's a variable
        if (oldName.match(/^[\$@&]\{[^}]+\}$/)) {
            await this.renameVariable(oldName, newName, workspaceEdit);
        } else {
            // It's a keyword
            await this.renameKeyword(oldName, newName, workspaceEdit);
        }

        return workspaceEdit;
    }

    private async renameKeyword(
        oldName: string,
        newName: string,
        workspaceEdit: vscode.WorkspaceEdit
    ): Promise<void> {
        const files = await vscode.workspace.findFiles('**/*.{robot,resource}', '**/node_modules/**');

        for (const file of files) {
            try {
                const document = await vscode.workspace.openTextDocument(file);
                const edits = this.findAndReplaceInDocument(document, oldName, newName);

                if (edits.length > 0) {
                    workspaceEdit.set(file, edits);
                }
            } catch (error) {
                console.error(`Error renaming in ${file.fsPath}:`, error);
            }
        }
    }

    private async renameVariable(
        oldName: string,
        newName: string,
        workspaceEdit: vscode.WorkspaceEdit
    ): Promise<void> {
        // Ensure new name has proper variable syntax
        let formattedNewName = newName;
        if (!newName.match(/^[\$@&]\{[^}]+\}$/)) {
            const prefix = oldName.charAt(0); // Get $, @, or &
            formattedNewName = `${prefix}{${newName}}`;
        }

        const files = await vscode.workspace.findFiles('**/*.{robot,resource}', '**/node_modules/**');

        for (const file of files) {
            try {
                const document = await vscode.workspace.openTextDocument(file);
                const edits = this.findAndReplaceInDocument(document, oldName, formattedNewName);

                if (edits.length > 0) {
                    workspaceEdit.set(file, edits);
                }
            } catch (error) {
                console.error(`Error renaming variable in ${file.fsPath}:`, error);
            }
        }
    }

    private findAndReplaceInDocument(
        document: vscode.TextDocument,
        oldName: string,
        newName: string
    ): vscode.TextEdit[] {
        const edits: vscode.TextEdit[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Use case-insensitive matching for keywords (Robot Framework standard)
            const isVariable = oldName.match(/^[\$@&]\{[^}]+\}$/);
            const regex = isVariable
                ? new RegExp(this.escapeRegex(oldName), 'g')
                : new RegExp(`\\b${this.escapeRegex(oldName)}\\b`, 'gi');

            let match;
            while ((match = regex.exec(line)) !== null) {
                const startPos = new vscode.Position(i, match.index);
                const endPos = new vscode.Position(i, match.index + match[0].length);
                const range = new vscode.Range(startPos, endPos);

                edits.push(vscode.TextEdit.replace(range, newName));
            }
        }

        return edits;
    }

    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
