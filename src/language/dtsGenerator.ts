import { apiData, GlobalDef, MethodDef, ParamDef, PropertyDef } from './apiData';

/** Pro 版 API 文档根地址 */
const DOC_BASE = 'https://script.deeke.cn';
const DOC_LINK_LABEL = 'DeekeScript Pro 文档';

function buildDocUrl(globalName: string): string {
    const slug = globalName.charAt(0).toLowerCase() + globalName.slice(1);
    return `${DOC_BASE}/base/${slug}/${slug}.html`;
}

/** VitePress 锚点：## launch(packageName) → #launch-packagename */
function buildMethodAnchor(method: MethodDef): string {
    if (method.params.length === 0) {
        return method.name.toLowerCase();
    }
    return `${method.name.toLowerCase()}-${method.params.map(p => p.name.toLowerCase()).join('-')}`;
}

function buildMethodDocUrl(globalName: string, method: MethodDef): string {
    return `${buildDocUrl(globalName)}#${buildMethodAnchor(method)}`;
}

function buildDtsParamSig(p: ParamDef): string {
    let s = p.name;
    if (p.rest) s = '...' + s;
    if (p.optional) s += '?';
    s += ': ' + p.type;
    return s;
}

function buildDtsMethodSig(m: MethodDef): string {
    const params = m.params.map(buildDtsParamSig).join(', ');
    return `${m.name}(${params}): ${m.returns}`;
}

function buildDtsFuncSig(name: string, params: ParamDef[], returns: string): string {
    const fp = params.map(buildDtsParamSig).join(', ');
    return `${name}(${fp}): ${returns}`;
}

interface ParsedDescription {
    summary: string;
    paramDocs: Map<string, string>;
    returnDoc?: string | undefined;
}

/** Parse apiData description text into summary, @param and @returns parts. */
function parseDescription(description: string): ParsedDescription {
    const cleaned = description
        .replace(/\/\*\*[\s\S]*?\*\//g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    const summaryLines: string[] = [];
    const paramDocs = new Map<string, string>();
    let returnDoc: string | undefined;

    for (const line of cleaned.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const paramMatch = trimmed.match(/^@param\s+(\w+)\s+(.+)$/);
        const returnMatch = trimmed.match(/^@returns?\s+(.+)$/);
        if (paramMatch) {
            paramDocs.set(paramMatch[1], paramMatch[2].trim());
        } else if (returnMatch) {
            returnDoc = returnMatch[1].trim();
        } else if (!trimmed.startsWith('@')) {
            summaryLines.push(trimmed);
        }
    }

    return {
        summary: summaryLines.join('\n'),
        paramDocs,
        returnDoc,
    };
}

function appendJSDocLines(lines: string[], docLines: string[], indent: string): void {
    lines.push(`${indent}/**`);
    for (const docLine of docLines) {
        lines.push(`${indent} * ${docLine}`);
    }
    lines.push(`${indent} */`);
}

function buildJSDocLines(parts: string[]): string[] {
    return parts.filter(Boolean);
}

function buildMethodJSDoc(globalName: string, method: MethodDef): string[] {
    const parsed = parseDescription(method.description);
    const docLines: string[] = [];

    if (parsed.summary) {
        docLines.push(...parsed.summary.split('\n'));
    }

    for (const p of method.params) {
        const desc = parsed.paramDocs.get(p.name);
        const optional = p.optional ? '（可选）' : '';
        const rest = p.rest ? '（剩余参数）' : '';
        const detail = desc || p.name;
        docLines.push(`@param {${p.type}} ${p.name} ${detail}${optional}${rest}`);
    }

    if (method.returns && method.returns !== 'void') {
        const retDesc = parsed.returnDoc || method.returns;
        docLines.push(`@returns {${method.returns}} ${retDesc}`);
    } else if (method.returns === 'void' && parsed.returnDoc) {
        docLines.push(`@returns {void} ${parsed.returnDoc}`);
    }

    docLines.push(`@see {@link ${buildMethodDocUrl(globalName, method)} ${DOC_LINK_LABEL}}`);

    return buildJSDocLines(docLines);
}

function buildPropertyJSDoc(globalName: string, prop: PropertyDef): string[] {
    const docLines: string[] = [];
    if (prop.description) {
        docLines.push(...prop.description.split('\n').map(l => l.trim()).filter(Boolean));
    } else {
        docLines.push(prop.name);
    }
    docLines.push(`@see {@link ${buildDocUrl(globalName)} ${DOC_LINK_LABEL}}`);
    return buildJSDocLines(docLines);
}

function buildGlobalJSDoc(def: GlobalDef, globalName: string): string[] {
    const docLines: string[] = [];
    if (def.description) {
        docLines.push(...def.description.split('\n').map(l => l.trim()).filter(Boolean));
    }
    docLines.push(`@see {@link ${buildDocUrl(globalName)} ${DOC_LINK_LABEL}}`);
    return buildJSDocLines(docLines);
}

function buildFunctionJSDoc(def: GlobalDef, name: string): string[] {
    const parsed = parseDescription(def.description);
    const docLines: string[] = [];

    if (parsed.summary) {
        docLines.push(...parsed.summary.split('\n'));
    }

    for (const p of def.funcParams) {
        const desc = parsed.paramDocs.get(p.name);
        const optional = p.optional ? '（可选）' : '';
        const rest = p.rest ? '（剩余参数）' : '';
        const detail = desc || p.name;
        docLines.push(`@param {${p.type}} ${p.name} ${detail}${optional}${rest}`);
    }

    if (def.funcReturns && def.funcReturns !== 'void') {
        const retDesc = parsed.returnDoc || def.funcReturns;
        docLines.push(`@returns {${def.funcReturns}} ${retDesc}`);
    }

    docLines.push(`@see {@link ${buildDocUrl(name)} ${DOC_LINK_LABEL}}`);
    return buildJSDocLines(docLines);
}

function buildConstructorJSDoc(def: GlobalDef, className: string): string[] {
    const docLines: string[] = [`创建 ${className} 实例`];
    for (const p of def.constructorParams) {
        docLines.push(`@param {${p.type}} ${p.name} ${p.name}`);
    }
    docLines.push(`@see {@link ${buildDocUrl(className)} ${DOC_LINK_LABEL}}`);
    return buildJSDocLines(docLines);
}

function writeMethod(lines: string[], globalName: string, method: MethodDef, indent: string): void {
    appendJSDocLines(lines, buildMethodJSDoc(globalName, method), indent);
    lines.push(`${indent}${buildDtsMethodSig(method)};`);
}

function writeProperty(lines: string[], globalName: string, prop: PropertyDef, indent: string): void {
    appendJSDocLines(lines, buildPropertyJSDoc(globalName, prop), indent);
    lines.push(`${indent}${prop.name}: ${prop.type};`);
}

/** Generate a .d.ts file content from apiData so VS Code's TypeScript checker knows about DeekeScript globals. */
export function generateDtsContent(): string {
    const lines: string[] = [
        '// Auto-generated by DeekeScript extension — DO NOT EDIT',
        '// Enables VS Code JavaScript type checking for DeekeScript projects.',
        '// API documentation: https://script.deeke.cn',
        '',
    ];
    const declared = new Set<string>();

    for (const [name, def] of Object.entries(apiData)) {
        if (declared.has(name)) continue;
        declared.add(name);

        switch (def.kind) {
            case 'object':
                appendJSDocLines(lines, buildGlobalJSDoc(def, name), '');
                lines.push(`interface ${name} {`);
                for (const m of def.methods) {
                    writeMethod(lines, name, m, '    ');
                }
                for (const p of def.properties) {
                    writeProperty(lines, name, p, '    ');
                }
                lines.push('}');
                if (!def.typeOnly) {
                    lines.push(`declare var ${name}: ${name};`);
                }
                lines.push('');
                break;

            case 'class':
                if (def.funcParams.length > 0) {
                    appendJSDocLines(lines, buildFunctionJSDoc(def, name), '');
                    lines.push(`declare function ${name}(${def.funcParams.map(buildDtsParamSig).join(', ')}): ${def.funcReturns};`);
                    appendJSDocLines(lines, buildGlobalJSDoc(def, name), '');
                    lines.push(`interface ${name} {`);
                    for (const m of def.methods) {
                        writeMethod(lines, name, m, '    ');
                    }
                    for (const p of def.properties) {
                        writeProperty(lines, name, p, '    ');
                    }
                    lines.push('}');
                } else {
                    appendJSDocLines(lines, buildGlobalJSDoc(def, name), '');
                    lines.push(`declare class ${name} {`);
                    if (def.constructorParams.length > 0) {
                        appendJSDocLines(lines, buildConstructorJSDoc(def, name), '    ');
                        const cp = def.constructorParams.map(p => `${p.name}: ${p.type}`).join(', ');
                        lines.push(`    constructor(${cp});`);
                    }
                    for (const m of def.methods) {
                        writeMethod(lines, name, m, '    ');
                    }
                    for (const p of def.properties) {
                        writeProperty(lines, name, p, '    ');
                    }
                    lines.push('}');
                }
                lines.push('');
                break;

            case 'function': {
                appendJSDocLines(lines, buildFunctionJSDoc(def, name), '');
                lines.push(`declare function ${buildDtsFuncSig(name, def.funcParams, def.funcReturns)};`);

                const returnType = def.funcReturns;
                if (def.methods.length > 0 && returnType && returnType !== 'void' && !declared.has(returnType)) {
                    declared.add(returnType);
                    appendJSDocLines(lines, [`${returnType} 类型`, `@see {@link ${buildDocUrl(name)} ${DOC_LINK_LABEL}}`], '');
                    lines.push(`interface ${returnType} {`);
                    for (const m of def.methods) {
                        writeMethod(lines, returnType, m, '    ');
                    }
                    for (const p of def.properties) {
                        writeProperty(lines, returnType, p, '    ');
                    }
                    lines.push('}');
                }
                lines.push('');
                break;
            }
        }
    }

    return lines.join('\n');
}
