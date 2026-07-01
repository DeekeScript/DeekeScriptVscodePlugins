import * as vscode from 'vscode';
import { completionProvider } from './completionProvider';
import { hoverProvider } from './hoverProvider';
import { signatureHelpProvider } from './signatureHelpProvider';

export function activateLanguageFeatures(context: vscode.ExtensionContext): void {
    const jsSelector: vscode.DocumentSelector = { language: 'javascript' };

    // Disable VS Code's built-in word-based suggestions for JavaScript files.
    // In DeekeScript workspaces, word suggestions are noise (irrelevant English
    // words from the file) and only distract from the real API completions.
    const config = vscode.workspace.getConfiguration();
    const jsKey = '[javascript]';
    const currentOverride = config.get<Record<string, unknown>>(jsKey) || {};
    if (currentOverride['editor.wordBasedSuggestions'] !== 'off') {
        const merged = { ...currentOverride, 'editor.wordBasedSuggestions': 'off' };
        config.update(jsKey, merged, vscode.ConfigurationTarget.Workspace);
    }

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(jsSelector, completionProvider, '.'),
        vscode.languages.registerHoverProvider(jsSelector, hoverProvider),
        vscode.languages.registerSignatureHelpProvider(jsSelector, signatureHelpProvider, '(', ',')
    );
}
