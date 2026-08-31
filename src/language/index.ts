import * as vscode from 'vscode';
import { setupWorkspaceTypeChecking } from './workspaceSetup';

export function activateLanguageFeatures(context: vscode.ExtensionContext): void {
    // Disable word-based suggestions — they add noise in DeekeScript workspaces.
    // API completions, hover, signature help and diagnostics come from the
    // generated .vscode/deekeScript.d.ts via the TypeScript language service.
    const config = vscode.workspace.getConfiguration();
    const jsKey = '[javascript]';
    const currentOverride = config.get<Record<string, unknown>>(jsKey) || {};
    if (currentOverride['editor.wordBasedSuggestions'] !== 'off') {
        const merged = {
            ...currentOverride,
            'editor.wordBasedSuggestions': 'off',
        };
        config.update(jsKey, merged, vscode.ConfigurationTarget.Workspace);
    }

    setupWorkspaceTypeChecking();
    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(() => setupWorkspaceTypeChecking())
    );
}
