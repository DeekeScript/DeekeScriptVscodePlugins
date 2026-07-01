import * as vscode from 'vscode';
import { apiData, GlobalDef, MethodDef } from './apiData';
import { isDeekeScriptProject } from './utils';

/** Build a signature string like "launch(packageName: string): void" */
function buildSignature(method: MethodDef): string {
    const params = method.params.map(p => {
        let s = p.name;
        if (p.rest) s = '...' + s;
        if (p.optional) s += '?';
        s += ': ' + p.type;
        return s;
    }).join(', ');
    return `${method.name}(${params}): ${method.returns}`;
}

/** Build a snippet string like "launch(${1:packageName})" */
function buildSnippet(method: MethodDef): string {
    const parts: string[] = [];
    let i = 1;
    for (const p of method.params) {
        if (p.optional) continue;
        if (p.rest) {
            parts.push(`\${${i}:${p.name}}`);
        } else {
            parts.push(`\${${i}:${p.name}}`);
        }
        i++;
    }
    return `${method.name}(${parts.join(', ')})`;
}

/** Convert JSDoc text to MarkdownString for display */
function buildDocumentation(def: GlobalDef): vscode.MarkdownString;
function buildDocumentation(method: MethodDef, globalName: string): vscode.MarkdownString;
function buildDocumentation(arg: GlobalDef | MethodDef, globalName?: string): vscode.MarkdownString {
    const md = new vscode.MarkdownString();

    if (globalName !== undefined) {
        // Method documentation
        const method = arg as MethodDef;
        const sig = buildSignature(method);
        md.appendCodeblock(`${globalName}.${sig}`, 'typescript');
        if (method.description) {
            // Clean JSDoc tags from description for display
            const cleanDesc = method.description
                .replace(/@param\s+\w+\s+.+/g, '')
                .replace(/@returns?\s+.+/g, '')
                .replace(/@\w+\s*.+/g, '')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
            if (cleanDesc) {
                md.appendMarkdown(cleanDesc);
            }
        }
        // Show params
        if (method.params.length > 0) {
            md.appendMarkdown('\n\n**参数:**');
            for (const p of method.params) {
                const opt = p.optional ? ' (可选)' : '';
                md.appendMarkdown(`\n- \`${p.name}: ${p.type}\`${opt}`);
            }
        }
        // Show returns
        if (method.returns && method.returns !== 'void') {
            md.appendMarkdown(`\n\n**返回:** \`${method.returns}\``);
        }
    } else {
        // Global object documentation
        const def = arg as GlobalDef;
        const kindLabel = def.kind === 'class' ? '类' : def.kind === 'function' ? '函数' : '对象';
        md.appendMarkdown(`**DeekeScript ${kindLabel}**`);
        if (def.description) {
            md.appendMarkdown('\n\n' + def.description);
        }
    }

    return md;
}

export const completionProvider: vscode.CompletionItemProvider = {
    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): Promise<vscode.CompletionList | undefined> {
        if (!await isDeekeScriptProject(document)) return undefined;

        const lineText = document.lineAt(position.line).text;
        const textBeforeCursor = lineText.slice(0, position.character);

        // Check if we're in a member access context (triggered by '.')
        const dotMatch = resolveDotContext(textBeforeCursor);
        if (dotMatch) {
            return new vscode.CompletionList(provideMemberCompletions(dotMatch), false);
        }

        // For global scope completions, only trigger on manual invoke or after certain patterns
        // Don't auto-trigger on every keystroke to avoid cluttering VS Code's built-in suggestions
        if (context.triggerKind === vscode.CompletionTriggerKind.Invoke ||
            context.triggerKind === vscode.CompletionTriggerKind.TriggerForIncompleteCompletions) {
            return new vscode.CompletionList(provideGlobalCompletions(), false);
        }

        // Also provide completions at the start of an expression (after newline, semicolon, etc.)
        // This catches cases like typing a new variable assignment
        const exprStartMatch = textBeforeCursor.match(/(?:^|[;{(\s])(\w*)$/);
        if (exprStartMatch) {
            return new vscode.CompletionList(provideGlobalCompletions(exprStartMatch[1]), false);
        }

        return undefined;
    }
};

function provideGlobalCompletions(filter?: string): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];
    const filterLower = filter ? filter.toLowerCase() : '';

    for (const [name, def] of Object.entries(apiData)) {
        if (filterLower && !name.toLowerCase().startsWith(filterLower)) continue;

        const item = new vscode.CompletionItem(name);
        (item as any).label = { label: name, description: 'DeekeScript' };
        item.documentation = buildDocumentation(def);

        switch (def.kind) {
            case 'class':
                item.kind = vscode.CompletionItemKind.Class;
                item.detail = '类';
                if (def.constructorParams.length > 0) {
                    item.insertText = new vscode.SnippetString(`${name}(${def.constructorParams.map((p, i) => `\${${i + 1}:${p.name}}`).join(', ')})`);
                }
                break;
            case 'function':
                item.kind = vscode.CompletionItemKind.Function;
                item.detail = `(${def.funcParams.map(p => `${p.name}: ${p.type}`).join(', ')}): ${def.funcReturns}`;
                if (def.funcParams.length > 0) {
                    item.insertText = new vscode.SnippetString(`${name}(${def.funcParams.map((p, i) => `\${${i + 1}:${p.name}}`).join(', ')})`);
                }
                break;
            default:
                item.kind = vscode.CompletionItemKind.Variable;
                item.detail = `${def.methods.length} 个方法`;
                break;
        }

        // Sort by kind then name; '!' prefix ensures our items appear before any built-in suggestions
        const kindOrder = { 'class': 0, 'function': 1, 'object': 2 };
        item.sortText = `!${kindOrder[def.kind]}${name}`;

        items.push(item);
    }

    return items;
}

/**
 * Resolve the target type name from the context before a '.'.
 * Handles:
 *   "Word."              → returns "Word" (direct member access)
 *   "Word()."            → returns funcReturns of Word (function call)
 *   "obj.method()."      → returns method.returns (method call chain)
 *   "UiSelector().className('name')." → recursive chain resolution
 */
export function resolveDotContext(textBefore: string): string | null {
    if (!textBefore.endsWith('.')) return null;

    const beforeDot = textBefore.slice(0, -1).trimEnd();

    // Case 1: direct member access — Word.
    const directMatch = beforeDot.match(/(\w+)$/);
    if (directMatch) {
        return directMatch[1];
    }

    // Case 2: function/method call — ...().
    if (beforeDot.endsWith(')')) {
        // Find the matching opening paren
        let depth = 0;
        let parenStart = -1;
        for (let i = beforeDot.length - 1; i >= 0; i--) {
            if (beforeDot[i] === ')') depth++;
            else if (beforeDot[i] === '(') {
                depth--;
                if (depth === 0) { parenStart = i; break; }
            }
        }
        if (parenStart > 0) {
            // Find the function/method name before '('
            const beforeParen = beforeDot.slice(0, parenStart).trimEnd();
            const funcMatch = beforeParen.match(/(\w+)$/);
            if (funcMatch) {
                const funcName = funcMatch[1];
                // Check if there's a '.' before the name → method call on an object
                const beforeName = beforeParen.slice(0, beforeParen.length - funcName.length).trimEnd();
                if (beforeName.endsWith('.')) {
                    // Method call chain: resolve parent object type, then look up method return type
                    const parentType = resolveDotContext(beforeName);
                    if (parentType) {
                        const parentDef = apiData[parentType];
                        if (parentDef) {
                            const method = parentDef.methods.find(m => m.name === funcName);
                            if (method && method.returns && method.returns !== 'void') {
                                return method.returns;
                            }
                        }
                    }
                    return null;
                }

                // Top-level function call (no dot before name)
                const funcDef = apiData[funcName];
                if (funcDef && funcDef.kind === 'function' && funcDef.funcReturns) {
                    return funcDef.funcReturns;
                }
                if (funcDef && funcDef.kind === 'class' && funcDef.funcReturns) {
                    return funcDef.funcReturns;
                }
                if (funcDef && funcDef.kind === 'class') {
                    return funcName;
                }
            }
        }
    }

    return null;
}

function provideMemberCompletions(objectName: string): vscode.CompletionItem[] | undefined {
    const def = apiData[objectName];
    if (!def) return undefined;

    const items: vscode.CompletionItem[] = [];

    // Add method completions
    for (const method of def.methods) {
        const item = new vscode.CompletionItem(method.name, vscode.CompletionItemKind.Method);
        (item as any).label = { label: method.name, description: 'DeekeScript' };
        item.detail = buildSignature(method);
        item.documentation = buildDocumentation(method, objectName);
        item.insertText = new vscode.SnippetString(buildSnippet(method));
        item.sortText = '!0' + method.name; // methods before properties, before built-in suggestions

        items.push(item);
    }

    // Add property completions
    for (const prop of def.properties) {
        const item = new vscode.CompletionItem(prop.name, vscode.CompletionItemKind.Property);
        (item as any).label = { label: prop.name, description: 'DeekeScript' };
        item.detail = `: ${prop.type}`;
        if (prop.description) {
            item.documentation = new vscode.MarkdownString(prop.description);
        }
        item.sortText = '!1' + prop.name; // properties after methods, before built-in suggestions

        items.push(item);
    }

    return items;
}
