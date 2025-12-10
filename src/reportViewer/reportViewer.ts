import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class ReportViewerProvider {
    private static currentPanel: vscode.WebviewPanel | undefined;
    private static readonly viewType = 'robotframeworkReportViewer';

    constructor(private context: vscode.ExtensionContext) {}

    public async showReport(reportPath: string, reportType: 'report' | 'log' = 'report'): Promise<void> {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (ReportViewerProvider.currentPanel) {
            ReportViewerProvider.currentPanel.reveal(column);
        } else {
            // Create new panel
            ReportViewerProvider.currentPanel = vscode.window.createWebviewPanel(
                ReportViewerProvider.viewType,
                reportType === 'report' ? 'Robot Framework Report' : 'Robot Framework Log',
                column || vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [
                        vscode.Uri.file(path.dirname(reportPath))
                    ]
                }
            );

            ReportViewerProvider.currentPanel.onDidDispose(
                () => {
                    ReportViewerProvider.currentPanel = undefined;
                },
                null,
                this.context.subscriptions
            );
        }

        // Load and display the report
        await this.loadReport(reportPath);
    }

    private async loadReport(reportPath: string): Promise<void> {
        if (!ReportViewerProvider.currentPanel) {
            return;
        }

        try {
            if (!fs.existsSync(reportPath)) {
                ReportViewerProvider.currentPanel.webview.html = this.getErrorHtml(
                    'Report not found',
                    `The report file was not found at: ${reportPath}`
                );
                return;
            }

            const reportContent = fs.readFileSync(reportPath, 'utf-8');

            // Convert local file paths to webview URIs
            const reportDir = path.dirname(reportPath);
            const modifiedContent = this.processReportContent(
                reportContent,
                reportDir,
                ReportViewerProvider.currentPanel.webview
            );

            ReportViewerProvider.currentPanel.webview.html = modifiedContent;
        } catch (error) {
            ReportViewerProvider.currentPanel.webview.html = this.getErrorHtml(
                'Error loading report',
                error instanceof Error ? error.message : String(error)
            );
        }
    }

    private processReportContent(
        content: string,
        reportDir: string,
        webview: vscode.Webview
    ): string {
        // Replace relative paths with webview URIs
        let processed = content;

        // Handle CSS files
        processed = processed.replace(
            /<link\s+([^>]*\s+)?href="([^"]+\.css)"/g,
            (match, attrs, href) => {
                if (!href.startsWith('http')) {
                    const cssPath = path.join(reportDir, href);
                    if (fs.existsSync(cssPath)) {
                        const cssUri = webview.asWebviewUri(vscode.Uri.file(cssPath));
                        return `<link ${attrs || ''}href="${cssUri}"`;
                    }
                }
                return match;
            }
        );

        // Handle JavaScript files
        processed = processed.replace(
            /<script\s+([^>]*\s+)?src="([^"]+\.js)"/g,
            (match, attrs, src) => {
                if (!src.startsWith('http')) {
                    const jsPath = path.join(reportDir, src);
                    if (fs.existsSync(jsPath)) {
                        const jsUri = webview.asWebviewUri(vscode.Uri.file(jsPath));
                        return `<script ${attrs || ''}src="${jsUri}"`;
                    }
                }
                return match;
            }
        );

        // Add CSP meta tag if not present
        if (!processed.includes('Content-Security-Policy')) {
            const cspMeta = `
                <meta http-equiv="Content-Security-Policy"
                      content="default-src 'none';
                               style-src ${webview.cspSource} 'unsafe-inline';
                               script-src ${webview.cspSource} 'unsafe-inline' 'unsafe-eval';
                               img-src ${webview.cspSource} data: https:;
                               font-src ${webview.cspSource};">
            `;
            processed = processed.replace('</head>', `${cspMeta}</head>`);
        }

        // Add custom CSS for better VS Code integration
        const customCss = `
            <style>
                body {
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }
                #statistics {
                    background-color: var(--vscode-editor-background) !important;
                }
                .pass {
                    color: var(--vscode-terminal-ansiGreen) !important;
                }
                .fail {
                    color: var(--vscode-terminal-ansiRed) !important;
                }
            </style>
        `;
        processed = processed.replace('</head>', `${customCss}</head>`);

        return processed;
    }

    private getErrorHtml(title: string, message: string): string {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${title}</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        padding: 20px;
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                    }
                    .error-container {
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 30px;
                        background-color: var(--vscode-input-background);
                        border: 1px solid var(--vscode-input-border);
                        border-radius: 4px;
                    }
                    h1 {
                        color: var(--vscode-errorForeground);
                        margin-top: 0;
                    }
                    .message {
                        padding: 15px;
                        background-color: var(--vscode-textBlockQuote-background);
                        border-left: 4px solid var(--vscode-errorForeground);
                        margin-top: 20px;
                    }
                    code {
                        font-family: var(--vscode-editor-font-family);
                        background-color: var(--vscode-textCodeBlock-background);
                        padding: 2px 6px;
                        border-radius: 3px;
                    }
                </style>
            </head>
            <body>
                <div class="error-container">
                    <h1>⚠️ ${title}</h1>
                    <div class="message">
                        <p>${message}</p>
                    </div>
                    <p style="margin-top: 30px; color: var(--vscode-descriptionForeground);">
                        Make sure you have run the tests and the report file exists.
                    </p>
                </div>
            </body>
            </html>
        `;
    }

    public static async findAndShowRecentReport(
        workspaceFolder: vscode.WorkspaceFolder,
        reportType: 'report' | 'log' = 'report',
        context?: vscode.ExtensionContext
    ): Promise<boolean> {
        // Search for report files in common locations
        const searchPatterns = [
            `**/${reportType}.html`,
            `**/.robot-test-output/**/${reportType}.html`,
            `**/output/**/${reportType}.html`,
            `**/results/**/${reportType}.html`
        ];

        for (const pattern of searchPatterns) {
            const files = await vscode.workspace.findFiles(
                new vscode.RelativePattern(workspaceFolder, pattern),
                '**/node_modules/**',
                10
            );

            if (files.length > 0) {
                // Sort by modification time, most recent first
                const sortedFiles = await Promise.all(
                    files.map(async (file) => {
                        const stats = fs.statSync(file.fsPath);
                        return { file, mtime: stats.mtime };
                    })
                );

                sortedFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

                // Show the most recent report
                // Use provided context or create a minimal one
                const provider = context
                    ? new ReportViewerProvider(context)
                    : new ReportViewerProvider({ subscriptions: [] } as any);
                await provider.showReport(sortedFiles[0].file.fsPath, reportType);
                return true;
            }
        }

        return false;
    }
}
