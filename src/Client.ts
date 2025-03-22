import * as fs from "fs";
import { MessageEvent, WebSocket } from 'ws';
import log from './unit/log';
import setting from "./setting";
import { workspace } from "vscode";

export default class Client {
    static socket: WebSocket | undefined = undefined;
    socketIp: string | undefined = undefined;
    socketPort: number | undefined = undefined;
    wsMaxRetries: number = 0;
    wsBaseDelay: number = 1000;
    isMunualClose: boolean = false;
    retryOpen: boolean = false;
    projectSyncing: boolean = false;//项目正在同步吗？
    projectSyncFiles: [number, string][] = [];
    reconnectTimer: NodeJS.Timeout | null = null;
    constructor(socketIp: string) {
        this.socketIp = socketIp;
        const config = workspace.getConfiguration('server');
        this.socketPort = config.get('port');
        this.isMunualClose = false;
        this.retryOpen = false;
        this.init();
    }

    init() {
        const config = workspace.getConfiguration('server');
        this.wsMaxRetries = config.get('wsMaxRetries') || this.wsMaxRetries;
        this.wsBaseDelay = config.get('wsBaseDelay') || this.wsBaseDelay;
    }

    // 指数退避重连策略
    scheduleReconnect() {
        if (this.isMunualClose || !this.retryOpen) {
            return;
        }

        const config = workspace.getConfiguration('server');
        const maxRetries: number = config.get('wsMaxRetries') || this.wsMaxRetries;
        if (this.wsMaxRetries-- <= 0) {
            log.info(`超过最大重试次数 (${maxRetries})`);
            return;
        }

        log.info(`${maxRetries - this.wsMaxRetries + 1}秒后尝试重连...`);
        this.reconnectTimer = setTimeout(() => {
            this.createSocket();
        }, this.wsBaseDelay * (maxRetries - this.wsMaxRetries + 1));
    }

    createSocket() {
        return new Promise((resolve, rejects) => {
            this.connect();
            let _this = this;
            if (!Client.socket) {
                return;
            }

            Client.socket.onerror = function () {
                if (!_this.retryOpen) {
                    log.modelError('连接失败');//重试的时候不输出错误消息
                }

                resolve("");
            };

            Client.socket.onopen = function () {
                log.modelInfo('连接成功');
                _this.retryOpen = true;//连接成功之后才能支持重试
                _this.init();//连接成功之后，将重试数据初始化
                resolve("");
            };

            Client.socket.onclose = function () {
                const config = workspace.getConfiguration('server');
                if (config.get('wsMaxRetries') == _this.wsMaxRetries) {
                    log.modelInfo('连接已关闭');//未重试，则提示关闭连接
                }
                _this.scheduleReconnect();
                resolve("");
            };
            Client.socket.onmessage = (event: MessageEvent) => {
                this.message(event);
            };
        });
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
                log.info('错误内容：' + err.message + "\n文件：" + err.sourceName + "\n行数：" + err.lineNumber + "\n" + "列号：" + err.columnNumber);
            } catch (e) {
                log.info(res['msg']);
            }
            return;
        }
        return log.modelError(res['msg']);
    }

    connect() {
        if (this.state()) {
            return;
        }

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        log.info("正在连接到手机：" + `ws://${this.socketIp}:${this.socketPort}`);
        try {
            Client.socket = new WebSocket(`ws://${this.socketIp}:${this.socketPort}`);
        } catch (e: any) {
            log.info(e.message);
        }
    }

    close() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        this.isMunualClose = true;
        Client.socket?.close();
        Client.socket = undefined;
    }

    state() {
        return Client.socket && Client.socket.readyState === Client.socket.OPEN;
    }

    fileDelete(baseDir: string, file: string, isDir: boolean = false) {
        try {
            let data = {
                status: 1003,
                file: file.substring(baseDir.length),
                isDir: isDir,
                body: ""
            };
            log.info((isDir ? '即将同步删除文件夹：' : "即将同步删除文件：") + file.substring(baseDir.length));
            Client.socket?.send(JSON.stringify(data));
        } catch (e: any) {
            log.modelError(e.message.toString());
        }
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
            Client.socket?.send(JSON.stringify(data));
        } catch (e: any) {
            log.modelError(e.message.toString());
        }
    }

    //初始化手机APP中项目文件
    initAppProject(files: Array<[number, string]>) {
        try {
            let data = {
                status: 1002,
                body: JSON.stringify(files),//这里主要不能直接转为utf8传输，否则图片等文件会丢失数据，导致问题
            };
            Client.socket?.send(JSON.stringify(data));
        } catch (e: any) {
            log.modelError(e.message.toString());
        }
    }

    projectSync(baseDir: string) {
        if (!setting.isProject()) {
            return log.modelError("非DeekeScript项目");
        }

        if (this.projectSyncing) {
            return true;
        }

        this.projectSyncing = true;
        this.projectSyncFiles = [[0, baseDir]];//重置发送的文件
        try {
            this.projectSyncDetail(baseDir, baseDir, true);
        } catch (e: any) {
            log.info(e.message.toString());
        }

        this.projectSyncing = false;
        this.initAppProject(this.projectSyncFiles);
        log.info("所有文件都已发送到APP端");
        return true;
    }

    projectSyncDetail(absolutePath: string, baseDir: string, isDir: boolean) {
        this.fileSync(absolutePath, baseDir, isDir);
        this.projectSyncFiles?.push([isDir ? 0 : 1, baseDir.substring(absolutePath.length)]);
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
            this.projectSyncFiles?.push([isDir ? 0 : 1, (baseDir + '/' + f).substring(absolutePath.length)]);
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
        if (!Client.socket) {
            return false;
        }

        Client.socket.send(JSON.stringify(data), {
            "compress": true,//压缩
        }, (err) => {
            if (err) {
                log.info("错误消息");
                return log.modelError(err?.message.toString());
            }
        });
    }
}
