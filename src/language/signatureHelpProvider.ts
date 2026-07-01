import * as vscode from 'vscode';
import { apiData, MethodDef } from './apiData';
import { isDeekeScriptProject } from './utils';
import { resolveDotContext } from './completionProvider';

function buildSignatureInfo(method: MethodDef, objectName: string, methodName: string): vscode.SignatureInformation {
    const params = method.params.map(p => {
        let s = p.name;
        if (p.rest) s = '...' + s;
        s += ': ' + p.type;
        if (p.optional) s += '?';
        return s;
    }).join(', ');

    const label = `${objectName}.${methodName}(${params}): ${method.returns}`;
    const si = new vscode.SignatureInformation(label);

    if (method.description) {
        const cleanDesc = method.description
            .replace(/@param\s+\w+\s+.+/g, '')
            .replace(/@returns?\s+.+/g, '')
            .replace(/@\w+\s*.+/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        if (cleanDesc) {
            const firstLine = cleanDesc.split('\n')[0].trim();
            if (firstLine) {
                si.documentation = new vscode.MarkdownString(firstLine);
            }
        }
    }

    // Build parameter labels
    const prefixLen = `${objectName}.${methodName}(`.length;
    si.parameters = method.params.map((p, i) => {
        let text = p.name;
        if (p.rest) text = '...' + text;
        text += ': ' + p.type;
        if (p.optional) text += '?';

        // Calculate the offset of this param within the full label
        let offset = prefixLen;
        for (let j = 0; j < i; j++) {
            let pj = method.params[j];
            let pt = pj.name;
            if (pj.rest) pt = '...' + pt;
            pt += ': ' + pj.type;
            if (pj.optional) pt += '?';
            offset += pt.length + 2; // +2 for ', '
        }
        return new vscode.ParameterInformation([offset, offset + text.length]);
    });

    return si;
}

export const signatureHelpProvider: vscode.SignatureHelpProvider = {
    async provideSignatureHelp(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        _context: vscode.SignatureHelpContext
    ): Promise<vscode.SignatureHelp | undefined> {
        if (!await isDeekeScriptProject(document)) return undefined;

        const lineText = document.lineAt(position.line).text;
        const textBeforeCursor = lineText.slice(0, position.character);

        // Resolve the call target: handles Func(, new Cls(, obj.method(, and chain calls
        const target = resolveCallTarget(textBeforeCursor);
        if (!target) return undefined;

        const { objectType, methodName, isNew } = target;

        // Global function or constructor (no objectType)
        if (!objectType) {
            const def = apiData[methodName];
            if (!def) return undefined;

            const help = new vscode.SignatureHelp();

            if (def.kind === 'function') {
                const params = def.funcParams.map(p => {
                    let s = p.name;
                    if (p.rest) s = '...' + s;
                    s += ': ' + p.type;
                    if (p.optional) s += '?';
                    return s;
                }).join(', ');
                const label = `${methodName}(${params}): ${def.funcReturns}`;
                const si = new vscode.SignatureInformation(label);
                const prefixLen = `${methodName}(`.length;
                si.parameters = def.funcParams.map((p, i) => {
                    let text = p.name + ': ' + p.type;
                    let offset = prefixLen;
                    for (let j = 0; j < i; j++) {
                        let pt = def.funcParams[j].name + ': ' + def.funcParams[j].type;
                        offset += pt.length + 2;
                    }
                    return new vscode.ParameterInformation([offset, offset + text.length]);
                });
                help.signatures = [si];
                help.activeParameter = countCommas(textBeforeCursor);
                return help;
            }

            if (def.kind === 'class' && isNew) {
                const ctorParams = def.constructorParams;
                if (ctorParams.length === 0) return undefined;

                const params = ctorParams.map(p => `${p.name}: ${p.type}`).join(', ');
                const label = `new ${methodName}(${params})`;
                const si = new vscode.SignatureInformation(label);
                const prefixLen = `new ${methodName}(`.length;
                si.parameters = ctorParams.map((p, i) => {
                    let text = p.name + ': ' + p.type;
                    let offset = prefixLen;
                    for (let j = 0; j < i; j++) {
                        let pt = ctorParams[j].name + ': ' + ctorParams[j].type;
                        offset += pt.length + 2;
                    }
                    return new vscode.ParameterInformation([offset, offset + text.length]);
                });
                help.signatures = [si];
                help.activeParameter = countCommas(textBeforeCursor);
                return help;
            }

            return undefined;
        }

        // Method call on an object/class type
        const def = apiData[objectType];
        if (!def) return undefined;

        const method = def.methods.find(m => m.name === methodName);
        if (!method) return undefined;

        const help = new vscode.SignatureHelp();
        help.signatures = [buildSignatureInfo(method, objectType, methodName)];
        help.activeSignature = 0;
        help.activeParameter = Math.min(
            countCommas(textBeforeCursor),
            method.params.length - 1
        );

        return help;
    }
};

/**
 * Resolve the target of a call expression ending with '('.
 * Handles: Func(, new Cls(, obj.method(, Func().method(, chain().a().b(
 */
function resolveCallTarget(textBefore: string): { objectType: string | null, methodName: string, isNew: boolean } | null {
    if (!textBefore.endsWith('(')) return null;

    // Find the word before the last '('
    const beforeParen = textBefore.slice(0, -1).trimEnd();
    const wordMatch = beforeParen.match(/(\w+)$/);
    if (!wordMatch) return null;
    const methodName = wordMatch[1];

    // Check for 'new ' before the name
    const beforeWord = beforeParen.slice(0, beforeParen.length - methodName.length).trimEnd();
    const isNew = beforeWord.endsWith('new');

    // Check if preceded by '.' → method call on some expression
    // Strip 'new ' first for accurate dot detection
    const beforeNameText = isNew ? beforeWord.slice(0, -3).trimEnd() : beforeWord;
    if (beforeNameText.endsWith('.')) {
        // Resolve the type before the dot
        const objectType = resolveDotContext(beforeNameText);
        if (objectType) {
            return { objectType, methodName, isNew: false };
        }
        return null;
    }

    // Global call (function or constructor)
    return { objectType: null, methodName, isNew };
}

function countCommas(text: string): number {
    // Count commas inside the current parenthesis level
    let depth = 0;
    let count = 0;
    for (let i = text.length - 1; i >= 0; i--) {
        const ch = text[i];
        if (ch === ')') depth++;
        else if (ch === '(') {
            depth--;
            if (depth < 0) break;
        } else if (ch === ',' && depth === 0) {
            count++;
        }
    }
    return count;
}
