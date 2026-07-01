import * as vscode from 'vscode';

const projectCache = new Map<string, boolean>();

export async function isDeekeScriptProject(document: vscode.TextDocument): Promise<boolean> {
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!folder) return false;
    const key = folder.uri.toString();
    if (!projectCache.has(key)) {
        try {
            const deekeJsonUri = vscode.Uri.parse(folder.uri.toString() + '/deekeScript.json');
            await vscode.workspace.fs.stat(deekeJsonUri);
            projectCache.set(key, true);
        } catch {
            projectCache.set(key, false);
        }
    }
    return projectCache.get(key)!;
}

vscode.workspace.onDidChangeWorkspaceFolders(() => projectCache.clear());
