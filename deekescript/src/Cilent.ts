import * as fs from "fs";
import { MessageEvent, WebSocket } from 'ws';
import log from './unit/log';
import setting from "./setting";

export default class Cilent {
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
            }
        });
    }

    projectSyncFilesRemove(file: string) {
        for (let i in this.projectSyncFiles) {
            if (this.projectSyncFiles[i]) {
                this.projectSyncFiles.splice(Number(i), 1);
            }
        }

        if (this.projectSyncFiles.length == 0) {
            log.modelInfo("同步成功");
        }
    }

    message(event: MessageEvent) {
        let res = JSON.parse(event.data.toString());
        if (res['code'] === 0) {
            if (res['command'] == 'fileAsyncCommand') {
                return res['file'] && this.projectSyncFilesRemove(res['file']);
            }
            return log.modelInfo(res['msg']);
        }
        return log.modelError(res['msg']);
    }

    connect() {
        if (this.socket) {
            this.socket.close()
        }
        log.info("正在连接到手机：" + `ws://${this.socketIp}:${this.socketPort}`);
        return new WebSocket(`ws://${this.socketIp}:${this.socketPort}`);
    }

    close() {
        this.socket?.close();
    }

    state() {
        return this.socket && this.socket.readyState == this.socket.OPEN;
    }

    fileSync(file: string, isDir: boolean = false) {
        try {
            let data = {
                command: 'fileAsyncCommand',
                file: file,
                isDir: isDir,
                content: fs.readFileSync(file, 'utf8'),
            }
            this.socket?.send(JSON.stringify(data));
        } catch (e: any) {
            log.modelError(e.message.toString());
        }
    }

    projectSync() {
        if (!setting.isProject()) {
            return log.modelError("非DeekeScript项目");
        }

        if (this.projectSyncing) {
            return true;
        }

        this.projectSyncing = true;
        let baseDir = setting.getContext().asAbsolutePath("");
        this.projectSyncFiles = [];//重置发送的文件
        try {
            this.projectSyncDetail(baseDir);
        } catch (e: any) {
            log.info(e.message.toString());
        }

        this.projectSyncing = false;
        return true;
    }

    projectSyncDetail(baseDir: string) {
        this.fileSync(baseDir, false);
        this.projectSyncFiles?.push(baseDir);
        let files = fs.readdirSync(baseDir);
        for (let f of files) {
            if (f.indexOf('.') === 0) {
                continue;//“.”开头的过滤掉
            }

            if (fs.statSync(baseDir + '/' + f).isDirectory()) {
                this.projectSyncDetail(baseDir + '/' + f);
                continue;
            }

            this.fileSync(baseDir + '/' + f, true);
            this.projectSyncFiles?.push(baseDir + '/' + f);
        }
    }

    fileRunCommand(obj: { file: string }) {
        let data = {
            "command": "fileRunCommand",
            "file": obj.file,
            "content": fs.readFileSync(obj.file),
        }
        this.commnad(data);
    }

    stopCommand() {
        let data = {
            "command": "stopCommand"
        }
        this.commnad(data);
    }

    projectRunCommand() {
        let data = {
            "command": "projectRunCommand"
        }
        return this.commnad(data);
    }

    commnad(data: Object) {
        if (!this.socket) {
            return false;
        }
        this.socket.send(JSON.stringify(data), {
            "compress": true,//压缩
        }, (err) => {
            if (err) {
                return log.modelError(err?.message.toString());
            }
        });
    }
}
