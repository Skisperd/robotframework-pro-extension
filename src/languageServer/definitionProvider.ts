import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { KeywordIndexer } from './keywordIndexer';
import { execSync } from 'child_process';

export class RobotDefinitionProvider implements vscode.DefinitionProvider {
    private robotLibraryPath: string | null = null;
    private libraryCache: Map<string, { filePath: string, keywords: Map<string, number> }> = new Map();

    constructor(private indexer: KeywordIndexer) {
        this.initializeRobotLibraryPath();
    }

    private async initializeRobotLibraryPath(): Promise<void> {
        try {
            // Get Robot Framework library path from Python
            const pythonPath = vscode.workspace.getConfiguration('python').get<string>('defaultInterpreterPath') || 'python';
            const result = execSync(`${pythonPath} -c "import robot; print(robot.__file__)"`, {
                encoding: 'utf-8',
                timeout: 5000
            }).trim();
            
            // robot.__file__ points to robot/__init__.py, we need the parent directory
            this.robotLibraryPath = path.dirname(result);
            console.log('Robot Framework library path:', this.robotLibraryPath);
            
            // Pre-index common libraries
            this.indexLibrary('BuiltIn', 'libraries/BuiltIn.py');
            this.indexLibrary('String', 'libraries/String.py');
            this.indexLibrary('Collections', 'libraries/Collections.py');
            this.indexLibrary('OperatingSystem', 'libraries/OperatingSystem.py');
            this.indexLibrary('DateTime', 'libraries/DateTime.py');
            this.indexLibrary('Process', 'libraries/Process.py');
            this.indexLibrary('XML', 'libraries/XML.py');
        } catch (error) {
            console.error('Failed to get Robot Framework path:', error);
        }
    }

    private indexLibrary(libraryName: string, relativePath: string): void {
        if (!this.robotLibraryPath) {
            return;
        }

        const filePath = path.join(this.robotLibraryPath, relativePath);
        if (!fs.existsSync(filePath)) {
            console.warn(`Library file not found: ${filePath}`);
            return;
        }

        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');
            const keywords = new Map<string, number>();

            // Find all method definitions that could be keywords
            // Robot Framework keywords are methods that don't start with underscore
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const match = line.match(/^\s{4}def\s+([a-z][a-z0-9_]*)\s*\(/i);
                if (match && !match[1].startsWith('_')) {
                    // Convert python_method_name to Robot Framework Keyword Name
                    const pythonName = match[1];
                    const rfName = pythonName.replace(/_/g, ' ').toLowerCase();
                    keywords.set(rfName, i);
                    
                    // Also store with underscores for exact match
                    keywords.set(pythonName.toLowerCase(), i);
                }
            }

            this.libraryCache.set(libraryName.toLowerCase(), { filePath, keywords });
            console.log(`Indexed ${keywords.size} keywords from ${libraryName}`);
        } catch (error) {
            console.error(`Failed to index library ${libraryName}:`, error);
        }
    }

    provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Definition | vscode.LocationLink[]> {
        const line = document.lineAt(position.line).text;
        
        // First, check if cursor is on a variable like ${VAR} or @{LIST} or &{DICT}
        const variableMatch = this.getVariableAtPosition(line, position.character);
        if (variableMatch) {
            return this.findVariableDefinition(variableMatch);
        }

        // Get keyword at position - keywords can have spaces, dots, underscores
        const keywordName = this.getKeywordAtPosition(line, position.character);
        if (keywordName) {
            const locations = this.findKeywordDefinition(keywordName);
            if (locations.length > 0) {
                return locations;
            }
        }

        // Fallback: try word at position with a simpler regex
        const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z][A-Za-z0-9_\s\-\.]*[A-Za-z0-9]/);
        if (wordRange) {
            const word = document.getText(wordRange).trim();
            return this.findKeywordDefinition(word);
        }

        return null;
    }

    private getVariableAtPosition(line: string, charPos: number): string | null {
        // Match variables: ${VAR}, @{LIST}, &{DICT}, %{ENV}
        const variableRegex = /[\$@&%]\{[^}]+\}/g;
        let match;
        while ((match = variableRegex.exec(line)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            if (charPos >= start && charPos <= end) {
                return match[0];
            }
        }
        return null;
    }

    private getKeywordAtPosition(line: string, charPos: number): string | null {
        // In Robot Framework, keywords are separated by multiple spaces (2+) or tabs
        const trimmedLine = line.trimStart();
        const leadingSpaces = line.length - trimmedLine.length;
        
        // Skip if cursor is in leading whitespace
        if (charPos < leadingSpaces) {
            return null;
        }

        // Split by 2+ spaces or tabs
        const cells = line.split(/\s{2,}|\t/).filter(c => c.trim() !== '');
        
        let currentPos = 0;
        for (const cell of cells) {
            const cellStart = line.indexOf(cell, currentPos);
            const cellEnd = cellStart + cell.length;
            
            if (charPos >= cellStart && charPos <= cellEnd) {
                // Found the cell, check if it looks like a keyword
                const trimmed = cell.trim();
                // Skip if it's a variable assignment, setting, or empty
                if (trimmed.match(/^[\$@&%]\{/) || trimmed.startsWith('[') || trimmed === '') {
                    return null;
                }
                // Skip if it's just a variable assignment like ${result}=
                if (trimmed.match(/^[\$@&%]\{[^}]+\}=?\s*$/)) {
                    return null;
                }
                return trimmed;
            }
            currentPos = cellEnd;
        }
        
        return null;
    }

    private findKeywordDefinition(keywordName: string): vscode.Location[] {
        const locations: vscode.Location[] = [];
        
        // First, try to find in user-defined keywords
        const userKeywords = this.indexer.findKeyword(keywordName);
        for (const kw of userKeywords) {
            // Skip builtin:// URIs, we'll handle them separately
            if (!kw.location.uri.scheme.startsWith('builtin')) {
                locations.push(kw.location);
            } else {
                // Try to resolve the real location for builtin keywords
                const realLocation = this.resolveBuiltinKeywordLocation(keywordName, kw.library);
                if (realLocation) {
                    locations.push(realLocation);
                }
            }
        }
        
        // If no locations found, try builtin libraries directly
        if (locations.length === 0) {
            const realLocation = this.resolveBuiltinKeywordLocation(keywordName);
            if (realLocation) {
                locations.push(realLocation);
            }
        }
        
        return locations;
    }

    private resolveBuiltinKeywordLocation(keywordName: string, libraryHint?: string): vscode.Location | null {
        // Normalize keyword name for lookup
        const normalizedName = keywordName.toLowerCase().replace(/\s+/g, ' ').trim();
        const nameWithUnderscores = normalizedName.replace(/\s/g, '_');
        
        // Libraries to search in order
        const librariesToSearch = libraryHint 
            ? [libraryHint.toLowerCase()]
            : ['builtin', 'string', 'collections', 'operatingsystem', 'datetime', 'process', 'xml'];
        
        for (const libName of librariesToSearch) {
            const library = this.libraryCache.get(libName);
            if (!library) {
                continue;
            }
            
            // Try to find the keyword
            let lineNumber = library.keywords.get(normalizedName);
            if (lineNumber === undefined) {
                lineNumber = library.keywords.get(nameWithUnderscores);
            }
            
            if (lineNumber !== undefined) {
                const uri = vscode.Uri.file(library.filePath);
                const position = new vscode.Position(lineNumber, 0);
                return new vscode.Location(uri, position);
            }
        }
        
        return null;
    }

    private findVariableDefinition(variableName: string): vscode.Location[] {
        const variables = this.indexer.findVariable(variableName);
        return variables.map(v => v.location);
    }
}
