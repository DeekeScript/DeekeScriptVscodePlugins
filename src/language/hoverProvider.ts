import * as vscode from 'vscode';
import { apiData, MethodDef, GlobalDef } from './apiData';
import { isDeekeScriptProject } from './utils';

function buildSignature(method: MethodDef, name: string): string {
    const params = method.params.map(p => {
        let s = p.name;
        if (p.rest) s = '...' + s;
        s += ': ' + p.type;
        if (p.optional) s += '?';
        return s;
    }).join(', ');
    return `${name}.${method.name}(${params}): ${method.returns}`;
}

function buildMethodHover(method: MethodDef, globalName: string): vscode.MarkdownString {
    const md = new vscode.MarkdownString();

    const sig = buildSignature(method, globalName);
    md.appendCodeblock(sig, 'typescript');

    if (method.description) {
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

    if (method.params.length > 0) {
        md.appendMarkdown('\n\n**参数:**');
        for (const p of method.params) {
            const opt = p.optional ? ' (可选)' : '';
            md.appendMarkdown(`\n- \`${p.name}: ${p.type}\`${opt}`);
        }
    }

    if (method.returns && method.returns !== 'void') {
        md.appendMarkdown(`\n\n**返回:** \`${method.returns}\``);
    }

    return md;
}

function buildGlobalHover(def: GlobalDef, name: string): vscode.MarkdownString {
    const md = new vscode.MarkdownString();

    let kindLabel: string;
    switch (def.kind) {
        case 'class': kindLabel = '类'; break;
        case 'function': kindLabel = '函数'; break;
        default: kindLabel = '对象'; break;
    }
    md.appendMarkdown(`**DeekeScript ${kindLabel}** \`${name}\``);

    if (def.description) {
        md.appendMarkdown('\n\n' + def.description);
    }

    if (def.kind === 'function' && def.funcParams.length > 0) {
        const sig = `${name}(${def.funcParams.map(p => `${p.name}: ${p.type}`).join(', ')}): ${def.funcReturns}`;
        md.appendCodeblock(sig, 'typescript');
    }

    const count = def.methods.length;
    if (count > 0) {
        md.appendMarkdown(`\n\n${count} 个方法`);
    }

    return md;
}

export const hoverProvider: vscode.HoverProvider = {
    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): Promise<vscode.Hover | undefined> {
        if (!await isDeekeScriptProject(document)) return undefined;

        // Get the word under cursor
        const wordRange = document.getWordRangeAtPosition(position, /[\w$]+/);
        if (!wordRange) return undefined;
        const word = document.getText(wordRange);

        // Check if word is preceded by a '.' (member access)
        const lineText = document.lineAt(position.line).text;
        const textBeforeWord = lineText.slice(0, wordRange.start.character);
        const dotMatch = textBeforeWord.match(/(\w+)\.\s*$/);

        if (dotMatch) {
            // Member access hover: X.methodName
            const objectName = dotMatch[1];
            const def = apiData[objectName];
            if (!def) return undefined;

            const method = def.methods.find(m => m.name === word);
            if (method) {
                const content = buildMethodHover(method, objectName);
                return new vscode.Hover(content, wordRange);
            }

            const prop = def.properties.find(p => p.name === word);
            if (prop) {
                const md = new vscode.MarkdownString();
                md.appendCodeblock(`${objectName}.${prop.name}: ${prop.type}`, 'typescript');
                if (prop.description) {
                    md.appendMarkdown(prop.description);
                }
                return new vscode.Hover(md, wordRange);
            }

            return undefined;
        }

        // Check if it's a global API name
        const def = apiData[word];
        if (def) {
            const content = buildGlobalHover(def, word);
            return new vscode.Hover(content, wordRange);
        }

        return undefined;
    }
};
