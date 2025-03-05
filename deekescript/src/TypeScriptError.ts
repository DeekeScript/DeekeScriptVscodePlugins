// const sourceMap = require('source-map');
// const fs = require('fs');
import * as fs from 'fs';
import * as sourceMap from 'source-map';

// 创建一个 SourceMapConsumer 来解析 source map 文件
async function mapErrorToTSStack(baseDir: string, file: string, lineNumber: number, columnNumber: number, error: string) {
    // try {
    //     // 读取 source map 文件 (假设 app.js.map 与 app.js 文件位于同一目录)
    //     const sourceMapFile = baseDir + file + '.map';
    //     console.log('获取的TypeScript文件地址：' + baseDir + file + '.map');
    //     console.log('行：' + lineNumber + ':' + columnNumber);
    //     const map = JSON.parse(fs.readFileSync(sourceMapFile, 'utf8'));
    //     console.log(map);

    //     const consumer = await new sourceMap.SourceMapConsumer(map);
    //     // 使用 SourceMapConsumer查找 TypeScript 文件和行号
    //     const originalPosition = consumer.originalPositionFor({
    //         line: lineNumber,
    //         column: columnNumber
    //     });
    //     console.log(originalPosition);

    //     if (originalPosition.source) {
    //         // 将 JavaScript 堆栈转换为 TypeScript 堆栈
    //         return error + "\n" + `at ${originalPosition.source}:${originalPosition.line}:${originalPosition.column}`;
    //     }
    // } catch (e) {
    //     console.log("错误转换异常：" + e);//如果是js项目，这里就会报错；Typescript项目不会报错
    // }
    return error + "\n" + `at ${file}:${lineNumber}:${columnNumber}`;
}

// module.exports = mapErrorToTSStack;
export { mapErrorToTSStack };
