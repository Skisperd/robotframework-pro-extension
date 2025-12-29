import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { KeywordIndexer } from './keywordIndexer';
import { execSync } from 'child_process';

interface LibraryKeywordInfo {
    source: string;
    lineno: number;
}

export class RobotDefinitionProvider implements vscode.DefinitionProvider {
    private robotLibraryPath: string | null = null;
    private libraryCache: Map<string, { filePath: string, keywords: Map<string, number> }> = new Map();
    private initialized: boolean = false;
    private pythonPath: string = 'python';

    constructor(private indexer: KeywordIndexer) {
        // Initialization will happen lazily on first use
    }

    private getPythonPath(): string {
        // Try multiple sources for Python path
        const rfConfig = vscode.workspace.getConfiguration('robotframework');
        const pythonConfig = vscode.workspace.getConfiguration('python');
        
        return rfConfig.get<string>('python.executable') 
            || pythonConfig.get<string>('defaultInterpreterPath')
            || pythonConfig.get<string>('pythonPath')
            || 'python';
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
                // Match method definitions with 4 spaces indent (class methods)
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
            console.log(`Indexed ${keywords.size} keywords from ${libraryName} at ${filePath}`);
        } catch (error) {
            console.error(`Failed to index library ${libraryName}:`, error);
        }
    }

    provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Definition | vscode.LocationLink[]> {
        // Ensure libraries are indexed (lazy initialization)
        if (!this.initialized) {
            this.initializeRobotLibraryPathSync();
        }
        
        const line = document.lineAt(position.line).text;
        
        // First, check if cursor is on a variable like ${VAR} or @{LIST} or &{DICT}
        const variableMatch = this.getVariableAtPosition(line, position.character);
        if (variableMatch) {
            return this.findVariableDefinition(variableMatch);
        }

        // Get keyword at position - keywords can have spaces, dots, underscores
        const keywordName = this.getKeywordAtPosition(line, position.character);
        if (keywordName) {
            console.log('Looking for keyword:', keywordName);
            const locations = this.findKeywordDefinition(keywordName);
            console.log('Found locations:', locations.length);
            if (locations.length > 0) {
                return locations;
            }
        }

        // Fallback: try word at position with a simpler regex
        const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z][A-Za-z0-9_\s\-\.]*[A-Za-z0-9]/);
        if (wordRange) {
            const word = document.getText(wordRange).trim();
            console.log('Fallback - Looking for word:', word);
            return this.findKeywordDefinition(word);
        }

        return null;
    }

    private initializeRobotLibraryPathSync(): void {
        if (this.initialized) {
            return;
        }
        
        try {
            this.pythonPath = this.getPythonPath();
            console.log('Using Python path:', this.pythonPath);
            
            // Get Robot Framework library path from Python
            const result = execSync(`"${this.pythonPath}" -c "import robot; print(robot.__file__)"`, {
                encoding: 'utf-8',
                timeout: 10000,
                windowsHide: true
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
            
            this.initialized = true;
            console.log('Robot Framework libraries indexed successfully. Cache size:', this.libraryCache.size);
        } catch (error) {
            console.error('Failed to get Robot Framework path:', error);
            this.initialized = true; // Mark as initialized to avoid retrying
        }
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
            // First try our cache
            let realLocation = this.resolveBuiltinKeywordLocation(keywordName);
            
            // If not in cache, try using Robot Framework directly
            if (!realLocation) {
                realLocation = this.getKeywordLocationFromRobot(keywordName);
            }
            
            if (realLocation) {
                locations.push(realLocation);
            }
        }
        
        return locations;
    }

    /**
     * Uses Robot Framework's libdoc to get the exact source and line number of a keyword
     */
    private getKeywordLocationFromRobot(keywordName: string): vscode.Location | null {
        // List of libraries to search
        const libraries = ['BuiltIn', 'String', 'Collections', 'OperatingSystem', 'DateTime', 'Process', 'XML'];
        
        for (const libName of libraries) {
            const info = this.getKeywordInfoFromLibrary(libName, keywordName);
            if (info && info.source && info.lineno > 0) {
                const uri = vscode.Uri.file(info.source);
                const position = new vscode.Position(info.lineno - 1, 0); // lineno is 1-based
                return new vscode.Location(uri, position);
            }
        }
        
        return null;
    }

    /**
     * Get keyword info (source file and line number) from Robot Framework library
     */
    private getKeywordInfoFromLibrary(libraryName: string, keywordName: string): LibraryKeywordInfo | null {
        try {
            // Use Robot Framework's own introspection to get keyword source and line number
            const pythonCode = `
import json
try:
    from robot.libraries.${libraryName} import ${libraryName}
    lib = ${libraryName}()
    kw_name = '${keywordName.replace(/'/g, "\\'")}'
    # Convert keyword name to method name
    method_name = kw_name.lower().replace(' ', '_')
    if hasattr(lib, method_name):
        method = getattr(lib, method_name)
        import inspect
        source = inspect.getfile(method)
        try:
            lineno = inspect.getsourcelines(method)[1]
        except:
            lineno = 1
        print(json.dumps({"source": source, "lineno": lineno}))
    else:
        print(json.dumps({"source": "", "lineno": 0}))
except Exception as e:
    print(json.dumps({"source": "", "lineno": 0, "error": str(e)}))
`;
            
            const result = execSync(`"${this.pythonPath}" -c "${pythonCode.replace(/\n/g, ';').replace(/"/g, '\\"')}"`, {
                encoding: 'utf-8',
                timeout: 5000,
                windowsHide: true
            }).trim();
            
            const info = JSON.parse(result) as LibraryKeywordInfo;
            if (info.source && info.lineno > 0) {
                console.log(`Found keyword "${keywordName}" in ${libraryName}: ${info.source}:${info.lineno}`);
                return info;
            }
        } catch (error) {
            // Silently ignore - keyword not found in this library
        }
        
        return null;
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
