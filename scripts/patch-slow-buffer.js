/**
 * Node 25 起移除了 buffer.SlowBuffer。
 * 旧版 vsce 依赖的 buffer-equal-constant-time 在加载时会直接读取它，发布因此中断。
 * 本脚本在 vsce 启动前改掉这一行：SlowBuffer 不存在时退回 Buffer。
 */
const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'node_modules', 'buffer-equal-constant-time', 'index.js');
if (!fs.existsSync(target)) {
    process.exit(0);
}

const from = "var SlowBuffer = require('buffer').SlowBuffer;";
const to = "var SlowBuffer = require('buffer').SlowBuffer || Buffer;";
const src = fs.readFileSync(target, 'utf8');
if (src.includes(from)) {
    fs.writeFileSync(target, src.replace(from, to));
}
