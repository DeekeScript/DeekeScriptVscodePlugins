import * as vscode from 'vscode';
import log from './unit/log';
import * as ts from 'typescript';
import * as fs from 'fs';
import path from 'path';

export default class GoCompletionItemProvider implements vscode.CompletionItemProvider {
    public getMethodDocumentation(node: ts.MethodDeclaration): string[] {
        // 使用 getJSDocComments 获取 JSDoc 注释
        const jsDocs = ts.getJSDocCommentsAndTags(node);
        let comments: string[] = [];
        if (jsDocs && jsDocs.length > 0) {
            for (let i in jsDocs) {
                //let comment = jsDocs[i].comment; // 获取第一个注释
                let comment = jsDocs[i].getFullText();
                comments.push(comment?.toString() || ''); // 如果没有注释，返回空字符串
            }
        }
        return comments; // 如果没有 JSDoc 注释，返回空字符串
    }

    public getPropertyDocumentation(member: ts.PropertyDeclaration): string[] {
        const jsDocs = ts.getJSDocTags(member);
        let comments: string[] = [];
        if (jsDocs && jsDocs.length > 0) {
            jsDocs.forEach(jsDoc => {
                const comment = jsDoc.comment;
                if (comment) {
                    comments.push(comment.toString());
                }
            });
        }
        return comments;
    }

    public getNotice(code: string | undefined) {
        return code;
        // let tags = ['=', '>', '<'];
        // if (code === undefined) {
        //     return undefined;
        // }

        // if (code.endsWith('=') || code.endsWith('= ')) {
        //     return { type: 'class' };
        // }

        // if (code.endsWith('.')) {
        //     let minIndex = -1;
        //     for (let i in tags) {
        //         let index = code.lastIndexOf(tags[i]);
        //         if (index > minIndex) {
        //             minIndex = index;
        //         }
        //     }

        //     if (minIndex >= 0) {
        //         return { type: 'method', class: code.substring(minIndex, code.length) };//查找class，找到method或者属性
        //     }
        // }
    }

    public provideCompletionItems(
        document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken):
        Thenable<vscode.CompletionItem[]> {

        const fileName = document.uri.fsPath;
        // const lineText = document.lineAt(position).text;
        const offset = document.offsetAt(position);
        const suggestions: vscode.CompletionItem[] = [];



        const customClass = new vscode.CompletionItem('MyCustomClass', vscode.CompletionItemKind.Class);
        customClass.documentation = '这是一个自定义的类，用于扩展功能。';
        customClass.detail = '自定义类';
        suggestions.push(customClass);

        // 示例：为扩展的方法添加提示
        const customMethod = new vscode.CompletionItem('myCustomMethod', vscode.CompletionItemKind.Method);
        customMethod.documentation = '这是一个自定义方法，提供额外功能。';
        customMethod.insertText = 'myCustomMethod($1)';
        customMethod.detail = '自定义方法';
        suggestions.push(customMethod);


        const currentLineWord = document.lineAt(position.line).text;
        return new Promise<vscode.CompletionItem[]>((resolve) => {
            //将last进行拆解，如果是下面的几个类型，则给出提示
            const tag = this.getNotice(currentLineWord);
            if (tag !== undefined) {
                //log.info(JSON.stringify(tag));
            }

            if (tag === undefined) {
                return resolve(suggestions);
            }

            // 打开目录
            fs.opendir(path.join(__dirname, 'ts/class'), (err, dir) => {
                if (err) {
                    log.info('目录打开失败:', err);
                    return;
                }

                // 遍历目录
                (async () => {
                    for await (const dirent of dir) {
                        if (!dirent.isFile()) {
                            return;
                        }

                        let fileName = dirent.path + '/' + dirent.name;
                        try {
                            let sourceFile = ts.createSourceFile(
                                fileName,
                                fs.readFileSync(fileName, 'utf8'),
                                ts.ScriptTarget.Latest,
                                true
                            );

                            //log.info("解析文件：" + sourceFile.fileName);
                            //log.info(JSON.stringify(methods));
                        } catch (e) {
                            log.info('出错了：' + e);
                        }
                    }
                    // 关闭目录
                    await dir.close();
                    resolve(suggestions); // 返回补全项
                })().catch(console.error);
            });
        });
    }
}