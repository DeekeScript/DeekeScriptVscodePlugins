import * as fs from "fs";
import * as vscode from "vscode";
import { workspace } from "vscode";
import { WebSocketService } from './services/WebSocketService';
import { FileSyncService } from './services/FileSyncService';
import { FileRunData, StopData, ProjectRunData, ClientConfig } from './types';
import log from './unit/log';
import setting from "./setting";
import { isValidIPAddress, getRelativePath } from './utils';
import { showConnectionProgress } from './utils/progress';

export default class Client {
    private wsService: WebSocketService;
    private fileSyncService: FileSyncService;
    private config: ClientConfig;
    private socketIp: string;

    constructor(socketIp: string) {
        if (!isValidIPAddress(socketIp)) {
            throw new Error('无效的IP地址格式');
        }

        this.socketIp = socketIp;
        this.config = this.loadConfig();
        
        this.wsService = new WebSocketService(socketIp, this.config);
        this.fileSyncService = new FileSyncService(this.wsService);
    }

    private loadConfig(): ClientConfig {
        const config = workspace.getConfiguration('server');
        return {
            port: config.get('port') || 8088,
            wsMaxRetries: config.get('wsMaxRetries') || 59,
            wsBaseDelay: config.get('wsBaseDelay') || 1000
        };
    }

    // 更新配置
    updateConfig(): void {
        this.config = this.loadConfig();
        this.wsService.updateConfig(this.config);
    }

    // 连接WebSocket
    async createSocket(): Promise<void> {
        try {
            await showConnectionProgress(async () => {
                await this.wsService.connect();
            });
        } catch (error) {
            //log.error(`连接失败：${error instanceof Error ? error.message : '未知错误'}`);
            throw error;
        }
    }

    // 检查连接状态
    state(): boolean {
        return this.wsService.isConnected;
    }

    // 获取连接的IP地址
    getSocketIp(): string {
        return this.socketIp;
    }

    // 关闭连接
    close(): void {
        this.wsService.close();
    }

    // 删除文件
    async fileDelete(baseDir: string, file: string, isDir: boolean = false): Promise<void> {
        try {
            await this.fileSyncService.deleteFile(baseDir, file, isDir);
        } catch (error) {
            log.error(`删除文件失败：${error instanceof Error ? error.message : '未知错误'}`);
            throw error;
        }
    }

    // 同步文件
    async fileSync(baseDir: string, file: string, isDir: boolean = false, document?: vscode.TextDocument): Promise<void> {
        try {
            await this.fileSyncService.syncFile(baseDir, file, isDir, document);
        } catch (error) {
            log.error(`同步文件失败：${error instanceof Error ? error.message : '未知错误'}`);
            throw error;
        }
    }

    // 同步项目
    async projectSync(baseDir: string): Promise<boolean> {
        if (!setting.isProject()) {
            log.showError("非DeekeScript项目");
            return false;
        }

        try {
            const result = await this.fileSyncService.syncProject(baseDir);
            return result.success;
        } catch (error) {
            log.error(`项目同步失败：${error instanceof Error ? error.message : '未知错误'}`);
            return false;
        }
    }

    // 运行文件
    async fileRunCommand(obj: { absolutePath: string, file: string }): Promise<void> {
        try {
            const data: Omit<FileRunData, 'key'> = {
                status: 1,
                body: fs.readFileSync(obj.file).toString('utf8'),
                file: getRelativePath(obj.absolutePath, obj.file)
            };
            await this.wsService.send(data);
        } catch (error) {
            log.error(`运行文件失败：${error instanceof Error ? error.message : '未知错误'}`);
            throw error;
        }
    }

    // 停止所有脚本
    async stopCommand(): Promise<void> {
        try {
            const data: Omit<StopData, 'key'> = { status: 0 };
            await this.wsService.send(data);
        } catch (error) {
            log.error(`停止脚本失败：${error instanceof Error ? error.message : '未知错误'}`);
            throw error;
        }
    }

    // 运行项目
    async projectRunCommand(): Promise<void> {
        try {
            const data: Omit<ProjectRunData, 'key'> = { 
                status: 1,
                command: "projectRunCommand" 
            };
            await this.wsService.send(data);
        } catch (error) {
            log.error(`运行项目失败：${error instanceof Error ? error.message : '未知错误'}`);
            throw error;
        }
    }

    // 获取同步状态
    getSyncState() {
        return this.fileSyncService.state;
    }

    // 重置重连状态
    resetRetryState(): void {
        this.wsService.resetRetryState();
    }

    // 获取重连状态信息
    getRetryInfo() {
        return this.wsService.getRetryInfo();
    }
} 