import * as fs from "fs";
import { MessageEvent, WebSocket } from 'ws';
import log from './unit/log';
import setting from "./setting";
// const { mapErrorToTSStack } = require('./TypeScriptError');
import { mapErrorToTSStack } from './TypeScriptError';
import * as vscode from 'vscode';

export default class Client {
    socket: WebSocket | undefined = undefined;
    socketIp: string | null = null;
    socketPort: number | null = null;
    projectSyncing: boolean = false;//项目正在同步吗？
    projectSyncFiles: string[] = [];
    constructor(socketIp: string, socketPort: number) {
        this.socketIp = socketIp;
        this.socketPort = socketPort;
    }

    createSocket() {
        return new Promise((resolve, rejects) => {
            this.socket = this.connect();
            let _this = this;

            this.socket.onerror = function () {
                log.modelError('连接失败');
                resolve("");
            };

            this.socket.onopen = function () {
                log.modelInfo('连接成功');
                resolve("");
            };

            this.socket.onclose = function () {
                log.modelInfo('连接已关闭');
                _this.socket = undefined;
                resolve("");
            };
            this.socket.onmessage = (event: MessageEvent) => {
                this.message(event);
            };
        });
    }

    projectSyncFilesRemove(file: string) {
        for (let i in this.projectSyncFiles) {
            if (this.projectSyncFiles[i]) {
                this.projectSyncFiles.splice(Number(i), 1);
            }
        }

        if (this.projectSyncFiles.length === 0) {
            log.modelInfo("同步成功");
        }
    }

    message(event: MessageEvent) {
        let res = JSON.parse(event.data.toString());
        if (res['code'] === 0) {
            try {
                //{"code":1,"message":"{\"sourceName\":\"/test3.js\",\"lineNumber\":4,\"columnNumber\":20,\"detail\":\"syntax error\"}"}
                let info = JSON.parse(res['msg']);//这里是Json
                if (info.code === 0) {
                    return log.info(info['message']);
                }
                //代码错误
                let err = info['message'];
                log.info('错误内容：' + err.message + "\n文件：" + err.sourceName + "\n行数：" + err.lineNumber + "\n" + "第几个字符：" + err.columnNumber);
                if (vscode.window?.activeTextEditor?.document && vscode.workspace.workspaceFolders) {
                    mapErrorToTSStack(vscode.workspace.workspaceFolders[0].uri.fsPath, err.sourceName, err.lineNumber, err.columnNumber, err.message).then((tsStack: any) => {
                        console.log('Converted TypeScript Stack Trace:');
                        console.log(tsStack);
                    });
                }
            } catch (e) {
                log.info(res['msg']);
            }
            return;
        }
        return log.modelError(res['msg']);
    }

    connect() {
        if (this.socket) {
            this.socket.close();
        }

        // if (vscode.window?.activeTextEditor?.document && vscode.workspace.workspaceFolders) {
        //     mapErrorToTSStack(vscode.workspace.workspaceFolders[0].uri.fsPath, "/script/task/test.js", 5, 21, "具体错误").then((tsStack: any) => {
        //         console.log('Converted TypeScript Stack Trace:');
        //         console.log(tsStack);
        //     });
        // }
        log.info("正在连接到手机：" + `ws://${this.socketIp}:${this.socketPort}`);

        return new WebSocket(`ws://${this.socketIp}:${this.socketPort}`);
    }

    close() {
        this.socket?.close();
    }

    state() {
        return this.socket && this.socket.readyState === this.socket.OPEN;
    }

    fileSync(baseDir: string, file: string, isDir: boolean = false) {
        try {
            let data = {
                status: 1001,
                file: file.substring(baseDir.length),
                isDir: isDir,
                body: isDir ? '' : fs.readFileSync(file).toString('base64'),//这里主要不能直接转为utf8传输，否则图片等文件会丢失数据，导致问题
            };
            log.info((isDir ? '即将同步文件夹：' : "即将同步文件：") + file.substring(baseDir.length));
            this.socket?.send(JSON.stringify(data));
        } catch (e: any) {
            log.modelError(e.message.toString());
        }
    }

    projectSync(baseDir: string, file: string) {
        if (!setting.isProject()) {
            return log.modelError("非DeekeScript项目");
        }

        if (this.projectSyncing) {
            return true;
        }

        this.projectSyncing = true;
        this.projectSyncFiles = [];//重置发送的文件
        try {
            this.projectSyncDetail(baseDir, baseDir, true);
        } catch (e: any) {
            log.info(e.message.toString());
        }

        this.projectSyncing = false;
        return true;
    }

    projectSyncDetail(absolutePath: string, baseDir: string, isDir: boolean) {
        this.fileSync(absolutePath, baseDir, isDir);
        this.projectSyncFiles?.push(baseDir);
        let files = fs.readdirSync(baseDir);
        for (let f of files) {
            if (f.indexOf('.') === 0) {
                continue;//“.”开头的过滤掉
            }

            if (fs.statSync(baseDir + '/' + f).isDirectory()) {
                //排除node_modules文件夹
                if (f === 'node_modules') {
                    continue;
                }
                this.projectSyncDetail(absolutePath, baseDir + '/' + f, true);
                continue;
            }

            this.fileSync(absolutePath, baseDir + '/' + f, false);
            this.projectSyncFiles?.push(baseDir + '/' + f);
        }
    }

    fileRunCommand(obj: { absolutePath: string, file: string }) {
        let data = {
            "status": 1,
            "body": fs.readFileSync(obj.file).toString('utf8'),
            "file": obj.file.substring(obj.absolutePath.length),
        };
        this.command(data);
    }

    stopCommand() {
        let data = {
            "status": 0
        };
        this.command(data);
    }

    projectRunCommand() {
        let data = {
            "command": "projectRunCommand"
        };
        return this.command(data);
    }

    command(data: Object) {
        if (!this.socket) {
            return false;
        }
        this.socket.send(JSON.stringify(data), {
            "compress": true,//压缩
        }, (err) => {
            if (err) {
                log.info("错误消息");
                return log.modelError(err?.message.toString());
            }
        });
    }
}
