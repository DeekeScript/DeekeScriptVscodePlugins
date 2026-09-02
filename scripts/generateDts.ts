import * as fs from 'fs';
import * as path from 'path';
import { generateDtsContent } from '../src/language/dtsGenerator';

const outDir = path.join(__dirname, '..', '.vscode');
const outFile = path.join(outDir, 'deekeScriptPro.d.ts');
const legacyRef = path.join(outDir, 'deekeScript.d.ts');

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, generateDtsContent(), 'utf-8');
fs.writeFileSync(
    legacyRef,
    [
        '/// <reference path="./deekeScriptPro.d.ts" />',
        '// 兼容旧路径：类型声明已迁移至 deekeScriptPro.d.ts',
        '',
    ].join('\n'),
    'utf-8'
);

console.log('Wrote', outFile);
console.log('Updated legacy stub', legacyRef);
