import * as vscode from 'vscode';
import { generateDtsContent } from './dtsGenerator';

/** Ensure jsconfig.json exists at workspace root with checkJs enabled. */
async function ensureJsConfig(workspaceFolder: vscode.Uri): Promise<void> {
    const jsconfigUri = vscode.Uri.parse(workspaceFolder.toString() + '/jsconfig.json');

    let existing: any = {};
    try {
        const raw = await vscode.workspace.fs.readFile(jsconfigUri);
        existing = JSON.parse(Buffer.from(raw).toString('utf-8'));
    } catch {
        // File doesn't exist — we'll create it
    }

    if (!existing.compilerOptions) existing.compilerOptions = {};
    if (existing.compilerOptions.checkJs !== true) {
        existing.compilerOptions.checkJs = true;
    }
    if (!existing.compilerOptions.target) {
        existing.compilerOptions.target = 'ES2022';
    }

    // Remove @types/node — DeekeScript runs on Android Rhino, not Node.js.
    // @types/node (>=22) ships web-globals shims (Storage, WebSocket, etc.)
    // whose constructor-type declarations conflict with DeekeScript globals.
    if (existing.compilerOptions.types) {
        const filtered = existing.compilerOptions.types.filter((t: string) => t !== 'node');
        if (filtered.length === 0) {
            delete existing.compilerOptions.types;
        } else {
            existing.compilerOptions.types = filtered;
        }
    }

    // Remove @deekeScript references — the generated deekeScript.d.ts already
    // consolidates all DeekeScript type declarations. Including the source .d.ts
    // files is redundant and can cause name-mismatch conflicts (e.g. Storage.d.ts
    // declares `var Storage: storage` while deekeScript.d.ts declares `var Storage: Storage`).
    if (existing.include) {
        existing.include = existing.include.filter((p: string) => !p.includes('@deekeScript'));
    }

    // Ensure lib excludes "dom" — browser DOM types declare their own Storage
    // constructor, which would conflict with the DeekeScript Storage global.
    if (!existing.compilerOptions.lib) {
        existing.compilerOptions.lib = ['es2022'];
    } else if (existing.compilerOptions.lib.includes('dom')) {
        existing.compilerOptions.lib = existing.compilerOptions.lib.filter((l: string) => l !== 'dom');
    }

    // Include .vscode/ so TypeScript picks up the generated deekeScript.d.ts
    if (!existing.include) {
        existing.include = ['.vscode/*.d.ts', '**/*.js'];
    } else {
        const hasVscodeDts = existing.include.some((p: string) => p.includes('.vscode'));
        if (!hasVscodeDts) {
            existing.include.push('.vscode/*.d.ts');
        }
    }

    const content = JSON.stringify(existing, null, 4);
    await vscode.workspace.fs.writeFile(jsconfigUri, Buffer.from(content, 'utf-8'));
}

/**
 * Set up workspace-level type checking for a DeekeScript project.
 * Writes deekeScript.d.ts (global API declarations) and jsconfig.json (checkJs enabled).
 * Skips if the workspace is not a DeekeScript project.
 */
export async function setupWorkspaceTypeChecking(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) return;

    for (const folder of folders) {
        // Only set up if this workspace is a DeekeScript project
        const deekeJsonUri = vscode.Uri.parse(folder.uri.toString() + '/deekeScript.json');
        try {
            await vscode.workspace.fs.stat(deekeJsonUri);
        } catch {
            continue;
        }

        // Write type declarations to .vscode/ (hidden IDE config dir, not project source)
        const vscodeDir = vscode.Uri.parse(folder.uri.toString() + '/.vscode');
        const dtsUri = vscode.Uri.parse(vscodeDir.toString() + '/deekeScript.d.ts');
        const dtsContent = generateDtsContent();
        try {
            await vscode.workspace.fs.createDirectory(vscodeDir);
        } catch {
            // Directory already exists
        }
        await vscode.workspace.fs.writeFile(dtsUri, Buffer.from(dtsContent, 'utf-8'));

        // Clean up old file from workspace root (previously written there)
        const oldDtsUri = vscode.Uri.parse(folder.uri.toString() + '/deekeScript.d.ts');
        try {
            await vscode.workspace.fs.delete(oldDtsUri);
        } catch {
            // Old file doesn't exist — fine
        }

        // Ensure jsconfig.json exists with checkJs enabled
        await ensureJsConfig(folder.uri);
    }
}
