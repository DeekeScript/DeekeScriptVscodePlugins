import * as vscode from 'vscode';

const projectCache = new Map<string, boolean>();

export function clearDeekeScriptProjectCache(): void {
    projectCache.clear();
}

export async function isDeekeScriptWorkspaceFolder(folder: vscode.WorkspaceFolder): Promise<boolean> {
    const key = folder.uri.toString();
    if (!projectCache.has(key)) {
        try {
            await vscode.workspace.fs.stat(vscode.Uri.parse(folder.uri.toString() + '/deekeScript.json'));
            projectCache.set(key, true);
        } catch {
            projectCache.set(key, false);
        }
    }
    return projectCache.get(key)!;
}

export async function hasAnyDeekeScriptProject(): Promise<boolean> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) return false;

    for (const folder of folders) {
        if (await isDeekeScriptWorkspaceFolder(folder)) {
            return true;
        }
    }
    return false;
}

export async function isDeekeScriptProject(document: vscode.TextDocument): Promise<boolean> {
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!folder) return false;
    return isDeekeScriptWorkspaceFolder(folder);
}

vscode.workspace.onDidChangeWorkspaceFolders(() => clearDeekeScriptProjectCache());
