import * as vscode from 'vscode';
import { setupWorkspaceTypeChecking } from './workspaceSetup';
import { clearDeekeScriptProjectCache, hasAnyDeekeScriptProject } from './utils';
import { registerRequirePathCompletion } from './requireCompletion';

async function applyDeekeScriptEditorSettings(): Promise<void> {
    const config = vscode.workspace.getConfiguration();
    const jsKey = '[javascript]';
    const currentOverride = config.get<Record<string, unknown>>(jsKey) || {};
    if (currentOverride['editor.wordBasedSuggestions'] !== 'off') {
        const merged = {
            ...currentOverride,
            'editor.wordBasedSuggestions': 'off',
        };
        await config.update(jsKey, merged, vscode.ConfigurationTarget.Workspace);
    }
}

async function setupDeekeScriptLanguageSupport(): Promise<void> {
    if (!await hasAnyDeekeScriptProject()) {
        return;
    }

    await applyDeekeScriptEditorSettings();
    await setupWorkspaceTypeChecking();
}

export function activateLanguageFeatures(context: vscode.ExtensionContext): void {
    registerRequirePathCompletion(context);
    void setupDeekeScriptLanguageSupport();

    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            clearDeekeScriptProjectCache();
            void setupDeekeScriptLanguageSupport();
        })
    );

    const deekeJsonWatcher = vscode.workspace.createFileSystemWatcher('**/deekeScript.json');
    deekeJsonWatcher.onDidCreate(() => {
        clearDeekeScriptProjectCache();
        void setupDeekeScriptLanguageSupport();
    });
    deekeJsonWatcher.onDidDelete(() => clearDeekeScriptProjectCache());
    context.subscriptions.push(deekeJsonWatcher);
}
