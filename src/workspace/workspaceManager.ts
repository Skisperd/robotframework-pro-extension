import * as vscode from 'vscode';
import { KeywordIndexer } from '../languageServer/keywordIndexer';

interface WorkspaceInfo {
    folder: vscode.WorkspaceFolder;
    indexer: KeywordIndexer;
    pythonPath: string;
}

export class MultiRootWorkspaceManager {
    private workspaces: Map<string, WorkspaceInfo> = new Map();

    constructor(private context: vscode.ExtensionContext) {}

    async initialize(): Promise<void> {
        // Initialize all workspace folders
        const folders = vscode.workspace.workspaceFolders || [];

        for (const folder of folders) {
            await this.addWorkspace(folder);
        }

        // Watch for workspace folder changes
        this.context.subscriptions.push(
            vscode.workspace.onDidChangeWorkspaceFolders(async (event) => {
                // Add new folders
                for (const folder of event.added) {
                    await this.addWorkspace(folder);
                }

                // Remove old folders
                for (const folder of event.removed) {
                    this.removeWorkspace(folder);
                }
            })
        );

        // Watch for configuration changes
        this.context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(async (event) => {
                if (event.affectsConfiguration('robotframework.python.executable')) {
                    // Reload Python paths for affected workspaces
                    for (const [, info] of this.workspaces) {
                        const config = vscode.workspace.getConfiguration(
                            'robotframework',
                            info.folder.uri
                        );
                        info.pythonPath = config.get<string>('python.executable', 'python');
                    }
                }
            })
        );
    }

    private async addWorkspace(folder: vscode.WorkspaceFolder): Promise<void> {
        const key = folder.uri.toString();

        if (this.workspaces.has(key)) {
            return; // Already added
        }

        try {
            // Get workspace-specific configuration
            const config = vscode.workspace.getConfiguration('robotframework', folder.uri);
            const pythonPath = config.get<string>('python.executable', 'python');

            // Create indexer for this workspace
            const indexer = new KeywordIndexer();
            
            // Index with timeout to prevent blocking
            const indexPromise = indexer.indexWorkspace(folder);
            const timeoutPromise = new Promise<void>((resolve) => 
                setTimeout(() => {
                    console.warn(`Workspace indexing timeout for ${folder.name}`);
                    resolve();
                }, 15000)
            );
            await Promise.race([indexPromise, timeoutPromise]);

            this.workspaces.set(key, {
                folder: folder,
                indexer: indexer,
                pythonPath: pythonPath
            });

            console.log(`Added workspace: ${folder.name} (Python: ${pythonPath})`);
        } catch (error) {
            console.warn(`Failed to add workspace ${folder.name}:`, error);
        }
    }

    private removeWorkspace(folder: vscode.WorkspaceFolder): void {
        const key = folder.uri.toString();
        const info = this.workspaces.get(key);

        if (info) {
            info.indexer.clear();
            this.workspaces.delete(key);
            console.log(`Removed workspace: ${folder.name}`);
        }
    }

    public getIndexerForUri(uri: vscode.Uri): KeywordIndexer | null {
        const folder = vscode.workspace.getWorkspaceFolder(uri);

        if (!folder) {
            // Return first available indexer if no specific folder found
            const first = this.workspaces.values().next();
            return first.done ? null : first.value.indexer;
        }

        const key = folder.uri.toString();
        const info = this.workspaces.get(key);

        return info ? info.indexer : null;
    }

    public getPythonPathForUri(uri: vscode.Uri): string {
        const folder = vscode.workspace.getWorkspaceFolder(uri);

        if (!folder) {
            return 'python'; // Default
        }

        const key = folder.uri.toString();
        const info = this.workspaces.get(key);

        return info ? info.pythonPath : 'python';
    }

    public getAllIndexers(): KeywordIndexer[] {
        return Array.from(this.workspaces.values()).map(info => info.indexer);
    }

    public getWorkspaceInfo(uri: vscode.Uri): WorkspaceInfo | null {
        const folder = vscode.workspace.getWorkspaceFolder(uri);

        if (!folder) {
            return null;
        }

        const key = folder.uri.toString();
        return this.workspaces.get(key) || null;
    }

    public async reindexWorkspace(folder: vscode.WorkspaceFolder): Promise<void> {
        const key = folder.uri.toString();
        const info = this.workspaces.get(key);

        if (info) {
            info.indexer.clear();
            await info.indexer.indexWorkspace(folder);
            console.log(`Re-indexed workspace: ${folder.name}`);
        }
    }

    public async reindexAll(): Promise<void> {
        for (const [, info] of this.workspaces) {
            info.indexer.clear();
            await info.indexer.indexWorkspace(info.folder);
        }
        console.log('Re-indexed all workspaces');
    }

    public getWorkspaceFolders(): vscode.WorkspaceFolder[] {
        return Array.from(this.workspaces.values()).map(info => info.folder);
    }

    public getWorkspaceCount(): number {
        return this.workspaces.size;
    }

    public hasMultipleWorkspaces(): boolean {
        return this.workspaces.size > 1;
    }

    public showWorkspaceQuickPick(): Thenable<vscode.WorkspaceFolder | undefined> {
        if (this.workspaces.size === 0) {
            vscode.window.showInformationMessage('No workspace folders found');
            return Promise.resolve(undefined);
        }

        if (this.workspaces.size === 1) {
            const first = this.workspaces.values().next();
            return Promise.resolve(first.done ? undefined : first.value.folder);
        }

        const items = Array.from(this.workspaces.values()).map(info => ({
            label: info.folder.name,
            description: info.folder.uri.fsPath,
            detail: `Python: ${info.pythonPath}`,
            folder: info.folder
        }));

        return vscode.window.showQuickPick(items, {
            placeHolder: 'Select workspace folder'
        }).then(selected => selected?.folder);
    }
}
