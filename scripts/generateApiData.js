/**
 * Build script: Parses .d.ts type definition files and generates
 * src/language/apiData.ts containing structured API metadata
 * for the DeekeScript VS Code extension's code completion feature.
 *
 * Usage: node scripts/generateApiData.js
 */

const fs = require('fs');
const path = require('path');

// Path to the DeekeScript project's type definitions
const TYPE_DIR = path.resolve(__dirname, '..', '..', 'DeekeScript', '@deekeScript', '@type');
const OUTPUT_FILE = path.resolve(__dirname, '..', 'src', 'language', 'apiData.ts');

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** Clean a raw JSDoc block string (the /** ... *​/ content) into plain text */
function cleanJsDoc(block) {
    if (!block || !block.trim()) return '';
    return block
        .replace(/^\/\*\*\s*/, '')
        .replace(/\s*\*\/\s*$/, '')
        .split('\n')
        .map(line => line.replace(/^\s*\*\s?/, ''))
        .join('\n')
        .trim();
}

/** Extract the last JSDoc block from text ending at a given position */
function extractJsDoc(textBefore) {
    const match = textBefore.match(/\/\*\*[\s\S]*?\*\/\s*$/);
    return match ? cleanJsDoc(match[0]) : '';
}

/** Parse @param tags from JSDoc text. Returns array of {name, desc} */
function parseParamDocs(jsdoc) {
    const params = [];
    const re = /@param\s+(\w+)\s+(.+?)(?=\n\s*(?:@\w|\*\/|$))/gs;
    let m;
    while ((m = re.exec(jsdoc)) !== null) {
        params.push({ name: m[1], desc: m[2].trim() });
    }
    return params;
}

/** Parse @return / @returns from JSDoc */
function parseReturnDoc(jsdoc) {
    const m = jsdoc.match(/@returns?\s+(.+?)(?=\n\s*(?:@\w|\*\/|$))/s);
    return m ? m[1].trim() : '';
}

/** Escape a string for use in a TypeScript single-quoted string literal */
function tsEscape(str) {
    return str
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '');
}

// ---------------------------------------------------------------------------
// Type parsing
// ---------------------------------------------------------------------------

/** Extract the parameter list from a method signature starting at the '('.
 *  Handles nested parentheses (function types) properly.
 *  Returns { paramStr, endIdx } where endIdx is the position after the closing ')' */
function extractParamStr(text, startIdx) {
    let depth = 0;
    let i = startIdx;
    // Find opening '('
    while (i < text.length && text[i] !== '(') i++;
    if (i >= text.length) return { paramStr: '', endIdx: i };
    const openIdx = i;
    i++;
    depth = 1;
    while (i < text.length && depth > 0) {
        if (text[i] === '(') depth++;
        else if (text[i] === ')') depth--;
        i++;
    }
    return { paramStr: text.slice(openIdx + 1, i - 1), endIdx: i };
}

/**
 * Parse a parameter list string "(a: T, b: U, c?: V)" into ParamDef[]
 */
function parseParamList(paramStr) {
    if (!paramStr.trim()) return [];
    const params = [];
    // Split by commas, but respect nested generics / function types
    let depth = 0;
    let current = '';
    for (let i = 0; i < paramStr.length; i++) {
        const ch = paramStr[i];
        if (ch === '(' || ch === '<' || ch === '{') depth++;
        else if (ch === ')' || ch === '>' || ch === '}') depth--;
        if (ch === ',' && depth === 0) {
            current = current.trim();
            if (current) params.push(parseOneParam(current));
            current = '';
        } else {
            current += ch;
        }
    }
    current = current.trim();
    if (current) params.push(parseOneParam(current));
    return params;
}

function parseOneParam(str) {
    // Handle ...rest parameters
    let rest = false;
    if (str.startsWith('...')) {
        rest = true;
        str = str.slice(3);
    }

    // Find the FIRST colon at depth 0 (not inside nested (), {}, or <>).
    // Using lastIndexOf broke on arrow-function and object-literal types
    // that contain their own colons, e.g. "(data: string) => void".
    let colonIdx = -1;
    let depth = 0;
    for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (ch === '(' || ch === '{' || ch === '<') depth++;
        else if (ch === ')' || ch === '}' || ch === '>') depth--;
        else if (ch === ':' && depth === 0) { colonIdx = i; break; }
    }

    // Handle optional params (name ends with ?) — checked regardless of whether
    // there's a type annotation, since untyped params can also be optional: "param?"
    let optional = false;
    let rawName = str.trim();

    if (colonIdx === -1) {
        // Untyped parameter
        if (rawName.endsWith('?')) {
            optional = true;
            rawName = rawName.slice(0, -1);
        }
        return { name: rawName, type: 'any', optional, rest };
    }

    rawName = str.slice(0, colonIdx).trim();
    if (rawName.endsWith('?')) {
        optional = true;
        rawName = rawName.slice(0, -1);
    }
    let type = str.slice(colonIdx + 1).trim();

    // Strip default values from type (e.g., "boolean = true" → "boolean")
    const eqIdx = findCharAtDepth(type, '=', 0);
    if (eqIdx !== -1) {
        type = type.slice(0, eqIdx).trim();
    }

    return { name: rawName, type, optional, rest };
}

/** Find a character ch in str while at exactly the given depth (nesting level). */
function findCharAtDepth(str, target, targetDepth) {
    let d = 0;
    for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (ch === '(' || ch === '{' || ch === '<') d++;
        else if (ch === ')' || ch === '}' || ch === '>') d--;
        else if (ch === target && d === targetDepth) return i;
    }
    return -1;
}

/**
 * Check if position `pos` in `body` is inside a method parameter list.
 * Scans backward from pos: if there's an unmatched '(' before this position
 * (i.e., a '(' without a matching ')' between it and pos), we're inside a
 * method signature's parameter list, and this is not a real property.
 */
function isInsideMethodParams(body, pos) {
    let depth = 0;
    for (let i = pos - 1; i >= 0; i--) {
        const ch = body[i];
        if (ch === ')') depth++;
        else if (ch === '(') {
            if (depth === 0) return true; // unmatched '(' found — inside method params
            depth--;
        }
        // Exit early if we hit a ';' or '{' at depth 0 — we're not inside method params
        else if (ch === ';' && depth === 0) return false;
        else if (ch === '{' && depth === 0) return false;
        // A newline with no unmatched paren means we're likely between statements
    }
    return false;
}

/**
 * Parse a method signature: "public methodName(params): returnType;"
 * or "public methodName(params);" (void return)
 * This version handles nested parentheses in parameter types.
 */
function parseMethodSig(sig, jsdocText) {
    // Find the method name
    const nameMatch = sig.match(/^(?:public\s+)?(\w+)\s*\(/);
    if (!nameMatch) return null;
    const methodName = nameMatch[1];

    // Extract parameter string with nested parens
    const parenStart = sig.indexOf('(', nameMatch[0].length - 1);
    if (parenStart === -1) return null;
    const paramResult = extractParamStr(sig, parenStart);
    const params = parseParamList(paramResult.paramStr);

    // Extract return type after closing paren — handles multi-line return types
    let returns = 'void';
    const afterParen = sig.slice(paramResult.endIdx).trimStart();
    if (afterParen.startsWith(':')) {
        let typeStart = 1;
        while (typeStart < afterParen.length && afterParen[typeStart] === ' ') typeStart++;
        const semiIdx = findCharAtDepth(afterParen, ';', 0);
        if (semiIdx !== -1) {
            returns = afterParen.slice(typeStart, semiIdx).trim();
        }
    }

    // Merge @param docs into params
    const paramDocs = parseParamDocs(jsdocText);
    for (const p of params) {
        const doc = paramDocs.find(d => d.name === p.name);
        if (doc) p.description = doc.desc;
    }

    return { name: methodName, description: jsdocText, params, returns };
}

/**
 * Extract all method signatures from a class/interface body.
 * Handles nested parentheses in parameter types properly.
 */
function extractMethodsFromBody(body) {
    const methods = [];
    // Find method-like patterns: JSDoc? public? name (
    const methodStartRe = /((?:\/\*\*[\s\S]*?\*\/\s*)?)\s*(?:public\s+)?(\w+)\s*\(/g;
    let mm;
    while ((mm = methodStartRe.exec(body)) !== null) {
        const methodName = mm[2];
        // Skip known non-method patterns
        if (methodName === 'if' || methodName === 'while' || methodName === 'for' ||
            methodName === 'switch' || methodName === 'catch' || methodName === 'with' ||
            methodName === 'return' || methodName === 'throw' || methodName === 'constructor') continue;

        const jsdocBlock = cleanJsDoc(mm[1]);
        const parenIdx = mm.index + mm[0].length - 1; // position of '('
        const paramResult = extractParamStr(body, parenIdx);

        // Extract return type — handles multi-line return types (e.g. Device.getPublicIPInfo)
        let returns = 'void';
        const afterParen = body.slice(paramResult.endIdx).trimStart();
        if (afterParen.startsWith(':')) {
            let typeStart = 1; // skip ':'
            while (typeStart < afterParen.length && afterParen[typeStart] === ' ') typeStart++;
            const semiIdx = findCharAtDepth(afterParen, ';', 0);
            if (semiIdx !== -1) {
                returns = afterParen.slice(typeStart, semiIdx).trim();
            }
        }

        const params = parseParamList(paramResult.paramStr);
        const paramDocs = parseParamDocs(jsdocBlock);
        for (const p of params) {
            const doc = paramDocs.find(d => d.name === p.name);
            if (doc) p.description = doc.desc;
        }

        methods.push({ name: methodName, description: jsdocBlock, params, returns });
    }
    return methods;
}

// ---------------------------------------------------------------------------
// File-level parsing
// ---------------------------------------------------------------------------

/**
 * Extract everything inside the outermost brace pair starting at `startIdx`.
 * Returns { content, endIdx } where endIdx is the position after the closing brace.
 */
function extractBraces(text, startIdx) {
    let depth = 0;
    let i = startIdx;
    // Find opening brace
    while (i < text.length && text[i] !== '{') i++;
    if (i >= text.length) return { content: '', endIdx: i };
    const openIdx = i;
    i++;
    depth = 1;
    while (i < text.length && depth > 0) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') depth--;
        i++;
    }
    return { content: text.slice(openIdx + 1, i - 1), endIdx: i };
}

/**
 * Parse a single .d.ts file. Returns:
 * {
 *   globals: [{ name, type, kind: 'var'|'function', params, returns, jsdoc }],
 *   interfaces: { Name: { methods, properties, jsdoc } },
 *   classes: { Name: { methods, properties, constructorParams, jsdoc } }
 * }
 */
function parseDtsFile(filePath) {
    const text = fs.readFileSync(filePath, 'utf-8');
    const result = {
        globals: [],
        interfaces: {},
        classes: {}
    };

    // --- Step 1: Find and extract the global block ---
    const globalMatch = text.match(/(?:declare\s+)?global\s*\{/);
    let globalContent = '';
    let globalEndIdx = 0;
    if (globalMatch) {
        const extracted = extractBraces(text, globalMatch.index);
        globalContent = extracted.content;
        globalEndIdx = extracted.endIdx;
    }

    // --- Step 2: Parse global declarations (var, function, class) ---
    // First, find JSDoc-style comments in the global block
    // Remove single-line // comments and /* */ (non-JSDoc) comments for cleaner parsing
    // But keep /** */ blocks

    // Parse var declarations: var Name: Type;
    const varRe = /var\s+(\w+)\s*:\s*(.+?);/g;
    let m;
    while ((m = varRe.exec(globalContent)) !== null) {
        const name = m[1];
        // Skip if 'name' is a type keyword in TS (just in case)
        let type = m[2].trim();
        const jsdoc = extractJsDoc(globalContent.slice(0, m.index));
        result.globals.push({ name, type, kind: 'var', params: [], returns: '', jsdoc });
    }

    // Parse function declarations: function Name(params): ReturnType;
    const funcRe = /function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*(.+?))?;/g;
    while ((m = funcRe.exec(globalContent)) !== null) {
        const name = m[1];
        const params = parseParamList(m[2]);
        const returns = (m[3] || 'void').trim();
        const jsdoc = extractJsDoc(globalContent.slice(0, m.index));
        result.globals.push({ name, type: 'function', kind: 'function', params, returns, jsdoc });
    }

    // Parse class declarations within global block
    const classRe = /class\s+(\w+)\s*\{/g;
    while ((m = classRe.exec(globalContent)) !== null) {
        const cname = m[1];
        const extracted = extractBraces(globalContent, m.index + m[0].length - 1);
        const classBody = extracted.content;
        const classJsdoc = extractJsDoc(globalContent.slice(0, m.index));

        // Parse constructor params
        const ctorMatch = classBody.match(/constructor\s*\(([^)]*)\)\s*;/);
        const constructorParams = ctorMatch ? parseParamList(ctorMatch[1]) : [];

        // Parse methods
        const methods = extractMethodsFromBody(classBody);

        // Parse properties
        const properties = [];
        const propRe = /((?:\/\*\*[\s\S]*?\*\/\s*)?)\s*(\w+)\s*:\s*(.+?);/g;
        while ((pm = propRe.exec(classBody)) !== null) {
            if (pm[2] === 'constructor') continue;
            if (isInsideMethodParams(classBody, pm.index)) continue;
            const propJsdoc = cleanJsDoc(pm[1]);
            properties.push({ name: pm[2], type: pm[3].trim(), description: propJsdoc });
        }

        result.classes[cname] = { methods, properties, constructorParams, jsdoc: classJsdoc };
    }

    // --- Step 3: Parse interface declarations ---
    // Interfaces may be outside the global block OR inside it (e.g., App.d.ts has interface inside global)
    // Search both the full text (for interfaces outside global) and globalContent (for interfaces inside)
    const searchContexts = [{ text, isGlobalContent: false }];
    if (globalContent) {
        searchContexts.push({ text: globalContent, isGlobalContent: true });
    }

    for (const ctx of searchContexts) {
        const ifaceRe = /((?:\/\*\*[\s\S]*?\*\/\s*)?)\s*interface\s+(\w+)\s*\{/g;
        let ifaceMatch;
        while ((ifaceMatch = ifaceRe.exec(ctx.text)) !== null) {
            const iname = ifaceMatch[2];

            // If searching full text, skip interfaces inside the global block (they'll be found in globalContent)
            if (!ctx.isGlobalContent && globalMatch && ifaceMatch.index > globalMatch.index &&
                ifaceMatch.index < globalEndIdx) {
                continue;
            }

            const extracted = extractBraces(ctx.text, ifaceMatch.index + ifaceMatch[0].length - 1);
            const ifaceBody = extracted.content;
            const ifaceJsdoc = extractJsDoc(ctx.text.slice(0, ifaceMatch.index));

            const methods = extractMethodsFromBody(ifaceBody);
            const properties = [];

            // Parse properties (non-method, non-constructor)
            const propRe = /((?:\/\*\*[\s\S]*?\*\/\s*)?)\s*(\w+)\s*:\s*(.+?);/g;
            while ((pm = propRe.exec(ifaceBody)) !== null) {
                if (pm[2] === 'constructor') continue;
                // Skip if this match is inside a method signature (has unmatched '(' before it)
                if (isInsideMethodParams(ifaceBody, pm.index)) continue;
                const propJsdoc = cleanJsDoc(pm[1]);
                properties.push({ name: pm[2], type: pm[3].trim(), description: propJsdoc });
            }

            result.interfaces[iname] = { methods, properties, jsdoc: ifaceJsdoc };
        }
    }

    return result;
}


// ---------------------------------------------------------------------------
// Aggregation and generation
// ---------------------------------------------------------------------------

function readAllDtsFiles(typeDir) {
    const files = [];
    function walk(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) walk(full);
            else if (e.name.endsWith('.d.ts') && e.name !== 'Global.d.ts') files.push(full);
        }
    }
    walk(typeDir);
    return files;
}

function buildApiData() {
    const files = readAllDtsFiles(TYPE_DIR);
    const allGlobals = [];   // { name, type, kind, params, returns, jsdoc }
    const allInterfaces = {}; // Name -> { methods, properties, jsdoc }
    const allClasses = {};    // Name -> { methods, properties, constructorParams, jsdoc }
    const allFunctions = [];  // standalone functions from global scope

    for (const file of files) {
        const parsed = parseDtsFile(file);
        allGlobals.push(...parsed.globals);
        Object.assign(allInterfaces, parsed.interfaces);
        Object.assign(allClasses, parsed.classes);
    }

    // --- Merge: for each global var, find its interface/class and build a GlobalDef ---
    const apiData = {};

    for (const g of allGlobals) {
        const name = g.name;

        if (g.kind === 'function') {
            // Standalone function (e.g., UiSelector(), JavaImporter())
            // Check if there's also a class with the same name (e.g., UiSelector function + class)
            const sameClass = allClasses[name];
            apiData[name] = {
                kind: sameClass ? 'class' : 'function',
                description: sameClass ? sameClass.jsdoc : g.jsdoc,
                methods: sameClass ? sameClass.methods : [],
                properties: sameClass ? sameClass.properties : [],
                constructorParams: sameClass ? sameClass.constructorParams : [],
                funcParams: g.params,
                funcReturns: g.returns
            };
            continue;
        }

        // For 'var' kind, the type field may be:
        // - A simple type name (e.g., "App", "access", "storage")
        // - An inline object literal (e.g., WebSocket's { new (url: string): ... })
        // - "any"

        const typeName = g.type;

        if (typeName === 'any') {
            // java: any, Packages: any — just provide name completion
            apiData[name] = {
                kind: 'object',
                description: g.jsdoc,
                methods: [],
                properties: [],
                constructorParams: [],
                funcParams: [],
                funcReturns: 'any'
            };
            continue;
        }

        // Check if it's an inline object literal (e.g. WebSocket definition)
        if (typeName.startsWith('{') && typeName.endsWith('}')) {
            const inlineBody = typeName.slice(1, -1).trim();
            const methods = [];
            const constructorParams = [];

            // Parse "new (url: string): webSocket;"
            const ctorMatch = inlineBody.match(/new\s*\(([^)]*)\)\s*(?::\s*(.+?))?\s*;/);
            if (ctorMatch) {
                const ctorParams = parseParamList(ctorMatch[1]);
                constructorParams.push(...ctorParams);
            }

            // Parse static methods and instance methods
            const staticRe = /(?:static\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*(.+?))?\s*;/g;
            let sm;
            while ((sm = staticRe.exec(inlineBody)) !== null) {
                if (sm[1] === 'new') continue;
                const params = parseParamList(sm[2]);
                const returns = (sm[3] || 'void').trim();
                methods.push({ name: sm[1], description: '', params, returns });
            }

            apiData[name] = {
                kind: 'object',
                description: g.jsdoc,
                methods,
                properties: [],
                constructorParams,
                funcParams: [],
                funcReturns: ''
            };
            continue;
        }

        // Normal case: typeName points to an interface or class
        const iface = allInterfaces[typeName];
        const cls = allClasses[typeName];

        if (cls) {
            // It's a class (e.g., Rect)
            apiData[name] = {
                kind: 'class',
                description: cls.jsdoc,
                methods: cls.methods,
                properties: cls.properties,
                constructorParams: cls.constructorParams,
                funcParams: [],
                funcReturns: ''
            };
        } else if (iface) {
            // It's an interface-backed object
            apiData[name] = {
                kind: 'object',
                description: iface.jsdoc,
                methods: iface.methods,
                properties: iface.properties,
                constructorParams: [],
                funcParams: [],
                funcReturns: ''
            };
        } else {
            // Type name not found — could be a cross-file reference
            // Try looking up the type name itself as a class (e.g., UiSelector)
            const selfCls = allClasses[name];
            if (selfCls) {
                apiData[name] = {
                    kind: 'class',
                    description: selfCls.jsdoc,
                    methods: selfCls.methods,
                    properties: selfCls.properties,
                    constructorParams: selfCls.constructorParams,
                    funcParams: [],
                    funcReturns: ''
                };
            } else {
                // Fallback
                apiData[name] = {
                    kind: 'object',
                    description: g.jsdoc,
                    methods: [],
                    properties: [],
                    constructorParams: [],
                    funcParams: [],
                    funcReturns: ''
                };
            }
        }
    }

    // --- Handle classes that are also available as global names (e.g., UiSelector, Rect) ---
    // These have a 'class' declaration in global scope but no 'var' declaration
    for (const [cname, cls] of Object.entries(allClasses)) {
        if (!apiData[cname]) {
            apiData[cname] = {
                kind: 'class',
                description: cls.jsdoc,
                methods: cls.methods,
                properties: cls.properties,
                constructorParams: cls.constructorParams,
                funcParams: [],
                funcReturns: ''
            };
        }
    }

    return apiData;
}

// ---------------------------------------------------------------------------
// Generate TypeScript output
// ---------------------------------------------------------------------------

function generateOutput(apiData) {
    const names = Object.keys(apiData).sort();

    let out = '';
    out += '// AUTO-GENERATED by scripts/generateApiData.js — DO NOT EDIT\n';
    out += '\n';
    out += 'export interface ParamDef {\n';
    out += "    name: string;\n";
    out += "    type: string;\n";
    out += "    optional?: boolean;\n";
    out += "    rest?: boolean;\n";
    out += '}\n';
    out += '\n';
    out += 'export interface MethodDef {\n';
    out += "    name: string;\n";
    out += "    description: string;\n";
    out += "    params: ParamDef[];\n";
    out += "    returns: string;\n";
    out += '}\n';
    out += '\n';
    out += 'export interface PropertyDef {\n';
    out += "    name: string;\n";
    out += "    type: string;\n";
    out += "    description: string;\n";
    out += '}\n';
    out += '\n';
    out += 'export interface GlobalDef {\n';
    out += "    kind: 'object' | 'class' | 'function';\n";
    out += "    description: string;\n";
    out += "    methods: MethodDef[];\n";
    out += "    properties: PropertyDef[];\n";
    out += "    constructorParams: ParamDef[];\n";
    out += "    funcParams: ParamDef[];\n";
    out += "    funcReturns: string;\n";
    out += '}\n';
    out += '\n';
    out += 'export const apiData: Record<string, GlobalDef> = {\n';

    for (const name of names) {
        const def = apiData[name];
        out += `    '${name}': {\n`;
        out += `        kind: '${def.kind}',\n`;
        out += `        description: '${tsEscape(def.description)}',\n`;
        out += `        methods: [\n`;
        for (const m of def.methods) {
            out += `            {\n`;
            out += `                name: '${tsEscape(m.name)}',\n`;
            out += `                description: '${tsEscape(m.description)}',\n`;
            out += `                params: [\n`;
            for (const p of m.params) {
                const opt = p.optional ? ', optional: true' : '';
                const rest = p.rest ? ', rest: true' : '';
                out += `                    { name: '${tsEscape(p.name)}', type: '${tsEscape(p.type)}'${opt}${rest} },\n`;
            }
            out += `                ],\n`;
            out += `                returns: '${tsEscape(m.returns)}',\n`;
            out += `            },\n`;
        }
        out += `        ],\n`;
        out += `        properties: [\n`;
        for (const p of def.properties) {
            out += `            { name: '${tsEscape(p.name)}', type: '${tsEscape(p.type)}', description: '${tsEscape(p.description)}' },\n`;
        }
        out += `        ],\n`;
        out += `        constructorParams: [\n`;
        for (const p of def.constructorParams) {
            out += `            { name: '${tsEscape(p.name)}', type: '${tsEscape(p.type)}' },\n`;
        }
        out += `        ],\n`;
        out += `        funcParams: [\n`;
        for (const p of def.funcParams) {
            const opt = p.optional ? ', optional: true' : '';
            const rest = p.rest ? ', rest: true' : '';
            out += `            { name: '${tsEscape(p.name)}', type: '${tsEscape(p.type)}'${opt}${rest} },\n`;
        }
        out += `        ],\n`;
        out += `        funcReturns: '${tsEscape(def.funcReturns)}',\n`;
        out += `    },\n`;
    }

    out += '};\n';
    return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

if (require.main === module) {
    console.log(`Parsing .d.ts files from: ${TYPE_DIR}`);
    const apiData = buildApiData();
    const names = Object.keys(apiData).sort();
    console.log(`Found ${names.length} global APIs: ${names.join(', ')}`);

    const output = generateOutput(apiData);
    fs.writeFileSync(OUTPUT_FILE, output, 'utf-8');
    console.log(`Generated: ${OUTPUT_FILE}`);
    console.log('Done.');
}
