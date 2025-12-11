import * as vscode from 'vscode';

export class DebugConfigurationProvider implements vscode.DebugConfigurationProvider {
    resolveDebugConfiguration(
        folder: vscode.WorkspaceFolder | undefined,
        config: vscode.DebugConfiguration,
        _token?: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DebugConfiguration> {
        // If launch.json is missing or empty
        if (!config.type && !config.request && !config.name) {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'robotframework') {
                config.type = 'robotframework';
                config.name = 'Launch Robot Framework';
                config.request = 'launch';
                config.target = '${file}';
                config.cwd = '${workspaceFolder}';
                config.stopOnEntry = false;
            }
        }

        if (!config.target) {
            return vscode.window.showInformationMessage('Cannot find a robot file to debug').then(_ => {
                return undefined;
            });
        }

        // Get configuration settings
        const robotConfig = vscode.workspace.getConfiguration('robotframework');
        const pythonExecutable = robotConfig.get<string>('python.executable', 'python');

        // Apply defaults
        config.python = config.python || pythonExecutable;
        config.cwd = config.cwd || (folder ? folder.uri.fsPath : undefined);
        config.arguments = config.arguments || [];
        config.env = config.env || {};
        config.stopOnEntry = config.stopOnEntry !== undefined ? config.stopOnEntry : false;

        return config;
    }

    resolveDebugConfigurationWithSubstitutedVariables(
        _folder: vscode.WorkspaceFolder | undefined,
        config: vscode.DebugConfiguration,
        _token?: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DebugConfiguration> {
        return config;
    }
}
