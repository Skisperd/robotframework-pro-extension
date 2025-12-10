import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    InitializeParams,
    DidChangeConfigurationNotification,
    CompletionItem,
    CompletionItemKind,
    TextDocumentPositionParams,
    TextDocumentSyncKind,
    InitializeResult,
    Diagnostic,
    DocumentFormattingParams,
    TextEdit,
    Range,
    Position,
    DocumentSymbol,
    SymbolKind,
    DocumentSymbolParams
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { RobotParser } from './parser';
import { RobotFormatter } from './formatter';
import { DiagnosticsProvider } from './diagnostics';

// Create a connection for the server
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

const parser = new RobotParser();
const formatter = new RobotFormatter();
const diagnosticsProvider = new DiagnosticsProvider();

connection.onInitialize((params: InitializeParams) => {
    const capabilities = params.capabilities;

    hasConfigurationCapability = !!(
        capabilities.workspace && !!capabilities.workspace.configuration
    );
    hasWorkspaceFolderCapability = !!(
        capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );

    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['$', '{', '.', ' ']
            },
            documentFormattingProvider: true,
            documentRangeFormattingProvider: true,
            hoverProvider: true,
            definitionProvider: true,
            referencesProvider: true,
            documentSymbolProvider: true,
            workspaceSymbolProvider: true
        }
    };

    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true
            }
        };
    }

    return result;
});

connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        connection.client.register(DidChangeConfigurationNotification.type, undefined);
    }
});

// Document change handler
documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
    const text = textDocument.getText();
    const diagnostics: Diagnostic[] = [];

    try {
        const parseResult = parser.parse(text);
        const validationDiagnostics = diagnosticsProvider.validate(parseResult, textDocument);
        diagnostics.push(...validationDiagnostics);
    } catch (error) {
        connection.console.error(`Error parsing document: ${error}`);
    }

    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// Completion handler
connection.onCompletion(
    (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
        return [
            {
                label: 'Log',
                kind: CompletionItemKind.Function,
                data: 1,
                detail: 'Built-in keyword',
                documentation: 'Logs the given message with the given level'
            },
            {
                label: 'Should Be Equal',
                kind: CompletionItemKind.Function,
                data: 2,
                detail: 'Built-in keyword',
                documentation: 'Fails if the given objects are unequal'
            },
            {
                label: 'Should Contain',
                kind: CompletionItemKind.Function,
                data: 3,
                detail: 'Built-in keyword',
                documentation: 'Fails if container does not contain item'
            },
            {
                label: 'Should Be True',
                kind: CompletionItemKind.Function,
                data: 4,
                detail: 'Built-in keyword',
                documentation: 'Fails if the given condition is not true'
            },
            {
                label: 'FOR',
                kind: CompletionItemKind.Keyword,
                data: 5,
                detail: 'Control structure',
                insertText: 'FOR    ${item}    IN    @{list}\n    Log    ${item}\nEND'
            },
            {
                label: 'IF',
                kind: CompletionItemKind.Keyword,
                data: 6,
                detail: 'Control structure',
                insertText: 'IF    ${condition}\n    Log    True branch\nEND'
            },
            {
                label: 'TRY',
                kind: CompletionItemKind.Keyword,
                data: 7,
                detail: 'Control structure',
                insertText: 'TRY\n    Log    Trying\nEXCEPT\n    Log    Error\nEND'
            },
            {
                label: '*** Settings ***',
                kind: CompletionItemKind.Module,
                data: 8
            },
            {
                label: '*** Variables ***',
                kind: CompletionItemKind.Module,
                data: 9
            },
            {
                label: '*** Test Cases ***',
                kind: CompletionItemKind.Module,
                data: 10
            },
            {
                label: '*** Keywords ***',
                kind: CompletionItemKind.Module,
                data: 11
            },
            {
                label: '[Documentation]',
                kind: CompletionItemKind.Property,
                data: 12
            },
            {
                label: '[Tags]',
                kind: CompletionItemKind.Property,
                data: 13
            },
            {
                label: '[Setup]',
                kind: CompletionItemKind.Property,
                data: 14
            },
            {
                label: '[Teardown]',
                kind: CompletionItemKind.Property,
                data: 15
            },
            {
                label: '[Arguments]',
                kind: CompletionItemKind.Property,
                data: 16
            },
            {
                label: '[Return]',
                kind: CompletionItemKind.Property,
                data: 17
            }
        ];
    }
);

// Completion resolve handler
connection.onCompletionResolve(
    (item: CompletionItem): CompletionItem => {
        return item;
    }
);

// Formatting handler
connection.onDocumentFormatting(
    async (params: DocumentFormattingParams): Promise<TextEdit[]> => {
        const document = documents.get(params.textDocument.uri);
        if (!document) {
            return [];
        }

        const text = document.getText();
        const formatted = formatter.format(text, params.options);

        if (formatted === text) {
            return [];
        }

        const lastLine = document.lineCount - 1;
        const lastChar = document.getText({
            start: { line: lastLine, character: 0 },
            end: { line: lastLine + 1, character: 0 }
        }).length;

        return [
            TextEdit.replace(
                Range.create(
                    Position.create(0, 0),
                    Position.create(lastLine, lastChar)
                ),
                formatted
            )
        ];
    }
);

// Hover handler
connection.onHover(params => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return null;
    }

    return {
        contents: {
            kind: 'markdown',
            value: 'Robot Framework keyword or variable'
        }
    };
});

// Document symbols handler
connection.onDocumentSymbol((params: DocumentSymbolParams): DocumentSymbol[] => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return [];
    }

    const symbols: DocumentSymbol[] = [];
    const text = document.getText();
    const lines = text.split('\n');

    let currentSection: DocumentSymbol | null = null;
    let inTestCases = false;
    let inKeywords = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // Check for section headers
        if (trimmedLine.startsWith('***')) {
            const sectionName = trimmedLine.replace(/\*/g, '').trim();
            const sectionLower = sectionName.toLowerCase();

            // Close previous section
            if (currentSection) {
                currentSection.range.end = Position.create(i - 1, lines[i - 1]?.length || 0);
                currentSection.selectionRange.end = currentSection.range.end;
            }

            // Create new section
            currentSection = DocumentSymbol.create(
                sectionName,
                undefined,
                SymbolKind.Namespace,
                Range.create(Position.create(i, 0), Position.create(i, line.length)),
                Range.create(Position.create(i, 0), Position.create(i, line.length))
            );
            currentSection.children = [];
            symbols.push(currentSection);

            // Set flags
            inTestCases = sectionLower.includes('test case');
            inKeywords = sectionLower.includes('keyword');
            continue;
        }

        // Skip empty lines and comments
        if (trimmedLine === '' || trimmedLine.startsWith('#')) {
            continue;
        }

        // Check if line starts without whitespace (potential test/keyword name)
        const startsWithoutWhitespace = line.length > 0 && !/^\s/.test(line);

        if (startsWithoutWhitespace && trimmedLine !== '' && currentSection) {
            if (inTestCases) {
                // Add test case symbol
                const testSymbol = DocumentSymbol.create(
                    trimmedLine,
                    undefined,
                    SymbolKind.Method,
                    Range.create(Position.create(i, 0), Position.create(i, line.length)),
                    Range.create(Position.create(i, 0), Position.create(i, line.length))
                );
                currentSection.children?.push(testSymbol);
            } else if (inKeywords) {
                // Add keyword symbol
                const keywordSymbol = DocumentSymbol.create(
                    trimmedLine,
                    undefined,
                    SymbolKind.Function,
                    Range.create(Position.create(i, 0), Position.create(i, line.length)),
                    Range.create(Position.create(i, 0), Position.create(i, line.length))
                );
                currentSection.children?.push(keywordSymbol);
            }
        }
    }

    // Close last section
    if (currentSection) {
        currentSection.range.end = Position.create(lines.length - 1, lines[lines.length - 1]?.length || 0);
        currentSection.selectionRange.end = currentSection.range.end;
    }

    return symbols;
});

// Definition handler (empty - feature not implemented yet)
connection.onDefinition((_params) => {
    return null;
});

// References handler (empty - feature not implemented yet)
connection.onReferences((_params) => {
    return null;
});

// Hover handler (empty - feature not implemented yet)
connection.onHover((_params) => {
    return null;
});

// Make the text document manager listen on the connection
documents.listen(connection);

// Listen on the connection
connection.listen();
