import * as path from 'path';
import * as vscode from 'vscode';
import { isDeekeScriptProject } from './utils';

const SKIP_DIRS = new Set([
    'node_modules',
    '.git',
    '.vscode',
    '.idea',
    'dist',
    '_book',
    '.deeke',
]);

/** 匹配 require('...') / require("...") 内光标位置 */
function getRequirePathContext(
    document: vscode.TextDocument,
    position: vscode.Position
): { prefix: string; quote: string } | null {
    const line = document.lineAt(position.line).text;
    const before = line.slice(0, position.character);
    const match = before.match(/require\s*\(\s*(['"])([^'"]*)$/);
    if (!match) {
        return null;
    }
    return { quote: match[1], prefix: match[2] };
}

function resolveBaseDir(
    folder: vscode.WorkspaceFolder,
    document: vscode.TextDocument,
    prefix: string
): { baseFsPath: string; insertPrefix: string } {
    const normalized = prefix.replace(/\\/g, '/');
    const lastSlash = normalized.lastIndexOf('/');
    const dirPart = lastSlash >= 0 ? normalized.slice(0, lastSlash + 1) : '';
    const segments = dirPart.split('/').filter((s) => s.length > 0);

    if (normalized.startsWith('./') || normalized.startsWith('../') || normalized === '.' || normalized === '..') {
        const docDir = path.dirname(document.uri.fsPath);
        const baseFsPath = segments.length > 0 ? path.resolve(docDir, ...segments) : docDir;
        return { baseFsPath, insertPrefix: dirPart };
    }

    // 项目根相对：require('app/a.js')
    const baseFsPath = segments.length > 0
        ? path.join(folder.uri.fsPath, ...segments)
        : folder.uri.fsPath;
    return { baseFsPath, insertPrefix: dirPart };
}

function getFilter(prefix: string): string {
    const normalized = prefix.replace(/\\/g, '/');
    const lastSlash = normalized.lastIndexOf('/');
    return lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
}

async function listEntries(
    baseFsPath: string,
    insertPrefix: string,
    filter: string
): Promise<vscode.CompletionItem[]> {
    let entries: [string, vscode.FileType][];
    try {
        entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(baseFsPath));
    } catch {
        return [];
    }

    const items: vscode.CompletionItem[] = [];
    const lowerFilter = filter.toLowerCase();

    for (const [name, type] of entries) {
        if (name.startsWith('.')) {
            continue;
        }
        if (type === vscode.FileType.Directory && SKIP_DIRS.has(name)) {
            continue;
        }
        if (lowerFilter && !name.toLowerCase().startsWith(lowerFilter)) {
            continue;
        }

        if (type === vscode.FileType.Directory) {
            const item = new vscode.CompletionItem(name + '/', vscode.CompletionItemKind.Folder);
            item.insertText = insertPrefix + name + '/';
            item.filterText = insertPrefix + name;
            item.detail = '目录（项目根相对 require）';
            item.command = {
                command: 'editor.action.triggerSuggest',
                title: 'Retrigger',
            };
            items.push(item);
        } else if (type === vscode.FileType.File && name.endsWith('.js')) {
            const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.File);
            item.insertText = insertPrefix + name;
            item.filterText = insertPrefix + name;
            item.detail = '模块（相对项目根，如 require(\'app/a.js\')）';
            items.push(item);
        }
    }

    return items.sort((a, b) => String(a.label).localeCompare(String(b.label)));
}

/**
 * 在 require('...') 内提示工程 JS 路径：
 * - ./ ../ → 相对当前文件
 * - 其它 → 相对项目根（配合 jsconfig baseUrl）
 */
export function registerRequirePathCompletion(context: vscode.ExtensionContext): void {
    const provider: vscode.CompletionItemProvider = {
        async provideCompletionItems(document, position) {
            if (document.languageId !== 'javascript' && document.languageId !== 'javascriptreact') {
                return undefined;
            }
            if (!(await isDeekeScriptProject(document))) {
                return undefined;
            }

            const ctx = getRequirePathContext(document, position);
            if (!ctx) {
                return undefined;
            }

            const folder = vscode.workspace.getWorkspaceFolder(document.uri);
            if (!folder) {
                return undefined;
            }

            const resolved = resolveBaseDir(folder, document, ctx.prefix);
            const filter = getFilter(ctx.prefix);
            const items = await listEntries(resolved.baseFsPath, resolved.insertPrefix, filter);

            const line = document.lineAt(position.line).text;
            const before = line.slice(0, position.character);
            if (!before.match(/require\s*\(\s*['"]/)) {
                return items;
            }
            const pathStart = before.lastIndexOf(ctx.quote) + 1;
            const range = new vscode.Range(
                new vscode.Position(position.line, pathStart),
                position
            );
            for (const item of items) {
                item.range = range;
            }

            return items;
        },
    };

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            [{ language: 'javascript', scheme: 'file' }, { language: 'javascriptreact', scheme: 'file' }],
            provider,
            "'",
            '"',
            '/',
            '.'
        )
    );
}
