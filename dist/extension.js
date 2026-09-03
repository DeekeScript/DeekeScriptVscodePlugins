/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.activate = activate;
exports.deactivate = deactivate;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = __importStar(__webpack_require__(1));
const Client_1 = __importDefault(__webpack_require__(2));
const setting_1 = __importDefault(__webpack_require__(34));
const log_1 = __importStar(__webpack_require__(33));
const Workspace_1 = __webpack_require__(39);
const language_1 = __webpack_require__(40);
const DeviceDiscoveryService_1 = __webpack_require__(47);
const config_1 = __webpack_require__(4);
function activate(context) {
    setting_1.default.init(context); //创建日志窗口， 设置extension变量
    // Generate .vscode/deekeScriptPro.d.ts + jsconfig.json for TypeScript-based IntelliSense
    (0, language_1.activateLanguageFeatures)(context);
    // 初始化日志配置，确保在Windows PowerShell等环境中禁用颜色
    log_1.default.setConfig({
        level: log_1.LogLevel.INFO,
        showNotifications: true,
        enableFileLogging: true,
        enableColors: false // 在VSCode扩展中禁用颜色以避免乱码
    });
    log_1.default.modelInfo("~_~ 欢迎使用" + context.extension.packageJSON.displayName + "~");
    let client = undefined;
    let workspace = new Workspace_1.Workspace();
    workspace.init(context); //监听工作区文件变化
    // 全局状态（跨工作区持久化）
    const globalState = context.globalState;
    const serverConfig = config_1.configManager.getServerConfig();
    const discovery = new DeviceDiscoveryService_1.DeviceDiscoveryService({
        port: serverConfig.port,
        intervalMs: serverConfig.discoveryIntervalMs,
        shouldScan: () => {
            if (!setting_1.default.isProject()) {
                return false;
            }
            const cfg = config_1.configManager.getServerConfig();
            if (!cfg.discoveryEnabled) {
                return false;
            }
            if (!client) {
                return true;
            }
            return client.allowsAutoDiscovery();
        },
        getLastKnownIp: () => globalState.get('deekeScriptPro.ip'),
        onDevicesFound: async (ips) => {
            if (ips.length === 1) {
                await connectToDevice(ips[0], { auto: true });
                return;
            }
            const pick = await vscode.window.showQuickPick(ips.map((ip) => ({ label: ip, description: 'DeekeScript Pro 手机端' })), { title: '发现多台设备，请选择要连接的手机', placeHolder: ips[0] });
            if (pick) {
                await connectToDevice(pick.label, { auto: true });
            }
        }
    });
    const ensureDiscoveryRunning = () => {
        if (config_1.configManager.getServerConfig().discoveryEnabled) {
            discovery.start();
        }
    };
    async function connectToDevice(ip, options = {}) {
        if (!/([\d]{1,3}\.){3}[\d]{1,3}/.test(ip)) {
            log_1.default.showError("手机连接地址有误~");
            return false;
        }
        if (client && client.state()) {
            const currentIp = client.getSocketIp();
            if (currentIp === ip) {
                if (!options.auto) {
                    log_1.default.showError('已经连接成功，无需再次连接');
                }
                return true;
            }
        }
        discovery.pause();
        const newClient = new Client_1.default(ip);
        try {
            await globalState.update('deekeScriptPro.ip', ip);
            await newClient.createSocket();
            if (client) {
                client.close();
            }
            client = newClient;
            workspace.setClient(client);
            workspace.setStop(false);
            if (options.auto) {
                log_1.default.showInfo(`局域网扫描连接成功：${ip}`);
                log_1.default.info(`局域网扫描连接成功：${ip}`);
            }
            return true;
        }
        catch (error) {
            newClient.close();
            const message = error instanceof Error ? error.message : '未知错误';
            if (options.silentFail) {
                log_1.default.info(`自动连接 ${ip} 失败（${message}），将继续扫描局域网`);
            }
            else {
                log_1.default.showError(`连接失败：${message}`);
            }
            return false;
        }
        finally {
            discovery.resume();
        }
    }
    const syncAutoConnectWithProject = async () => {
        if (!setting_1.default.isProject()) {
            discovery.stop();
            return;
        }
        if (!config_1.configManager.getServerConfig().discoveryEnabled) {
            return;
        }
        log_1.default.info('检测到 deekeScript.json，开始自动扫描并连接手机...');
        ensureDiscoveryRunning();
        const lastIp = globalState.get('deekeScriptPro.ip');
        if (lastIp && /^192\.168\./.test(lastIp) && !(client && client.state())) {
            await connectToDevice(lastIp, { auto: true, silentFail: true });
        }
    };
    void syncAutoConnectWithProject();
    context.subscriptions.push({ dispose: () => discovery.stop() });
    const deekeJsonWatcher = vscode.workspace.createFileSystemWatcher('**/deekeScript.json');
    deekeJsonWatcher.onDidCreate(() => {
        void syncAutoConnectWithProject();
    });
    deekeJsonWatcher.onDidDelete(() => {
        discovery.stop();
    });
    context.subscriptions.push(deekeJsonWatcher);
    context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => {
        void syncAutoConnectWithProject();
    }));
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
        if (!event.affectsConfiguration('deekeScriptPro.server')) {
            return;
        }
        config_1.configManager.reloadConfig();
        const next = config_1.configManager.getServerConfig();
        discovery.updatePort(next.port);
        if (next.discoveryEnabled) {
            ensureDiscoveryRunning();
        }
        else {
            discovery.stop();
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('deekeScriptPro.serverRun', async () => {
        const input = vscode.window.createInputBox();
        const ip = globalState.get('deekeScriptPro.ip');
        if (ip) {
            input.value = ip;
        }
        input.title = '请输入手机 IP（192.168.x.x；留空可等待自动扫描）';
        input.placeholder = '扩展会根据本机 192.168 网段自动扫描';
        discovery.pause();
        input.show();
        input.onDidAccept(async () => {
            const param = input.value.trim();
            if (!param) {
                input.hide();
                discovery.resume();
                ensureDiscoveryRunning();
                return;
            }
            input.hide();
            discovery.resume();
            await connectToDevice(param);
        });
        input.onDidHide(() => {
            discovery.resume();
        });
    }));
    let errorMsg = "未连接手机或连接中断（扩展会自动扫描，也可手动执行“连接手机”）";
    context.subscriptions.push(vscode.commands.registerCommand('deekeScriptPro.projectSync', () => {
        if (!client?.state()) {
            return log_1.default.modelError(errorMsg);
        }
        if (vscode.window?.activeTextEditor?.document) {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri);
            if (!workspaceFolder) {
                return log_1.default.modelError("当前文件不属于任何工作区");
            }
            client?.projectSync(workspaceFolder.uri.fsPath);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('deekeScriptPro.fileSync', () => {
        if (!client?.state()) {
            return log_1.default.modelError(errorMsg);
        }
        if (vscode.window?.activeTextEditor?.document) {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri);
            if (!workspaceFolder) {
                return log_1.default.modelError("当前文件不属于任何工作区");
            }
            client.fileSync(workspaceFolder.uri.fsPath, vscode.window?.activeTextEditor?.document?.fileName, false);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('deekeScriptPro.run', () => {
        if (!client?.state()) {
            return log_1.default.modelError(errorMsg);
        }
        if (vscode.window?.activeTextEditor?.document) {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri);
            if (!workspaceFolder) {
                return log_1.default.modelError("当前文件不属于任何工作区");
            }
            client.fileRunCommand({
                absolutePath: workspaceFolder.uri.fsPath,
                file: vscode.window?.activeTextEditor?.document?.fileName,
            });
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('deekeScriptPro.projectRun', () => {
        if (!client?.state()) {
            return log_1.default.modelError(errorMsg);
        }
        client.projectRunCommand();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('deekeScriptPro.stopAll', () => {
        if (!client?.state()) {
            return log_1.default.modelError(errorMsg);
        }
        client.stopCommand();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('deekeScriptPro.serverClose', () => {
        if (client?.state()) {
            client.close();
            workspace.setClient(undefined);
            workspace.setStop(true); //stop workspace listening
            log_1.default.showInfo("连接关闭成功");
            ensureDiscoveryRunning();
        }
        else {
            client?.close();
            workspace.setClient(undefined);
            log_1.default.showError("连接未开启");
            ensureDiscoveryRunning();
        }
    }));
    // 添加重置重连状态的命令
    context.subscriptions.push(vscode.commands.registerCommand('deekeScriptPro.resetRetry', () => {
        if (client) {
            client.resetRetryState();
            log_1.default.showInfo("重连状态已重置");
            ensureDiscoveryRunning();
        }
        else {
            log_1.default.showError("客户端未初始化");
        }
    }));
    // 添加显示状态的命令
    context.subscriptions.push(vscode.commands.registerCommand('deekeScriptPro.showStatus', () => {
        if (client) {
            const retryInfo = client.getRetryInfo();
            const syncState = client.getSyncState();
            const statusMessage = [
                `连接状态: ${client.state() ? '已连接' : '未连接'}`,
                `重连次数: ${retryInfo.currentRetryCount}/${retryInfo.maxRetries}`,
                `曾经连接: ${retryInfo.hasConnectedOnce ? '是' : '否'}`,
                `自动发现: ${client.allowsAutoDiscovery() ? '扫描中' : '已暂停（已连接或重连中）'}`,
                `同步状态: ${syncState.isSyncing ? '同步中' : '空闲'}`,
                `已同步文件: ${syncState.syncedFiles}/${syncState.totalFiles}`,
                `同步错误: ${syncState.errors.length}个`
            ].join('\n');
            log_1.default.showInfo(`当前状态:\n${statusMessage}`);
        }
        else {
            log_1.default.showInfo('当前状态:\n连接状态: 未连接\n自动发现: 扫描中');
        }
    }));
}
// This method is called when your extension is deactivated
function deactivate() { }


/***/ }),
/* 1 */
/***/ ((module) => {

module.exports = require("vscode");

/***/ }),
/* 2 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
const fs = __importStar(__webpack_require__(3));
const config_1 = __webpack_require__(4);
const WebSocketService_1 = __webpack_require__(5);
const FileSyncService_1 = __webpack_require__(36);
const log_1 = __importDefault(__webpack_require__(33));
const setting_1 = __importDefault(__webpack_require__(34));
const utils_1 = __webpack_require__(37);
const progress_1 = __webpack_require__(38);
class Client {
    wsService;
    fileSyncService;
    config;
    socketIp;
    constructor(socketIp) {
        if (!(0, utils_1.isValidIPAddress)(socketIp)) {
            throw new Error('无效的IP地址格式');
        }
        this.socketIp = socketIp;
        this.config = this.loadConfig();
        this.wsService = new WebSocketService_1.WebSocketService(socketIp, this.config);
        this.fileSyncService = new FileSyncService_1.FileSyncService(this.wsService);
    }
    loadConfig() {
        const config = config_1.configManager.getServerConfig();
        return {
            port: config.port,
            wsMaxRetries: config.wsMaxRetries,
            wsBaseDelay: config.wsBaseDelay
        };
    }
    // 更新配置
    updateConfig() {
        this.config = this.loadConfig();
        this.wsService.updateConfig(this.config);
    }
    // 连接WebSocket
    async createSocket() {
        try {
            await (0, progress_1.showConnectionProgress)(async () => {
                await this.wsService.connect();
            });
        }
        catch (error) {
            //log.error(`连接失败：${error instanceof Error ? error.message : '未知错误'}`);
            throw error;
        }
    }
    // 检查连接状态
    state() {
        return this.wsService.isConnected;
    }
    // 获取连接的IP地址
    getSocketIp() {
        return this.socketIp;
    }
    // 关闭连接
    close() {
        this.wsService.close();
    }
    // 删除文件
    async fileDelete(baseDir, file, isDir = false) {
        try {
            await this.fileSyncService.deleteFile(baseDir, file, isDir);
        }
        catch (error) {
            log_1.default.error(`删除文件失败：${error instanceof Error ? error.message : '未知错误'}`);
            throw error;
        }
    }
    // 同步文件
    async fileSync(baseDir, file, isDir = false, document) {
        try {
            await this.fileSyncService.syncFile(baseDir, file, isDir, document);
        }
        catch (error) {
            log_1.default.error(`同步文件失败：${error instanceof Error ? error.message : '未知错误'}`);
            throw error;
        }
    }
    // 同步项目
    async projectSync(baseDir) {
        if (!setting_1.default.isProject()) {
            log_1.default.showError("非DeekeScript项目");
            return false;
        }
        try {
            const result = await this.fileSyncService.syncProject(baseDir);
            return result.success;
        }
        catch (error) {
            log_1.default.error(`项目同步失败：${error instanceof Error ? error.message : '未知错误'}`);
            return false;
        }
    }
    // 运行文件
    async fileRunCommand(obj) {
        try {
            const data = {
                status: 1,
                body: fs.readFileSync(obj.file).toString('utf8'),
                file: (0, utils_1.getRelativePath)(obj.absolutePath, obj.file)
            };
            await this.wsService.send(data);
        }
        catch (error) {
            log_1.default.error(`运行文件失败：${error instanceof Error ? error.message : '未知错误'}`);
            throw error;
        }
    }
    // 停止所有脚本
    async stopCommand() {
        try {
            const data = { status: 0 };
            await this.wsService.send(data);
        }
        catch (error) {
            log_1.default.error(`停止脚本失败：${error instanceof Error ? error.message : '未知错误'}`);
            throw error;
        }
    }
    // 运行项目
    async projectRunCommand() {
        try {
            const data = {
                status: 1,
                command: "projectRunCommand"
            };
            await this.wsService.send(data);
        }
        catch (error) {
            log_1.default.error(`运行项目失败：${error instanceof Error ? error.message : '未知错误'}`);
            throw error;
        }
    }
    // 获取同步状态
    getSyncState() {
        return this.fileSyncService.state;
    }
    // 重置重连状态
    resetRetryState() {
        this.wsService.resetRetryState();
    }
    // 获取重连状态信息
    getRetryInfo() {
        return this.wsService.getRetryInfo();
    }
    /** 是否允许局域网自动发现 */
    allowsAutoDiscovery() {
        return this.wsService.allowsAutoDiscovery();
    }
}
exports["default"] = Client;


/***/ }),
/* 3 */
/***/ ((module) => {

module.exports = require("fs");

/***/ }),
/* 4 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.configManager = exports.ConfigManager = void 0;
const vscode = __importStar(__webpack_require__(1));
class ConfigManager {
    static instance;
    config;
    constructor() {
        this.config = this.loadConfig();
    }
    static getInstance() {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }
    loadConfig() {
        const workspaceConfig = vscode.workspace.getConfiguration('deekeScriptPro');
        return {
            server: {
                port: workspaceConfig.get('server.port', 8088),
                wsMaxRetries: workspaceConfig.get('server.wsMaxRetries', 59),
                wsBaseDelay: workspaceConfig.get('server.wsBaseDelay', 1000),
                discoveryEnabled: workspaceConfig.get('server.discoveryEnabled', true),
                discoveryIntervalMs: workspaceConfig.get('server.discoveryIntervalMs', 5000)
            },
            logging: {
                level: workspaceConfig.get('logging.level', 'info'),
                enableColors: workspaceConfig.get('logging.enableColors', true),
                showNotifications: workspaceConfig.get('logging.showNotifications', true)
            },
            sync: {
                debounceDelay: workspaceConfig.get('sync.debounceDelay', 500),
                autoSync: workspaceConfig.get('sync.autoSync', true),
                excludePatterns: workspaceConfig.get('sync.excludePatterns', ['node_modules', '.git', '.vscode'])
            }
        };
    }
    getConfig() {
        return { ...this.config };
    }
    updateConfig(updates) {
        this.config = { ...this.config, ...updates };
        this.saveConfig();
    }
    async saveConfig() {
        const workspaceConfig = vscode.workspace.getConfiguration('deekeScriptPro');
        // 更新服务器配置
        await workspaceConfig.update('server.port', this.config.server.port, vscode.ConfigurationTarget.Workspace);
        await workspaceConfig.update('server.wsMaxRetries', this.config.server.wsMaxRetries, vscode.ConfigurationTarget.Workspace);
        await workspaceConfig.update('server.wsBaseDelay', this.config.server.wsBaseDelay, vscode.ConfigurationTarget.Workspace);
        // 更新日志配置
        await workspaceConfig.update('logging.level', this.config.logging.level, vscode.ConfigurationTarget.Workspace);
        await workspaceConfig.update('logging.enableColors', this.config.logging.enableColors, vscode.ConfigurationTarget.Workspace);
        await workspaceConfig.update('logging.showNotifications', this.config.logging.showNotifications, vscode.ConfigurationTarget.Workspace);
        // 更新同步配置
        await workspaceConfig.update('sync.debounceDelay', this.config.sync.debounceDelay, vscode.ConfigurationTarget.Workspace);
        await workspaceConfig.update('sync.autoSync', this.config.sync.autoSync, vscode.ConfigurationTarget.Workspace);
        await workspaceConfig.update('sync.excludePatterns', this.config.sync.excludePatterns, vscode.ConfigurationTarget.Workspace);
    }
    // 获取服务器配置
    getServerConfig() {
        return this.config.server;
    }
    // 获取日志配置
    getLoggingConfig() {
        return this.config.logging;
    }
    // 获取同步配置
    getSyncConfig() {
        return this.config.sync;
    }
    // 检查文件是否应该被排除
    shouldExcludeFile(filePath) {
        return this.config.sync.excludePatterns.some(pattern => filePath.includes(pattern));
    }
    // 重新加载配置
    reloadConfig() {
        this.config = this.loadConfig();
    }
}
exports.ConfigManager = ConfigManager;
// 导出单例实例
exports.configManager = ConfigManager.getInstance();


/***/ }),
/* 5 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.WebSocketService = void 0;
const ws_1 = __webpack_require__(6);
const types_1 = __webpack_require__(32);
const log_1 = __importDefault(__webpack_require__(33));
class WebSocketService {
    socket = undefined;
    socketIp;
    socketPort;
    wsMaxRetries;
    isManualClose = false;
    retryOpen = false;
    reconnectTimer = null;
    connectionState = types_1.ConnectionState.DISCONNECTED;
    messageHandlers = new Map();
    // 消息key管理
    pendingRequests = new Map();
    requestTimeout = 10000; // 10秒超时
    // 重连相关状态
    currentRetryCount = 0;
    hasConnectedOnce = false; // 标记是否曾经连接成功过
    constructor(socketIp, config) {
        this.socketIp = socketIp;
        this.socketPort = config.port;
        this.wsMaxRetries = config.wsMaxRetries;
    }
    get state() {
        return this.connectionState;
    }
    get isConnected() {
        return this.socket?.readyState === ws_1.WebSocket.OPEN;
    }
    // 注册消息处理器
    onMessage(type, handler) {
        this.messageHandlers.set(type, handler);
    }
    // 连接WebSocket
    async connect() {
        if (this.isConnected) {
            log_1.default.formatWarning('WebSocket已经连接，无需再次连接');
            return;
        }
        this.connectionState = types_1.ConnectionState.CONNECTING;
        log_1.default.logConnectionStatus('connecting', `ws://${this.socketIp}:${this.socketPort}`);
        try {
            await this.createConnection();
            // 连接成功处理已在onopen事件中完成
        }
        catch (error) {
            this.connectionState = types_1.ConnectionState.DISCONNECTED;
            //log.formatError(`连接失败：${error instanceof Error ? error.message : '未知错误'}`);
            throw error;
        }
    }
    createConnection() {
        return new Promise((resolve, reject) => {
            try {
                this.socket = new ws_1.WebSocket(`ws://${this.socketIp}:${this.socketPort}`);
                this.socket.onopen = () => {
                    this.connectionState = types_1.ConnectionState.CONNECTED;
                    this.retryOpen = true;
                    this.hasConnectedOnce = true; // 标记曾经连接成功过
                    this.currentRetryCount = 0; // 连接成功后重置重连计数器
                    log_1.default.logConnectionStatus('connected');
                    resolve();
                };
                this.socket.onclose = () => {
                    this.connectionState = types_1.ConnectionState.DISCONNECTED;
                    if (this.retryOpen && !this.isManualClose) {
                        this.scheduleReconnect();
                    }
                    else {
                        log_1.default.logConnectionStatus('disconnected');
                    }
                    resolve();
                };
                this.socket.onerror = (error) => {
                    if (!this.retryOpen) {
                        log_1.default.showError(`连接失败：${error.message}`);
                        //vscode.window.showErrorMessage('连接错误');
                    }
                    reject(error);
                };
                this.socket.onmessage = (event) => {
                    this.handleMessage(event);
                };
                this.socket.on('unexpected-response', (_req, res) => {
                    if (res.statusCode == 101) {
                        log_1.default.showError(`连接失败（请关闭电脑的vpn代理，重启vscode；连接成功后，再开启vpn即可！）`);
                        return;
                    }
                    log_1.default.showError(`连接失败，状态码: ${res.statusCode}`);
                    //vscode.window.showErrorMessage(`连接错误，状态码: ${res.statusCode}`);
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    handleMessage(event) {
        try {
            const data = JSON.parse(event.data.toString());
            // 检查是否是服务端响应消息（新格式）
            if (data.key && this.pendingRequests.has(data.key)) {
                this.handleServerResponse(data);
                return;
            }
            // 处理旧格式的消息
            const message = data;
            if (message.code === 0) {
                this.handleSuccessMessage(message.msg);
                // 如果有待处理的请求，假设这个成功消息是对它们的响应
                this.resolveAllPendingRequests();
            }
            else {
                log_1.default.showError(message.msg);
                // 如果有待处理的请求，假设这个错误消息是对它们的响应
                this.rejectAllPendingRequests(new Error(message.msg));
            }
        }
        catch (error) {
            log_1.default.error(`消息解析失败：${error instanceof Error ? error.message : '未知错误'}`);
            // 解析失败时，拒绝所有待处理的请求
            this.rejectAllPendingRequests(new Error('消息解析失败'));
        }
    }
    // 解析所有待处理的请求（用于旧格式消息）
    resolveAllPendingRequests() {
        for (const [, request] of this.pendingRequests.entries()) {
            clearTimeout(request.timeout);
            request.resolve({ success: true, code: 0, msg: '操作成功' });
        }
        this.pendingRequests.clear();
    }
    // 拒绝所有待处理的请求（用于旧格式消息）
    rejectAllPendingRequests(error) {
        for (const [, request] of this.pendingRequests.entries()) {
            clearTimeout(request.timeout);
            request.reject(error);
        }
        this.pendingRequests.clear();
    }
    handleServerResponse(response) {
        const pendingRequest = this.pendingRequests.get(response.key);
        if (!pendingRequest) {
            return;
        }
        // 清除超时定时器
        clearTimeout(pendingRequest.timeout);
        this.pendingRequests.delete(response.key);
        if (response.code == 0) {
            pendingRequest.resolve(response);
        }
        else {
            pendingRequest.reject(new Error(response.msg));
        }
    }
    handleSuccessMessage(msg) {
        try {
            const info = JSON.parse(msg);
            if (info.code === 0) {
                log_1.default.info(info.message);
                return;
            }
            // 处理错误信息
            const errorInfo = info.message;
            log_1.default.error(`${errorInfo.message}\n文件：${errorInfo.sourceName}\n行数：${errorInfo.lineNumber}\n列号：${errorInfo.columnNumber}`);
        }
        catch (error) {
            log_1.default.info(msg);
        }
    }
    scheduleReconnect() {
        if (this.isManualClose || !this.retryOpen) {
            return;
        }
        // 检查重连次数限制
        if (this.currentRetryCount >= this.wsMaxRetries) {
            log_1.default.formatError(`超过最大重连次数 (${this.wsMaxRetries})，停止重连`);
            this.retryOpen = false;
            this.connectionState = types_1.ConnectionState.DISCONNECTED;
            return;
        }
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        this.currentRetryCount++;
        this.connectionState = types_1.ConnectionState.RECONNECTING;
        // 计算重连延迟时间 - 逐步增加1秒
        const delayTime = this.currentRetryCount * 1000; // 1s, 2s, 3s, 4s...
        log_1.default.logConnectionStatus('reconnecting', `第${this.currentRetryCount}次重连，${this.currentRetryCount}s后尝试...`);
        this.reconnectTimer = setTimeout(() => {
            this.createConnection().then(() => {
                // 重连成功，重置计数
                this.currentRetryCount = 0;
                this.connectionState = types_1.ConnectionState.CONNECTED;
                // 重连成功的日志已在onopen事件中处理
            }).catch(() => {
            });
        }, delayTime);
    }
    // 生成唯一消息key
    generateMessageKey() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    // 发送消息并等待响应
    sendWithResponse(data) {
        return new Promise((resolve, reject) => {
            if (!this.socket || this.socket.readyState !== ws_1.WebSocket.OPEN) {
                reject(new Error('WebSocket未连接'));
                return;
            }
            // 生成唯一key
            const messageKey = this.generateMessageKey();
            const messageWithKey = { ...data, key: messageKey };
            // 设置超时定时器
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(messageKey);
                reject(new Error(`请求超时 (${this.requestTimeout}ms)`));
            }, this.requestTimeout);
            // 保存待处理的请求
            this.pendingRequests.set(messageKey, { resolve, reject, timeout });
            try {
                const message = JSON.stringify(messageWithKey);
                this.socket.send(message, { compress: true }, (error) => {
                    if (error) {
                        // 发送失败，清理待处理请求
                        this.pendingRequests.delete(messageKey);
                        clearTimeout(timeout);
                        log_1.default.error(`发送消息失败：${error.message}`);
                        reject(error);
                    }
                });
            }
            catch (error) {
                // 序列化失败，清理待处理请求
                this.pendingRequests.delete(messageKey);
                clearTimeout(timeout);
                reject(error);
            }
        });
    }
    // 发送消息（不等待响应，兼容旧接口）
    send(data) {
        return new Promise((resolve, reject) => {
            if (!this.socket || this.socket.readyState !== ws_1.WebSocket.OPEN) {
                reject(new Error('WebSocket未连接'));
                return;
            }
            try {
                const message = JSON.stringify(data);
                this.socket.send(message, { compress: true }, (error) => {
                    if (error) {
                        log_1.default.error(`发送消息失败：${error.message}`);
                        reject(error);
                    }
                    else {
                        resolve();
                    }
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    // 关闭连接
    close() {
        this.isManualClose = true;
        this.retryOpen = false;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.socket) {
            this.socket.close();
            this.socket = undefined;
        }
        this.connectionState = types_1.ConnectionState.DISCONNECTED;
        // 重置重连状态
        this.currentRetryCount = 0;
        this.hasConnectedOnce = false;
    }
    // 更新配置
    updateConfig(config) {
        if (config.port !== undefined)
            this.socketPort = config.port;
        if (config.wsMaxRetries !== undefined)
            this.wsMaxRetries = config.wsMaxRetries;
        // wsBaseDelay 不再使用，忽略该配置
    }
    // 重置重连状态
    resetRetryState() {
        this.currentRetryCount = 0;
        this.hasConnectedOnce = false;
        log_1.default.info('重连状态已重置');
    }
    // 获取重连状态信息
    getRetryInfo() {
        return {
            currentRetryCount: this.currentRetryCount,
            hasConnectedOnce: this.hasConnectedOnce,
            maxRetries: this.wsMaxRetries
        };
    }
    /** 是否允许局域网自动发现（未连接且不在重连过程中） */
    allowsAutoDiscovery() {
        if (this.isConnected) {
            return false;
        }
        if (this.connectionState === types_1.ConnectionState.CONNECTING) {
            return false;
        }
        if (this.connectionState === types_1.ConnectionState.RECONNECTING) {
            return false;
        }
        if (this.reconnectTimer) {
            return false;
        }
        // 曾连上过且仍在重试周期内 → 交给重连逻辑，不扫网
        if (this.retryOpen && this.currentRetryCount < this.wsMaxRetries) {
            return false;
        }
        return true;
    }
}
exports.WebSocketService = WebSocketService;


/***/ }),
/* 6 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



const WebSocket = __webpack_require__(7);

WebSocket.createWebSocketStream = __webpack_require__(29);
WebSocket.Server = __webpack_require__(30);
WebSocket.Receiver = __webpack_require__(22);
WebSocket.Sender = __webpack_require__(26);

WebSocket.WebSocket = WebSocket;
WebSocket.WebSocketServer = WebSocket.Server;

module.exports = WebSocket;


/***/ }),
/* 7 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "^Duplex|Readable$", "caughtErrors": "none" }] */



const EventEmitter = __webpack_require__(8);
const https = __webpack_require__(9);
const http = __webpack_require__(10);
const net = __webpack_require__(11);
const tls = __webpack_require__(12);
const { randomBytes, createHash } = __webpack_require__(13);
const { Duplex, Readable } = __webpack_require__(14);
const { URL } = __webpack_require__(15);

const PerMessageDeflate = __webpack_require__(16);
const Receiver = __webpack_require__(22);
const Sender = __webpack_require__(26);
const { isBlob } = __webpack_require__(23);

const {
  BINARY_TYPES,
  EMPTY_BUFFER,
  GUID,
  kForOnEventAttribute,
  kListener,
  kStatusCode,
  kWebSocket,
  NOOP
} = __webpack_require__(19);
const {
  EventTarget: { addEventListener, removeEventListener }
} = __webpack_require__(27);
const { format, parse } = __webpack_require__(28);
const { toBuffer } = __webpack_require__(18);

const closeTimeout = 30 * 1000;
const kAborted = Symbol('kAborted');
const protocolVersions = [8, 13];
const readyStates = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
const subprotocolRegex = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/;

/**
 * Class representing a WebSocket.
 *
 * @extends EventEmitter
 */
class WebSocket extends EventEmitter {
  /**
   * Create a new `WebSocket`.
   *
   * @param {(String|URL)} address The URL to which to connect
   * @param {(String|String[])} [protocols] The subprotocols
   * @param {Object} [options] Connection options
   */
  constructor(address, protocols, options) {
    super();

    this._binaryType = BINARY_TYPES[0];
    this._closeCode = 1006;
    this._closeFrameReceived = false;
    this._closeFrameSent = false;
    this._closeMessage = EMPTY_BUFFER;
    this._closeTimer = null;
    this._errorEmitted = false;
    this._extensions = {};
    this._paused = false;
    this._protocol = '';
    this._readyState = WebSocket.CONNECTING;
    this._receiver = null;
    this._sender = null;
    this._socket = null;

    if (address !== null) {
      this._bufferedAmount = 0;
      this._isServer = false;
      this._redirects = 0;

      if (protocols === undefined) {
        protocols = [];
      } else if (!Array.isArray(protocols)) {
        if (typeof protocols === 'object' && protocols !== null) {
          options = protocols;
          protocols = [];
        } else {
          protocols = [protocols];
        }
      }

      initAsClient(this, address, protocols, options);
    } else {
      this._autoPong = options.autoPong;
      this._isServer = true;
    }
  }

  /**
   * For historical reasons, the custom "nodebuffer" type is used by the default
   * instead of "blob".
   *
   * @type {String}
   */
  get binaryType() {
    return this._binaryType;
  }

  set binaryType(type) {
    if (!BINARY_TYPES.includes(type)) return;

    this._binaryType = type;

    //
    // Allow to change `binaryType` on the fly.
    //
    if (this._receiver) this._receiver._binaryType = type;
  }

  /**
   * @type {Number}
   */
  get bufferedAmount() {
    if (!this._socket) return this._bufferedAmount;

    return this._socket._writableState.length + this._sender._bufferedBytes;
  }

  /**
   * @type {String}
   */
  get extensions() {
    return Object.keys(this._extensions).join();
  }

  /**
   * @type {Boolean}
   */
  get isPaused() {
    return this._paused;
  }

  /**
   * @type {Function}
   */
  /* istanbul ignore next */
  get onclose() {
    return null;
  }

  /**
   * @type {Function}
   */
  /* istanbul ignore next */
  get onerror() {
    return null;
  }

  /**
   * @type {Function}
   */
  /* istanbul ignore next */
  get onopen() {
    return null;
  }

  /**
   * @type {Function}
   */
  /* istanbul ignore next */
  get onmessage() {
    return null;
  }

  /**
   * @type {String}
   */
  get protocol() {
    return this._protocol;
  }

  /**
   * @type {Number}
   */
  get readyState() {
    return this._readyState;
  }

  /**
   * @type {String}
   */
  get url() {
    return this._url;
  }

  /**
   * Set up the socket and the internal resources.
   *
   * @param {Duplex} socket The network socket between the server and client
   * @param {Buffer} head The first packet of the upgraded stream
   * @param {Object} options Options object
   * @param {Boolean} [options.allowSynchronousEvents=false] Specifies whether
   *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
   *     multiple times in the same tick
   * @param {Function} [options.generateMask] The function used to generate the
   *     masking key
   * @param {Number} [options.maxPayload=0] The maximum allowed message size
   * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
   *     not to skip UTF-8 validation for text and close messages
   * @private
   */
  setSocket(socket, head, options) {
    const receiver = new Receiver({
      allowSynchronousEvents: options.allowSynchronousEvents,
      binaryType: this.binaryType,
      extensions: this._extensions,
      isServer: this._isServer,
      maxPayload: options.maxPayload,
      skipUTF8Validation: options.skipUTF8Validation
    });

    const sender = new Sender(socket, this._extensions, options.generateMask);

    this._receiver = receiver;
    this._sender = sender;
    this._socket = socket;

    receiver[kWebSocket] = this;
    sender[kWebSocket] = this;
    socket[kWebSocket] = this;

    receiver.on('conclude', receiverOnConclude);
    receiver.on('drain', receiverOnDrain);
    receiver.on('error', receiverOnError);
    receiver.on('message', receiverOnMessage);
    receiver.on('ping', receiverOnPing);
    receiver.on('pong', receiverOnPong);

    sender.onerror = senderOnError;

    //
    // These methods may not be available if `socket` is just a `Duplex`.
    //
    if (socket.setTimeout) socket.setTimeout(0);
    if (socket.setNoDelay) socket.setNoDelay();

    if (head.length > 0) socket.unshift(head);

    socket.on('close', socketOnClose);
    socket.on('data', socketOnData);
    socket.on('end', socketOnEnd);
    socket.on('error', socketOnError);

    this._readyState = WebSocket.OPEN;
    this.emit('open');
  }

  /**
   * Emit the `'close'` event.
   *
   * @private
   */
  emitClose() {
    if (!this._socket) {
      this._readyState = WebSocket.CLOSED;
      this.emit('close', this._closeCode, this._closeMessage);
      return;
    }

    if (this._extensions[PerMessageDeflate.extensionName]) {
      this._extensions[PerMessageDeflate.extensionName].cleanup();
    }

    this._receiver.removeAllListeners();
    this._readyState = WebSocket.CLOSED;
    this.emit('close', this._closeCode, this._closeMessage);
  }

  /**
   * Start a closing handshake.
   *
   *          +----------+   +-----------+   +----------+
   *     - - -|ws.close()|-->|close frame|-->|ws.close()|- - -
   *    |     +----------+   +-----------+   +----------+     |
   *          +----------+   +-----------+         |
   * CLOSING  |ws.close()|<--|close frame|<--+-----+       CLOSING
   *          +----------+   +-----------+   |
   *    |           |                        |   +---+        |
   *                +------------------------+-->|fin| - - - -
   *    |         +---+                      |   +---+
   *     - - - - -|fin|<---------------------+
   *              +---+
   *
   * @param {Number} [code] Status code explaining why the connection is closing
   * @param {(String|Buffer)} [data] The reason why the connection is
   *     closing
   * @public
   */
  close(code, data) {
    if (this.readyState === WebSocket.CLOSED) return;
    if (this.readyState === WebSocket.CONNECTING) {
      const msg = 'WebSocket was closed before the connection was established';
      abortHandshake(this, this._req, msg);
      return;
    }

    if (this.readyState === WebSocket.CLOSING) {
      if (
        this._closeFrameSent &&
        (this._closeFrameReceived || this._receiver._writableState.errorEmitted)
      ) {
        this._socket.end();
      }

      return;
    }

    this._readyState = WebSocket.CLOSING;
    this._sender.close(code, data, !this._isServer, (err) => {
      //
      // This error is handled by the `'error'` listener on the socket. We only
      // want to know if the close frame has been sent here.
      //
      if (err) return;

      this._closeFrameSent = true;

      if (
        this._closeFrameReceived ||
        this._receiver._writableState.errorEmitted
      ) {
        this._socket.end();
      }
    });

    setCloseTimer(this);
  }

  /**
   * Pause the socket.
   *
   * @public
   */
  pause() {
    if (
      this.readyState === WebSocket.CONNECTING ||
      this.readyState === WebSocket.CLOSED
    ) {
      return;
    }

    this._paused = true;
    this._socket.pause();
  }

  /**
   * Send a ping.
   *
   * @param {*} [data] The data to send
   * @param {Boolean} [mask] Indicates whether or not to mask `data`
   * @param {Function} [cb] Callback which is executed when the ping is sent
   * @public
   */
  ping(data, mask, cb) {
    if (this.readyState === WebSocket.CONNECTING) {
      throw new Error('WebSocket is not open: readyState 0 (CONNECTING)');
    }

    if (typeof data === 'function') {
      cb = data;
      data = mask = undefined;
    } else if (typeof mask === 'function') {
      cb = mask;
      mask = undefined;
    }

    if (typeof data === 'number') data = data.toString();

    if (this.readyState !== WebSocket.OPEN) {
      sendAfterClose(this, data, cb);
      return;
    }

    if (mask === undefined) mask = !this._isServer;
    this._sender.ping(data || EMPTY_BUFFER, mask, cb);
  }

  /**
   * Send a pong.
   *
   * @param {*} [data] The data to send
   * @param {Boolean} [mask] Indicates whether or not to mask `data`
   * @param {Function} [cb] Callback which is executed when the pong is sent
   * @public
   */
  pong(data, mask, cb) {
    if (this.readyState === WebSocket.CONNECTING) {
      throw new Error('WebSocket is not open: readyState 0 (CONNECTING)');
    }

    if (typeof data === 'function') {
      cb = data;
      data = mask = undefined;
    } else if (typeof mask === 'function') {
      cb = mask;
      mask = undefined;
    }

    if (typeof data === 'number') data = data.toString();

    if (this.readyState !== WebSocket.OPEN) {
      sendAfterClose(this, data, cb);
      return;
    }

    if (mask === undefined) mask = !this._isServer;
    this._sender.pong(data || EMPTY_BUFFER, mask, cb);
  }

  /**
   * Resume the socket.
   *
   * @public
   */
  resume() {
    if (
      this.readyState === WebSocket.CONNECTING ||
      this.readyState === WebSocket.CLOSED
    ) {
      return;
    }

    this._paused = false;
    if (!this._receiver._writableState.needDrain) this._socket.resume();
  }

  /**
   * Send a data message.
   *
   * @param {*} data The message to send
   * @param {Object} [options] Options object
   * @param {Boolean} [options.binary] Specifies whether `data` is binary or
   *     text
   * @param {Boolean} [options.compress] Specifies whether or not to compress
   *     `data`
   * @param {Boolean} [options.fin=true] Specifies whether the fragment is the
   *     last one
   * @param {Boolean} [options.mask] Specifies whether or not to mask `data`
   * @param {Function} [cb] Callback which is executed when data is written out
   * @public
   */
  send(data, options, cb) {
    if (this.readyState === WebSocket.CONNECTING) {
      throw new Error('WebSocket is not open: readyState 0 (CONNECTING)');
    }

    if (typeof options === 'function') {
      cb = options;
      options = {};
    }

    if (typeof data === 'number') data = data.toString();

    if (this.readyState !== WebSocket.OPEN) {
      sendAfterClose(this, data, cb);
      return;
    }

    const opts = {
      binary: typeof data !== 'string',
      mask: !this._isServer,
      compress: true,
      fin: true,
      ...options
    };

    if (!this._extensions[PerMessageDeflate.extensionName]) {
      opts.compress = false;
    }

    this._sender.send(data || EMPTY_BUFFER, opts, cb);
  }

  /**
   * Forcibly close the connection.
   *
   * @public
   */
  terminate() {
    if (this.readyState === WebSocket.CLOSED) return;
    if (this.readyState === WebSocket.CONNECTING) {
      const msg = 'WebSocket was closed before the connection was established';
      abortHandshake(this, this._req, msg);
      return;
    }

    if (this._socket) {
      this._readyState = WebSocket.CLOSING;
      this._socket.destroy();
    }
  }
}

/**
 * @constant {Number} CONNECTING
 * @memberof WebSocket
 */
Object.defineProperty(WebSocket, 'CONNECTING', {
  enumerable: true,
  value: readyStates.indexOf('CONNECTING')
});

/**
 * @constant {Number} CONNECTING
 * @memberof WebSocket.prototype
 */
Object.defineProperty(WebSocket.prototype, 'CONNECTING', {
  enumerable: true,
  value: readyStates.indexOf('CONNECTING')
});

/**
 * @constant {Number} OPEN
 * @memberof WebSocket
 */
Object.defineProperty(WebSocket, 'OPEN', {
  enumerable: true,
  value: readyStates.indexOf('OPEN')
});

/**
 * @constant {Number} OPEN
 * @memberof WebSocket.prototype
 */
Object.defineProperty(WebSocket.prototype, 'OPEN', {
  enumerable: true,
  value: readyStates.indexOf('OPEN')
});

/**
 * @constant {Number} CLOSING
 * @memberof WebSocket
 */
Object.defineProperty(WebSocket, 'CLOSING', {
  enumerable: true,
  value: readyStates.indexOf('CLOSING')
});

/**
 * @constant {Number} CLOSING
 * @memberof WebSocket.prototype
 */
Object.defineProperty(WebSocket.prototype, 'CLOSING', {
  enumerable: true,
  value: readyStates.indexOf('CLOSING')
});

/**
 * @constant {Number} CLOSED
 * @memberof WebSocket
 */
Object.defineProperty(WebSocket, 'CLOSED', {
  enumerable: true,
  value: readyStates.indexOf('CLOSED')
});

/**
 * @constant {Number} CLOSED
 * @memberof WebSocket.prototype
 */
Object.defineProperty(WebSocket.prototype, 'CLOSED', {
  enumerable: true,
  value: readyStates.indexOf('CLOSED')
});

[
  'binaryType',
  'bufferedAmount',
  'extensions',
  'isPaused',
  'protocol',
  'readyState',
  'url'
].forEach((property) => {
  Object.defineProperty(WebSocket.prototype, property, { enumerable: true });
});

//
// Add the `onopen`, `onerror`, `onclose`, and `onmessage` attributes.
// See https://html.spec.whatwg.org/multipage/comms.html#the-websocket-interface
//
['open', 'error', 'close', 'message'].forEach((method) => {
  Object.defineProperty(WebSocket.prototype, `on${method}`, {
    enumerable: true,
    get() {
      for (const listener of this.listeners(method)) {
        if (listener[kForOnEventAttribute]) return listener[kListener];
      }

      return null;
    },
    set(handler) {
      for (const listener of this.listeners(method)) {
        if (listener[kForOnEventAttribute]) {
          this.removeListener(method, listener);
          break;
        }
      }

      if (typeof handler !== 'function') return;

      this.addEventListener(method, handler, {
        [kForOnEventAttribute]: true
      });
    }
  });
});

WebSocket.prototype.addEventListener = addEventListener;
WebSocket.prototype.removeEventListener = removeEventListener;

module.exports = WebSocket;

/**
 * Initialize a WebSocket client.
 *
 * @param {WebSocket} websocket The client to initialize
 * @param {(String|URL)} address The URL to which to connect
 * @param {Array} protocols The subprotocols
 * @param {Object} [options] Connection options
 * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether any
 *     of the `'message'`, `'ping'`, and `'pong'` events can be emitted multiple
 *     times in the same tick
 * @param {Boolean} [options.autoPong=true] Specifies whether or not to
 *     automatically send a pong in response to a ping
 * @param {Function} [options.finishRequest] A function which can be used to
 *     customize the headers of each http request before it is sent
 * @param {Boolean} [options.followRedirects=false] Whether or not to follow
 *     redirects
 * @param {Function} [options.generateMask] The function used to generate the
 *     masking key
 * @param {Number} [options.handshakeTimeout] Timeout in milliseconds for the
 *     handshake request
 * @param {Number} [options.maxPayload=104857600] The maximum allowed message
 *     size
 * @param {Number} [options.maxRedirects=10] The maximum number of redirects
 *     allowed
 * @param {String} [options.origin] Value of the `Origin` or
 *     `Sec-WebSocket-Origin` header
 * @param {(Boolean|Object)} [options.perMessageDeflate=true] Enable/disable
 *     permessage-deflate
 * @param {Number} [options.protocolVersion=13] Value of the
 *     `Sec-WebSocket-Version` header
 * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
 *     not to skip UTF-8 validation for text and close messages
 * @private
 */
function initAsClient(websocket, address, protocols, options) {
  const opts = {
    allowSynchronousEvents: true,
    autoPong: true,
    protocolVersion: protocolVersions[1],
    maxPayload: 100 * 1024 * 1024,
    skipUTF8Validation: false,
    perMessageDeflate: true,
    followRedirects: false,
    maxRedirects: 10,
    ...options,
    socketPath: undefined,
    hostname: undefined,
    protocol: undefined,
    timeout: undefined,
    method: 'GET',
    host: undefined,
    path: undefined,
    port: undefined
  };

  websocket._autoPong = opts.autoPong;

  if (!protocolVersions.includes(opts.protocolVersion)) {
    throw new RangeError(
      `Unsupported protocol version: ${opts.protocolVersion} ` +
        `(supported versions: ${protocolVersions.join(', ')})`
    );
  }

  let parsedUrl;

  if (address instanceof URL) {
    parsedUrl = address;
  } else {
    try {
      parsedUrl = new URL(address);
    } catch (e) {
      throw new SyntaxError(`Invalid URL: ${address}`);
    }
  }

  if (parsedUrl.protocol === 'http:') {
    parsedUrl.protocol = 'ws:';
  } else if (parsedUrl.protocol === 'https:') {
    parsedUrl.protocol = 'wss:';
  }

  websocket._url = parsedUrl.href;

  const isSecure = parsedUrl.protocol === 'wss:';
  const isIpcUrl = parsedUrl.protocol === 'ws+unix:';
  let invalidUrlMessage;

  if (parsedUrl.protocol !== 'ws:' && !isSecure && !isIpcUrl) {
    invalidUrlMessage =
      'The URL\'s protocol must be one of "ws:", "wss:", ' +
      '"http:", "https:", or "ws+unix:"';
  } else if (isIpcUrl && !parsedUrl.pathname) {
    invalidUrlMessage = "The URL's pathname is empty";
  } else if (parsedUrl.hash) {
    invalidUrlMessage = 'The URL contains a fragment identifier';
  }

  if (invalidUrlMessage) {
    const err = new SyntaxError(invalidUrlMessage);

    if (websocket._redirects === 0) {
      throw err;
    } else {
      emitErrorAndClose(websocket, err);
      return;
    }
  }

  const defaultPort = isSecure ? 443 : 80;
  const key = randomBytes(16).toString('base64');
  const request = isSecure ? https.request : http.request;
  const protocolSet = new Set();
  let perMessageDeflate;

  opts.createConnection =
    opts.createConnection || (isSecure ? tlsConnect : netConnect);
  opts.defaultPort = opts.defaultPort || defaultPort;
  opts.port = parsedUrl.port || defaultPort;
  opts.host = parsedUrl.hostname.startsWith('[')
    ? parsedUrl.hostname.slice(1, -1)
    : parsedUrl.hostname;
  opts.headers = {
    ...opts.headers,
    'Sec-WebSocket-Version': opts.protocolVersion,
    'Sec-WebSocket-Key': key,
    Connection: 'Upgrade',
    Upgrade: 'websocket'
  };
  opts.path = parsedUrl.pathname + parsedUrl.search;
  opts.timeout = opts.handshakeTimeout;

  if (opts.perMessageDeflate) {
    perMessageDeflate = new PerMessageDeflate(
      opts.perMessageDeflate !== true ? opts.perMessageDeflate : {},
      false,
      opts.maxPayload
    );
    opts.headers['Sec-WebSocket-Extensions'] = format({
      [PerMessageDeflate.extensionName]: perMessageDeflate.offer()
    });
  }
  if (protocols.length) {
    for (const protocol of protocols) {
      if (
        typeof protocol !== 'string' ||
        !subprotocolRegex.test(protocol) ||
        protocolSet.has(protocol)
      ) {
        throw new SyntaxError(
          'An invalid or duplicated subprotocol was specified'
        );
      }

      protocolSet.add(protocol);
    }

    opts.headers['Sec-WebSocket-Protocol'] = protocols.join(',');
  }
  if (opts.origin) {
    if (opts.protocolVersion < 13) {
      opts.headers['Sec-WebSocket-Origin'] = opts.origin;
    } else {
      opts.headers.Origin = opts.origin;
    }
  }
  if (parsedUrl.username || parsedUrl.password) {
    opts.auth = `${parsedUrl.username}:${parsedUrl.password}`;
  }

  if (isIpcUrl) {
    const parts = opts.path.split(':');

    opts.socketPath = parts[0];
    opts.path = parts[1];
  }

  let req;

  if (opts.followRedirects) {
    if (websocket._redirects === 0) {
      websocket._originalIpc = isIpcUrl;
      websocket._originalSecure = isSecure;
      websocket._originalHostOrSocketPath = isIpcUrl
        ? opts.socketPath
        : parsedUrl.host;

      const headers = options && options.headers;

      //
      // Shallow copy the user provided options so that headers can be changed
      // without mutating the original object.
      //
      options = { ...options, headers: {} };

      if (headers) {
        for (const [key, value] of Object.entries(headers)) {
          options.headers[key.toLowerCase()] = value;
        }
      }
    } else if (websocket.listenerCount('redirect') === 0) {
      const isSameHost = isIpcUrl
        ? websocket._originalIpc
          ? opts.socketPath === websocket._originalHostOrSocketPath
          : false
        : websocket._originalIpc
          ? false
          : parsedUrl.host === websocket._originalHostOrSocketPath;

      if (!isSameHost || (websocket._originalSecure && !isSecure)) {
        //
        // Match curl 7.77.0 behavior and drop the following headers. These
        // headers are also dropped when following a redirect to a subdomain.
        //
        delete opts.headers.authorization;
        delete opts.headers.cookie;

        if (!isSameHost) delete opts.headers.host;

        opts.auth = undefined;
      }
    }

    //
    // Match curl 7.77.0 behavior and make the first `Authorization` header win.
    // If the `Authorization` header is set, then there is nothing to do as it
    // will take precedence.
    //
    if (opts.auth && !options.headers.authorization) {
      options.headers.authorization =
        'Basic ' + Buffer.from(opts.auth).toString('base64');
    }

    req = websocket._req = request(opts);

    if (websocket._redirects) {
      //
      // Unlike what is done for the `'upgrade'` event, no early exit is
      // triggered here if the user calls `websocket.close()` or
      // `websocket.terminate()` from a listener of the `'redirect'` event. This
      // is because the user can also call `request.destroy()` with an error
      // before calling `websocket.close()` or `websocket.terminate()` and this
      // would result in an error being emitted on the `request` object with no
      // `'error'` event listeners attached.
      //
      websocket.emit('redirect', websocket.url, req);
    }
  } else {
    req = websocket._req = request(opts);
  }

  if (opts.timeout) {
    req.on('timeout', () => {
      abortHandshake(websocket, req, 'Opening handshake has timed out');
    });
  }

  req.on('error', (err) => {
    if (req === null || req[kAborted]) return;

    req = websocket._req = null;
    emitErrorAndClose(websocket, err);
  });

  req.on('response', (res) => {
    const location = res.headers.location;
    const statusCode = res.statusCode;

    if (
      location &&
      opts.followRedirects &&
      statusCode >= 300 &&
      statusCode < 400
    ) {
      if (++websocket._redirects > opts.maxRedirects) {
        abortHandshake(websocket, req, 'Maximum redirects exceeded');
        return;
      }

      req.abort();

      let addr;

      try {
        addr = new URL(location, address);
      } catch (e) {
        const err = new SyntaxError(`Invalid URL: ${location}`);
        emitErrorAndClose(websocket, err);
        return;
      }

      initAsClient(websocket, addr, protocols, options);
    } else if (!websocket.emit('unexpected-response', req, res)) {
      abortHandshake(
        websocket,
        req,
        `Unexpected server response: ${res.statusCode}`
      );
    }
  });

  req.on('upgrade', (res, socket, head) => {
    websocket.emit('upgrade', res);

    //
    // The user may have closed the connection from a listener of the
    // `'upgrade'` event.
    //
    if (websocket.readyState !== WebSocket.CONNECTING) return;

    req = websocket._req = null;

    const upgrade = res.headers.upgrade;

    if (upgrade === undefined || upgrade.toLowerCase() !== 'websocket') {
      abortHandshake(websocket, socket, 'Invalid Upgrade header');
      return;
    }

    const digest = createHash('sha1')
      .update(key + GUID)
      .digest('base64');

    if (res.headers['sec-websocket-accept'] !== digest) {
      abortHandshake(websocket, socket, 'Invalid Sec-WebSocket-Accept header');
      return;
    }

    const serverProt = res.headers['sec-websocket-protocol'];
    let protError;

    if (serverProt !== undefined) {
      if (!protocolSet.size) {
        protError = 'Server sent a subprotocol but none was requested';
      } else if (!protocolSet.has(serverProt)) {
        protError = 'Server sent an invalid subprotocol';
      }
    } else if (protocolSet.size) {
      protError = 'Server sent no subprotocol';
    }

    if (protError) {
      abortHandshake(websocket, socket, protError);
      return;
    }

    if (serverProt) websocket._protocol = serverProt;

    const secWebSocketExtensions = res.headers['sec-websocket-extensions'];

    if (secWebSocketExtensions !== undefined) {
      if (!perMessageDeflate) {
        const message =
          'Server sent a Sec-WebSocket-Extensions header but no extension ' +
          'was requested';
        abortHandshake(websocket, socket, message);
        return;
      }

      let extensions;

      try {
        extensions = parse(secWebSocketExtensions);
      } catch (err) {
        const message = 'Invalid Sec-WebSocket-Extensions header';
        abortHandshake(websocket, socket, message);
        return;
      }

      const extensionNames = Object.keys(extensions);

      if (
        extensionNames.length !== 1 ||
        extensionNames[0] !== PerMessageDeflate.extensionName
      ) {
        const message = 'Server indicated an extension that was not requested';
        abortHandshake(websocket, socket, message);
        return;
      }

      try {
        perMessageDeflate.accept(extensions[PerMessageDeflate.extensionName]);
      } catch (err) {
        const message = 'Invalid Sec-WebSocket-Extensions header';
        abortHandshake(websocket, socket, message);
        return;
      }

      websocket._extensions[PerMessageDeflate.extensionName] =
        perMessageDeflate;
    }

    websocket.setSocket(socket, head, {
      allowSynchronousEvents: opts.allowSynchronousEvents,
      generateMask: opts.generateMask,
      maxPayload: opts.maxPayload,
      skipUTF8Validation: opts.skipUTF8Validation
    });
  });

  if (opts.finishRequest) {
    opts.finishRequest(req, websocket);
  } else {
    req.end();
  }
}

/**
 * Emit the `'error'` and `'close'` events.
 *
 * @param {WebSocket} websocket The WebSocket instance
 * @param {Error} The error to emit
 * @private
 */
function emitErrorAndClose(websocket, err) {
  websocket._readyState = WebSocket.CLOSING;
  //
  // The following assignment is practically useless and is done only for
  // consistency.
  //
  websocket._errorEmitted = true;
  websocket.emit('error', err);
  websocket.emitClose();
}

/**
 * Create a `net.Socket` and initiate a connection.
 *
 * @param {Object} options Connection options
 * @return {net.Socket} The newly created socket used to start the connection
 * @private
 */
function netConnect(options) {
  options.path = options.socketPath;
  return net.connect(options);
}

/**
 * Create a `tls.TLSSocket` and initiate a connection.
 *
 * @param {Object} options Connection options
 * @return {tls.TLSSocket} The newly created socket used to start the connection
 * @private
 */
function tlsConnect(options) {
  options.path = undefined;

  if (!options.servername && options.servername !== '') {
    options.servername = net.isIP(options.host) ? '' : options.host;
  }

  return tls.connect(options);
}

/**
 * Abort the handshake and emit an error.
 *
 * @param {WebSocket} websocket The WebSocket instance
 * @param {(http.ClientRequest|net.Socket|tls.Socket)} stream The request to
 *     abort or the socket to destroy
 * @param {String} message The error message
 * @private
 */
function abortHandshake(websocket, stream, message) {
  websocket._readyState = WebSocket.CLOSING;

  const err = new Error(message);
  Error.captureStackTrace(err, abortHandshake);

  if (stream.setHeader) {
    stream[kAborted] = true;
    stream.abort();

    if (stream.socket && !stream.socket.destroyed) {
      //
      // On Node.js >= 14.3.0 `request.abort()` does not destroy the socket if
      // called after the request completed. See
      // https://github.com/websockets/ws/issues/1869.
      //
      stream.socket.destroy();
    }

    process.nextTick(emitErrorAndClose, websocket, err);
  } else {
    stream.destroy(err);
    stream.once('error', websocket.emit.bind(websocket, 'error'));
    stream.once('close', websocket.emitClose.bind(websocket));
  }
}

/**
 * Handle cases where the `ping()`, `pong()`, or `send()` methods are called
 * when the `readyState` attribute is `CLOSING` or `CLOSED`.
 *
 * @param {WebSocket} websocket The WebSocket instance
 * @param {*} [data] The data to send
 * @param {Function} [cb] Callback
 * @private
 */
function sendAfterClose(websocket, data, cb) {
  if (data) {
    const length = isBlob(data) ? data.size : toBuffer(data).length;

    //
    // The `_bufferedAmount` property is used only when the peer is a client and
    // the opening handshake fails. Under these circumstances, in fact, the
    // `setSocket()` method is not called, so the `_socket` and `_sender`
    // properties are set to `null`.
    //
    if (websocket._socket) websocket._sender._bufferedBytes += length;
    else websocket._bufferedAmount += length;
  }

  if (cb) {
    const err = new Error(
      `WebSocket is not open: readyState ${websocket.readyState} ` +
        `(${readyStates[websocket.readyState]})`
    );
    process.nextTick(cb, err);
  }
}

/**
 * The listener of the `Receiver` `'conclude'` event.
 *
 * @param {Number} code The status code
 * @param {Buffer} reason The reason for closing
 * @private
 */
function receiverOnConclude(code, reason) {
  const websocket = this[kWebSocket];

  websocket._closeFrameReceived = true;
  websocket._closeMessage = reason;
  websocket._closeCode = code;

  if (websocket._socket[kWebSocket] === undefined) return;

  websocket._socket.removeListener('data', socketOnData);
  process.nextTick(resume, websocket._socket);

  if (code === 1005) websocket.close();
  else websocket.close(code, reason);
}

/**
 * The listener of the `Receiver` `'drain'` event.
 *
 * @private
 */
function receiverOnDrain() {
  const websocket = this[kWebSocket];

  if (!websocket.isPaused) websocket._socket.resume();
}

/**
 * The listener of the `Receiver` `'error'` event.
 *
 * @param {(RangeError|Error)} err The emitted error
 * @private
 */
function receiverOnError(err) {
  const websocket = this[kWebSocket];

  if (websocket._socket[kWebSocket] !== undefined) {
    websocket._socket.removeListener('data', socketOnData);

    //
    // On Node.js < 14.0.0 the `'error'` event is emitted synchronously. See
    // https://github.com/websockets/ws/issues/1940.
    //
    process.nextTick(resume, websocket._socket);

    websocket.close(err[kStatusCode]);
  }

  if (!websocket._errorEmitted) {
    websocket._errorEmitted = true;
    websocket.emit('error', err);
  }
}

/**
 * The listener of the `Receiver` `'finish'` event.
 *
 * @private
 */
function receiverOnFinish() {
  this[kWebSocket].emitClose();
}

/**
 * The listener of the `Receiver` `'message'` event.
 *
 * @param {Buffer|ArrayBuffer|Buffer[])} data The message
 * @param {Boolean} isBinary Specifies whether the message is binary or not
 * @private
 */
function receiverOnMessage(data, isBinary) {
  this[kWebSocket].emit('message', data, isBinary);
}

/**
 * The listener of the `Receiver` `'ping'` event.
 *
 * @param {Buffer} data The data included in the ping frame
 * @private
 */
function receiverOnPing(data) {
  const websocket = this[kWebSocket];

  if (websocket._autoPong) websocket.pong(data, !this._isServer, NOOP);
  websocket.emit('ping', data);
}

/**
 * The listener of the `Receiver` `'pong'` event.
 *
 * @param {Buffer} data The data included in the pong frame
 * @private
 */
function receiverOnPong(data) {
  this[kWebSocket].emit('pong', data);
}

/**
 * Resume a readable stream
 *
 * @param {Readable} stream The readable stream
 * @private
 */
function resume(stream) {
  stream.resume();
}

/**
 * The `Sender` error event handler.
 *
 * @param {Error} The error
 * @private
 */
function senderOnError(err) {
  const websocket = this[kWebSocket];

  if (websocket.readyState === WebSocket.CLOSED) return;
  if (websocket.readyState === WebSocket.OPEN) {
    websocket._readyState = WebSocket.CLOSING;
    setCloseTimer(websocket);
  }

  //
  // `socket.end()` is used instead of `socket.destroy()` to allow the other
  // peer to finish sending queued data. There is no need to set a timer here
  // because `CLOSING` means that it is already set or not needed.
  //
  this._socket.end();

  if (!websocket._errorEmitted) {
    websocket._errorEmitted = true;
    websocket.emit('error', err);
  }
}

/**
 * Set a timer to destroy the underlying raw socket of a WebSocket.
 *
 * @param {WebSocket} websocket The WebSocket instance
 * @private
 */
function setCloseTimer(websocket) {
  websocket._closeTimer = setTimeout(
    websocket._socket.destroy.bind(websocket._socket),
    closeTimeout
  );
}

/**
 * The listener of the socket `'close'` event.
 *
 * @private
 */
function socketOnClose() {
  const websocket = this[kWebSocket];

  this.removeListener('close', socketOnClose);
  this.removeListener('data', socketOnData);
  this.removeListener('end', socketOnEnd);

  websocket._readyState = WebSocket.CLOSING;

  let chunk;

  //
  // The close frame might not have been received or the `'end'` event emitted,
  // for example, if the socket was destroyed due to an error. Ensure that the
  // `receiver` stream is closed after writing any remaining buffered data to
  // it. If the readable side of the socket is in flowing mode then there is no
  // buffered data as everything has been already written and `readable.read()`
  // will return `null`. If instead, the socket is paused, any possible buffered
  // data will be read as a single chunk.
  //
  if (
    !this._readableState.endEmitted &&
    !websocket._closeFrameReceived &&
    !websocket._receiver._writableState.errorEmitted &&
    (chunk = websocket._socket.read()) !== null
  ) {
    websocket._receiver.write(chunk);
  }

  websocket._receiver.end();

  this[kWebSocket] = undefined;

  clearTimeout(websocket._closeTimer);

  if (
    websocket._receiver._writableState.finished ||
    websocket._receiver._writableState.errorEmitted
  ) {
    websocket.emitClose();
  } else {
    websocket._receiver.on('error', receiverOnFinish);
    websocket._receiver.on('finish', receiverOnFinish);
  }
}

/**
 * The listener of the socket `'data'` event.
 *
 * @param {Buffer} chunk A chunk of data
 * @private
 */
function socketOnData(chunk) {
  if (!this[kWebSocket]._receiver.write(chunk)) {
    this.pause();
  }
}

/**
 * The listener of the socket `'end'` event.
 *
 * @private
 */
function socketOnEnd() {
  const websocket = this[kWebSocket];

  websocket._readyState = WebSocket.CLOSING;
  websocket._receiver.end();
  this.end();
}

/**
 * The listener of the socket `'error'` event.
 *
 * @private
 */
function socketOnError() {
  const websocket = this[kWebSocket];

  this.removeListener('error', socketOnError);
  this.on('error', NOOP);

  if (websocket) {
    websocket._readyState = WebSocket.CLOSING;
    this.destroy();
  }
}


/***/ }),
/* 8 */
/***/ ((module) => {

module.exports = require("events");

/***/ }),
/* 9 */
/***/ ((module) => {

module.exports = require("https");

/***/ }),
/* 10 */
/***/ ((module) => {

module.exports = require("http");

/***/ }),
/* 11 */
/***/ ((module) => {

module.exports = require("net");

/***/ }),
/* 12 */
/***/ ((module) => {

module.exports = require("tls");

/***/ }),
/* 13 */
/***/ ((module) => {

module.exports = require("crypto");

/***/ }),
/* 14 */
/***/ ((module) => {

module.exports = require("stream");

/***/ }),
/* 15 */
/***/ ((module) => {

module.exports = require("url");

/***/ }),
/* 16 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



const zlib = __webpack_require__(17);

const bufferUtil = __webpack_require__(18);
const Limiter = __webpack_require__(21);
const { kStatusCode } = __webpack_require__(19);

const FastBuffer = Buffer[Symbol.species];
const TRAILER = Buffer.from([0x00, 0x00, 0xff, 0xff]);
const kPerMessageDeflate = Symbol('permessage-deflate');
const kTotalLength = Symbol('total-length');
const kCallback = Symbol('callback');
const kBuffers = Symbol('buffers');
const kError = Symbol('error');

//
// We limit zlib concurrency, which prevents severe memory fragmentation
// as documented in https://github.com/nodejs/node/issues/8871#issuecomment-250915913
// and https://github.com/websockets/ws/issues/1202
//
// Intentionally global; it's the global thread pool that's an issue.
//
let zlibLimiter;

/**
 * permessage-deflate implementation.
 */
class PerMessageDeflate {
  /**
   * Creates a PerMessageDeflate instance.
   *
   * @param {Object} [options] Configuration options
   * @param {(Boolean|Number)} [options.clientMaxWindowBits] Advertise support
   *     for, or request, a custom client window size
   * @param {Boolean} [options.clientNoContextTakeover=false] Advertise/
   *     acknowledge disabling of client context takeover
   * @param {Number} [options.concurrencyLimit=10] The number of concurrent
   *     calls to zlib
   * @param {(Boolean|Number)} [options.serverMaxWindowBits] Request/confirm the
   *     use of a custom server window size
   * @param {Boolean} [options.serverNoContextTakeover=false] Request/accept
   *     disabling of server context takeover
   * @param {Number} [options.threshold=1024] Size (in bytes) below which
   *     messages should not be compressed if context takeover is disabled
   * @param {Object} [options.zlibDeflateOptions] Options to pass to zlib on
   *     deflate
   * @param {Object} [options.zlibInflateOptions] Options to pass to zlib on
   *     inflate
   * @param {Boolean} [isServer=false] Create the instance in either server or
   *     client mode
   * @param {Number} [maxPayload=0] The maximum allowed message length
   */
  constructor(options, isServer, maxPayload) {
    this._maxPayload = maxPayload | 0;
    this._options = options || {};
    this._threshold =
      this._options.threshold !== undefined ? this._options.threshold : 1024;
    this._isServer = !!isServer;
    this._deflate = null;
    this._inflate = null;

    this.params = null;

    if (!zlibLimiter) {
      const concurrency =
        this._options.concurrencyLimit !== undefined
          ? this._options.concurrencyLimit
          : 10;
      zlibLimiter = new Limiter(concurrency);
    }
  }

  /**
   * @type {String}
   */
  static get extensionName() {
    return 'permessage-deflate';
  }

  /**
   * Create an extension negotiation offer.
   *
   * @return {Object} Extension parameters
   * @public
   */
  offer() {
    const params = {};

    if (this._options.serverNoContextTakeover) {
      params.server_no_context_takeover = true;
    }
    if (this._options.clientNoContextTakeover) {
      params.client_no_context_takeover = true;
    }
    if (this._options.serverMaxWindowBits) {
      params.server_max_window_bits = this._options.serverMaxWindowBits;
    }
    if (this._options.clientMaxWindowBits) {
      params.client_max_window_bits = this._options.clientMaxWindowBits;
    } else if (this._options.clientMaxWindowBits == null) {
      params.client_max_window_bits = true;
    }

    return params;
  }

  /**
   * Accept an extension negotiation offer/response.
   *
   * @param {Array} configurations The extension negotiation offers/reponse
   * @return {Object} Accepted configuration
   * @public
   */
  accept(configurations) {
    configurations = this.normalizeParams(configurations);

    this.params = this._isServer
      ? this.acceptAsServer(configurations)
      : this.acceptAsClient(configurations);

    return this.params;
  }

  /**
   * Releases all resources used by the extension.
   *
   * @public
   */
  cleanup() {
    if (this._inflate) {
      this._inflate.close();
      this._inflate = null;
    }

    if (this._deflate) {
      const callback = this._deflate[kCallback];

      this._deflate.close();
      this._deflate = null;

      if (callback) {
        callback(
          new Error(
            'The deflate stream was closed while data was being processed'
          )
        );
      }
    }
  }

  /**
   *  Accept an extension negotiation offer.
   *
   * @param {Array} offers The extension negotiation offers
   * @return {Object} Accepted configuration
   * @private
   */
  acceptAsServer(offers) {
    const opts = this._options;
    const accepted = offers.find((params) => {
      if (
        (opts.serverNoContextTakeover === false &&
          params.server_no_context_takeover) ||
        (params.server_max_window_bits &&
          (opts.serverMaxWindowBits === false ||
            (typeof opts.serverMaxWindowBits === 'number' &&
              opts.serverMaxWindowBits > params.server_max_window_bits))) ||
        (typeof opts.clientMaxWindowBits === 'number' &&
          !params.client_max_window_bits)
      ) {
        return false;
      }

      return true;
    });

    if (!accepted) {
      throw new Error('None of the extension offers can be accepted');
    }

    if (opts.serverNoContextTakeover) {
      accepted.server_no_context_takeover = true;
    }
    if (opts.clientNoContextTakeover) {
      accepted.client_no_context_takeover = true;
    }
    if (typeof opts.serverMaxWindowBits === 'number') {
      accepted.server_max_window_bits = opts.serverMaxWindowBits;
    }
    if (typeof opts.clientMaxWindowBits === 'number') {
      accepted.client_max_window_bits = opts.clientMaxWindowBits;
    } else if (
      accepted.client_max_window_bits === true ||
      opts.clientMaxWindowBits === false
    ) {
      delete accepted.client_max_window_bits;
    }

    return accepted;
  }

  /**
   * Accept the extension negotiation response.
   *
   * @param {Array} response The extension negotiation response
   * @return {Object} Accepted configuration
   * @private
   */
  acceptAsClient(response) {
    const params = response[0];

    if (
      this._options.clientNoContextTakeover === false &&
      params.client_no_context_takeover
    ) {
      throw new Error('Unexpected parameter "client_no_context_takeover"');
    }

    if (!params.client_max_window_bits) {
      if (typeof this._options.clientMaxWindowBits === 'number') {
        params.client_max_window_bits = this._options.clientMaxWindowBits;
      }
    } else if (
      this._options.clientMaxWindowBits === false ||
      (typeof this._options.clientMaxWindowBits === 'number' &&
        params.client_max_window_bits > this._options.clientMaxWindowBits)
    ) {
      throw new Error(
        'Unexpected or invalid parameter "client_max_window_bits"'
      );
    }

    return params;
  }

  /**
   * Normalize parameters.
   *
   * @param {Array} configurations The extension negotiation offers/reponse
   * @return {Array} The offers/response with normalized parameters
   * @private
   */
  normalizeParams(configurations) {
    configurations.forEach((params) => {
      Object.keys(params).forEach((key) => {
        let value = params[key];

        if (value.length > 1) {
          throw new Error(`Parameter "${key}" must have only a single value`);
        }

        value = value[0];

        if (key === 'client_max_window_bits') {
          if (value !== true) {
            const num = +value;
            if (!Number.isInteger(num) || num < 8 || num > 15) {
              throw new TypeError(
                `Invalid value for parameter "${key}": ${value}`
              );
            }
            value = num;
          } else if (!this._isServer) {
            throw new TypeError(
              `Invalid value for parameter "${key}": ${value}`
            );
          }
        } else if (key === 'server_max_window_bits') {
          const num = +value;
          if (!Number.isInteger(num) || num < 8 || num > 15) {
            throw new TypeError(
              `Invalid value for parameter "${key}": ${value}`
            );
          }
          value = num;
        } else if (
          key === 'client_no_context_takeover' ||
          key === 'server_no_context_takeover'
        ) {
          if (value !== true) {
            throw new TypeError(
              `Invalid value for parameter "${key}": ${value}`
            );
          }
        } else {
          throw new Error(`Unknown parameter "${key}"`);
        }

        params[key] = value;
      });
    });

    return configurations;
  }

  /**
   * Decompress data. Concurrency limited.
   *
   * @param {Buffer} data Compressed data
   * @param {Boolean} fin Specifies whether or not this is the last fragment
   * @param {Function} callback Callback
   * @public
   */
  decompress(data, fin, callback) {
    zlibLimiter.add((done) => {
      this._decompress(data, fin, (err, result) => {
        done();
        callback(err, result);
      });
    });
  }

  /**
   * Compress data. Concurrency limited.
   *
   * @param {(Buffer|String)} data Data to compress
   * @param {Boolean} fin Specifies whether or not this is the last fragment
   * @param {Function} callback Callback
   * @public
   */
  compress(data, fin, callback) {
    zlibLimiter.add((done) => {
      this._compress(data, fin, (err, result) => {
        done();
        callback(err, result);
      });
    });
  }

  /**
   * Decompress data.
   *
   * @param {Buffer} data Compressed data
   * @param {Boolean} fin Specifies whether or not this is the last fragment
   * @param {Function} callback Callback
   * @private
   */
  _decompress(data, fin, callback) {
    const endpoint = this._isServer ? 'client' : 'server';

    if (!this._inflate) {
      const key = `${endpoint}_max_window_bits`;
      const windowBits =
        typeof this.params[key] !== 'number'
          ? zlib.Z_DEFAULT_WINDOWBITS
          : this.params[key];

      this._inflate = zlib.createInflateRaw({
        ...this._options.zlibInflateOptions,
        windowBits
      });
      this._inflate[kPerMessageDeflate] = this;
      this._inflate[kTotalLength] = 0;
      this._inflate[kBuffers] = [];
      this._inflate.on('error', inflateOnError);
      this._inflate.on('data', inflateOnData);
    }

    this._inflate[kCallback] = callback;

    this._inflate.write(data);
    if (fin) this._inflate.write(TRAILER);

    this._inflate.flush(() => {
      const err = this._inflate[kError];

      if (err) {
        this._inflate.close();
        this._inflate = null;
        callback(err);
        return;
      }

      const data = bufferUtil.concat(
        this._inflate[kBuffers],
        this._inflate[kTotalLength]
      );

      if (this._inflate._readableState.endEmitted) {
        this._inflate.close();
        this._inflate = null;
      } else {
        this._inflate[kTotalLength] = 0;
        this._inflate[kBuffers] = [];

        if (fin && this.params[`${endpoint}_no_context_takeover`]) {
          this._inflate.reset();
        }
      }

      callback(null, data);
    });
  }

  /**
   * Compress data.
   *
   * @param {(Buffer|String)} data Data to compress
   * @param {Boolean} fin Specifies whether or not this is the last fragment
   * @param {Function} callback Callback
   * @private
   */
  _compress(data, fin, callback) {
    const endpoint = this._isServer ? 'server' : 'client';

    if (!this._deflate) {
      const key = `${endpoint}_max_window_bits`;
      const windowBits =
        typeof this.params[key] !== 'number'
          ? zlib.Z_DEFAULT_WINDOWBITS
          : this.params[key];

      this._deflate = zlib.createDeflateRaw({
        ...this._options.zlibDeflateOptions,
        windowBits
      });

      this._deflate[kTotalLength] = 0;
      this._deflate[kBuffers] = [];

      this._deflate.on('data', deflateOnData);
    }

    this._deflate[kCallback] = callback;

    this._deflate.write(data);
    this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
      if (!this._deflate) {
        //
        // The deflate stream was closed while data was being processed.
        //
        return;
      }

      let data = bufferUtil.concat(
        this._deflate[kBuffers],
        this._deflate[kTotalLength]
      );

      if (fin) {
        data = new FastBuffer(data.buffer, data.byteOffset, data.length - 4);
      }

      //
      // Ensure that the callback will not be called again in
      // `PerMessageDeflate#cleanup()`.
      //
      this._deflate[kCallback] = null;

      this._deflate[kTotalLength] = 0;
      this._deflate[kBuffers] = [];

      if (fin && this.params[`${endpoint}_no_context_takeover`]) {
        this._deflate.reset();
      }

      callback(null, data);
    });
  }
}

module.exports = PerMessageDeflate;

/**
 * The listener of the `zlib.DeflateRaw` stream `'data'` event.
 *
 * @param {Buffer} chunk A chunk of data
 * @private
 */
function deflateOnData(chunk) {
  this[kBuffers].push(chunk);
  this[kTotalLength] += chunk.length;
}

/**
 * The listener of the `zlib.InflateRaw` stream `'data'` event.
 *
 * @param {Buffer} chunk A chunk of data
 * @private
 */
function inflateOnData(chunk) {
  this[kTotalLength] += chunk.length;

  if (
    this[kPerMessageDeflate]._maxPayload < 1 ||
    this[kTotalLength] <= this[kPerMessageDeflate]._maxPayload
  ) {
    this[kBuffers].push(chunk);
    return;
  }

  this[kError] = new RangeError('Max payload size exceeded');
  this[kError].code = 'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH';
  this[kError][kStatusCode] = 1009;
  this.removeListener('data', inflateOnData);

  //
  // The choice to employ `zlib.reset()` over `zlib.close()` is dictated by the
  // fact that in Node.js versions prior to 13.10.0, the callback for
  // `zlib.flush()` is not called if `zlib.close()` is used. Utilizing
  // `zlib.reset()` ensures that either the callback is invoked or an error is
  // emitted.
  //
  this.reset();
}

/**
 * The listener of the `zlib.InflateRaw` stream `'error'` event.
 *
 * @param {Error} err The emitted error
 * @private
 */
function inflateOnError(err) {
  //
  // There is no need to call `Zlib#close()` as the handle is automatically
  // closed when an error is emitted.
  //
  this[kPerMessageDeflate]._inflate = null;

  if (this[kError]) {
    this[kCallback](this[kError]);
    return;
  }

  err[kStatusCode] = 1007;
  this[kCallback](err);
}


/***/ }),
/* 17 */
/***/ ((module) => {

module.exports = require("zlib");

/***/ }),
/* 18 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



const { EMPTY_BUFFER } = __webpack_require__(19);

const FastBuffer = Buffer[Symbol.species];

/**
 * Merges an array of buffers into a new buffer.
 *
 * @param {Buffer[]} list The array of buffers to concat
 * @param {Number} totalLength The total length of buffers in the list
 * @return {Buffer} The resulting buffer
 * @public
 */
function concat(list, totalLength) {
  if (list.length === 0) return EMPTY_BUFFER;
  if (list.length === 1) return list[0];

  const target = Buffer.allocUnsafe(totalLength);
  let offset = 0;

  for (let i = 0; i < list.length; i++) {
    const buf = list[i];
    target.set(buf, offset);
    offset += buf.length;
  }

  if (offset < totalLength) {
    return new FastBuffer(target.buffer, target.byteOffset, offset);
  }

  return target;
}

/**
 * Masks a buffer using the given mask.
 *
 * @param {Buffer} source The buffer to mask
 * @param {Buffer} mask The mask to use
 * @param {Buffer} output The buffer where to store the result
 * @param {Number} offset The offset at which to start writing
 * @param {Number} length The number of bytes to mask.
 * @public
 */
function _mask(source, mask, output, offset, length) {
  for (let i = 0; i < length; i++) {
    output[offset + i] = source[i] ^ mask[i & 3];
  }
}

/**
 * Unmasks a buffer using the given mask.
 *
 * @param {Buffer} buffer The buffer to unmask
 * @param {Buffer} mask The mask to use
 * @public
 */
function _unmask(buffer, mask) {
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] ^= mask[i & 3];
  }
}

/**
 * Converts a buffer to an `ArrayBuffer`.
 *
 * @param {Buffer} buf The buffer to convert
 * @return {ArrayBuffer} Converted buffer
 * @public
 */
function toArrayBuffer(buf) {
  if (buf.length === buf.buffer.byteLength) {
    return buf.buffer;
  }

  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
}

/**
 * Converts `data` to a `Buffer`.
 *
 * @param {*} data The data to convert
 * @return {Buffer} The buffer
 * @throws {TypeError}
 * @public
 */
function toBuffer(data) {
  toBuffer.readOnly = true;

  if (Buffer.isBuffer(data)) return data;

  let buf;

  if (data instanceof ArrayBuffer) {
    buf = new FastBuffer(data);
  } else if (ArrayBuffer.isView(data)) {
    buf = new FastBuffer(data.buffer, data.byteOffset, data.byteLength);
  } else {
    buf = Buffer.from(data);
    toBuffer.readOnly = false;
  }

  return buf;
}

module.exports = {
  concat,
  mask: _mask,
  toArrayBuffer,
  toBuffer,
  unmask: _unmask
};

/* istanbul ignore else  */
if (!process.env.WS_NO_BUFFER_UTIL) {
  try {
    const bufferUtil = __webpack_require__(20);

    module.exports.mask = function (source, mask, output, offset, length) {
      if (length < 48) _mask(source, mask, output, offset, length);
      else bufferUtil.mask(source, mask, output, offset, length);
    };

    module.exports.unmask = function (buffer, mask) {
      if (buffer.length < 32) _unmask(buffer, mask);
      else bufferUtil.unmask(buffer, mask);
    };
  } catch (e) {
    // Continue regardless of the error.
  }
}


/***/ }),
/* 19 */
/***/ ((module) => {



const BINARY_TYPES = ['nodebuffer', 'arraybuffer', 'fragments'];
const hasBlob = typeof Blob !== 'undefined';

if (hasBlob) BINARY_TYPES.push('blob');

module.exports = {
  BINARY_TYPES,
  EMPTY_BUFFER: Buffer.alloc(0),
  GUID: '258EAFA5-E914-47DA-95CA-C5AB0DC85B11',
  hasBlob,
  kForOnEventAttribute: Symbol('kIsForOnEventAttribute'),
  kListener: Symbol('kListener'),
  kStatusCode: Symbol('status-code'),
  kWebSocket: Symbol('websocket'),
  NOOP: () => {}
};


/***/ }),
/* 20 */
/***/ ((module) => {

module.exports = require("bufferutil");

/***/ }),
/* 21 */
/***/ ((module) => {



const kDone = Symbol('kDone');
const kRun = Symbol('kRun');

/**
 * A very simple job queue with adjustable concurrency. Adapted from
 * https://github.com/STRML/async-limiter
 */
class Limiter {
  /**
   * Creates a new `Limiter`.
   *
   * @param {Number} [concurrency=Infinity] The maximum number of jobs allowed
   *     to run concurrently
   */
  constructor(concurrency) {
    this[kDone] = () => {
      this.pending--;
      this[kRun]();
    };
    this.concurrency = concurrency || Infinity;
    this.jobs = [];
    this.pending = 0;
  }

  /**
   * Adds a job to the queue.
   *
   * @param {Function} job The job to run
   * @public
   */
  add(job) {
    this.jobs.push(job);
    this[kRun]();
  }

  /**
   * Removes a job from the queue and runs it if possible.
   *
   * @private
   */
  [kRun]() {
    if (this.pending === this.concurrency) return;

    if (this.jobs.length) {
      const job = this.jobs.shift();

      this.pending++;
      job(this[kDone]);
    }
  }
}

module.exports = Limiter;


/***/ }),
/* 22 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



const { Writable } = __webpack_require__(14);

const PerMessageDeflate = __webpack_require__(16);
const {
  BINARY_TYPES,
  EMPTY_BUFFER,
  kStatusCode,
  kWebSocket
} = __webpack_require__(19);
const { concat, toArrayBuffer, unmask } = __webpack_require__(18);
const { isValidStatusCode, isValidUTF8 } = __webpack_require__(23);

const FastBuffer = Buffer[Symbol.species];

const GET_INFO = 0;
const GET_PAYLOAD_LENGTH_16 = 1;
const GET_PAYLOAD_LENGTH_64 = 2;
const GET_MASK = 3;
const GET_DATA = 4;
const INFLATING = 5;
const DEFER_EVENT = 6;

/**
 * HyBi Receiver implementation.
 *
 * @extends Writable
 */
class Receiver extends Writable {
  /**
   * Creates a Receiver instance.
   *
   * @param {Object} [options] Options object
   * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
   *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
   *     multiple times in the same tick
   * @param {String} [options.binaryType=nodebuffer] The type for binary data
   * @param {Object} [options.extensions] An object containing the negotiated
   *     extensions
   * @param {Boolean} [options.isServer=false] Specifies whether to operate in
   *     client or server mode
   * @param {Number} [options.maxPayload=0] The maximum allowed message length
   * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
   *     not to skip UTF-8 validation for text and close messages
   */
  constructor(options = {}) {
    super();

    this._allowSynchronousEvents =
      options.allowSynchronousEvents !== undefined
        ? options.allowSynchronousEvents
        : true;
    this._binaryType = options.binaryType || BINARY_TYPES[0];
    this._extensions = options.extensions || {};
    this._isServer = !!options.isServer;
    this._maxPayload = options.maxPayload | 0;
    this._skipUTF8Validation = !!options.skipUTF8Validation;
    this[kWebSocket] = undefined;

    this._bufferedBytes = 0;
    this._buffers = [];

    this._compressed = false;
    this._payloadLength = 0;
    this._mask = undefined;
    this._fragmented = 0;
    this._masked = false;
    this._fin = false;
    this._opcode = 0;

    this._totalPayloadLength = 0;
    this._messageLength = 0;
    this._fragments = [];

    this._errored = false;
    this._loop = false;
    this._state = GET_INFO;
  }

  /**
   * Implements `Writable.prototype._write()`.
   *
   * @param {Buffer} chunk The chunk of data to write
   * @param {String} encoding The character encoding of `chunk`
   * @param {Function} cb Callback
   * @private
   */
  _write(chunk, encoding, cb) {
    if (this._opcode === 0x08 && this._state == GET_INFO) return cb();

    this._bufferedBytes += chunk.length;
    this._buffers.push(chunk);
    this.startLoop(cb);
  }

  /**
   * Consumes `n` bytes from the buffered data.
   *
   * @param {Number} n The number of bytes to consume
   * @return {Buffer} The consumed bytes
   * @private
   */
  consume(n) {
    this._bufferedBytes -= n;

    if (n === this._buffers[0].length) return this._buffers.shift();

    if (n < this._buffers[0].length) {
      const buf = this._buffers[0];
      this._buffers[0] = new FastBuffer(
        buf.buffer,
        buf.byteOffset + n,
        buf.length - n
      );

      return new FastBuffer(buf.buffer, buf.byteOffset, n);
    }

    const dst = Buffer.allocUnsafe(n);

    do {
      const buf = this._buffers[0];
      const offset = dst.length - n;

      if (n >= buf.length) {
        dst.set(this._buffers.shift(), offset);
      } else {
        dst.set(new Uint8Array(buf.buffer, buf.byteOffset, n), offset);
        this._buffers[0] = new FastBuffer(
          buf.buffer,
          buf.byteOffset + n,
          buf.length - n
        );
      }

      n -= buf.length;
    } while (n > 0);

    return dst;
  }

  /**
   * Starts the parsing loop.
   *
   * @param {Function} cb Callback
   * @private
   */
  startLoop(cb) {
    this._loop = true;

    do {
      switch (this._state) {
        case GET_INFO:
          this.getInfo(cb);
          break;
        case GET_PAYLOAD_LENGTH_16:
          this.getPayloadLength16(cb);
          break;
        case GET_PAYLOAD_LENGTH_64:
          this.getPayloadLength64(cb);
          break;
        case GET_MASK:
          this.getMask();
          break;
        case GET_DATA:
          this.getData(cb);
          break;
        case INFLATING:
        case DEFER_EVENT:
          this._loop = false;
          return;
      }
    } while (this._loop);

    if (!this._errored) cb();
  }

  /**
   * Reads the first two bytes of a frame.
   *
   * @param {Function} cb Callback
   * @private
   */
  getInfo(cb) {
    if (this._bufferedBytes < 2) {
      this._loop = false;
      return;
    }

    const buf = this.consume(2);

    if ((buf[0] & 0x30) !== 0x00) {
      const error = this.createError(
        RangeError,
        'RSV2 and RSV3 must be clear',
        true,
        1002,
        'WS_ERR_UNEXPECTED_RSV_2_3'
      );

      cb(error);
      return;
    }

    const compressed = (buf[0] & 0x40) === 0x40;

    if (compressed && !this._extensions[PerMessageDeflate.extensionName]) {
      const error = this.createError(
        RangeError,
        'RSV1 must be clear',
        true,
        1002,
        'WS_ERR_UNEXPECTED_RSV_1'
      );

      cb(error);
      return;
    }

    this._fin = (buf[0] & 0x80) === 0x80;
    this._opcode = buf[0] & 0x0f;
    this._payloadLength = buf[1] & 0x7f;

    if (this._opcode === 0x00) {
      if (compressed) {
        const error = this.createError(
          RangeError,
          'RSV1 must be clear',
          true,
          1002,
          'WS_ERR_UNEXPECTED_RSV_1'
        );

        cb(error);
        return;
      }

      if (!this._fragmented) {
        const error = this.createError(
          RangeError,
          'invalid opcode 0',
          true,
          1002,
          'WS_ERR_INVALID_OPCODE'
        );

        cb(error);
        return;
      }

      this._opcode = this._fragmented;
    } else if (this._opcode === 0x01 || this._opcode === 0x02) {
      if (this._fragmented) {
        const error = this.createError(
          RangeError,
          `invalid opcode ${this._opcode}`,
          true,
          1002,
          'WS_ERR_INVALID_OPCODE'
        );

        cb(error);
        return;
      }

      this._compressed = compressed;
    } else if (this._opcode > 0x07 && this._opcode < 0x0b) {
      if (!this._fin) {
        const error = this.createError(
          RangeError,
          'FIN must be set',
          true,
          1002,
          'WS_ERR_EXPECTED_FIN'
        );

        cb(error);
        return;
      }

      if (compressed) {
        const error = this.createError(
          RangeError,
          'RSV1 must be clear',
          true,
          1002,
          'WS_ERR_UNEXPECTED_RSV_1'
        );

        cb(error);
        return;
      }

      if (
        this._payloadLength > 0x7d ||
        (this._opcode === 0x08 && this._payloadLength === 1)
      ) {
        const error = this.createError(
          RangeError,
          `invalid payload length ${this._payloadLength}`,
          true,
          1002,
          'WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH'
        );

        cb(error);
        return;
      }
    } else {
      const error = this.createError(
        RangeError,
        `invalid opcode ${this._opcode}`,
        true,
        1002,
        'WS_ERR_INVALID_OPCODE'
      );

      cb(error);
      return;
    }

    if (!this._fin && !this._fragmented) this._fragmented = this._opcode;
    this._masked = (buf[1] & 0x80) === 0x80;

    if (this._isServer) {
      if (!this._masked) {
        const error = this.createError(
          RangeError,
          'MASK must be set',
          true,
          1002,
          'WS_ERR_EXPECTED_MASK'
        );

        cb(error);
        return;
      }
    } else if (this._masked) {
      const error = this.createError(
        RangeError,
        'MASK must be clear',
        true,
        1002,
        'WS_ERR_UNEXPECTED_MASK'
      );

      cb(error);
      return;
    }

    if (this._payloadLength === 126) this._state = GET_PAYLOAD_LENGTH_16;
    else if (this._payloadLength === 127) this._state = GET_PAYLOAD_LENGTH_64;
    else this.haveLength(cb);
  }

  /**
   * Gets extended payload length (7+16).
   *
   * @param {Function} cb Callback
   * @private
   */
  getPayloadLength16(cb) {
    if (this._bufferedBytes < 2) {
      this._loop = false;
      return;
    }

    this._payloadLength = this.consume(2).readUInt16BE(0);
    this.haveLength(cb);
  }

  /**
   * Gets extended payload length (7+64).
   *
   * @param {Function} cb Callback
   * @private
   */
  getPayloadLength64(cb) {
    if (this._bufferedBytes < 8) {
      this._loop = false;
      return;
    }

    const buf = this.consume(8);
    const num = buf.readUInt32BE(0);

    //
    // The maximum safe integer in JavaScript is 2^53 - 1. An error is returned
    // if payload length is greater than this number.
    //
    if (num > Math.pow(2, 53 - 32) - 1) {
      const error = this.createError(
        RangeError,
        'Unsupported WebSocket frame: payload length > 2^53 - 1',
        false,
        1009,
        'WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH'
      );

      cb(error);
      return;
    }

    this._payloadLength = num * Math.pow(2, 32) + buf.readUInt32BE(4);
    this.haveLength(cb);
  }

  /**
   * Payload length has been read.
   *
   * @param {Function} cb Callback
   * @private
   */
  haveLength(cb) {
    if (this._payloadLength && this._opcode < 0x08) {
      this._totalPayloadLength += this._payloadLength;
      if (this._totalPayloadLength > this._maxPayload && this._maxPayload > 0) {
        const error = this.createError(
          RangeError,
          'Max payload size exceeded',
          false,
          1009,
          'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH'
        );

        cb(error);
        return;
      }
    }

    if (this._masked) this._state = GET_MASK;
    else this._state = GET_DATA;
  }

  /**
   * Reads mask bytes.
   *
   * @private
   */
  getMask() {
    if (this._bufferedBytes < 4) {
      this._loop = false;
      return;
    }

    this._mask = this.consume(4);
    this._state = GET_DATA;
  }

  /**
   * Reads data bytes.
   *
   * @param {Function} cb Callback
   * @private
   */
  getData(cb) {
    let data = EMPTY_BUFFER;

    if (this._payloadLength) {
      if (this._bufferedBytes < this._payloadLength) {
        this._loop = false;
        return;
      }

      data = this.consume(this._payloadLength);

      if (
        this._masked &&
        (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0
      ) {
        unmask(data, this._mask);
      }
    }

    if (this._opcode > 0x07) {
      this.controlMessage(data, cb);
      return;
    }

    if (this._compressed) {
      this._state = INFLATING;
      this.decompress(data, cb);
      return;
    }

    if (data.length) {
      //
      // This message is not compressed so its length is the sum of the payload
      // length of all fragments.
      //
      this._messageLength = this._totalPayloadLength;
      this._fragments.push(data);
    }

    this.dataMessage(cb);
  }

  /**
   * Decompresses data.
   *
   * @param {Buffer} data Compressed data
   * @param {Function} cb Callback
   * @private
   */
  decompress(data, cb) {
    const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];

    perMessageDeflate.decompress(data, this._fin, (err, buf) => {
      if (err) return cb(err);

      if (buf.length) {
        this._messageLength += buf.length;
        if (this._messageLength > this._maxPayload && this._maxPayload > 0) {
          const error = this.createError(
            RangeError,
            'Max payload size exceeded',
            false,
            1009,
            'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH'
          );

          cb(error);
          return;
        }

        this._fragments.push(buf);
      }

      this.dataMessage(cb);
      if (this._state === GET_INFO) this.startLoop(cb);
    });
  }

  /**
   * Handles a data message.
   *
   * @param {Function} cb Callback
   * @private
   */
  dataMessage(cb) {
    if (!this._fin) {
      this._state = GET_INFO;
      return;
    }

    const messageLength = this._messageLength;
    const fragments = this._fragments;

    this._totalPayloadLength = 0;
    this._messageLength = 0;
    this._fragmented = 0;
    this._fragments = [];

    if (this._opcode === 2) {
      let data;

      if (this._binaryType === 'nodebuffer') {
        data = concat(fragments, messageLength);
      } else if (this._binaryType === 'arraybuffer') {
        data = toArrayBuffer(concat(fragments, messageLength));
      } else if (this._binaryType === 'blob') {
        data = new Blob(fragments);
      } else {
        data = fragments;
      }

      if (this._allowSynchronousEvents) {
        this.emit('message', data, true);
        this._state = GET_INFO;
      } else {
        this._state = DEFER_EVENT;
        setImmediate(() => {
          this.emit('message', data, true);
          this._state = GET_INFO;
          this.startLoop(cb);
        });
      }
    } else {
      const buf = concat(fragments, messageLength);

      if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
        const error = this.createError(
          Error,
          'invalid UTF-8 sequence',
          true,
          1007,
          'WS_ERR_INVALID_UTF8'
        );

        cb(error);
        return;
      }

      if (this._state === INFLATING || this._allowSynchronousEvents) {
        this.emit('message', buf, false);
        this._state = GET_INFO;
      } else {
        this._state = DEFER_EVENT;
        setImmediate(() => {
          this.emit('message', buf, false);
          this._state = GET_INFO;
          this.startLoop(cb);
        });
      }
    }
  }

  /**
   * Handles a control message.
   *
   * @param {Buffer} data Data to handle
   * @return {(Error|RangeError|undefined)} A possible error
   * @private
   */
  controlMessage(data, cb) {
    if (this._opcode === 0x08) {
      if (data.length === 0) {
        this._loop = false;
        this.emit('conclude', 1005, EMPTY_BUFFER);
        this.end();
      } else {
        const code = data.readUInt16BE(0);

        if (!isValidStatusCode(code)) {
          const error = this.createError(
            RangeError,
            `invalid status code ${code}`,
            true,
            1002,
            'WS_ERR_INVALID_CLOSE_CODE'
          );

          cb(error);
          return;
        }

        const buf = new FastBuffer(
          data.buffer,
          data.byteOffset + 2,
          data.length - 2
        );

        if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
          const error = this.createError(
            Error,
            'invalid UTF-8 sequence',
            true,
            1007,
            'WS_ERR_INVALID_UTF8'
          );

          cb(error);
          return;
        }

        this._loop = false;
        this.emit('conclude', code, buf);
        this.end();
      }

      this._state = GET_INFO;
      return;
    }

    if (this._allowSynchronousEvents) {
      this.emit(this._opcode === 0x09 ? 'ping' : 'pong', data);
      this._state = GET_INFO;
    } else {
      this._state = DEFER_EVENT;
      setImmediate(() => {
        this.emit(this._opcode === 0x09 ? 'ping' : 'pong', data);
        this._state = GET_INFO;
        this.startLoop(cb);
      });
    }
  }

  /**
   * Builds an error object.
   *
   * @param {function(new:Error|RangeError)} ErrorCtor The error constructor
   * @param {String} message The error message
   * @param {Boolean} prefix Specifies whether or not to add a default prefix to
   *     `message`
   * @param {Number} statusCode The status code
   * @param {String} errorCode The exposed error code
   * @return {(Error|RangeError)} The error
   * @private
   */
  createError(ErrorCtor, message, prefix, statusCode, errorCode) {
    this._loop = false;
    this._errored = true;

    const err = new ErrorCtor(
      prefix ? `Invalid WebSocket frame: ${message}` : message
    );

    Error.captureStackTrace(err, this.createError);
    err.code = errorCode;
    err[kStatusCode] = statusCode;
    return err;
  }
}

module.exports = Receiver;


/***/ }),
/* 23 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



const { isUtf8 } = __webpack_require__(24);

const { hasBlob } = __webpack_require__(19);

//
// Allowed token characters:
//
// '!', '#', '$', '%', '&', ''', '*', '+', '-',
// '.', 0-9, A-Z, '^', '_', '`', a-z, '|', '~'
//
// tokenChars[32] === 0 // ' '
// tokenChars[33] === 1 // '!'
// tokenChars[34] === 0 // '"'
// ...
//
// prettier-ignore
const tokenChars = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 0 - 15
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 16 - 31
  0, 1, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 1, 1, 0, // 32 - 47
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, // 48 - 63
  0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 64 - 79
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, // 80 - 95
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 96 - 111
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0 // 112 - 127
];

/**
 * Checks if a status code is allowed in a close frame.
 *
 * @param {Number} code The status code
 * @return {Boolean} `true` if the status code is valid, else `false`
 * @public
 */
function isValidStatusCode(code) {
  return (
    (code >= 1000 &&
      code <= 1014 &&
      code !== 1004 &&
      code !== 1005 &&
      code !== 1006) ||
    (code >= 3000 && code <= 4999)
  );
}

/**
 * Checks if a given buffer contains only correct UTF-8.
 * Ported from https://www.cl.cam.ac.uk/%7Emgk25/ucs/utf8_check.c by
 * Markus Kuhn.
 *
 * @param {Buffer} buf The buffer to check
 * @return {Boolean} `true` if `buf` contains only correct UTF-8, else `false`
 * @public
 */
function _isValidUTF8(buf) {
  const len = buf.length;
  let i = 0;

  while (i < len) {
    if ((buf[i] & 0x80) === 0) {
      // 0xxxxxxx
      i++;
    } else if ((buf[i] & 0xe0) === 0xc0) {
      // 110xxxxx 10xxxxxx
      if (
        i + 1 === len ||
        (buf[i + 1] & 0xc0) !== 0x80 ||
        (buf[i] & 0xfe) === 0xc0 // Overlong
      ) {
        return false;
      }

      i += 2;
    } else if ((buf[i] & 0xf0) === 0xe0) {
      // 1110xxxx 10xxxxxx 10xxxxxx
      if (
        i + 2 >= len ||
        (buf[i + 1] & 0xc0) !== 0x80 ||
        (buf[i + 2] & 0xc0) !== 0x80 ||
        (buf[i] === 0xe0 && (buf[i + 1] & 0xe0) === 0x80) || // Overlong
        (buf[i] === 0xed && (buf[i + 1] & 0xe0) === 0xa0) // Surrogate (U+D800 - U+DFFF)
      ) {
        return false;
      }

      i += 3;
    } else if ((buf[i] & 0xf8) === 0xf0) {
      // 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
      if (
        i + 3 >= len ||
        (buf[i + 1] & 0xc0) !== 0x80 ||
        (buf[i + 2] & 0xc0) !== 0x80 ||
        (buf[i + 3] & 0xc0) !== 0x80 ||
        (buf[i] === 0xf0 && (buf[i + 1] & 0xf0) === 0x80) || // Overlong
        (buf[i] === 0xf4 && buf[i + 1] > 0x8f) ||
        buf[i] > 0xf4 // > U+10FFFF
      ) {
        return false;
      }

      i += 4;
    } else {
      return false;
    }
  }

  return true;
}

/**
 * Determines whether a value is a `Blob`.
 *
 * @param {*} value The value to be tested
 * @return {Boolean} `true` if `value` is a `Blob`, else `false`
 * @private
 */
function isBlob(value) {
  return (
    hasBlob &&
    typeof value === 'object' &&
    typeof value.arrayBuffer === 'function' &&
    typeof value.type === 'string' &&
    typeof value.stream === 'function' &&
    (value[Symbol.toStringTag] === 'Blob' ||
      value[Symbol.toStringTag] === 'File')
  );
}

module.exports = {
  isBlob,
  isValidStatusCode,
  isValidUTF8: _isValidUTF8,
  tokenChars
};

if (isUtf8) {
  module.exports.isValidUTF8 = function (buf) {
    return buf.length < 24 ? _isValidUTF8(buf) : isUtf8(buf);
  };
} /* istanbul ignore else  */ else if (!process.env.WS_NO_UTF_8_VALIDATE) {
  try {
    const isValidUTF8 = __webpack_require__(25);

    module.exports.isValidUTF8 = function (buf) {
      return buf.length < 32 ? _isValidUTF8(buf) : isValidUTF8(buf);
    };
  } catch (e) {
    // Continue regardless of the error.
  }
}


/***/ }),
/* 24 */
/***/ ((module) => {

module.exports = require("buffer");

/***/ }),
/* 25 */
/***/ ((module) => {

module.exports = require("utf-8-validate");

/***/ }),
/* 26 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "^Duplex" }] */



const { Duplex } = __webpack_require__(14);
const { randomFillSync } = __webpack_require__(13);

const PerMessageDeflate = __webpack_require__(16);
const { EMPTY_BUFFER, kWebSocket, NOOP } = __webpack_require__(19);
const { isBlob, isValidStatusCode } = __webpack_require__(23);
const { mask: applyMask, toBuffer } = __webpack_require__(18);

const kByteLength = Symbol('kByteLength');
const maskBuffer = Buffer.alloc(4);
const RANDOM_POOL_SIZE = 8 * 1024;
let randomPool;
let randomPoolPointer = RANDOM_POOL_SIZE;

const DEFAULT = 0;
const DEFLATING = 1;
const GET_BLOB_DATA = 2;

/**
 * HyBi Sender implementation.
 */
class Sender {
  /**
   * Creates a Sender instance.
   *
   * @param {Duplex} socket The connection socket
   * @param {Object} [extensions] An object containing the negotiated extensions
   * @param {Function} [generateMask] The function used to generate the masking
   *     key
   */
  constructor(socket, extensions, generateMask) {
    this._extensions = extensions || {};

    if (generateMask) {
      this._generateMask = generateMask;
      this._maskBuffer = Buffer.alloc(4);
    }

    this._socket = socket;

    this._firstFragment = true;
    this._compress = false;

    this._bufferedBytes = 0;
    this._queue = [];
    this._state = DEFAULT;
    this.onerror = NOOP;
    this[kWebSocket] = undefined;
  }

  /**
   * Frames a piece of data according to the HyBi WebSocket protocol.
   *
   * @param {(Buffer|String)} data The data to frame
   * @param {Object} options Options object
   * @param {Boolean} [options.fin=false] Specifies whether or not to set the
   *     FIN bit
   * @param {Function} [options.generateMask] The function used to generate the
   *     masking key
   * @param {Boolean} [options.mask=false] Specifies whether or not to mask
   *     `data`
   * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
   *     key
   * @param {Number} options.opcode The opcode
   * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
   *     modified
   * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
   *     RSV1 bit
   * @return {(Buffer|String)[]} The framed data
   * @public
   */
  static frame(data, options) {
    let mask;
    let merge = false;
    let offset = 2;
    let skipMasking = false;

    if (options.mask) {
      mask = options.maskBuffer || maskBuffer;

      if (options.generateMask) {
        options.generateMask(mask);
      } else {
        if (randomPoolPointer === RANDOM_POOL_SIZE) {
          /* istanbul ignore else  */
          if (randomPool === undefined) {
            //
            // This is lazily initialized because server-sent frames must not
            // be masked so it may never be used.
            //
            randomPool = Buffer.alloc(RANDOM_POOL_SIZE);
          }

          randomFillSync(randomPool, 0, RANDOM_POOL_SIZE);
          randomPoolPointer = 0;
        }

        mask[0] = randomPool[randomPoolPointer++];
        mask[1] = randomPool[randomPoolPointer++];
        mask[2] = randomPool[randomPoolPointer++];
        mask[3] = randomPool[randomPoolPointer++];
      }

      skipMasking = (mask[0] | mask[1] | mask[2] | mask[3]) === 0;
      offset = 6;
    }

    let dataLength;

    if (typeof data === 'string') {
      if (
        (!options.mask || skipMasking) &&
        options[kByteLength] !== undefined
      ) {
        dataLength = options[kByteLength];
      } else {
        data = Buffer.from(data);
        dataLength = data.length;
      }
    } else {
      dataLength = data.length;
      merge = options.mask && options.readOnly && !skipMasking;
    }

    let payloadLength = dataLength;

    if (dataLength >= 65536) {
      offset += 8;
      payloadLength = 127;
    } else if (dataLength > 125) {
      offset += 2;
      payloadLength = 126;
    }

    const target = Buffer.allocUnsafe(merge ? dataLength + offset : offset);

    target[0] = options.fin ? options.opcode | 0x80 : options.opcode;
    if (options.rsv1) target[0] |= 0x40;

    target[1] = payloadLength;

    if (payloadLength === 126) {
      target.writeUInt16BE(dataLength, 2);
    } else if (payloadLength === 127) {
      target[2] = target[3] = 0;
      target.writeUIntBE(dataLength, 4, 6);
    }

    if (!options.mask) return [target, data];

    target[1] |= 0x80;
    target[offset - 4] = mask[0];
    target[offset - 3] = mask[1];
    target[offset - 2] = mask[2];
    target[offset - 1] = mask[3];

    if (skipMasking) return [target, data];

    if (merge) {
      applyMask(data, mask, target, offset, dataLength);
      return [target];
    }

    applyMask(data, mask, data, 0, dataLength);
    return [target, data];
  }

  /**
   * Sends a close message to the other peer.
   *
   * @param {Number} [code] The status code component of the body
   * @param {(String|Buffer)} [data] The message component of the body
   * @param {Boolean} [mask=false] Specifies whether or not to mask the message
   * @param {Function} [cb] Callback
   * @public
   */
  close(code, data, mask, cb) {
    let buf;

    if (code === undefined) {
      buf = EMPTY_BUFFER;
    } else if (typeof code !== 'number' || !isValidStatusCode(code)) {
      throw new TypeError('First argument must be a valid error code number');
    } else if (data === undefined || !data.length) {
      buf = Buffer.allocUnsafe(2);
      buf.writeUInt16BE(code, 0);
    } else {
      const length = Buffer.byteLength(data);

      if (length > 123) {
        throw new RangeError('The message must not be greater than 123 bytes');
      }

      buf = Buffer.allocUnsafe(2 + length);
      buf.writeUInt16BE(code, 0);

      if (typeof data === 'string') {
        buf.write(data, 2);
      } else {
        buf.set(data, 2);
      }
    }

    const options = {
      [kByteLength]: buf.length,
      fin: true,
      generateMask: this._generateMask,
      mask,
      maskBuffer: this._maskBuffer,
      opcode: 0x08,
      readOnly: false,
      rsv1: false
    };

    if (this._state !== DEFAULT) {
      this.enqueue([this.dispatch, buf, false, options, cb]);
    } else {
      this.sendFrame(Sender.frame(buf, options), cb);
    }
  }

  /**
   * Sends a ping message to the other peer.
   *
   * @param {*} data The message to send
   * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
   * @param {Function} [cb] Callback
   * @public
   */
  ping(data, mask, cb) {
    let byteLength;
    let readOnly;

    if (typeof data === 'string') {
      byteLength = Buffer.byteLength(data);
      readOnly = false;
    } else if (isBlob(data)) {
      byteLength = data.size;
      readOnly = false;
    } else {
      data = toBuffer(data);
      byteLength = data.length;
      readOnly = toBuffer.readOnly;
    }

    if (byteLength > 125) {
      throw new RangeError('The data size must not be greater than 125 bytes');
    }

    const options = {
      [kByteLength]: byteLength,
      fin: true,
      generateMask: this._generateMask,
      mask,
      maskBuffer: this._maskBuffer,
      opcode: 0x09,
      readOnly,
      rsv1: false
    };

    if (isBlob(data)) {
      if (this._state !== DEFAULT) {
        this.enqueue([this.getBlobData, data, false, options, cb]);
      } else {
        this.getBlobData(data, false, options, cb);
      }
    } else if (this._state !== DEFAULT) {
      this.enqueue([this.dispatch, data, false, options, cb]);
    } else {
      this.sendFrame(Sender.frame(data, options), cb);
    }
  }

  /**
   * Sends a pong message to the other peer.
   *
   * @param {*} data The message to send
   * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
   * @param {Function} [cb] Callback
   * @public
   */
  pong(data, mask, cb) {
    let byteLength;
    let readOnly;

    if (typeof data === 'string') {
      byteLength = Buffer.byteLength(data);
      readOnly = false;
    } else if (isBlob(data)) {
      byteLength = data.size;
      readOnly = false;
    } else {
      data = toBuffer(data);
      byteLength = data.length;
      readOnly = toBuffer.readOnly;
    }

    if (byteLength > 125) {
      throw new RangeError('The data size must not be greater than 125 bytes');
    }

    const options = {
      [kByteLength]: byteLength,
      fin: true,
      generateMask: this._generateMask,
      mask,
      maskBuffer: this._maskBuffer,
      opcode: 0x0a,
      readOnly,
      rsv1: false
    };

    if (isBlob(data)) {
      if (this._state !== DEFAULT) {
        this.enqueue([this.getBlobData, data, false, options, cb]);
      } else {
        this.getBlobData(data, false, options, cb);
      }
    } else if (this._state !== DEFAULT) {
      this.enqueue([this.dispatch, data, false, options, cb]);
    } else {
      this.sendFrame(Sender.frame(data, options), cb);
    }
  }

  /**
   * Sends a data message to the other peer.
   *
   * @param {*} data The message to send
   * @param {Object} options Options object
   * @param {Boolean} [options.binary=false] Specifies whether `data` is binary
   *     or text
   * @param {Boolean} [options.compress=false] Specifies whether or not to
   *     compress `data`
   * @param {Boolean} [options.fin=false] Specifies whether the fragment is the
   *     last one
   * @param {Boolean} [options.mask=false] Specifies whether or not to mask
   *     `data`
   * @param {Function} [cb] Callback
   * @public
   */
  send(data, options, cb) {
    const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];
    let opcode = options.binary ? 2 : 1;
    let rsv1 = options.compress;

    let byteLength;
    let readOnly;

    if (typeof data === 'string') {
      byteLength = Buffer.byteLength(data);
      readOnly = false;
    } else if (isBlob(data)) {
      byteLength = data.size;
      readOnly = false;
    } else {
      data = toBuffer(data);
      byteLength = data.length;
      readOnly = toBuffer.readOnly;
    }

    if (this._firstFragment) {
      this._firstFragment = false;
      if (
        rsv1 &&
        perMessageDeflate &&
        perMessageDeflate.params[
          perMessageDeflate._isServer
            ? 'server_no_context_takeover'
            : 'client_no_context_takeover'
        ]
      ) {
        rsv1 = byteLength >= perMessageDeflate._threshold;
      }
      this._compress = rsv1;
    } else {
      rsv1 = false;
      opcode = 0;
    }

    if (options.fin) this._firstFragment = true;

    const opts = {
      [kByteLength]: byteLength,
      fin: options.fin,
      generateMask: this._generateMask,
      mask: options.mask,
      maskBuffer: this._maskBuffer,
      opcode,
      readOnly,
      rsv1
    };

    if (isBlob(data)) {
      if (this._state !== DEFAULT) {
        this.enqueue([this.getBlobData, data, this._compress, opts, cb]);
      } else {
        this.getBlobData(data, this._compress, opts, cb);
      }
    } else if (this._state !== DEFAULT) {
      this.enqueue([this.dispatch, data, this._compress, opts, cb]);
    } else {
      this.dispatch(data, this._compress, opts, cb);
    }
  }

  /**
   * Gets the contents of a blob as binary data.
   *
   * @param {Blob} blob The blob
   * @param {Boolean} [compress=false] Specifies whether or not to compress
   *     the data
   * @param {Object} options Options object
   * @param {Boolean} [options.fin=false] Specifies whether or not to set the
   *     FIN bit
   * @param {Function} [options.generateMask] The function used to generate the
   *     masking key
   * @param {Boolean} [options.mask=false] Specifies whether or not to mask
   *     `data`
   * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
   *     key
   * @param {Number} options.opcode The opcode
   * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
   *     modified
   * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
   *     RSV1 bit
   * @param {Function} [cb] Callback
   * @private
   */
  getBlobData(blob, compress, options, cb) {
    this._bufferedBytes += options[kByteLength];
    this._state = GET_BLOB_DATA;

    blob
      .arrayBuffer()
      .then((arrayBuffer) => {
        if (this._socket.destroyed) {
          const err = new Error(
            'The socket was closed while the blob was being read'
          );

          //
          // `callCallbacks` is called in the next tick to ensure that errors
          // that might be thrown in the callbacks behave like errors thrown
          // outside the promise chain.
          //
          process.nextTick(callCallbacks, this, err, cb);
          return;
        }

        this._bufferedBytes -= options[kByteLength];
        const data = toBuffer(arrayBuffer);

        if (!compress) {
          this._state = DEFAULT;
          this.sendFrame(Sender.frame(data, options), cb);
          this.dequeue();
        } else {
          this.dispatch(data, compress, options, cb);
        }
      })
      .catch((err) => {
        //
        // `onError` is called in the next tick for the same reason that
        // `callCallbacks` above is.
        //
        process.nextTick(onError, this, err, cb);
      });
  }

  /**
   * Dispatches a message.
   *
   * @param {(Buffer|String)} data The message to send
   * @param {Boolean} [compress=false] Specifies whether or not to compress
   *     `data`
   * @param {Object} options Options object
   * @param {Boolean} [options.fin=false] Specifies whether or not to set the
   *     FIN bit
   * @param {Function} [options.generateMask] The function used to generate the
   *     masking key
   * @param {Boolean} [options.mask=false] Specifies whether or not to mask
   *     `data`
   * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
   *     key
   * @param {Number} options.opcode The opcode
   * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
   *     modified
   * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
   *     RSV1 bit
   * @param {Function} [cb] Callback
   * @private
   */
  dispatch(data, compress, options, cb) {
    if (!compress) {
      this.sendFrame(Sender.frame(data, options), cb);
      return;
    }

    const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];

    this._bufferedBytes += options[kByteLength];
    this._state = DEFLATING;
    perMessageDeflate.compress(data, options.fin, (_, buf) => {
      if (this._socket.destroyed) {
        const err = new Error(
          'The socket was closed while data was being compressed'
        );

        callCallbacks(this, err, cb);
        return;
      }

      this._bufferedBytes -= options[kByteLength];
      this._state = DEFAULT;
      options.readOnly = false;
      this.sendFrame(Sender.frame(buf, options), cb);
      this.dequeue();
    });
  }

  /**
   * Executes queued send operations.
   *
   * @private
   */
  dequeue() {
    while (this._state === DEFAULT && this._queue.length) {
      const params = this._queue.shift();

      this._bufferedBytes -= params[3][kByteLength];
      Reflect.apply(params[0], this, params.slice(1));
    }
  }

  /**
   * Enqueues a send operation.
   *
   * @param {Array} params Send operation parameters.
   * @private
   */
  enqueue(params) {
    this._bufferedBytes += params[3][kByteLength];
    this._queue.push(params);
  }

  /**
   * Sends a frame.
   *
   * @param {(Buffer | String)[]} list The frame to send
   * @param {Function} [cb] Callback
   * @private
   */
  sendFrame(list, cb) {
    if (list.length === 2) {
      this._socket.cork();
      this._socket.write(list[0]);
      this._socket.write(list[1], cb);
      this._socket.uncork();
    } else {
      this._socket.write(list[0], cb);
    }
  }
}

module.exports = Sender;

/**
 * Calls queued callbacks with an error.
 *
 * @param {Sender} sender The `Sender` instance
 * @param {Error} err The error to call the callbacks with
 * @param {Function} [cb] The first callback
 * @private
 */
function callCallbacks(sender, err, cb) {
  if (typeof cb === 'function') cb(err);

  for (let i = 0; i < sender._queue.length; i++) {
    const params = sender._queue[i];
    const callback = params[params.length - 1];

    if (typeof callback === 'function') callback(err);
  }
}

/**
 * Handles a `Sender` error.
 *
 * @param {Sender} sender The `Sender` instance
 * @param {Error} err The error
 * @param {Function} [cb] The first pending callback
 * @private
 */
function onError(sender, err, cb) {
  callCallbacks(sender, err, cb);
  sender.onerror(err);
}


/***/ }),
/* 27 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



const { kForOnEventAttribute, kListener } = __webpack_require__(19);

const kCode = Symbol('kCode');
const kData = Symbol('kData');
const kError = Symbol('kError');
const kMessage = Symbol('kMessage');
const kReason = Symbol('kReason');
const kTarget = Symbol('kTarget');
const kType = Symbol('kType');
const kWasClean = Symbol('kWasClean');

/**
 * Class representing an event.
 */
class Event {
  /**
   * Create a new `Event`.
   *
   * @param {String} type The name of the event
   * @throws {TypeError} If the `type` argument is not specified
   */
  constructor(type) {
    this[kTarget] = null;
    this[kType] = type;
  }

  /**
   * @type {*}
   */
  get target() {
    return this[kTarget];
  }

  /**
   * @type {String}
   */
  get type() {
    return this[kType];
  }
}

Object.defineProperty(Event.prototype, 'target', { enumerable: true });
Object.defineProperty(Event.prototype, 'type', { enumerable: true });

/**
 * Class representing a close event.
 *
 * @extends Event
 */
class CloseEvent extends Event {
  /**
   * Create a new `CloseEvent`.
   *
   * @param {String} type The name of the event
   * @param {Object} [options] A dictionary object that allows for setting
   *     attributes via object members of the same name
   * @param {Number} [options.code=0] The status code explaining why the
   *     connection was closed
   * @param {String} [options.reason=''] A human-readable string explaining why
   *     the connection was closed
   * @param {Boolean} [options.wasClean=false] Indicates whether or not the
   *     connection was cleanly closed
   */
  constructor(type, options = {}) {
    super(type);

    this[kCode] = options.code === undefined ? 0 : options.code;
    this[kReason] = options.reason === undefined ? '' : options.reason;
    this[kWasClean] = options.wasClean === undefined ? false : options.wasClean;
  }

  /**
   * @type {Number}
   */
  get code() {
    return this[kCode];
  }

  /**
   * @type {String}
   */
  get reason() {
    return this[kReason];
  }

  /**
   * @type {Boolean}
   */
  get wasClean() {
    return this[kWasClean];
  }
}

Object.defineProperty(CloseEvent.prototype, 'code', { enumerable: true });
Object.defineProperty(CloseEvent.prototype, 'reason', { enumerable: true });
Object.defineProperty(CloseEvent.prototype, 'wasClean', { enumerable: true });

/**
 * Class representing an error event.
 *
 * @extends Event
 */
class ErrorEvent extends Event {
  /**
   * Create a new `ErrorEvent`.
   *
   * @param {String} type The name of the event
   * @param {Object} [options] A dictionary object that allows for setting
   *     attributes via object members of the same name
   * @param {*} [options.error=null] The error that generated this event
   * @param {String} [options.message=''] The error message
   */
  constructor(type, options = {}) {
    super(type);

    this[kError] = options.error === undefined ? null : options.error;
    this[kMessage] = options.message === undefined ? '' : options.message;
  }

  /**
   * @type {*}
   */
  get error() {
    return this[kError];
  }

  /**
   * @type {String}
   */
  get message() {
    return this[kMessage];
  }
}

Object.defineProperty(ErrorEvent.prototype, 'error', { enumerable: true });
Object.defineProperty(ErrorEvent.prototype, 'message', { enumerable: true });

/**
 * Class representing a message event.
 *
 * @extends Event
 */
class MessageEvent extends Event {
  /**
   * Create a new `MessageEvent`.
   *
   * @param {String} type The name of the event
   * @param {Object} [options] A dictionary object that allows for setting
   *     attributes via object members of the same name
   * @param {*} [options.data=null] The message content
   */
  constructor(type, options = {}) {
    super(type);

    this[kData] = options.data === undefined ? null : options.data;
  }

  /**
   * @type {*}
   */
  get data() {
    return this[kData];
  }
}

Object.defineProperty(MessageEvent.prototype, 'data', { enumerable: true });

/**
 * This provides methods for emulating the `EventTarget` interface. It's not
 * meant to be used directly.
 *
 * @mixin
 */
const EventTarget = {
  /**
   * Register an event listener.
   *
   * @param {String} type A string representing the event type to listen for
   * @param {(Function|Object)} handler The listener to add
   * @param {Object} [options] An options object specifies characteristics about
   *     the event listener
   * @param {Boolean} [options.once=false] A `Boolean` indicating that the
   *     listener should be invoked at most once after being added. If `true`,
   *     the listener would be automatically removed when invoked.
   * @public
   */
  addEventListener(type, handler, options = {}) {
    for (const listener of this.listeners(type)) {
      if (
        !options[kForOnEventAttribute] &&
        listener[kListener] === handler &&
        !listener[kForOnEventAttribute]
      ) {
        return;
      }
    }

    let wrapper;

    if (type === 'message') {
      wrapper = function onMessage(data, isBinary) {
        const event = new MessageEvent('message', {
          data: isBinary ? data : data.toString()
        });

        event[kTarget] = this;
        callListener(handler, this, event);
      };
    } else if (type === 'close') {
      wrapper = function onClose(code, message) {
        const event = new CloseEvent('close', {
          code,
          reason: message.toString(),
          wasClean: this._closeFrameReceived && this._closeFrameSent
        });

        event[kTarget] = this;
        callListener(handler, this, event);
      };
    } else if (type === 'error') {
      wrapper = function onError(error) {
        const event = new ErrorEvent('error', {
          error,
          message: error.message
        });

        event[kTarget] = this;
        callListener(handler, this, event);
      };
    } else if (type === 'open') {
      wrapper = function onOpen() {
        const event = new Event('open');

        event[kTarget] = this;
        callListener(handler, this, event);
      };
    } else {
      return;
    }

    wrapper[kForOnEventAttribute] = !!options[kForOnEventAttribute];
    wrapper[kListener] = handler;

    if (options.once) {
      this.once(type, wrapper);
    } else {
      this.on(type, wrapper);
    }
  },

  /**
   * Remove an event listener.
   *
   * @param {String} type A string representing the event type to remove
   * @param {(Function|Object)} handler The listener to remove
   * @public
   */
  removeEventListener(type, handler) {
    for (const listener of this.listeners(type)) {
      if (listener[kListener] === handler && !listener[kForOnEventAttribute]) {
        this.removeListener(type, listener);
        break;
      }
    }
  }
};

module.exports = {
  CloseEvent,
  ErrorEvent,
  Event,
  EventTarget,
  MessageEvent
};

/**
 * Call an event listener
 *
 * @param {(Function|Object)} listener The listener to call
 * @param {*} thisArg The value to use as `this`` when calling the listener
 * @param {Event} event The event to pass to the listener
 * @private
 */
function callListener(listener, thisArg, event) {
  if (typeof listener === 'object' && listener.handleEvent) {
    listener.handleEvent.call(listener, event);
  } else {
    listener.call(thisArg, event);
  }
}


/***/ }),
/* 28 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



const { tokenChars } = __webpack_require__(23);

/**
 * Adds an offer to the map of extension offers or a parameter to the map of
 * parameters.
 *
 * @param {Object} dest The map of extension offers or parameters
 * @param {String} name The extension or parameter name
 * @param {(Object|Boolean|String)} elem The extension parameters or the
 *     parameter value
 * @private
 */
function push(dest, name, elem) {
  if (dest[name] === undefined) dest[name] = [elem];
  else dest[name].push(elem);
}

/**
 * Parses the `Sec-WebSocket-Extensions` header into an object.
 *
 * @param {String} header The field value of the header
 * @return {Object} The parsed object
 * @public
 */
function parse(header) {
  const offers = Object.create(null);
  let params = Object.create(null);
  let mustUnescape = false;
  let isEscaping = false;
  let inQuotes = false;
  let extensionName;
  let paramName;
  let start = -1;
  let code = -1;
  let end = -1;
  let i = 0;

  for (; i < header.length; i++) {
    code = header.charCodeAt(i);

    if (extensionName === undefined) {
      if (end === -1 && tokenChars[code] === 1) {
        if (start === -1) start = i;
      } else if (
        i !== 0 &&
        (code === 0x20 /* ' ' */ || code === 0x09) /* '\t' */
      ) {
        if (end === -1 && start !== -1) end = i;
      } else if (code === 0x3b /* ';' */ || code === 0x2c /* ',' */) {
        if (start === -1) {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }

        if (end === -1) end = i;
        const name = header.slice(start, end);
        if (code === 0x2c) {
          push(offers, name, params);
          params = Object.create(null);
        } else {
          extensionName = name;
        }

        start = end = -1;
      } else {
        throw new SyntaxError(`Unexpected character at index ${i}`);
      }
    } else if (paramName === undefined) {
      if (end === -1 && tokenChars[code] === 1) {
        if (start === -1) start = i;
      } else if (code === 0x20 || code === 0x09) {
        if (end === -1 && start !== -1) end = i;
      } else if (code === 0x3b || code === 0x2c) {
        if (start === -1) {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }

        if (end === -1) end = i;
        push(params, header.slice(start, end), true);
        if (code === 0x2c) {
          push(offers, extensionName, params);
          params = Object.create(null);
          extensionName = undefined;
        }

        start = end = -1;
      } else if (code === 0x3d /* '=' */ && start !== -1 && end === -1) {
        paramName = header.slice(start, i);
        start = end = -1;
      } else {
        throw new SyntaxError(`Unexpected character at index ${i}`);
      }
    } else {
      //
      // The value of a quoted-string after unescaping must conform to the
      // token ABNF, so only token characters are valid.
      // Ref: https://tools.ietf.org/html/rfc6455#section-9.1
      //
      if (isEscaping) {
        if (tokenChars[code] !== 1) {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
        if (start === -1) start = i;
        else if (!mustUnescape) mustUnescape = true;
        isEscaping = false;
      } else if (inQuotes) {
        if (tokenChars[code] === 1) {
          if (start === -1) start = i;
        } else if (code === 0x22 /* '"' */ && start !== -1) {
          inQuotes = false;
          end = i;
        } else if (code === 0x5c /* '\' */) {
          isEscaping = true;
        } else {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
      } else if (code === 0x22 && header.charCodeAt(i - 1) === 0x3d) {
        inQuotes = true;
      } else if (end === -1 && tokenChars[code] === 1) {
        if (start === -1) start = i;
      } else if (start !== -1 && (code === 0x20 || code === 0x09)) {
        if (end === -1) end = i;
      } else if (code === 0x3b || code === 0x2c) {
        if (start === -1) {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }

        if (end === -1) end = i;
        let value = header.slice(start, end);
        if (mustUnescape) {
          value = value.replace(/\\/g, '');
          mustUnescape = false;
        }
        push(params, paramName, value);
        if (code === 0x2c) {
          push(offers, extensionName, params);
          params = Object.create(null);
          extensionName = undefined;
        }

        paramName = undefined;
        start = end = -1;
      } else {
        throw new SyntaxError(`Unexpected character at index ${i}`);
      }
    }
  }

  if (start === -1 || inQuotes || code === 0x20 || code === 0x09) {
    throw new SyntaxError('Unexpected end of input');
  }

  if (end === -1) end = i;
  const token = header.slice(start, end);
  if (extensionName === undefined) {
    push(offers, token, params);
  } else {
    if (paramName === undefined) {
      push(params, token, true);
    } else if (mustUnescape) {
      push(params, paramName, token.replace(/\\/g, ''));
    } else {
      push(params, paramName, token);
    }
    push(offers, extensionName, params);
  }

  return offers;
}

/**
 * Builds the `Sec-WebSocket-Extensions` header field value.
 *
 * @param {Object} extensions The map of extensions and parameters to format
 * @return {String} A string representing the given object
 * @public
 */
function format(extensions) {
  return Object.keys(extensions)
    .map((extension) => {
      let configurations = extensions[extension];
      if (!Array.isArray(configurations)) configurations = [configurations];
      return configurations
        .map((params) => {
          return [extension]
            .concat(
              Object.keys(params).map((k) => {
                let values = params[k];
                if (!Array.isArray(values)) values = [values];
                return values
                  .map((v) => (v === true ? k : `${k}=${v}`))
                  .join('; ');
              })
            )
            .join('; ');
        })
        .join(', ');
    })
    .join(', ');
}

module.exports = { format, parse };


/***/ }),
/* 29 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "^WebSocket$" }] */


const WebSocket = __webpack_require__(7);
const { Duplex } = __webpack_require__(14);

/**
 * Emits the `'close'` event on a stream.
 *
 * @param {Duplex} stream The stream.
 * @private
 */
function emitClose(stream) {
  stream.emit('close');
}

/**
 * The listener of the `'end'` event.
 *
 * @private
 */
function duplexOnEnd() {
  if (!this.destroyed && this._writableState.finished) {
    this.destroy();
  }
}

/**
 * The listener of the `'error'` event.
 *
 * @param {Error} err The error
 * @private
 */
function duplexOnError(err) {
  this.removeListener('error', duplexOnError);
  this.destroy();
  if (this.listenerCount('error') === 0) {
    // Do not suppress the throwing behavior.
    this.emit('error', err);
  }
}

/**
 * Wraps a `WebSocket` in a duplex stream.
 *
 * @param {WebSocket} ws The `WebSocket` to wrap
 * @param {Object} [options] The options for the `Duplex` constructor
 * @return {Duplex} The duplex stream
 * @public
 */
function createWebSocketStream(ws, options) {
  let terminateOnDestroy = true;

  const duplex = new Duplex({
    ...options,
    autoDestroy: false,
    emitClose: false,
    objectMode: false,
    writableObjectMode: false
  });

  ws.on('message', function message(msg, isBinary) {
    const data =
      !isBinary && duplex._readableState.objectMode ? msg.toString() : msg;

    if (!duplex.push(data)) ws.pause();
  });

  ws.once('error', function error(err) {
    if (duplex.destroyed) return;

    // Prevent `ws.terminate()` from being called by `duplex._destroy()`.
    //
    // - If the `'error'` event is emitted before the `'open'` event, then
    //   `ws.terminate()` is a noop as no socket is assigned.
    // - Otherwise, the error is re-emitted by the listener of the `'error'`
    //   event of the `Receiver` object. The listener already closes the
    //   connection by calling `ws.close()`. This allows a close frame to be
    //   sent to the other peer. If `ws.terminate()` is called right after this,
    //   then the close frame might not be sent.
    terminateOnDestroy = false;
    duplex.destroy(err);
  });

  ws.once('close', function close() {
    if (duplex.destroyed) return;

    duplex.push(null);
  });

  duplex._destroy = function (err, callback) {
    if (ws.readyState === ws.CLOSED) {
      callback(err);
      process.nextTick(emitClose, duplex);
      return;
    }

    let called = false;

    ws.once('error', function error(err) {
      called = true;
      callback(err);
    });

    ws.once('close', function close() {
      if (!called) callback(err);
      process.nextTick(emitClose, duplex);
    });

    if (terminateOnDestroy) ws.terminate();
  };

  duplex._final = function (callback) {
    if (ws.readyState === ws.CONNECTING) {
      ws.once('open', function open() {
        duplex._final(callback);
      });
      return;
    }

    // If the value of the `_socket` property is `null` it means that `ws` is a
    // client websocket and the handshake failed. In fact, when this happens, a
    // socket is never assigned to the websocket. Wait for the `'error'` event
    // that will be emitted by the websocket.
    if (ws._socket === null) return;

    if (ws._socket._writableState.finished) {
      callback();
      if (duplex._readableState.endEmitted) duplex.destroy();
    } else {
      ws._socket.once('finish', function finish() {
        // `duplex` is not destroyed here because the `'end'` event will be
        // emitted on `duplex` after this `'finish'` event. The EOF signaling
        // `null` chunk is, in fact, pushed when the websocket emits `'close'`.
        callback();
      });
      ws.close();
    }
  };

  duplex._read = function () {
    if (ws.isPaused) ws.resume();
  };

  duplex._write = function (chunk, encoding, callback) {
    if (ws.readyState === ws.CONNECTING) {
      ws.once('open', function open() {
        duplex._write(chunk, encoding, callback);
      });
      return;
    }

    ws.send(chunk, callback);
  };

  duplex.on('end', duplexOnEnd);
  duplex.on('error', duplexOnError);
  return duplex;
}

module.exports = createWebSocketStream;


/***/ }),
/* 30 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "^Duplex$", "caughtErrors": "none" }] */



const EventEmitter = __webpack_require__(8);
const http = __webpack_require__(10);
const { Duplex } = __webpack_require__(14);
const { createHash } = __webpack_require__(13);

const extension = __webpack_require__(28);
const PerMessageDeflate = __webpack_require__(16);
const subprotocol = __webpack_require__(31);
const WebSocket = __webpack_require__(7);
const { GUID, kWebSocket } = __webpack_require__(19);

const keyRegex = /^[+/0-9A-Za-z]{22}==$/;

const RUNNING = 0;
const CLOSING = 1;
const CLOSED = 2;

/**
 * Class representing a WebSocket server.
 *
 * @extends EventEmitter
 */
class WebSocketServer extends EventEmitter {
  /**
   * Create a `WebSocketServer` instance.
   *
   * @param {Object} options Configuration options
   * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
   *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
   *     multiple times in the same tick
   * @param {Boolean} [options.autoPong=true] Specifies whether or not to
   *     automatically send a pong in response to a ping
   * @param {Number} [options.backlog=511] The maximum length of the queue of
   *     pending connections
   * @param {Boolean} [options.clientTracking=true] Specifies whether or not to
   *     track clients
   * @param {Function} [options.handleProtocols] A hook to handle protocols
   * @param {String} [options.host] The hostname where to bind the server
   * @param {Number} [options.maxPayload=104857600] The maximum allowed message
   *     size
   * @param {Boolean} [options.noServer=false] Enable no server mode
   * @param {String} [options.path] Accept only connections matching this path
   * @param {(Boolean|Object)} [options.perMessageDeflate=false] Enable/disable
   *     permessage-deflate
   * @param {Number} [options.port] The port where to bind the server
   * @param {(http.Server|https.Server)} [options.server] A pre-created HTTP/S
   *     server to use
   * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
   *     not to skip UTF-8 validation for text and close messages
   * @param {Function} [options.verifyClient] A hook to reject connections
   * @param {Function} [options.WebSocket=WebSocket] Specifies the `WebSocket`
   *     class to use. It must be the `WebSocket` class or class that extends it
   * @param {Function} [callback] A listener for the `listening` event
   */
  constructor(options, callback) {
    super();

    options = {
      allowSynchronousEvents: true,
      autoPong: true,
      maxPayload: 100 * 1024 * 1024,
      skipUTF8Validation: false,
      perMessageDeflate: false,
      handleProtocols: null,
      clientTracking: true,
      verifyClient: null,
      noServer: false,
      backlog: null, // use default (511 as implemented in net.js)
      server: null,
      host: null,
      path: null,
      port: null,
      WebSocket,
      ...options
    };

    if (
      (options.port == null && !options.server && !options.noServer) ||
      (options.port != null && (options.server || options.noServer)) ||
      (options.server && options.noServer)
    ) {
      throw new TypeError(
        'One and only one of the "port", "server", or "noServer" options ' +
          'must be specified'
      );
    }

    if (options.port != null) {
      this._server = http.createServer((req, res) => {
        const body = http.STATUS_CODES[426];

        res.writeHead(426, {
          'Content-Length': body.length,
          'Content-Type': 'text/plain'
        });
        res.end(body);
      });
      this._server.listen(
        options.port,
        options.host,
        options.backlog,
        callback
      );
    } else if (options.server) {
      this._server = options.server;
    }

    if (this._server) {
      const emitConnection = this.emit.bind(this, 'connection');

      this._removeListeners = addListeners(this._server, {
        listening: this.emit.bind(this, 'listening'),
        error: this.emit.bind(this, 'error'),
        upgrade: (req, socket, head) => {
          this.handleUpgrade(req, socket, head, emitConnection);
        }
      });
    }

    if (options.perMessageDeflate === true) options.perMessageDeflate = {};
    if (options.clientTracking) {
      this.clients = new Set();
      this._shouldEmitClose = false;
    }

    this.options = options;
    this._state = RUNNING;
  }

  /**
   * Returns the bound address, the address family name, and port of the server
   * as reported by the operating system if listening on an IP socket.
   * If the server is listening on a pipe or UNIX domain socket, the name is
   * returned as a string.
   *
   * @return {(Object|String|null)} The address of the server
   * @public
   */
  address() {
    if (this.options.noServer) {
      throw new Error('The server is operating in "noServer" mode');
    }

    if (!this._server) return null;
    return this._server.address();
  }

  /**
   * Stop the server from accepting new connections and emit the `'close'` event
   * when all existing connections are closed.
   *
   * @param {Function} [cb] A one-time listener for the `'close'` event
   * @public
   */
  close(cb) {
    if (this._state === CLOSED) {
      if (cb) {
        this.once('close', () => {
          cb(new Error('The server is not running'));
        });
      }

      process.nextTick(emitClose, this);
      return;
    }

    if (cb) this.once('close', cb);

    if (this._state === CLOSING) return;
    this._state = CLOSING;

    if (this.options.noServer || this.options.server) {
      if (this._server) {
        this._removeListeners();
        this._removeListeners = this._server = null;
      }

      if (this.clients) {
        if (!this.clients.size) {
          process.nextTick(emitClose, this);
        } else {
          this._shouldEmitClose = true;
        }
      } else {
        process.nextTick(emitClose, this);
      }
    } else {
      const server = this._server;

      this._removeListeners();
      this._removeListeners = this._server = null;

      //
      // The HTTP/S server was created internally. Close it, and rely on its
      // `'close'` event.
      //
      server.close(() => {
        emitClose(this);
      });
    }
  }

  /**
   * See if a given request should be handled by this server instance.
   *
   * @param {http.IncomingMessage} req Request object to inspect
   * @return {Boolean} `true` if the request is valid, else `false`
   * @public
   */
  shouldHandle(req) {
    if (this.options.path) {
      const index = req.url.indexOf('?');
      const pathname = index !== -1 ? req.url.slice(0, index) : req.url;

      if (pathname !== this.options.path) return false;
    }

    return true;
  }

  /**
   * Handle a HTTP Upgrade request.
   *
   * @param {http.IncomingMessage} req The request object
   * @param {Duplex} socket The network socket between the server and client
   * @param {Buffer} head The first packet of the upgraded stream
   * @param {Function} cb Callback
   * @public
   */
  handleUpgrade(req, socket, head, cb) {
    socket.on('error', socketOnError);

    const key = req.headers['sec-websocket-key'];
    const upgrade = req.headers.upgrade;
    const version = +req.headers['sec-websocket-version'];

    if (req.method !== 'GET') {
      const message = 'Invalid HTTP method';
      abortHandshakeOrEmitwsClientError(this, req, socket, 405, message);
      return;
    }

    if (upgrade === undefined || upgrade.toLowerCase() !== 'websocket') {
      const message = 'Invalid Upgrade header';
      abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
      return;
    }

    if (key === undefined || !keyRegex.test(key)) {
      const message = 'Missing or invalid Sec-WebSocket-Key header';
      abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
      return;
    }

    if (version !== 13 && version !== 8) {
      const message = 'Missing or invalid Sec-WebSocket-Version header';
      abortHandshakeOrEmitwsClientError(this, req, socket, 400, message, {
        'Sec-WebSocket-Version': '13, 8'
      });
      return;
    }

    if (!this.shouldHandle(req)) {
      abortHandshake(socket, 400);
      return;
    }

    const secWebSocketProtocol = req.headers['sec-websocket-protocol'];
    let protocols = new Set();

    if (secWebSocketProtocol !== undefined) {
      try {
        protocols = subprotocol.parse(secWebSocketProtocol);
      } catch (err) {
        const message = 'Invalid Sec-WebSocket-Protocol header';
        abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
        return;
      }
    }

    const secWebSocketExtensions = req.headers['sec-websocket-extensions'];
    const extensions = {};

    if (
      this.options.perMessageDeflate &&
      secWebSocketExtensions !== undefined
    ) {
      const perMessageDeflate = new PerMessageDeflate(
        this.options.perMessageDeflate,
        true,
        this.options.maxPayload
      );

      try {
        const offers = extension.parse(secWebSocketExtensions);

        if (offers[PerMessageDeflate.extensionName]) {
          perMessageDeflate.accept(offers[PerMessageDeflate.extensionName]);
          extensions[PerMessageDeflate.extensionName] = perMessageDeflate;
        }
      } catch (err) {
        const message =
          'Invalid or unacceptable Sec-WebSocket-Extensions header';
        abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
        return;
      }
    }

    //
    // Optionally call external client verification handler.
    //
    if (this.options.verifyClient) {
      const info = {
        origin:
          req.headers[`${version === 8 ? 'sec-websocket-origin' : 'origin'}`],
        secure: !!(req.socket.authorized || req.socket.encrypted),
        req
      };

      if (this.options.verifyClient.length === 2) {
        this.options.verifyClient(info, (verified, code, message, headers) => {
          if (!verified) {
            return abortHandshake(socket, code || 401, message, headers);
          }

          this.completeUpgrade(
            extensions,
            key,
            protocols,
            req,
            socket,
            head,
            cb
          );
        });
        return;
      }

      if (!this.options.verifyClient(info)) return abortHandshake(socket, 401);
    }

    this.completeUpgrade(extensions, key, protocols, req, socket, head, cb);
  }

  /**
   * Upgrade the connection to WebSocket.
   *
   * @param {Object} extensions The accepted extensions
   * @param {String} key The value of the `Sec-WebSocket-Key` header
   * @param {Set} protocols The subprotocols
   * @param {http.IncomingMessage} req The request object
   * @param {Duplex} socket The network socket between the server and client
   * @param {Buffer} head The first packet of the upgraded stream
   * @param {Function} cb Callback
   * @throws {Error} If called more than once with the same socket
   * @private
   */
  completeUpgrade(extensions, key, protocols, req, socket, head, cb) {
    //
    // Destroy the socket if the client has already sent a FIN packet.
    //
    if (!socket.readable || !socket.writable) return socket.destroy();

    if (socket[kWebSocket]) {
      throw new Error(
        'server.handleUpgrade() was called more than once with the same ' +
          'socket, possibly due to a misconfiguration'
      );
    }

    if (this._state > RUNNING) return abortHandshake(socket, 503);

    const digest = createHash('sha1')
      .update(key + GUID)
      .digest('base64');

    const headers = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${digest}`
    ];

    const ws = new this.options.WebSocket(null, undefined, this.options);

    if (protocols.size) {
      //
      // Optionally call external protocol selection handler.
      //
      const protocol = this.options.handleProtocols
        ? this.options.handleProtocols(protocols, req)
        : protocols.values().next().value;

      if (protocol) {
        headers.push(`Sec-WebSocket-Protocol: ${protocol}`);
        ws._protocol = protocol;
      }
    }

    if (extensions[PerMessageDeflate.extensionName]) {
      const params = extensions[PerMessageDeflate.extensionName].params;
      const value = extension.format({
        [PerMessageDeflate.extensionName]: [params]
      });
      headers.push(`Sec-WebSocket-Extensions: ${value}`);
      ws._extensions = extensions;
    }

    //
    // Allow external modification/inspection of handshake headers.
    //
    this.emit('headers', headers, req);

    socket.write(headers.concat('\r\n').join('\r\n'));
    socket.removeListener('error', socketOnError);

    ws.setSocket(socket, head, {
      allowSynchronousEvents: this.options.allowSynchronousEvents,
      maxPayload: this.options.maxPayload,
      skipUTF8Validation: this.options.skipUTF8Validation
    });

    if (this.clients) {
      this.clients.add(ws);
      ws.on('close', () => {
        this.clients.delete(ws);

        if (this._shouldEmitClose && !this.clients.size) {
          process.nextTick(emitClose, this);
        }
      });
    }

    cb(ws, req);
  }
}

module.exports = WebSocketServer;

/**
 * Add event listeners on an `EventEmitter` using a map of <event, listener>
 * pairs.
 *
 * @param {EventEmitter} server The event emitter
 * @param {Object.<String, Function>} map The listeners to add
 * @return {Function} A function that will remove the added listeners when
 *     called
 * @private
 */
function addListeners(server, map) {
  for (const event of Object.keys(map)) server.on(event, map[event]);

  return function removeListeners() {
    for (const event of Object.keys(map)) {
      server.removeListener(event, map[event]);
    }
  };
}

/**
 * Emit a `'close'` event on an `EventEmitter`.
 *
 * @param {EventEmitter} server The event emitter
 * @private
 */
function emitClose(server) {
  server._state = CLOSED;
  server.emit('close');
}

/**
 * Handle socket errors.
 *
 * @private
 */
function socketOnError() {
  this.destroy();
}

/**
 * Close the connection when preconditions are not fulfilled.
 *
 * @param {Duplex} socket The socket of the upgrade request
 * @param {Number} code The HTTP response status code
 * @param {String} [message] The HTTP response body
 * @param {Object} [headers] Additional HTTP response headers
 * @private
 */
function abortHandshake(socket, code, message, headers) {
  //
  // The socket is writable unless the user destroyed or ended it before calling
  // `server.handleUpgrade()` or in the `verifyClient` function, which is a user
  // error. Handling this does not make much sense as the worst that can happen
  // is that some of the data written by the user might be discarded due to the
  // call to `socket.end()` below, which triggers an `'error'` event that in
  // turn causes the socket to be destroyed.
  //
  message = message || http.STATUS_CODES[code];
  headers = {
    Connection: 'close',
    'Content-Type': 'text/html',
    'Content-Length': Buffer.byteLength(message),
    ...headers
  };

  socket.once('finish', socket.destroy);

  socket.end(
    `HTTP/1.1 ${code} ${http.STATUS_CODES[code]}\r\n` +
      Object.keys(headers)
        .map((h) => `${h}: ${headers[h]}`)
        .join('\r\n') +
      '\r\n\r\n' +
      message
  );
}

/**
 * Emit a `'wsClientError'` event on a `WebSocketServer` if there is at least
 * one listener for it, otherwise call `abortHandshake()`.
 *
 * @param {WebSocketServer} server The WebSocket server
 * @param {http.IncomingMessage} req The request object
 * @param {Duplex} socket The socket of the upgrade request
 * @param {Number} code The HTTP response status code
 * @param {String} message The HTTP response body
 * @param {Object} [headers] The HTTP response headers
 * @private
 */
function abortHandshakeOrEmitwsClientError(
  server,
  req,
  socket,
  code,
  message,
  headers
) {
  if (server.listenerCount('wsClientError')) {
    const err = new Error(message);
    Error.captureStackTrace(err, abortHandshakeOrEmitwsClientError);

    server.emit('wsClientError', err, socket, req);
  } else {
    abortHandshake(socket, code, message, headers);
  }
}


/***/ }),
/* 31 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



const { tokenChars } = __webpack_require__(23);

/**
 * Parses the `Sec-WebSocket-Protocol` header into a set of subprotocol names.
 *
 * @param {String} header The field value of the header
 * @return {Set} The subprotocol names
 * @public
 */
function parse(header) {
  const protocols = new Set();
  let start = -1;
  let end = -1;
  let i = 0;

  for (i; i < header.length; i++) {
    const code = header.charCodeAt(i);

    if (end === -1 && tokenChars[code] === 1) {
      if (start === -1) start = i;
    } else if (
      i !== 0 &&
      (code === 0x20 /* ' ' */ || code === 0x09) /* '\t' */
    ) {
      if (end === -1 && start !== -1) end = i;
    } else if (code === 0x2c /* ',' */) {
      if (start === -1) {
        throw new SyntaxError(`Unexpected character at index ${i}`);
      }

      if (end === -1) end = i;

      const protocol = header.slice(start, end);

      if (protocols.has(protocol)) {
        throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
      }

      protocols.add(protocol);
      start = end = -1;
    } else {
      throw new SyntaxError(`Unexpected character at index ${i}`);
    }
  }

  if (start === -1 || end !== -1) {
    throw new SyntaxError('Unexpected end of input');
  }

  const protocol = header.slice(start, i);

  if (protocols.has(protocol)) {
    throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
  }

  protocols.add(protocol);
  return protocols;
}

module.exports = { parse };


/***/ }),
/* 32 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ConnectionState = void 0;
// 连接状态枚举
var ConnectionState;
(function (ConnectionState) {
    ConnectionState["DISCONNECTED"] = "disconnected";
    ConnectionState["CONNECTING"] = "connecting";
    ConnectionState["CONNECTED"] = "connected";
    ConnectionState["RECONNECTING"] = "reconnecting";
})(ConnectionState || (exports.ConnectionState = ConnectionState = {}));


/***/ }),
/* 33 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.LogLevel = void 0;
const vscode = __importStar(__webpack_require__(1));
const setting_1 = __importDefault(__webpack_require__(34));
// 日志级别枚举
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
// 颜色代码
const Colors = {
    RESET: '\x1b[0m',
    BRIGHT: '\x1b[1m',
    DIM: '\x1b[2m',
    RED: '\x1b[31m',
    GREEN: '\x1b[32m',
    YELLOW: '\x1b[33m',
    BLUE: '\x1b[34m',
    MAGENTA: '\x1b[35m',
    CYAN: '\x1b[36m',
    WHITE: '\x1b[37m',
    BG_RED: '\x1b[41m',
    BG_GREEN: '\x1b[42m',
    BG_YELLOW: '\x1b[43m',
    BG_BLUE: '\x1b[44m'
};
// 检测终端是否支持ANSI颜色
function supportsColors() {
    // 检查是否在Windows PowerShell环境中
    if (process.platform === 'win32') {
        const term = process.env.TERM || '';
        const shell = process.env.SHELL || '';
        // Windows PowerShell通常不支持ANSI颜色
        if (shell.includes('powershell') || shell.includes('cmd') || term === '') {
            return false;
        }
    }
    // 检查是否在VSCode的输出面板中
    if (process.env.VSCODE_EXTENSION_DEVELOPMENT === 'true') {
        return false;
    }
    // 检查TERM环境变量
    const term = process.env.TERM;
    if (term && (term.includes('xterm') || term.includes('linux') || term.includes('screen'))) {
        return true;
    }
    // 默认情况下禁用颜色以避免乱码
    return false;
}
class Logger {
    config = {
        level: LogLevel.INFO,
        showNotifications: true,
        enableFileLogging: true,
        enableColors: supportsColors() // 根据终端环境自动设置
    };
    setConfig(config) {
        this.config = { ...this.config, ...config };
    }
    // 手动启用或禁用颜色
    setColorsEnabled(enabled) {
        this.config.enableColors = enabled;
    }
    // 获取当前颜色状态
    isColorsEnabled() {
        return this.config.enableColors;
    }
    shouldLog(level) {
        return level >= this.config.level;
    }
    getColorForLevel(level) {
        if (!this.config.enableColors)
            return '';
        switch (level) {
            case 'DEBUG': return Colors.DIM + Colors.CYAN;
            case 'INFO': return Colors.BRIGHT + Colors.GREEN;
            case 'WARN': return Colors.BRIGHT + Colors.YELLOW;
            case 'ERROR': return Colors.BRIGHT + Colors.RED;
            default: return Colors.WHITE;
        }
    }
    formatMessage(level, message, ...params) {
        const formattedParams = params.length > 0 ? ` ${JSON.stringify(params)}` : '';
        const color = this.getColorForLevel(level);
        const resetColor = this.config.enableColors ? Colors.RESET : '';
        return `${color}${message}${formattedParams}${resetColor}`;
    }
    debug(message, ...params) {
        if (this.shouldLog(LogLevel.DEBUG)) {
            const formattedMessage = this.formatMessage('DEBUG', message, ...params);
            setting_1.default.getLogWindows().debug(formattedMessage);
        }
    }
    info(message, ...params) {
        if (this.shouldLog(LogLevel.INFO)) {
            const formattedMessage = this.formatMessage('INFO', message, ...params);
            setting_1.default.getLogWindows().info(formattedMessage);
        }
    }
    warn(message, ...params) {
        if (this.shouldLog(LogLevel.WARN)) {
            const formattedMessage = this.formatMessage('WARN', message, ...params);
            setting_1.default.getLogWindows().warn(formattedMessage);
        }
    }
    error(message, ...params) {
        if (this.shouldLog(LogLevel.ERROR)) {
            const formattedMessage = this.formatMessage('ERROR', message, ...params);
            setting_1.default.getLogWindows().error(formattedMessage);
        }
    }
    // 显示通知消息
    showInfo(message) {
        if (this.config.showNotifications) {
            vscode.window.showInformationMessage(message);
        }
        this.info(message);
    }
    showWarning(message) {
        if (this.config.showNotifications) {
            vscode.window.showWarningMessage(message);
        }
        this.warn(message);
    }
    showError(message) {
        if (this.config.showNotifications) {
            vscode.window.showErrorMessage(message);
        }
        this.error(message);
    }
    // 格式化日志方法
    formatSuccess(message, ...params) {
        const formattedMessage = this.config.enableColors
            ? `${Colors.BRIGHT}${Colors.GREEN}✓ ${message}${Colors.RESET}`
            : `✓ ${message}`;
        this.info(formattedMessage, ...params);
    }
    formatWarning(message, ...params) {
        const formattedMessage = this.config.enableColors
            ? `${Colors.BRIGHT}${Colors.YELLOW}⚠ ${message}${Colors.RESET}`
            : `⚠ ${message}`;
        this.warn(formattedMessage, ...params);
    }
    formatError(message, ...params) {
        const formattedMessage = this.config.enableColors
            ? `${Colors.BRIGHT}${Colors.RED}✗ ${message}${Colors.RESET}`
            : `✗ ${message}`;
        this.error(formattedMessage, ...params);
    }
    formatProgress(message, ...params) {
        const formattedMessage = this.config.enableColors
            ? `${Colors.BRIGHT}${Colors.BLUE}⟳ ${message}${Colors.RESET}`
            : `⟳ ${message}`;
        this.info(formattedMessage, ...params);
    }
    // 连接状态日志
    logConnectionStatus(status, details) {
        const statusMessages = {
            connecting: '正在连接...',
            connected: '连接成功',
            disconnected: '连接断开',
            reconnecting: '正在重连...'
        };
        const statusColors = {
            connecting: Colors.YELLOW,
            connected: Colors.GREEN,
            disconnected: Colors.RED,
            reconnecting: Colors.BLUE
        };
        const message = statusMessages[status];
        const color = statusColors[status];
        if (this.config.enableColors) {
            this.info(`${color}${message}${Colors.RESET}${details ? ` - ${details}` : ''}`);
        }
        else {
            this.info(`${message}${details ? ` - ${details}` : ''}`);
        }
    }
    // 兼容旧接口
    model(message) {
        this.showInfo(message);
    }
    modelInfo(message) {
        // 仅显示通知并记录一次日志（showInfo 内部已调用 info）
        this.showInfo(message);
    }
    modelError(message) {
        // 仅显示通知并记录一次日志（showError 内部已调用 error）
        this.showError(message);
    }
}
const log = new Logger();
exports["default"] = log;


/***/ }),
/* 34 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
const fs = __importStar(__webpack_require__(3));
const path = __importStar(__webpack_require__(35));
const vscode = __importStar(__webpack_require__(1));
let extension;
let logg;
let context;
const setting = {
    init(context) {
        this.setExtension(context.extension);
        this.setLogWindows(context.extension);
        this.setContext(context);
    },
    setExtension(iExtension) {
        extension = iExtension;
    },
    getExtension() {
        return extension;
    },
    setContext(iContext) {
        context = iContext;
    },
    getContext() {
        return context;
    },
    setLogWindows(extension) {
        logg = vscode.window.createOutputChannel(extension.packageJSON.displayName, { log: true });
        logg.show(true);
    },
    getLogWindows() {
        return logg;
    },
    isProject() {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            return false;
        }
        for (const folder of folders) {
            const deekeJson = path.join(folder.uri.fsPath, 'deekeScript.json');
            if (fs.existsSync(deekeJson)) {
                return true;
            }
        }
        return false;
    }
};
exports["default"] = setting;


/***/ }),
/* 35 */
/***/ ((module) => {

module.exports = require("path");

/***/ }),
/* 36 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.FileSyncService = void 0;
const fs = __importStar(__webpack_require__(3));
const path = __importStar(__webpack_require__(35));
const vscode = __importStar(__webpack_require__(1));
const utils_1 = __webpack_require__(37);
const progress_1 = __webpack_require__(38);
const log_1 = __importDefault(__webpack_require__(33));
class FileSyncService {
    wsService;
    syncState = {
        isSyncing: false,
        totalFiles: 0,
        syncedFiles: 0,
        errors: []
    };
    constructor(wsService) {
        this.wsService = wsService;
    }
    get state() {
        return { ...this.syncState };
    }
    // 同步单个文件
    async syncFile(baseDir, filePath, isDir = false, document) {
        try {
            if (!this.wsService.isConnected) {
                throw new Error('WebSocket未连接');
            }
            const relativePath = (0, utils_1.getRelativePath)(baseDir, filePath);
            // 获取文件内容：优先使用文档对象中的实时内容，否则从磁盘读取
            let fileContent = '';
            if (!isDir) {
                if (document) {
                    // 使用文档对象中的实时内容，转换为base64
                    fileContent = Buffer.from(document.getText(), 'utf8').toString('base64');
                }
                else {
                    // 从磁盘读取文件，直接转换为base64
                    const fileBuffer = fs.readFileSync(filePath);
                    fileContent = fileBuffer.toString('base64');
                }
            }
            const data = {
                status: 1001,
                file: relativePath,
                isDir: isDir,
                body: fileContent
            };
            // 发送消息并等待服务端确认
            await this.wsService.sendWithResponse(data);
            // 收到服务端确认后再打印日志
            log_1.default.formatSuccess(`${isDir ? '同步文件夹：' : '同步文件：'}${relativePath}`);
            return {
                success: true,
                message: `成功同步${isDir ? '文件夹' : '文件'}：${relativePath}`
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            log_1.default.formatError(`同步文件失败：${errorMessage}`);
            return {
                success: false,
                message: `同步失败：${errorMessage}`,
                error: error instanceof Error ? error : new Error(errorMessage)
            };
        }
    }
    // 删除文件
    async deleteFile(baseDir, filePath, isDir = false) {
        try {
            if (!this.wsService.isConnected) {
                throw new Error('WebSocket未连接');
            }
            const relativePath = (0, utils_1.getRelativePath)(baseDir, filePath);
            const data = {
                status: 1003,
                file: relativePath,
                isDir: isDir,
                body: ''
            };
            // 发送消息并等待服务端确认
            await this.wsService.sendWithResponse(data);
            // 收到服务端确认后再打印日志
            log_1.default.formatSuccess(`${isDir ? '删除文件夹：' : '删除文件：'}${relativePath}`);
            return {
                success: true,
                message: `成功删除${isDir ? '文件夹' : '文件'}：${relativePath}`
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            log_1.default.formatError(`删除文件失败：${errorMessage}`);
            return {
                success: false,
                message: `删除失败：${errorMessage}`,
                error: error instanceof Error ? error : new Error(errorMessage)
            };
        }
    }
    // 同步整个项目
    async syncProject(baseDir) {
        if (this.syncState.isSyncing) {
            return {
                success: false,
                message: '项目正在同步中，请稍后再试'
            };
        }
        this.syncState = {
            isSyncing: true,
            totalFiles: 0,
            syncedFiles: 0,
            errors: []
        };
        try {
            const files = await this.scanProjectFiles(baseDir);
            this.syncState.totalFiles = files.length;
            if (files.length === 0) {
                log_1.default.formatWarning('没有找到需要同步的文件');
                return {
                    success: true,
                    message: '没有找到需要同步的文件'
                };
            }
            // 使用进度条显示同步进度
            await (0, progress_1.showFileSyncProgress)(files.length, async (progressCallback) => {
                let currentFile = 0;
                // 同步所有文件
                for (const file of files) {
                    currentFile++;
                    const relativePath = (0, utils_1.getRelativePath)(baseDir, file.path);
                    const fileType = file.isDir ? '文件夹' : '文件';
                    progressCallback(currentFile, `同步${fileType}: ${relativePath}`);
                    try {
                        // 尝试获取文档对象以获取最新内容
                        const document = vscode.workspace.textDocuments.find(doc => doc.fileName === file.path);
                        const result = await this.syncFile(baseDir, file.path, file.isDir, document);
                        if (result.success) {
                            this.syncState.syncedFiles++;
                        }
                        else {
                            this.syncState.errors.push(result.message);
                        }
                        // 添加小延迟，让用户能看到进度变化
                        if (currentFile < files.length) {
                            await new Promise(resolve => setTimeout(resolve, 2));
                        }
                    }
                    catch (error) {
                        const errorMessage = error instanceof Error ? error.message : '未知错误';
                        this.syncState.errors.push(errorMessage);
                    }
                }
                // 初始化项目文件列表
                progressCallback(files.length, '初始化项目文件列表...');
                await this.initProjectFiles(files, baseDir);
            });
            const successMessage = `项目同步完成，共${this.syncState.syncedFiles}/${this.syncState.totalFiles}个文件`;
            if (this.syncState.errors.length > 0) {
                log_1.default.formatWarning(`${successMessage}，${this.syncState.errors.length}个文件同步失败`);
            }
            else {
                log_1.default.formatSuccess(successMessage);
            }
            return {
                success: this.syncState.errors.length === 0,
                message: successMessage
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            log_1.default.formatError(`项目同步失败：${errorMessage}`);
            return {
                success: false,
                message: `项目同步失败：${errorMessage}`,
                error: error instanceof Error ? error : new Error(errorMessage)
            };
        }
        finally {
            this.syncState.isSyncing = false;
        }
    }
    // 扫描项目文件
    async scanProjectFiles(baseDir) {
        const files = [];
        const scanDirectory = (dir) => {
            const items = fs.readdirSync(dir);
            for (const item of items) {
                if (item.startsWith('.')) {
                    continue; // 跳过隐藏文件
                }
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    if (item === 'node_modules') {
                        continue; // 跳过node_modules
                    }
                    files.push({ path: fullPath, isDir: true });
                    scanDirectory(fullPath);
                }
                else {
                    files.push({ path: fullPath, isDir: false });
                }
            }
        };
        scanDirectory(baseDir);
        return files;
    }
    // 初始化项目文件列表
    async initProjectFiles(files, baseDir) {
        try {
            const fileList = files.map(file => [
                file.isDir,
                (0, utils_1.getRelativePath)(baseDir, file.path)
            ]);
            const data = {
                status: 1002,
                body: JSON.stringify(fileList)
            };
            // 发送消息并等待服务端确认
            await this.wsService.sendWithResponse(data);
            log_1.default.info('项目文件列表已发送到APP端');
        }
        catch (error) {
            log_1.default.error(`初始化项目文件列表失败：${error instanceof Error ? error.message : '未知错误'}`);
        }
    }
    // 重置同步状态
    resetSyncState() {
        this.syncState = {
            isSyncing: false,
            totalFiles: 0,
            syncedFiles: 0,
            errors: []
        };
    }
}
exports.FileSyncService = FileSyncService;


/***/ }),
/* 37 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.isValidIPAddress = isValidIPAddress;
exports.debounce = debounce;
exports.getWorkspaceFolder = getWorkspaceFolder;
exports.validateWorkspaceFile = validateWorkspaceFile;
exports.normalizePath = normalizePath;
exports.getRelativePath = getRelativePath;
exports.isDeekeScriptProject = isDeekeScriptProject;
exports.delay = delay;
exports.retry = retry;
const vscode = __importStar(__webpack_require__(1));
// IP地址验证函数
function isValidIPAddress(ip) {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
}
// 防抖函数
function debounce(func, wait) {
    let timeout = null;
    return (...args) => {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => func(...args), wait);
    };
}
// 获取工作区文件夹
function getWorkspaceFolder(uri) {
    return vscode.workspace.getWorkspaceFolder(uri);
}
// 验证文件是否属于工作区
function validateWorkspaceFile(document) {
    const workspaceFolder = getWorkspaceFolder(document.uri);
    if (!workspaceFolder) {
        throw new Error("当前文件不属于任何工作区");
    }
    return workspaceFolder;
}
// 格式化文件路径
function normalizePath(path) {
    return path.replace(/\\/g, '/');
}
// 获取相对路径
function getRelativePath(baseDir, filePath) {
    return normalizePath(filePath.substring(baseDir.length));
}
// 检查是否为DeekeScript项目
async function isDeekeScriptProject(context) {
    const projectPath = context.asAbsolutePath("");
    try {
        await vscode.workspace.fs.stat(vscode.Uri.file(`${projectPath}/deekeScript.json`));
        return true;
    }
    catch {
        return false;
    }
}
// 延迟函数
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// 重试函数
async function retry(fn, maxRetries, baseDelay) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (attempt === maxRetries) {
                throw lastError;
            }
            const delayMs = baseDelay * Math.pow(2, attempt - 1); // 指数退避
            await delay(delayMs);
        }
    }
    throw lastError;
}


/***/ }),
/* 38 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.showProgress = showProgress;
exports.showFileSyncProgress = showFileSyncProgress;
exports.showConnectionProgress = showConnectionProgress;
const vscode = __importStar(__webpack_require__(1));
const log_1 = __importDefault(__webpack_require__(33));
// 简化的进度条工具
async function showProgress(title, task) {
    return vscode.window.withProgress({
        title,
        cancellable: true,
        location: vscode.ProgressLocation.Notification
    }, async (progress, token) => {
        token.onCancellationRequested(() => {
            log_1.default.formatWarning('操作已取消');
        });
        return await task(progress);
    });
}
// 文件同步进度条
async function showFileSyncProgress(totalFiles, syncTask) {
    await showProgress('文件同步中...', async (progress) => {
        let lastReportedFile = 0;
        let lastReportTime = 0;
        let startTime = Date.now();
        // 显示初始进度
        progress.report({
            message: `准备同步 ${totalFiles} 个文件... (0/${totalFiles}, 0%)`,
            increment: 0
        });
        await syncTask((current, message) => {
            const now = Date.now();
            const percentage = Math.round((current / totalFiles) * 100);
            const elapsed = Math.round((now - startTime) / 1000);
            // 确保进度条有最小显示时间，避免一闪而过
            const minDisplayTime = 150; // 最小显示时间150ms
            const timeSinceLastReport = now - lastReportTime;
            if (timeSinceLastReport >= minDisplayTime || current === totalFiles) {
                const increment = current > lastReportedFile ? ((current - lastReportedFile) / totalFiles) * 100 : 0;
                // 计算预估剩余时间
                let timeInfo = '';
                if (current > 0 && elapsed > 0) {
                    const avgTimePerFile = elapsed / current;
                    const remainingFiles = totalFiles - current;
                    const estimatedRemaining = Math.round(avgTimePerFile * remainingFiles);
                    timeInfo = `，已用时: ${elapsed}s，预计剩余: ${estimatedRemaining}s`;
                }
                progress.report({
                    message: `${message} (${current}/${totalFiles}, ${percentage}%)${timeInfo}`,
                    increment: increment
                });
                lastReportedFile = current;
                lastReportTime = now;
            }
        });
    });
}
// 连接进度条
async function showConnectionProgress(connectionTask) {
    await showProgress('正在连接...', async (progress) => {
        progress.report({ message: '正在建立连接...' });
        await connectionTask();
        progress.report({ message: '连接成功！', increment: 100 });
    });
}


/***/ }),
/* 39 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Workspace = void 0;
const log_1 = __importDefault(__webpack_require__(33));
const vscode = __importStar(__webpack_require__(1));
const setting_1 = __importDefault(__webpack_require__(34));
const utils_1 = __webpack_require__(37);
const config_1 = __webpack_require__(4);
class Workspace {
    stop = false;
    client = undefined;
    /** 按文件路径独立防抖，避免多文件编辑时互相覆盖 */
    debouncers = new Map();
    fileWatcher;
    setStop(stop) {
        this.stop = stop;
    }
    setClient(client) {
        this.client = client;
    }
    init(context) {
        this.listening(context);
        log_1.default.info("正在监听工作区文件变化（连接成功后自动同步到手机）");
    }
    /** 已连接且允许自动同步 */
    canSync() {
        if (this.stop) {
            return false;
        }
        if (!setting_1.default.isProject()) {
            return false;
        }
        if (!config_1.configManager.getSyncConfig().autoSync) {
            return false;
        }
        if (!this.client?.state()) {
            return false;
        }
        return true;
    }
    shouldSyncPath(filePath) {
        const normalized = filePath.replace(/\\/g, '/');
        return !config_1.configManager.getSyncConfig().excludePatterns.some((pattern) => normalized.includes(pattern));
    }
    getWorkspaceFolder(uri) {
        return vscode.workspace.getWorkspaceFolder(uri);
    }
    getDebouncedSync(filePath) {
        let fn = this.debouncers.get(filePath);
        if (!fn) {
            fn = (0, utils_1.debounce)((baseDir, path, document) => {
                void this.syncFileToPhone(baseDir, path, false, document);
            }, config_1.configManager.getSyncConfig().debounceDelay);
            this.debouncers.set(filePath, fn);
        }
        return fn;
    }
    scheduleFileSync(baseDir, filePath, document) {
        if (!this.canSync() || !this.shouldSyncPath(filePath)) {
            return;
        }
        this.getDebouncedSync(filePath)(baseDir, filePath, document);
    }
    isDocumentOpen(uri) {
        const target = uri.toString();
        return vscode.workspace.textDocuments.some((doc) => doc.uri.toString() === target);
    }
    async syncFileToPhone(baseDir, filePath, isDir = false, document) {
        if (!this.canSync() || !this.client) {
            return;
        }
        if (!isDir && !this.shouldSyncPath(filePath)) {
            return;
        }
        try {
            const latestDocument = vscode.workspace.textDocuments.find((doc) => doc.fileName === filePath);
            await this.client.fileSync(baseDir, filePath, isDir, latestDocument || document);
        }
        catch (error) {
            log_1.default.error(`自动同步失败：${error instanceof Error ? error.message : '未知错误'}`);
        }
    }
    // 递归同步文件夹内的所有文件
    async syncDirectoryRecursively(baseDir, dirPath) {
        if (!this.canSync() || !this.client) {
            return;
        }
        if (!this.shouldSyncPath(dirPath)) {
            return;
        }
        try {
            await this.client.fileSync(baseDir, dirPath, true);
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));
            for (const entry of entries) {
                const fullPath = dirPath + '/' + entry[0];
                if (!this.shouldSyncPath(fullPath)) {
                    continue;
                }
                const isDir = entry[1] === vscode.FileType.Directory;
                if (isDir) {
                    await this.syncDirectoryRecursively(baseDir, fullPath);
                }
                else {
                    await this.syncFileToPhone(baseDir, fullPath, false);
                }
            }
        }
        catch (error) {
            log_1.default.error(`递归同步文件夹失败：${dirPath} - ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }
    async handleFileUri(uri, isDir) {
        if (uri.scheme !== 'file' || !this.canSync()) {
            return;
        }
        const workspaceFolder = this.getWorkspaceFolder(uri);
        if (!workspaceFolder) {
            return;
        }
        const filePath = uri.fsPath;
        if (isDir) {
            await this.syncDirectoryRecursively(workspaceFolder.uri.fsPath, filePath);
            return;
        }
        const document = vscode.workspace.textDocuments.find((doc) => doc.fileName === filePath);
        await this.syncFileToPhone(workspaceFolder.uri.fsPath, filePath, false, document);
    }
    listening(context) {
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((_e) => {
            config_1.configManager.reloadConfig();
        }));
        context.subscriptions.push(vscode.workspace.onDidChangeNotebookDocument((e) => {
            if (!this.canSync() || !e.notebook.isDirty) {
                return;
            }
            const workspaceFolder = this.getWorkspaceFolder(e.notebook.uri);
            if (!workspaceFolder) {
                return;
            }
            void this.syncFileToPhone(workspaceFolder.uri.fsPath, e.notebook.uri.fsPath, false);
        }));
        // 编辑过程中防抖同步
        context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((e) => {
            if (!this.canSync()) {
                return;
            }
            const workspaceFolder = this.getWorkspaceFolder(e.document.uri);
            if (!workspaceFolder) {
                return;
            }
            this.scheduleFileSync(workspaceFolder.uri.fsPath, e.document.fileName, e.document);
        }));
        // 保存时立即同步最新内容
        context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document) => {
            if (!this.canSync()) {
                return;
            }
            const workspaceFolder = this.getWorkspaceFolder(document.uri);
            if (!workspaceFolder) {
                return;
            }
            void this.syncFileToPhone(workspaceFolder.uri.fsPath, document.fileName, false, document);
        }));
        context.subscriptions.push(vscode.workspace.onDidCreateFiles(async (e) => {
            if (!e.files?.length) {
                return;
            }
            for (const file of e.files) {
                if (!this.canSync()) {
                    continue;
                }
                const workspaceFolder = this.getWorkspaceFolder(file);
                if (!workspaceFolder) {
                    continue;
                }
                log_1.default.info(`文件新增：${(0, utils_1.getRelativePath)(workspaceFolder.uri.fsPath, file.fsPath)}`);
                const stats = await vscode.workspace.fs.stat(file);
                const isDir = stats.type !== vscode.FileType.File;
                await this.handleFileUri(file, isDir);
            }
        }));
        context.subscriptions.push(vscode.workspace.onDidDeleteFiles((e) => {
            if (!e.files?.length || !this.canSync() || !this.client) {
                return;
            }
            for (const file of e.files) {
                if (!this.shouldSyncPath(file.fsPath)) {
                    continue;
                }
                const workspaceFolder = this.getWorkspaceFolder(file);
                if (!workspaceFolder) {
                    continue;
                }
                log_1.default.info(`文件移除：${(0, utils_1.getRelativePath)(workspaceFolder.uri.fsPath, file.fsPath)}`);
                void this.client.fileDelete(workspaceFolder.uri.fsPath, file.fsPath, false);
            }
        }));
        context.subscriptions.push(vscode.workspace.onDidRenameFiles(async (e) => {
            if (!e.files?.length || !this.canSync() || !this.client) {
                return;
            }
            for (const file of e.files) {
                const workspaceFolder = this.getWorkspaceFolder(file.newUri);
                if (!workspaceFolder) {
                    continue;
                }
                log_1.default.info(`文件重命名：${file.oldUri.fsPath} → ${file.newUri.fsPath}`);
                const stats = await vscode.workspace.fs.stat(file.newUri);
                const isDir = stats.type !== vscode.FileType.File;
                await this.client.fileDelete(workspaceFolder.uri.fsPath, file.oldUri.fsPath, isDir);
                await this.handleFileUri(file.newUri, isDir);
            }
        }));
        // 磁盘修改（Git 切换、外部工具写入）；已在编辑器中打开的文件由 onDidChangeTextDocument 处理
        this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');
        this.fileWatcher.onDidChange((uri) => {
            if (!this.canSync() || this.isDocumentOpen(uri)) {
                return;
            }
            const workspaceFolder = this.getWorkspaceFolder(uri);
            if (!workspaceFolder) {
                return;
            }
            this.scheduleFileSync(workspaceFolder.uri.fsPath, uri.fsPath);
        });
        context.subscriptions.push(this.fileWatcher);
    }
}
exports.Workspace = Workspace;


/***/ }),
/* 40 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.activateLanguageFeatures = activateLanguageFeatures;
const vscode = __importStar(__webpack_require__(1));
const workspaceSetup_1 = __webpack_require__(41);
const utils_1 = __webpack_require__(45);
const requireCompletion_1 = __webpack_require__(46);
async function applyDeekeScriptEditorSettings() {
    const config = vscode.workspace.getConfiguration();
    const jsKey = '[javascript]';
    const currentOverride = config.get(jsKey) || {};
    if (currentOverride['editor.wordBasedSuggestions'] !== 'off') {
        const merged = {
            ...currentOverride,
            'editor.wordBasedSuggestions': 'off',
        };
        await config.update(jsKey, merged, vscode.ConfigurationTarget.Workspace);
    }
}
async function setupDeekeScriptLanguageSupport() {
    if (!await (0, utils_1.hasAnyDeekeScriptProject)()) {
        return;
    }
    await applyDeekeScriptEditorSettings();
    await (0, workspaceSetup_1.setupWorkspaceTypeChecking)();
}
function activateLanguageFeatures(context) {
    (0, requireCompletion_1.registerRequirePathCompletion)(context);
    void setupDeekeScriptLanguageSupport();
    context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => {
        (0, utils_1.clearDeekeScriptProjectCache)();
        void setupDeekeScriptLanguageSupport();
    }));
    const deekeJsonWatcher = vscode.workspace.createFileSystemWatcher('**/deekeScript.json');
    deekeJsonWatcher.onDidCreate(() => {
        (0, utils_1.clearDeekeScriptProjectCache)();
        void setupDeekeScriptLanguageSupport();
    });
    deekeJsonWatcher.onDidDelete(() => (0, utils_1.clearDeekeScriptProjectCache)());
    context.subscriptions.push(deekeJsonWatcher);
}


/***/ }),
/* 41 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.setupWorkspaceTypeChecking = setupWorkspaceTypeChecking;
const vscode = __importStar(__webpack_require__(1));
const dtsGenerator_1 = __webpack_require__(42);
const utils_1 = __webpack_require__(45);
const PRO_DTS_FILE = 'deekeScriptPro.d.ts';
const PRO_DTS_INCLUDE = '.vscode/deekeScriptPro.d.ts';
/** Ensure jsconfig.json exists at workspace root with checkJs enabled. */
async function ensureJsConfig(workspaceFolder) {
    const jsconfigUri = vscode.Uri.parse(workspaceFolder.toString() + '/jsconfig.json');
    let existing = {};
    try {
        const raw = await vscode.workspace.fs.readFile(jsconfigUri);
        existing = JSON.parse(Buffer.from(raw).toString('utf-8'));
    }
    catch {
        // File doesn't exist — we'll create it
    }
    if (!existing.compilerOptions)
        existing.compilerOptions = {};
    if (existing.compilerOptions.checkJs !== true) {
        existing.compilerOptions.checkJs = true;
    }
    if (!existing.compilerOptions.target) {
        existing.compilerOptions.target = 'ES2022';
    }
    // DeekeScript require('app/a.js') 相对项目根（非 Node node_modules）。
    // baseUrl 让语言服务把非 ./ ../ 的路径解析到工程根，从而有跳转与补全。
    existing.compilerOptions.baseUrl = '.';
    if (!existing.compilerOptions.module) {
        existing.compilerOptions.module = 'commonjs';
    }
    // Remove @types/node — DeekeScript runs on Android Rhino, not Node.js.
    // @types/node (>=22) ships web-globals shims (Storage, WebSocket, etc.)
    // whose constructor-type declarations conflict with DeekeScript globals.
    if (existing.compilerOptions.types) {
        const filtered = existing.compilerOptions.types.filter((t) => t !== 'node');
        if (filtered.length === 0) {
            delete existing.compilerOptions.types;
        }
        else {
            existing.compilerOptions.types = filtered;
        }
    }
    // Remove @deekeScript references — the generated deekeScript.d.ts already
    // consolidates all DeekeScript type declarations. Including the source .d.ts
    // files is redundant and can cause name-mismatch conflicts (e.g. Storage.d.ts
    // declares `var Storage: storage` while deekeScript.d.ts declares `var Storage: Storage`).
    if (existing.include) {
        existing.include = existing.include.filter((p) => !p.includes('@deekeScript'));
    }
    // Ensure lib excludes "dom" — browser DOM types declare their own Storage
    // constructor, which would conflict with the DeekeScript Storage global.
    if (!existing.compilerOptions.lib) {
        existing.compilerOptions.lib = ['es2022'];
    }
    else if (existing.compilerOptions.lib.includes('dom')) {
        existing.compilerOptions.lib = existing.compilerOptions.lib.filter((l) => l !== 'dom');
    }
    // Include Pro type declarations (do not overwrite standard deekeScript.d.ts)
    if (!existing.include) {
        existing.include = [PRO_DTS_INCLUDE, '**/*.js'];
    }
    else {
        const hasProDts = existing.include.some((p) => p.includes('deekeScriptPro.d.ts'));
        if (!hasProDts) {
            existing.include.push(PRO_DTS_INCLUDE);
        }
    }
    const content = JSON.stringify(existing, null, 4);
    await vscode.workspace.fs.writeFile(jsconfigUri, Buffer.from(content, 'utf-8'));
}
/**
 * Set up workspace-level type checking for a DeekeScript project.
 * Writes deekeScriptPro.d.ts (global API declarations) and jsconfig.json (checkJs enabled).
 * Skips if the workspace is not a DeekeScript project.
 */
async function setupWorkspaceTypeChecking() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0)
        return;
    for (const folder of folders) {
        if (!await (0, utils_1.isDeekeScriptWorkspaceFolder)(folder)) {
            continue;
        }
        // Write type declarations to .vscode/ (hidden IDE config dir, not project source)
        const vscodeDir = vscode.Uri.parse(folder.uri.toString() + '/.vscode');
        const dtsUri = vscode.Uri.parse(vscodeDir.toString() + '/' + PRO_DTS_FILE);
        const dtsContent = (0, dtsGenerator_1.generateDtsContent)();
        try {
            await vscode.workspace.fs.createDirectory(vscodeDir);
        }
        catch {
            // Directory already exists
        }
        await vscode.workspace.fs.writeFile(dtsUri, Buffer.from(dtsContent, 'utf-8'));
        // Clean up legacy type stubs (superseded by deekeScriptPro.d.ts)
        const legacyDtsUri = vscode.Uri.parse(vscodeDir.toString() + '/deekeScript.d.ts');
        try {
            await vscode.workspace.fs.delete(legacyDtsUri);
        }
        catch {
            // Legacy file doesn't exist — fine
        }
        // Clean up old file from workspace root (previously written there)
        const oldDtsUri = vscode.Uri.parse(folder.uri.toString() + '/deekeScript.d.ts');
        try {
            await vscode.workspace.fs.delete(oldDtsUri);
        }
        catch {
            // Old file doesn't exist — fine
        }
        // Ensure jsconfig.json exists with checkJs enabled
        await ensureJsConfig(folder.uri);
    }
}


/***/ }),
/* 42 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.generateDtsContent = generateDtsContent;
const apiData_1 = __webpack_require__(43);
const v2Dts_1 = __webpack_require__(44);
/** Pro 版 API 文档根地址 */
const DOC_BASE = 'https://script.deeke.cn';
const DOC_LINK_LABEL = 'DeekeScript Pro 文档';
/** 文档不在 /base/{slug}/{slug}.html 下的 API（路径以 script.deeke.cn 为准） */
const DOC_URL_OVERRIDES = {
    Access: `${DOC_BASE}/access/access.html`,
    Console: `${DOC_BASE}/base/console/console.html`,
    console: `${DOC_BASE}/base/console/console.html`,
    Cos: `${DOC_BASE}/base/cos/cos.html`,
    DeekeScript: `${DOC_BASE}/base/deekeScript/deekeScript.html`,
    DeviceApp: `${DOC_BASE}/do/deviceApp.html`,
    DeviceHardware: `${DOC_BASE}/do/deviceHardware.html`,
    DeviceKiosk: `${DOC_BASE}/do/deviceKiosk.html`,
    DevicePolicy: `${DOC_BASE}/do/devicePolicy.html`,
    Dialogs: `${DOC_BASE}/advance/dialogs.html`,
    Encrypt: `${DOC_BASE}/advance/encryption.html`,
    Engines: `${DOC_BASE}/advance/engines/engines.html`,
    FloatDialogs: `${DOC_BASE}/advance/dialogs.html`,
    FloatWindow: `${DOC_BASE}/v2/floatWindow.html`,
    ForegroundServiceBridge: `${DOC_BASE}/advance/foreground.html`,
    Hid: `${DOC_BASE}/hid/method.html`,
    Images: `${DOC_BASE}/advance/photoAndColor.html`,
    JavaImporter: `${DOC_BASE}/advance/extension/extension.html`,
    KeyBoards: `${DOC_BASE}/inputMethod/method.html`,
    NotificationBridge: `${DOC_BASE}/advance/notification.html`,
    SocketIoClient: `${DOC_BASE}/base/socket/client.html`,
    socketIoClient: `${DOC_BASE}/base/socket/client.html`,
    System: `${DOC_BASE}/base/system/funcs.html`,
    Threads: `${DOC_BASE}/advance/threads.html`,
    setTimeout: `${DOC_BASE}/base/timer/timer.html`,
    setInterval: `${DOC_BASE}/base/timer/timer.html`,
    clearTimeout: `${DOC_BASE}/base/timer/timer.html`,
    clearInterval: `${DOC_BASE}/base/timer/timer.html`,
};
function buildDocUrl(globalName) {
    const override = DOC_URL_OVERRIDES[globalName];
    if (override) {
        return override;
    }
    const slug = globalName.charAt(0).toLowerCase() + globalName.slice(1);
    return `${DOC_BASE}/base/${slug}/${slug}.html`;
}
function buildFloatWindowMethodAnchor(method) {
    if (method.name === 'stopTask') {
        return 'floatwindow-stoptask';
    }
    return `floatwindow-${method.name.toLowerCase()}`;
}
/** VitePress 锚点：## launch(packageName) → #launch-packagename */
function buildMethodAnchor(method) {
    if (method.params.length === 0) {
        return method.name.toLowerCase();
    }
    return `${method.name.toLowerCase()}-${method.params.map(p => p.name.toLowerCase()).join('-')}`;
}
function buildMethodDocUrl(globalName, method) {
    const base = buildDocUrl(globalName);
    if (globalName === 'FloatWindow') {
        return `${base}#${buildFloatWindowMethodAnchor(method)}`;
    }
    if (globalName === 'Engines' && method.name === 'closeAll') {
        return `${base}#closeall`;
    }
    return `${base}#${buildMethodAnchor(method)}`;
}
function buildDtsParamSig(p) {
    let s = p.name;
    if (p.rest)
        s = '...' + s;
    if (p.optional)
        s += '?';
    s += ': ' + p.type;
    return s;
}
function buildDtsMethodSig(m) {
    const params = m.params.map(buildDtsParamSig).join(', ');
    return `${m.name}(${params}): ${m.returns}`;
}
function buildDtsFuncSig(name, params, returns) {
    const fp = params.map(buildDtsParamSig).join(', ');
    return `${name}(${fp}): ${returns}`;
}
/** Parse apiData description text into summary, @param and @returns parts. */
function parseDescription(description) {
    const cleaned = description
        .replace(/\/\*\*[\s\S]*?\*\//g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    const summaryLines = [];
    const paramDocs = new Map();
    let returnDoc;
    for (const line of cleaned.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed)
            continue;
        const paramMatch = trimmed.match(/^@param\s+(\w+)\s+(.+)$/);
        const returnMatch = trimmed.match(/^@returns?\s+(.+)$/);
        if (paramMatch) {
            paramDocs.set(paramMatch[1], paramMatch[2].trim());
        }
        else if (returnMatch) {
            returnDoc = returnMatch[1].trim();
        }
        else if (!trimmed.startsWith('@')) {
            summaryLines.push(trimmed);
        }
    }
    return {
        summary: summaryLines.join('\n'),
        paramDocs,
        returnDoc,
    };
}
function appendJSDocLines(lines, docLines, indent) {
    lines.push(`${indent}/**`);
    for (const docLine of docLines) {
        lines.push(`${indent} * ${docLine}`);
    }
    lines.push(`${indent} */`);
}
function buildJSDocLines(parts) {
    return parts.filter(Boolean);
}
function buildMethodJSDoc(globalName, method) {
    const parsed = parseDescription(method.description);
    const docLines = [];
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
    }
    else if (method.returns === 'void' && parsed.returnDoc) {
        docLines.push(`@returns {void} ${parsed.returnDoc}`);
    }
    docLines.push(`@see {@link ${buildMethodDocUrl(globalName, method)} ${DOC_LINK_LABEL}}`);
    return buildJSDocLines(docLines);
}
function buildPropertyJSDoc(globalName, prop) {
    const docLines = [];
    if (prop.description) {
        docLines.push(...prop.description.split('\n').map(l => l.trim()).filter(Boolean));
    }
    else {
        docLines.push(prop.name);
    }
    docLines.push(`@see {@link ${buildDocUrl(globalName)} ${DOC_LINK_LABEL}}`);
    return buildJSDocLines(docLines);
}
function buildGlobalJSDoc(def, globalName) {
    const docLines = [];
    if (def.description) {
        docLines.push(...def.description.split('\n').map(l => l.trim()).filter(Boolean));
    }
    docLines.push(`@see {@link ${buildDocUrl(globalName)} ${DOC_LINK_LABEL}}`);
    return buildJSDocLines(docLines);
}
function buildFunctionJSDoc(def, name) {
    const parsed = parseDescription(def.description);
    const docLines = [];
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
function buildConstructorJSDoc(def, className) {
    const docLines = [`创建 ${className} 实例`];
    for (const p of def.constructorParams) {
        docLines.push(`@param {${p.type}} ${p.name} ${p.name}`);
    }
    docLines.push(`@see {@link ${buildDocUrl(className)} ${DOC_LINK_LABEL}}`);
    return buildJSDocLines(docLines);
}
function writeMethod(lines, globalName, method, indent) {
    appendJSDocLines(lines, buildMethodJSDoc(globalName, method), indent);
    lines.push(`${indent}${buildDtsMethodSig(method)};`);
}
function writeProperty(lines, globalName, prop, indent) {
    appendJSDocLines(lines, buildPropertyJSDoc(globalName, prop), indent);
    lines.push(`${indent}${prop.name}: ${prop.type};`);
}
/** Generate a .d.ts file content from apiData so VS Code's TypeScript checker knows about DeekeScript globals. */
function generateDtsContent() {
    const lines = [
        '// Auto-generated by DeekeScript Pro extension — DO NOT EDIT',
        '// Enables VS Code JavaScript type checking for DeekeScript Pro projects.',
        '// API documentation: https://script.deeke.cn',
        '',
    ];
    const declared = new Set();
    for (const [name, def] of Object.entries(apiData_1.apiData)) {
        if (declared.has(name))
            continue;
        declared.add(name);
        switch (def.kind) {
            case 'object':
                if (name === 'FloatWindow') {
                    lines.push((0, v2Dts_1.generateFloatWindowTypes)());
                }
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
                }
                else {
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
    lines.push((0, v2Dts_1.generateRequireGlobals)());
    lines.push((0, v2Dts_1.generateTimerGlobals)());
    lines.push((0, v2Dts_1.generateV2DtsContent)());
    return lines.join('\n');
}


/***/ }),
/* 43 */
/***/ ((__unused_webpack_module, exports) => {


// AUTO-GENERATED by scripts/generateApiData.js — DO NOT EDIT
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.apiData = void 0;
exports.apiData = {
    'Access': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'isAccessibilityServiceEnabled',
                description: '是否开启了无障碍权限',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'isFloatWindowsEnabled',
                description: '是否开启了悬浮窗权限',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'isBackgroundAlertEnabled',
                description: '是否开启了后台弹窗权限',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'isMediaProjectionEnable',
                description: '是否开启了截图录屏权限',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'openAccessibilityServiceSetting',
                description: '开启了无障碍权限设置界面',
                params: [],
                returns: 'void',
            },
            {
                name: 'openFloatWindowsSetting',
                description: '开启了悬浮窗权限设置界面',
                params: [],
                returns: 'void',
            },
            {
                name: 'openBackgroundAlertSetting',
                description: '开启了后台弹窗权限设置界面',
                params: [],
                returns: 'void',
            },
            {
                name: 'openMediaProjectionSetting',
                description: '开启了截图录屏权限设置界面',
                params: [],
                returns: 'void',
            },
            {
                name: 'requestNotificationAccess',
                description: '进入通知权限设置界面（用户可以开启通知权限）',
                params: [],
                returns: 'void',
            },
            {
                name: 'hasNotificationAccess',
                description: '是否开启读取通知权限',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'hasMediaReadPermission',
                description: '检查是否有媒体库读取权限（图片、视频）\n@return true 如果有权限',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'requestMediaPermissions',
                description: '申请媒体库权限（统一接口，自动处理各Android版本差异）\n\n权限说明：\n- Android 13+: 请求 READ_MEDIA_IMAGES 和 READ_MEDIA_VIDEO\n- Android 10-12: 请求 READ_EXTERNAL_STORAGE\n- Android 9-: 请求 READ_EXTERNAL_STORAGE 和 WRITE_EXTERNAL_STORAGE\n\n注意：这是异步操作，不会阻塞',
                params: [],
                returns: 'void',
            },
            {
                name: 'openPermissionSettings',
                description: '打开应用权限设置页面',
                params: [],
                returns: 'void',
            },
            {
                name: 'isMediaPermissionPermanentlyDenied',
                description: '检查媒体权限是否被永久拒绝（用户选择了"不再询问"）\n\n如果返回true，说明用户之前拒绝过权限并选择了"不再询问"，\n系统不会再弹出权限对话框，需要引导用户去设置页面手动开启\n\n@return true 如果权限被永久拒绝',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'hasStoragePermission',
                description: '检查是否有文件存储权限（适配Android 8及以上版本）\n\n权限说明：\n- Android 11+: 检查 MANAGE_EXTERNAL_STORAGE 权限（需要用户手动在设置中开启）\n- Android 8-10: 检查 READ_EXTERNAL_STORAGE 和 WRITE_EXTERNAL_STORAGE 权限\n\n@return true 如果有权限',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'requestStoragePermission',
                description: '申请文件存储权限（适配Android 8及以上版本）\n\n权限说明：\n- Android 11+: 引导用户去设置页面手动开启 MANAGE_EXTERNAL_STORAGE 权限\n- Android 8-10: 请求 READ_EXTERNAL_STORAGE 和 WRITE_EXTERNAL_STORAGE 权限\n\n注意：这是异步操作，不会阻塞\n如果用户禁用了权限，需要调用 isStoragePermissionPermanentlyDenied() 检查是否被永久拒绝',
                params: [],
                returns: 'void',
            },
            {
                name: 'isStoragePermissionPermanentlyDenied',
                description: '检查文件存储权限是否被永久拒绝（用户选择了"不再询问"或禁用了权限）\n\n权限说明：\n- Android 11+: 检查 MANAGE_EXTERNAL_STORAGE 权限状态\n- Android 8-10: 检查 READ_EXTERNAL_STORAGE 和 WRITE_EXTERNAL_STORAGE 是否被永久拒绝\n\n如果返回true，说明用户之前拒绝过权限并选择了"不再询问"，\n或者用户禁用了权限，系统不会再弹出权限对话框，需要引导用户去设置页面手动开启\n\n@return true 如果权限被永久拒绝或禁用',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'hasLocationPermission',
                description: '检查是否有位置权限\n\n权限说明：\n- 检查 ACCESS_FINE_LOCATION（精确定位）或 ACCESS_COARSE_LOCATION（粗略定位）权限\n- 如果授予了 ACCESS_FINE_LOCATION，则自动拥有 ACCESS_COARSE_LOCATION 权限\n\n@return true 如果有权限',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'requestLocationPermissions',
                description: '申请位置权限\n\n权限说明：\n- 优先请求 ACCESS_FINE_LOCATION（精确定位）\n- 如果用户拒绝了精确定位，系统可能降级为 ACCESS_COARSE_LOCATION（粗略定位）\n\n注意：这是异步操作，不会阻塞\n如果用户禁用了权限，需要调用 isLocationPermissionPermanentlyDenied() 检查是否被永久拒绝',
                params: [],
                returns: 'void',
            },
            {
                name: 'isLocationPermissionPermanentlyDenied',
                description: '检查位置权限是否被永久拒绝（用户选择了"不再询问"）\n\n如果返回true，说明用户之前拒绝过权限并选择了"不再询问"，\n系统不会再弹出权限对话框，需要引导用户去设置页面手动开启\n\n@return true 如果权限被永久拒绝',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'hasBluetoothConnectionPermission',
                description: '检查是否有蓝牙连接权限（Android 12+ 需要 BLUETOOTH_CONNECT）\nAndroid 12 以下始终返回 true',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'requestBluetoothConnectionPermission',
                description: '申请蓝牙连接权限（BLUETOOTH_CONNECT + BLUETOOTH_SCAN）\nAndroid 12 以下无需申请\n注意：这是异步操作',
                params: [],
                returns: 'void',
            },
            {
                name: 'isBluetoothPermissionPermanentlyDenied',
                description: '检查蓝牙权限是否被永久拒绝（用户选择了"不再询问"）\n\n如果返回true，需要引导用户去设置页面手动开启',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'openBluetoothPermissionSettings',
                description: '打开蓝牙权限设置页面（跳转到应用详情设置页）',
                params: [],
                returns: 'void',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
    },
    'App': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'currentPackageName',
                description: '获取当前包名',
                params: [],
                returns: 'string',
            },
            {
                name: 'currentVersionCode',
                description: '获取当前版本号',
                params: [],
                returns: 'number',
            },
            {
                name: 'currentVersionName',
                description: '获取当前版本名称',
                params: [],
                returns: 'string',
            },
            {
                name: 'packageInfo',
                description: '获取包信息\n@param packageName 包名',
                params: [
                    { name: 'packageName', type: 'string' },
                ],
                returns: 'any',
            },
            {
                name: 'gotoIntent',
                description: '调整到某个Activity\n@param uri 跳转的uri',
                params: [
                    { name: 'uri', type: 'string' },
                ],
                returns: 'void',
            },
            {
                name: 'startActivity',
                description: '启动Activity\n@param intent Intent对象',
                params: [
                    { name: 'intent', type: 'Intent' },
                ],
                returns: 'void',
            },
            {
                name: 'backApp',
                description: '返回到App',
                params: [],
                returns: 'void',
            },
            {
                name: 'startService',
                description: '启动服务\n@param service Intent对象',
                params: [
                    { name: 'service', type: 'Intent' },
                ],
                returns: 'any',
            },
            {
                name: 'sendBroadcast',
                description: '发送广播\n@param intent Intent对象',
                params: [
                    { name: 'intent', type: 'Intent' },
                ],
                returns: 'void',
            },
            {
                name: 'launch',
                description: '通过包名，打开某个App\n@param packageName 包名',
                params: [
                    { name: 'packageName', type: 'string' },
                ],
                returns: 'void',
            },
            {
                name: 'notifySuccess',
                description: '通知\n@param title 标题\n@param content 内容',
                params: [
                    { name: 'title', type: 'string' },
                    { name: 'content', type: 'string' },
                ],
                returns: 'void',
            },
            {
                name: 'getAppVersionName',
                description: '通过包名，获取某个App的版本名称\n@param packageName 包名',
                params: [
                    { name: 'packageName', type: 'string' },
                ],
                returns: 'string',
            },
            {
                name: 'getAppVersionCode',
                description: '通过包名，获取某个App版本号\n@param packageName 包名',
                params: [
                    { name: 'packageName', type: 'string' },
                ],
                returns: 'number',
            },
            {
                name: 'openAppSetting',
                description: '通过包名，进入某个App设置界面\n@param packageName 包名',
                params: [
                    { name: 'packageName', type: 'string' },
                ],
                returns: 'void',
            },
            {
                name: 'isAppInstalled',
                description: '判断应用是否已安装\n@param packageName 包名',
                params: [
                    { name: 'packageName', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'openUrl',
                description: '通过指定应用打开URL，如果应用未安装则使用浏览器打开\n@param url URL地址\n@param packageName 包名（可选，用于指定打开URL的应用）\n/\n        /**\n打开URL地址。如果提供了packageName，则优先使用指定应用打开，如果应用未安装则使用浏览器打开；如果未提供packageName，则直接使用浏览器打开。\n@param url URL地址\n@param packageName 包名（可选，用于指定打开URL的应用）',
                params: [
                    { name: 'url', type: 'string' },
                    { name: 'packageName', type: 'string', optional: true },
                ],
                returns: 'void',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
    },
    'Audio': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'load',
                description: '载入音频资源（不会自动播放）\n@param source 支持 http(s)、file://、content://、绝对路径、project:// 前缀\n@returns 是否载入成功',
                params: [
                    { name: 'source', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'play',
                description: '加载并播放音频\n@param source 音频资源路径\n@returns 是否成功',
                params: [
                    { name: 'source', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'play',
                description: '播放当前已加载的音频\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'pause',
                description: '暂停播放',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'stop',
                description: '停止播放（播放位置重置到开头）',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'release',
                description: '释放播放器资源',
                params: [],
                returns: 'void',
            },
            {
                name: 'seekTo',
                description: '跳转到指定位置\n@param msec 毫秒',
                params: [
                    { name: 'msec', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'setLooping',
                description: '设置是否循环播放\n@param looping 是否循环',
                params: [
                    { name: 'looping', type: 'boolean' },
                ],
                returns: 'boolean',
            },
            {
                name: 'setVolume',
                description: '设置左右声道音量\n@param leftVolume 左声道音量 0.0 ~ 1.0\n@param rightVolume 右声道音量 0.0 ~ 1.0',
                params: [
                    { name: 'leftVolume', type: 'number' },
                    { name: 'rightVolume', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'isPlaying',
                description: '是否正在播放',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'isLoaded',
                description: '是否已加载音频',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'getDuration',
                description: '获取音频总时长（毫秒），未加载返回 -1',
                params: [],
                returns: 'number',
            },
            {
                name: 'getCurrentPosition',
                description: '获取当前播放位置（毫秒），未加载返回 -1',
                params: [],
                returns: 'number',
            },
            {
                name: 'getCurrentSource',
                description: '获取当前加载的音频源路径',
                params: [],
                returns: 'string',
            },
            {
                name: 'canPlayInBackground',
                description: '是否具备后台播放能力（检测前台服务权限）',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'hasForegroundServicePermission',
                description: '是否已声明前台服务权限（Android 9+ 推荐用于后台保活播放）',
                params: [],
                returns: 'boolean',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
    },
    'Console': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'log',
                description: '记录普通日志信息\n@param message 要记录的消息',
                params: [
                    { name: 'message', type: 'any[]', rest: true },
                ],
                returns: 'void',
            },
            {
                name: 'warn',
                description: '记录警告信息\n@param message 要记录的警告消息',
                params: [
                    { name: 'message', type: 'any[]', rest: true },
                ],
                returns: 'void',
            },
            {
                name: 'error',
                description: '记录错误信息\n@param message 要记录的错误消息',
                params: [
                    { name: 'message', type: 'any[]', rest: true },
                ],
                returns: 'void',
            },
            {
                name: 'info',
                description: '记录信息，通常用于调试目的\n@param message 要记录的信息',
                params: [
                    { name: 'message', type: 'any[]', rest: true },
                ],
                returns: 'void',
            },
            {
                name: 'debug',
                description: '记录调试信息\n@param message 要记录的调试信息',
                params: [
                    { name: 'message', type: 'any[]', rest: true },
                ],
                returns: 'void',
            },
            {
                name: 'trace',
                description: '打印堆栈追踪\n@param message 堆栈追踪信息',
                params: [
                    { name: 'message', type: 'any[]', rest: true },
                ],
                returns: 'void',
            },
            {
                name: 'show',
                description: '显示日志窗口',
                params: [],
                returns: 'void',
            },
            {
                name: 'hide',
                description: '隐藏日志窗口',
                params: [],
                returns: 'void',
            },
            {
                name: 'setWindowSize',
                description: '设置日志窗口的大小\n@param width 窗口宽度（像素）\n@param height 窗口高度（像素）',
                params: [
                    { name: 'width', type: 'number' },
                    { name: 'height', type: 'number' },
                ],
                returns: 'void',
            },
            {
                name: 'setWindowPosition',
                description: '设置日志窗口的位置\n@param x 窗口左上角X坐标（像素）\n@param y 窗口左上角Y坐标（像素）',
                params: [
                    { name: 'x', type: 'number' },
                    { name: 'y', type: 'number' },
                ],
                returns: 'void',
            },
            {
                name: 'setBackgroundColor',
                description: '设置日志窗口的背景颜色\n@param color 颜色值（ARGB格式，如 0xFF000000 表示黑色）',
                params: [
                    { name: 'color', type: 'number' },
                ],
                returns: 'void',
            },
            {
                name: 'setTextColor',
                description: '设置日志文本的颜色\n@param color 颜色值（ARGB格式，如 0xFFFFFFFF 表示白色）',
                params: [
                    { name: 'color', type: 'number' },
                ],
                returns: 'void',
            },
            {
                name: 'setTextSize',
                description: '设置日志文本的字体大小\n@param size 字体大小（像素）',
                params: [
                    { name: 'size', type: 'number' },
                ],
                returns: 'void',
            },
            {
                name: 'setLineHeight',
                description: '设置日志文本的行高\n@param lineHeight 行高（像素）',
                params: [
                    { name: 'lineHeight', type: 'number' },
                ],
                returns: 'void',
            },
            {
                name: 'setButtonColors',
                description: '一次性设置两个按钮的颜色（关闭按钮、调整大小按钮）\n@param closeColor 关闭按钮颜色（ARGB格式）\n@param resizeColor 调整大小按钮颜色（ARGB格式）',
                params: [
                    { name: 'closeColor', type: 'number' },
                    { name: 'resizeColor', type: 'number' },
                ],
                returns: 'void',
            },
            {
                name: 'setTitleTextColor',
                description: '设置标题栏文字的颜色\n@param color 颜色值（ARGB格式，如 0xFFFFFFFF 表示白色）',
                params: [
                    { name: 'color', type: 'number' },
                ],
                returns: 'void',
            },
            {
                name: 'setTitleTextSize',
                description: '设置标题栏文字的字体大小\n@param size 字体大小（sp）',
                params: [
                    { name: 'size', type: 'number' },
                ],
                returns: 'void',
            },
            {
                name: 'setTitleText',
                description: '设置标题栏的文字内容\n@param text 标题文字内容。如果传入 null 或空字符串，将使用应用名称作为默认标题',
                params: [
                    { name: 'text', type: 'string | null' },
                ],
                returns: 'void',
            },
            {
                name: 'setTitleBarColor',
                description: '设置标题栏的背景颜色\n@param color 颜色值（ARGB格式，-1表示自动计算，比背景色深20%）',
                params: [
                    { name: 'color', type: 'number' },
                ],
                returns: 'void',
            },
            {
                name: 'setAllowMoveToTop',
                description: '设置是否允许窗口移动到顶部\n@param allow 是否允许移动到顶部',
                params: [
                    { name: 'allow', type: 'boolean' },
                ],
                returns: 'void',
            },
            {
                name: 'setAllowMoveToBottom',
                description: '设置是否允许窗口移动到底部\n@param allow 是否允许移动到底部',
                params: [
                    { name: 'allow', type: 'boolean' },
                ],
                returns: 'void',
            },
            {
                name: 'setClickable',
                description: '设置日志窗口是否可点击（穿透）\n@param clickable 是否可点击',
                params: [
                    { name: 'clickable', type: 'boolean' },
                ],
                returns: 'void',
            },
            {
                name: 'isClickable',
                description: '检查日志窗口是否可点击\n@returns 是否可点击',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'clearLogs',
                description: '清空日志窗口中的所有日志',
                params: [],
                returns: 'void',
            },
            {
                name: 'setMaxLogLines',
                description: '设置日志窗口显示的最大行数。超过此数量的旧日志会被自动删除。\n@param maxLines 最大行数',
                params: [
                    { name: 'maxLines', type: 'number' },
                ],
                returns: 'void',
            },
            {
                name: 'getMaxLogLines',
                description: '获取日志窗口显示的最大行数\n@returns 最大行数',
                params: [],
                returns: 'number',
            },
            {
                name: 'setAutoScroll',
                description: '设置是否自动滚动到底部（当有新日志时）\n@param autoScroll 是否自动滚动',
                params: [
                    { name: 'autoScroll', type: 'boolean' },
                ],
                returns: 'void',
            },
            {
                name: 'setWindowStyle',
                description: '一次性设置日志窗口的多个样式属性\n@param config 配置对象',
                params: [
                    { name: 'config', type: '{\n        width?: number;\n        height?: number;\n        x?: number;\n        y?: number;\n        backgroundColor?: number;\n        textColor?: number;\n        textSize?: number;\n        lineHeight?: number;\n        closeButtonColor?: number;\n        resizeButtonColor?: number;\n        titleTextColor?: number;\n        titleTextSize?: number;\n        titleText?: string | null;\n        titleBarColor?: number;\n        allowMoveToTop?: boolean;\n        allowMoveToBottom?: boolean;\n        clickable?: boolean;\n    }' },
                ],
                returns: 'void',
            },
            {
                name: 'getWindowStyle',
                description: '获取当前日志窗口的样式配置\n@returns 包含所有样式配置的对象',
                params: [],
                returns: '{\n        width: number;\n        height: number;\n        x: number;\n        y: number;\n        backgroundColor: number;\n        textColor: number;\n        textSize: number;\n        lineHeight: number;\n        closeButtonColor: number;\n        resizeButtonColor: number;\n        titleTextColor: number;\n        titleTextSize: number;\n        titleText: string;\n        titleBarColor: number;\n        allowMoveToTop: boolean;\n        allowMoveToBottom: boolean;\n        clickable: boolean;\n    }',
            },
        ],
        properties: [
            { name: 'width', type: 'number', description: '' },
            { name: 'height', type: 'number', description: '' },
            { name: 'x', type: 'number', description: '' },
            { name: 'y', type: 'number', description: '' },
            { name: 'backgroundColor', type: 'number', description: '' },
            { name: 'textColor', type: 'number', description: '' },
            { name: 'textSize', type: 'number', description: '' },
            { name: 'lineHeight', type: 'number', description: '' },
            { name: 'closeButtonColor', type: 'number', description: '' },
            { name: 'resizeButtonColor', type: 'number', description: '' },
            { name: 'titleTextColor', type: 'number', description: '' },
            { name: 'titleTextSize', type: 'number', description: '' },
            { name: 'titleText', type: 'string', description: '' },
            { name: 'titleBarColor', type: 'number', description: '' },
            { name: 'allowMoveToTop', type: 'boolean', description: '' },
            { name: 'allowMoveToBottom', type: 'boolean', description: '' },
            { name: 'clickable', type: 'boolean', description: '' },
        ],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
        typeOnly: true,
    },
    'DeekeBounds': {
        kind: 'object',
        description: '',
        methods: [],
        properties: [
            { name: 'left', type: 'number', description: '' },
            { name: 'top', type: 'number', description: '' },
            { name: 'width', type: 'number', description: '' },
            { name: 'height', type: 'number', description: '' },
        ],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
        typeOnly: true,
    },
    'DeekeNodeInfo': {
        kind: 'object',
        description: '',
        methods: [],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
        typeOnly: true,
    },
    'DeekeScript': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'version',
                description: 'DeekeScript 版本号',
                params: [],
                returns: 'number',
            },
            {
                name: 'readFile',
                description: '读取 JS 项目目录下的文件内容\n@param path 相对于项目根目录的文件路径\n@returns 文件内容字符串，失败返回 null',
                params: [
                    { name: 'path', type: 'string' },
                ],
                returns: 'string | null',
            },
            {
                name: 'getProjectRoot',
                description: '获取当前 JS 项目的根目录绝对路径\n@returns 项目根目录路径',
                params: [],
                returns: 'string',
            },
            {
                name: 'getNodeFields',
                description: '获取可设置的节点字段名列表\n@returns 字段名字符串数组，用于 getAllAccessibilityNodeInfo 的 fields 参数',
                params: [],
                returns: 'string[]',
            },
            {
                name: 'getAllAccessibilityNodeInfo',
                description: '一次性获取当前界面所有控件的节点信息\n@param bool true 为复杂模式（包含所有字段），false 为简单模式\n@param fields 需要返回的字段名数组，可通过 getNodeFields() 获取完整字段列表\n@returns { nodes: DeekeNodeInfo[] } 或 null（无障碍服务未启用时）',
                params: [
                    { name: 'bool', type: 'boolean' },
                    { name: 'fields', type: 'string[]' },
                ],
                returns: '{ nodes: DeekeNodeInfo[] } | null',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
    },
    'DeekeScriptJson': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'setDeekeScriptJsonGroup',
                description: '',
                params: [
                    { name: 'str', type: 'string' },
                ],
                returns: 'void',
            },
            {
                name: 'setSettingLists',
                description: '',
                params: [
                    { name: 'str', type: 'string' },
                ],
                returns: 'void',
            },
            {
                name: 'toJson',
                description: '',
                params: [],
                returns: 'object',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
    },
    'Device': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'width',
                description: '获取屏幕宽度',
                params: [],
                returns: 'number',
            },
            {
                name: 'height',
                description: '获取屏幕高度',
                params: [],
                returns: 'number',
            },
            {
                name: 'pixelDensity',
                description: '获取屏幕像素密度（density）\n\n可用于 dp 与 px 的换算：px = dp * density',
                params: [],
                returns: 'number',
            },
            {
                name: 'sdkInt',
                description: '获取设备版本，如 26',
                params: [],
                returns: 'number',
            },
            {
                name: 'device',
                description: '获取设备',
                params: [],
                returns: 'string',
            },
            {
                name: 'androidVersion',
                description: '获取设备版本，如 "8.1.0"',
                params: [],
                returns: 'string',
            },
            {
                name: 'getUuid',
                description: '获取设备唯一标识符\n\n返回系统级别的 ANDROID_ID，在设备恢复出厂设置之前会保持不变，保证设备唯一性。\n注意：设备恢复出厂设置后，ANDROID_ID 可能会改变。App卸载不会影响此标识符。',
                params: [],
                returns: 'string',
            },
            {
                name: 'getToken',
                description: '获取设备卡密',
                params: [],
                returns: 'string',
            },
            {
                name: 'getAttr',
                description: '获取设备其他信息（此方法可以取代getToken和getUuid）',
                params: [
                    { name: 'key', type: 'string' },
                ],
                returns: 'string',
            },
            {
                name: 'brand',
                description: '获取设备品牌， 如 "HUAWEI" 或 "Xiaomi"',
                params: [],
                returns: 'string',
            },
            {
                name: 'os',
                description: '获取设备操作系统名称， 如 "Android"',
                params: [],
                returns: 'string',
            },
            {
                name: 'model',
                description: '获取设备型号名称， 如 "Honor V30" 或类似的字符串',
                params: [],
                returns: 'string',
            },
            {
                name: 'codename',
                description: '获取设备代号， 例如 "REL" 表示正式发布的版本',
                params: [],
                returns: 'string',
            },
            {
                name: 'manufacturer',
                description: '获取设备制造商信息，如 "HUAWEI"、"Xiaomi" 等',
                params: [],
                returns: 'string',
            },
            {
                name: 'hardware',
                description: '获取硬件名称，如 "kirin990" 等',
                params: [],
                returns: 'string',
            },
            {
                name: 'board',
                description: '获取主板型号信息',
                params: [],
                returns: 'string',
            },
            {
                name: 'product',
                description: '获取产品名称信息',
                params: [],
                returns: 'string',
            },
            {
                name: 'bootloader',
                description: '获取 Bootloader 版本信息',
                params: [],
                returns: 'string',
            },
            {
                name: 'buildId',
                description: '获取构建ID信息',
                params: [],
                returns: 'string',
            },
            {
                name: 'display',
                description: '获取显示版本信息',
                params: [],
                returns: 'string',
            },
            {
                name: 'fingerprint',
                description: '获取设备指纹信息',
                params: [],
                returns: 'string',
            },
            {
                name: 'host',
                description: '获取主机名信息',
                params: [],
                returns: 'string',
            },
            {
                name: 'user',
                description: '获取构建用户信息',
                params: [],
                returns: 'string',
            },
            {
                name: 'getCpuAbi',
                description: '获取CPU架构信息，如 "arm64-v8a"、"armeabi-v7a" 等',
                params: [],
                returns: 'string',
            },
            {
                name: 'getCpuAbis',
                description: '获取所有支持的CPU架构列表',
                params: [],
                returns: 'string[]',
            },
            {
                name: 'getWifiIPAddress',
                description: '获取WiFi网络的IP地址（仅WiFi连接时有效）\n@returns WiFi IP地址，如果WiFi未连接返回空字符串',
                params: [],
                returns: 'string',
            },
            {
                name: 'getIPAddress',
                description: '获取当前活动网络的IP地址（支持WiFi和移动网络，返回局域网IP）\n@returns 当前活动网络的IP地址，如果获取失败返回 "127.0.0.1"',
                params: [],
                returns: 'string',
            },
            {
                name: 'getPublicIPAddress',
                description: '获取公网IPv4地址（需要通过HTTP请求外部服务）\n@returns 公网IPv4地址，如果获取失败返回空字符串',
                params: [],
                returns: 'string',
            },
            {
                name: 'getPublicIPAddressV6',
                description: '获取公网IPv6地址（需要通过HTTP请求外部服务）\n@returns 公网IPv6地址，如果获取失败返回空字符串',
                params: [],
                returns: 'string',
            },
            {
                name: 'getPublicIPInfo',
                description: '获取公网IP信息（包含IPv4和IPv6）\n@returns 包含 ipv4 和 ipv6 的对象',
                params: [],
                returns: '{\n        ipv4: string;\n        ipv6: string;\n    }',
            },
            {
                name: 'getIpInfo',
                description: '获取完整的IP信息（包括当前IP、WiFi IP、公网IP等）\n@returns 包含所有IP信息的对象',
                params: [],
                returns: '{\n        ip: string;\n        wifiIP: string;\n        publicIP: string;\n        publicIPV6: string;\n        publicIPInfo: {\n            ipv4: string;\n            ipv6: string;\n        };\n    }',
            },
            {
                name: 'getMacAddress',
                description: '获取MAC地址（需要WiFi已连接）\n@returns MAC地址，如果WiFi未连接返回空字符串',
                params: [],
                returns: 'string',
            },
            {
                name: 'getNetworkType',
                description: '获取网络类型\n@returns 网络类型："WiFi" | "Mobile" | "Ethernet" | "Other" | "None"',
                params: [],
                returns: '"WiFi" | "Mobile" | "Ethernet" | "Other" | "None"',
            },
            {
                name: 'isNetworkConnected',
                description: '检查网络是否已连接\n@returns 网络是否已连接',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'getNetworkInfo',
                description: '获取完整的网络信息\n@returns 包含网络类型、连接状态、MAC地址、IP地址等的对象',
                params: [],
                returns: '{\n        type: "WiFi" | "Mobile" | "Ethernet" | "Other" | "None";\n        connected: boolean;\n        macAddress: string;\n        ip: string;\n        wifiIP: string;\n        publicIP: string;\n        publicIPV6: string;\n    }',
            },
            {
                name: 'getLocation',
                description: '获取设备当前位置信息\n\n需要先申请位置权限（使用Access.requestLocationPermissions()）。\n此方法会优先使用GPS定位（更精确），如果GPS不可用，会尝试使用网络定位。\n如果仍然无法获取位置，会尝试使用被动定位提供者。\n\n@returns 位置信息对象，包含纬度、经度、海拔、精度、速度、方向角、时间戳和定位提供者。\n         如果获取失败或没有权限，返回 null',
                params: [],
                returns: '{\n        latitude: number;\n        longitude: number;\n        altitude: number;\n        accuracy: number;\n        speed: number;\n        bearing: number;\n        time: number;\n        provider: string;\n    } | null',
            },
            {
                name: 'getStatusBarHeight',
                description: '获取状态栏高度（像素）\n\n状态栏是屏幕顶部显示时间、电池、信号等信息的区域。\n如果获取失败返回0。\n\n@returns 状态栏高度（像素）',
                params: [],
                returns: 'number',
            },
            {
                name: 'getNavigationBarHeight',
                description: '获取底部虚拟按钮（导航栏）高度（像素）\n\n导航栏是屏幕底部显示返回、主页、最近任务等虚拟按钮的区域。\n如果导航栏隐藏了或获取失败返回0。\n\n@returns 导航栏高度（像素），如果隐藏或获取失败返回0',
                params: [],
                returns: 'number',
            },
            {
                name: 'getInstalledPackages',
                description: '获取所有已安装应用的包名列表\n@returns 应用包名数组',
                params: [],
                returns: 'string[]',
            },
            {
                name: 'getInstalledApplications',
                description: '获取所有已安装应用的详细信息列表\n@returns 应用信息数组，每个元素包含应用信息对象（packageName, appName, versionName, versionCode等）',
                params: [],
                returns: 'Array<{\n        packageName: string;\n        appName: string;\n        versionName: string;\n        versionCode: number;\n    }>',
            },
        ],
        properties: [
            { name: 'ipv4', type: 'string', description: '' },
            { name: 'ipv6', type: 'string', description: '' },
            { name: 'ip', type: 'string', description: '' },
            { name: 'wifiIP', type: 'string', description: '' },
            { name: 'publicIP', type: 'string', description: '' },
            { name: 'publicIPV6', type: 'string', description: '' },
            { name: 'ipv4', type: 'string', description: '' },
            { name: 'ipv6', type: 'string', description: '' },
            { name: 'type', type: '"WiFi" | "Mobile" | "Ethernet" | "Other" | "None"', description: '' },
            { name: 'connected', type: 'boolean', description: '' },
            { name: 'macAddress', type: 'string', description: '' },
            { name: 'ip', type: 'string', description: '' },
            { name: 'wifiIP', type: 'string', description: '' },
            { name: 'publicIP', type: 'string', description: '' },
            { name: 'publicIPV6', type: 'string', description: '' },
            { name: 'latitude', type: 'number', description: '' },
            { name: 'longitude', type: 'number', description: '' },
            { name: 'altitude', type: 'number', description: '' },
            { name: 'accuracy', type: 'number', description: '' },
            { name: 'speed', type: 'number', description: '' },
            { name: 'bearing', type: 'number', description: '' },
            { name: 'time', type: 'number', description: '' },
            { name: 'provider', type: 'string', description: '' },
            { name: 'packageName', type: 'string', description: '' },
            { name: 'appName', type: 'string', description: '' },
            { name: 'versionName', type: 'string', description: '' },
            { name: 'versionCode', type: 'number', description: '' },
        ],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
    },
    'DeviceApp': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'installPackage',
                description: '权限策略常量 - 提示用户\n/\n    PERMISSION_POLICY_PROMPT: number;\n\n    /**\n权限策略常量 - 自动授予\n/\n    PERMISSION_POLICY_AUTO_GRANT: number;\n\n    /**\n权限策略常量 - 自动拒绝\n/\n    PERMISSION_POLICY_AUTO_DENY: number;\n\n    /**\n权限授予状态常量 - 默认状态\n/\n    PERMISSION_GRANT_STATE_DEFAULT: number;\n\n    /**\n权限授予状态常量 - 已拒绝\n/\n    PERMISSION_GRANT_STATE_DENIED: number;\n\n    /**\n权限授予状态常量 - 已授予\n/\n    PERMISSION_GRANT_STATE_GRANTED: number;\n\n    /**\n静默安装应用\n需要Device Owner权限\n@param packageUri 应用安装包URI（文件路径），例如 "file:///sdcard/app.apk" 或 "/sdcard/app.apk"\n@returns 是否成功，true表示成功，false表示失败',
                params: [
                    { name: 'packageUri', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'uninstallPackage',
                description: '静默卸载应用\n需要Device Owner权限\n@param packageName 应用包名，例如 "com.example.app"\n@returns 是否成功，true表示成功，false表示失败',
                params: [
                    { name: 'packageName', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'setApplicationHidden',
                description: '隐藏/显示应用\n隐藏的应用将从启动器中移除，但不会卸载\n需要Device Owner权限\n@param packageName 应用包名，例如 "com.example.app"\n@param hidden true表示隐藏，false表示显示\n@returns 是否成功，true表示成功，false表示失败',
                params: [
                    { name: 'packageName', type: 'string' },
                    { name: 'hidden', type: 'boolean' },
                ],
                returns: 'boolean',
            },
            {
                name: 'isApplicationHidden',
                description: '检查应用是否隐藏\n需要Device Owner权限\n@param packageName 应用包名，例如 "com.example.app"\n@returns true表示应用已隐藏，false表示应用未隐藏或查询失败',
                params: [
                    { name: 'packageName', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'setPermissionPolicy',
                description: '设置应用权限策略\n需要Device Owner权限\n@param policy 权限策略，使用常量：PERMISSION_POLICY_PROMPT (0) - 提示用户，PERMISSION_POLICY_AUTO_GRANT (1) - 自动授予，PERMISSION_POLICY_AUTO_DENY (2) - 自动拒绝\n@returns 是否成功，true表示成功，false表示失败',
                params: [
                    { name: 'policy', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'grantRuntimePermission',
                description: '授予运行时权限\n需要Device Owner权限\n@param packageName 应用包名，例如 "com.example.app"\n@param permission 权限名称，例如 "android.permission.CAMERA"\n@returns 是否成功，true表示成功，false表示失败',
                params: [
                    { name: 'packageName', type: 'string' },
                    { name: 'permission', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'isPermissionGranted',
                description: '检查权限是否已授予\n需要Device Owner权限\n@param packageName 应用包名，例如 "com.example.app"\n@param permission 权限名称，例如 "android.permission.CAMERA"\n@returns true表示权限已授予，false表示权限未授予或查询失败',
                params: [
                    { name: 'packageName', type: 'string' },
                    { name: 'permission', type: 'string' },
                ],
                returns: 'boolean',
            },
        ],
        properties: [
            { name: 'PERMISSION_POLICY_PROMPT', type: 'number', description: '权限策略常量 - 提示用户' },
            { name: 'PERMISSION_POLICY_AUTO_GRANT', type: 'number', description: '权限策略常量 - 自动授予' },
            { name: 'PERMISSION_POLICY_AUTO_DENY', type: 'number', description: '权限策略常量 - 自动拒绝' },
            { name: 'PERMISSION_GRANT_STATE_DEFAULT', type: 'number', description: '权限授予状态常量 - 默认状态' },
            { name: 'PERMISSION_GRANT_STATE_DENIED', type: 'number', description: '权限授予状态常量 - 已拒绝' },
            { name: 'PERMISSION_GRANT_STATE_GRANTED', type: 'number', description: '权限授予状态常量 - 已授予' },
        ],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
    },
    'DeviceHardware': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'setScreenCaptureDisabled',
                description: '禁用/启用截屏功能\n禁用后，用户无法通过系统快捷键截屏\n需要Device Owner权限\nAPI级别要求：API 28 (Android 9.0) 及以上\n@param disabled true表示禁用截屏，false表示启用截屏\n@returns 是否成功，true表示成功，false表示失败',
                params: [
                    { name: 'disabled', type: 'boolean' },
                ],
                returns: 'boolean',
            },
            {
                name: 'setKeyguardDisabled',
                description: '禁用/启用锁屏界面\n禁用后，设备将不会显示锁屏界面（但可能仍需要解锁）\n需要Device Owner或Profile Owner权限\n@param disabled true表示禁用锁屏界面，false表示启用锁屏界面\n@returns 是否成功，true表示成功，false表示失败',
                params: [
                    { name: 'disabled', type: 'boolean' },
                ],
                returns: 'boolean',
            },
            {
                name: 'setStatusBarDisabled',
                description: '禁用/启用状态栏\n禁用后，状态栏将被隐藏\n需要Device Owner权限\nAPI级别要求：API 26 (Android 8.0) 及以上\n@param disabled true表示禁用状态栏，false表示启用状态栏\n@returns 是否成功，true表示成功，false表示失败',
                params: [
                    { name: 'disabled', type: 'boolean' },
                ],
                returns: 'boolean',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
    },
    'DeviceKiosk': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'setLockTaskPackages',
                description: '设置锁定任务模式的应用包名列表\n需要Device Owner权限\n设置后，这些应用可以进入锁定任务模式（Kiosk模式）\n@param packages 应用包名数组\n@returns 是否成功，true表示成功，false表示失败',
                params: [
                    { name: 'packages', type: 'string[]' },
                ],
                returns: 'boolean',
            },
            {
                name: 'getLockTaskPackages',
                description: '获取锁定任务模式的应用包名列表\n需要Device Owner权限\n@returns 应用包名数组，如果失败返回null',
                params: [],
                returns: 'string[] | null',
            },
            {
                name: 'isLockTaskModeEnabled',
                description: '检查锁定任务模式是否启用\n注意：此方法检查的是是否配置了锁定任务应用，而不是当前是否处于锁定任务模式\n@returns true表示已配置锁定任务应用，false表示未配置',
                params: [],
                returns: 'boolean',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
    },
    'DevicePolicy': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'isDeviceOwner',
                description: '检查当前应用是否为Device Owner\n@returns true表示是Device Owner，false表示不是',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'lockNow',
                description: '立即锁屏/息屏\n需要Device Owner权限\n@returns 是否成功，true表示成功，false表示失败',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'wakeScreen',
                description: '亮屏/唤醒屏幕\n需要WAKE_LOCK权限（在AndroidManifest.xml中声明）\n@returns 是否成功，true表示成功，false表示失败',
                params: [],
                returns: 'boolean',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
    },
    'Dialogs': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'show',
                description: '弹窗（App内运行）\n@param title 标题\n@param content 内容',
                params: [
                    { name: 'title', type: 'string' },
                    { name: 'content', type: 'string' },
                ],
                returns: 'void',
            },
            {
                name: 'show',
                description: '弹窗（App内运行）\n@param title 标题',
                params: [
                    { name: 'title', type: 'string' },
                ],
                returns: 'void',
            },
            {
                name: 'confirm',
                description: '确认弹窗（App内运行）\n@param title 标题\n@param content 内容',
                params: [
                    { name: 'title', type: 'string' },
                    { name: 'content', type: 'string' },
                    { name: 'callback', type: '(result: boolean) => void' },
                ],
                returns: 'void',
            },
            {
                name: 'input',
                description: '输入弹窗（App内运行）\n@param title 标题\n@param content 内容',
                params: [
                    { name: 'title', type: 'string' },
                ],
                returns: 'string',
            },
            {
                name: 'input',
                description: '输入弹窗（App内运行）\n@param title 标题\n@param value 默认值',
                params: [
                    { name: 'title', type: 'string' },
                    { name: 'value', type: 'object' },
                ],
                returns: 'string',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
    },
    'Encrypt': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'md5',
                description: 'md5加密\n@param input',
                params: [
                    { name: 'input', type: 'string' },
                ],
                returns: 'string',
            },
            {
                name: 'sha1',
                description: 'sha1加密\n@param input',
                params: [
                    { name: 'input', type: 'string' },
                ],
                returns: 'string',
            },
            {
                name: 'sha256',
                description: 'sha256加密\n@param input',
                params: [
                    { name: 'input', type: 'string' },
                ],
                returns: 'string',
            },
            {
                name: 'base64Encode',
                description: 'base64 encode\n@param input',
                params: [
                    { name: 'input', type: 'string|byte[]' },
                ],
                returns: 'string',
            },
            {
                name: 'base64Decode',
                description: 'base64 decode\n@param input',
                params: [
                    { name: 'input', type: 'string' },
                ],
                returns: 'string',
            },
            {
                name: 'generateIv',
                description: '生成iv',
                params: [],
                returns: 'string',
            },
            {
                name: 'aesCbcEncode',
                description: 'aescbc加密\n@param key \n@param iv \n@param input',
                params: [
                    { name: 'key', type: 'string' },
                    { name: 'iv', type: 'string' },
                    { name: 'input', type: 'string' },
                ],
                returns: 'string',
            },
            {
                name: 'aesCbcDecode',
                description: 'aescbc解密\n@param key \n@param iv \n@param input',
                params: [
                    { name: 'key', type: 'string' },
                    { name: 'iv', type: 'string' },
                    { name: 'input', type: 'string' },
                ],
                returns: 'string',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
    },
    'Engines': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'executeScript',
                description: '执行脚本\n@param file 文件路径，相对根目录的路径',
                params: [
                    { name: 'file', type: 'string' },
                ],
                returns: 'void',
            },
            {
                name: 'executeScriptStr',
                description: '执行脚本\n@param content 脚本内容',
                params: [
                    { name: 'name', type: 'string' },
                    { name: 'content', type: 'string' },
                ],
                returns: 'void',
            },
            {
                name: 'closeAll',
                description: '关闭当前任务脚本及其子脚本（须在 tasks/*.js 执行线程内调用）。悬浮窗菜单回调不在该线程，停任务请用 FloatWindow.stopTask()',
                params: [],
                returns: 'void',
            },
            {
                name: 'closeOther',
                description: '关闭当前线程之外的其他线程和子线程（包含定时器、socket、Hid 等）',
                params: [],
                returns: 'void',
            },
            {
                name: 'childScriptCount',
                description: '返回所有子脚本的数量',
                params: [],
                returns: 'number',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
    },
    'Files': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'read',
                description: '读取文件内容\n@param path 文件路径\n@return 文件内容，如果失败返回null',
                params: [
                    { name: 'path', type: 'string' },
                ],
                returns: 'string | null',
            },
            {
                name: 'write',
                description: '写入内容到文件\n@param path 文件路径\n@param content 要写入的内容\n@return 成功返回true，失败返回false',
                params: [
                    { name: 'path', type: 'string' },
                    { name: 'content', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'append',
                description: '追加内容到文件\n@param path 文件路径\n@param content 要追加的内容\n@return 成功返回true，失败返回false',
                params: [
                    { name: 'path', type: 'string' },
                    { name: 'content', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'delete',
                description: '删除文件或目录\n@param path 文件或目录路径\n@return 成功返回true，失败返回false',
                params: [
                    { name: 'path', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'exists',
                description: '检查文件或目录是否存在\n@param path 文件或目录路径\n@return 存在返回true，不存在返回false',
                params: [
                    { name: 'path', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'mkdirs',
                description: '创建目录（包括父目录）\n@param path 目录路径\n@return 成功返回true，失败返回false',
                params: [
                    { name: 'path', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'list',
                description: '列出目录中的文件\n@param path 目录路径\n@return 文件名数组',
                params: [
                    { name: 'path', type: 'string' },
                ],
                returns: 'string[]',
            },
            {
                name: 'listFiles',
                description: '列出目录中的文件（包含完整路径）\n@param path 目录路径\n@return 文件完整路径数组',
                params: [
                    { name: 'path', type: 'string' },
                ],
                returns: 'string[]',
            },
            {
                name: 'copy',
                description: '复制文件\n@param source 源文件路径\n@param destination 目标文件路径\n@return 成功返回true，失败返回false',
                params: [
                    { name: 'source', type: 'string' },
                    { name: 'destination', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'move',
                description: '移动文件\n@param source 源文件路径\n@param destination 目标文件路径\n@return 成功返回true，失败返回false',
                params: [
                    { name: 'source', type: 'string' },
                    { name: 'destination', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'size',
                description: '获取文件大小（字节）\n@param path 文件路径\n@return 文件大小（字节），如果文件不存在或为目录返回-1',
                params: [
                    { name: 'path', type: 'string' },
                ],
                returns: 'number',
            },
            {
                name: 'isDirectory',
                description: '检查路径是否为目录\n@param path 路径\n@return 是目录返回true，否则返回false',
                params: [
                    { name: 'path', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'isFile',
                description: '检查路径是否为文件\n@param path 路径\n@return 是文件返回true，否则返回false',
                params: [
                    { name: 'path', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'getName',
                description: '获取文件名\n@param path 文件路径\n@return 文件名',
                params: [
                    { name: 'path', type: 'string' },
                ],
                returns: 'string',
            },
            {
                name: 'getParent',
                description: '获取父目录路径\n@param path 文件路径\n@return 父目录路径',
                params: [
                    { name: 'path', type: 'string' },
                ],
                returns: 'string',
            },
            {
                name: 'getAbsolutePath',
                description: '获取绝对路径\n@param path 文件路径\n@return 绝对路径',
                params: [
                    { name: 'path', type: 'string' },
                ],
                returns: 'string',
            },
            {
                name: 'rename',
                description: '重命名文件或目录\n@param oldPath 旧路径\n@param newPath 新路径\n@return 成功返回true，失败返回false',
                params: [
                    { name: 'oldPath', type: 'string' },
                    { name: 'newPath', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'lastModified',
                description: '获取最后修改时间\n@param path 文件路径\n@return 最后修改时间（毫秒），如果文件不存在返回-1',
                params: [
                    { name: 'path', type: 'string' },
                ],
                returns: 'number',
            },
            {
                name: 'readUri',
                description: '从URI读取内容（支持content://和file://等URI）\n@param uriString URI字符串\n@return 内容，如果失败返回null',
                params: [
                    { name: 'uriString', type: 'string' },
                ],
                returns: 'string | null',
            },
            {
                name: 'readBytesFromUri',
                description: '从URI读取字节数组（支持content://和file://等URI，用于读取图片等二进制文件）\n@param uriString URI字符串\n@return 字节数组，如果失败返回null',
                params: [
                    { name: 'uriString', type: 'string' },
                ],
                returns: 'number[] | null',
            },
            {
                name: 'getPathFromUri',
                description: '从content URI获取真实文件路径\n@param uriString content URI字符串\n@return 真实文件路径，如果失败返回null',
                params: [
                    { name: 'uriString', type: 'string' },
                ],
                returns: 'string | null',
            },
            {
                name: 'readBytes',
                description: '从文件读取字节数组\n@param path 文件路径\n@return 字节数组，如果失败返回null',
                params: [
                    { name: 'path', type: 'string' },
                ],
                returns: 'number[] | null',
            },
            {
                name: 'writeBytes',
                description: '写入字节数组到文件\n@param path 文件路径\n@param bytes 要写入的字节数组\n@return 成功返回true，失败返回false',
                params: [
                    { name: 'path', type: 'string' },
                    { name: 'bytes', type: 'number[]' },
                ],
                returns: 'boolean',
            },
            {
                name: 'copyFromUri',
                description: '从URI复制文件到目标路径\n@param uriString 源URI字符串\n@param destination 目标文件路径\n@return 成功返回true，失败返回false',
                params: [
                    { name: 'uriString', type: 'string' },
                    { name: 'destination', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'getExternalStoragePath',
                description: '获取外部存储根目录路径\n@return 外部存储路径',
                params: [],
                returns: 'string',
            },
            {
                name: 'getFilesPath',
                description: '获取应用私有文件目录路径\n@return 文件目录路径',
                params: [],
                returns: 'string',
            },
            {
                name: 'getCachePath',
                description: '获取应用缓存目录路径\n@return 缓存目录路径',
                params: [],
                returns: 'string',
            },
            {
                name: 'getExternalFilesPath',
                description: '获取应用外部私有文件目录路径\n@param type 文件目录类型（如"Pictures"、"Documents"），null表示根目录\n@return 外部文件目录路径',
                params: [
                    { name: 'type', type: 'string | null' },
                ],
                returns: 'string',
            },
            {
                name: 'getExternalFilesPath',
                description: '获取应用外部私有文件根目录路径\n@return 外部文件目录路径',
                params: [],
                returns: 'string',
            },
            {
                name: 'getDownloadPath',
                description: '获取Download目录路径\n@return Download目录路径',
                params: [],
                returns: 'string',
            },
            {
                name: 'getPicturesPath',
                description: '获取Pictures目录路径\n@return Pictures目录路径',
                params: [],
                returns: 'string',
            },
            {
                name: 'getDCIMPath',
                description: '获取DCIM目录路径\n@return DCIM目录路径',
                params: [],
                returns: 'string',
            },
            {
                name: 'getMoviesPath',
                description: '获取Movies目录路径\n@return Movies目录路径',
                params: [],
                returns: 'string',
            },
            {
                name: 'getMusicPath',
                description: '获取Music目录路径\n@return Music目录路径',
                params: [],
                returns: 'string',
            },
            {
                name: 'getDocumentsPath',
                description: '获取Documents目录路径\n@return Documents目录路径',
                params: [],
                returns: 'string',
            },
            {
                name: 'readAsset',
                description: '从assets读取文件\n@param fileName assets目录中的文件名\n@return 文件内容，如果失败返回null',
                params: [
                    { name: 'fileName', type: 'string' },
                ],
                returns: 'string | null',
            },
            {
                name: 'isExternalStorageWritable',
                description: '检查外部存储是否可用且可写\n@return 可用且可写返回true，否则返回false',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'isExternalStorageReadable',
                description: '检查外部存储是否可读\n@return 可读返回true，否则返回false',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'getExtension',
                description: '获取文件扩展名\n@param path 文件路径\n@return 文件扩展名（不含点），如果没有扩展名返回空字符串',
                params: [
                    { name: 'path', type: 'string' },
                ],
                returns: 'string',
            },
            {
                name: 'getNameWithoutExtension',
                description: '获取不带扩展名的文件名\n@param path 文件路径\n@return 不带扩展名的文件名',
                params: [
                    { name: 'path', type: 'string' },
                ],
                returns: 'string',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
    },
    'FloatDialog': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'setContent',
                description: '设置对话框内容\n@param content 对话框内容',
                params: [
                    { name: 'content', type: 'string' },
                ],
                returns: 'void',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
        typeOnly: true,
    },
    'FloatDialogs': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'show',
                description: '悬浮窗弹窗（需要开启悬浮窗权限）\n@param title 弹窗标题\n@param content 弹窗内容',
                params: [
                    { name: 'title', type: 'string' },
                    { name: 'content', type: 'string' },
                ],
                returns: 'void',
            },
            {
                name: 'show',
                description: '悬浮窗弹窗（需要开启悬浮窗权限）\n@param content 弹窗内容',
                params: [
                    { name: 'content', type: 'string' },
                ],
                returns: 'void',
            },
            {
                name: 'toast',
                description: 'toast 吐司，与System.toast区别是，可以后台弹出消息',
                params: [
                    { name: 'content', type: 'string' },
                ],
                returns: 'void',
            },
            {
                name: 'toastLong',
                description: 'toastLong 吐司（时间更长），与System.toast区别是，可以后台弹出消息',
                params: [
                    { name: 'content', type: 'string' },
                ],
                returns: 'void',
            },
            {
                name: 'setFloatWindowClickable',
                description: '设置悬浮窗是否可点击\n@param clickable 是否可点击',
                params: [
                    { name: 'clickable', type: 'boolean' },
                ],
                returns: 'void',
            },
            {
                name: 'closeAll',
                description: '关闭FloatDialogs开启的所有弹窗',
                params: [],
                returns: 'void',
            },
            {
                name: 'setFloatWindowVisible',
                description: '设置悬浮窗显示/隐藏\n@param visible 是否显示',
                params: [
                    { name: 'visible', type: 'boolean' },
                ],
                returns: 'void',
            },
            {
                name: 'confirm',
                description: '显示确认对话框，支持动态修改内容和回调函数\n此方法会阻塞当前线程，直到用户点击按钮或回调函数返回true\n注意：此方法需要在初始化FloatDialogs时传入scope参数才能使用\n@param title 弹窗标题\n@param content 弹窗内容\n@param confirmText 确定按钮文字\n@param cancelText 取消按钮文字\n@param callback 回调函数，接收一个dialog对象作为参数，可以通过dialog.setContent()动态修改弹窗内容。如果回调函数返回true，则自动关闭对话框；返回false或不返回值，则继续等待用户点击按钮\n@returns 如果用户点击了确定按钮返回true，点击了取消按钮返回false',
                params: [
                    { name: 'title', type: 'string' },
                    { name: 'content', type: 'string' },
                    { name: 'confirmText', type: 'string' },
                    { name: 'cancelText', type: 'string' },
                    { name: 'callback', type: '(dialog: FloatDialog) => boolean | void' },
                ],
                returns: 'boolean',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
    },
    'FloatWindow': {
        kind: 'object',
        description: '项目悬浮窗展开菜单（点「运行」进入项目后，或打包 App）。未配置 floatWindow.menus 时与开发器一致：连点两次停止任务',
        methods: [
            {
                name: 'setMenus',
                description: '运行时替换菜单。最多 5 个；传空数组表示运行时无菜单\n@param menus 菜单项数组',
                params: [
                    { name: 'menus', type: 'DeekeFloatWindowMenuItem[]' },
                ],
                returns: 'void',
            },
            {
                name: 'on',
                description: '绑定菜单项点击回调。传入对象可一次绑定多个 id → function\n@param handlers 回调映射，或菜单 id\n@param fn 单个 id 对应的回调（可选）',
                params: [
                    { name: 'handlers', type: 'Record<string, DeekeFloatWindowMenuHandler> | string' },
                    { name: 'fn', type: 'DeekeFloatWindowMenuHandler', optional: true },
                ],
                returns: 'void',
            },
            {
                name: 'update',
                description: '修改某个菜单项的 label / icon / background / show / visible 等，展开时会立刻刷新\n@param id 菜单 id\n@param patch 要修改的字段',
                params: [
                    { name: 'id', type: 'string' },
                    { name: 'patch', type: 'DeekeFloatWindowMenuPatch' },
                ],
                returns: 'void',
            },
            {
                name: 'collapse',
                description: '收起展开的扇形菜单',
                params: [],
                returns: 'void',
            },
            {
                name: 'stopTask',
                description: '从悬浮窗停止整项项目任务并恢复悬浮球 UI。菜单里手动停任务用本方法；Engines.closeAll() 在菜单回调线程无效',
                params: [],
                returns: 'void',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
    },
    'ForegroundServiceBridge': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'startService',
                description: '开启前台服务',
                params: [],
                returns: 'void',
            },
            {
                name: 'register',
                description: '注册执行的方法（启动服务前设置）\n@param register 注册监听',
                params: [
                    { name: 'func', type: 'Function' },
                ],
                returns: 'void',
            },
            {
                name: 'setContent',
                description: '前台服务标题和内容设置（启动服务前设置）\n@param title 前台服务标题\n@param content 前台服务内容',
                params: [
                    { name: 'title', type: 'string' },
                    { name: 'content', type: 'string' },
                ],
                returns: 'void',
            },
            {
                name: 'stopService',
                description: '关闭服务',
                params: [],
                returns: 'void',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
    },
    'Gesture': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'click',
                description: '点击屏幕位置\n@param x x坐标\n@param y y坐标',
                params: [
                    { name: 'x', type: 'number' },
                    { name: 'y', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'longClick',
                description: '长按屏幕位置\n@param x x坐标\n@param y y坐标',
                params: [
                    { name: 'x', type: 'number' },
                    { name: 'y', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'press',
                description: '长按屏幕位置（可设置时长）\n@param x x坐标\n@param y y坐标\n@param duration 长按时长，毫秒',
                params: [
                    { name: 'x', type: 'number' },
                    { name: 'y', type: 'number' },
                    { name: 'duration', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'swipe',
                description: '从(x1,y1)滑动到(x2,y2)，并且耗时duration毫秒\n@param x1 起始位置，x坐标\n@param y1 起始位置，y坐标\n@param x2 结束位置，x坐标\n@param y2 结束位置，y坐标\n@param duration 滑动时长，毫秒',
                params: [
                    { name: 'x1', type: 'number' },
                    { name: 'y1', type: 'number' },
                    { name: 'x2', type: 'number' },
                    { name: 'y2', type: 'number' },
                    { name: 'duration', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'back',
                description: '返回键',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'home',
                description: '主页键（Home键）',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'recents',
                description: '任务切换键',
                params: [],
                returns: 'boolean',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
    },
    'Hid': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'swipe',
                description: '模拟从一个点滑动到另一个点。\n@param x1 起始点X坐标\n@param y1 起始点Y坐标\n@param x2 终点X坐标\n@param y2 终点Y坐标\n@param step 每步移动距离（5-60，默认随机20-51）\n@param downTimeout 按下后等待时间（默认随机100-180ms）\n@param upTimeout 滑动结束后等待抬起时间（默认随机100-180ms）\n@param timeout 每步之间的延迟时间（默认随机8-15ms）\n@param upDownTimes 抬起次数（默认1）\n@returns 是否滑动成功',
                params: [
                    { name: 'x1', type: 'number' },
                    { name: 'y1', type: 'number' },
                    { name: 'x2', type: 'number' },
                    { name: 'y2', type: 'number' },
                    { name: 'step', type: 'number', optional: true },
                    { name: 'downTimeout', type: 'number', optional: true },
                    { name: 'upTimeout', type: 'number', optional: true },
                    { name: 'timeout', type: 'number', optional: true },
                    { name: 'upDownTimes', type: 'number', optional: true },
                ],
                returns: 'boolean',
            },
            {
                name: 'swipex',
                description: '使用仿真曲线滑动。\n@param x1 起始点X坐标\n@param y1 起始点Y坐标\n@param x2 终点X坐标\n@param y2 终点Y坐标\n@param radian 弧度大小（默认10-100）\n@param step 每步移动距离（5-60，默认随机20-51）\n@param downTimeout 按下后等待时间（默认随机100-180ms）\n@param upTimeout 滑动结束后等待抬起时间（默认随机100-180ms）\n@param timeout 每步之间的延迟时间（默认随机8-15ms）\n@param upDownTimes 抬起次数（默认1）\n@returns 是否滑动成功',
                params: [
                    { name: 'x1', type: 'number' },
                    { name: 'y1', type: 'number' },
                    { name: 'x2', type: 'number' },
                    { name: 'y2', type: 'number' },
                    { name: 'radian', type: 'number', optional: true },
                    { name: 'step', type: 'number', optional: true },
                    { name: 'downTimeout', type: 'number', optional: true },
                    { name: 'upTimeout', type: 'number', optional: true },
                    { name: 'timeout', type: 'number', optional: true },
                    { name: 'upDownTimes', type: 'number', optional: true },
                ],
                returns: 'boolean',
            },
            {
                name: 'getHidZcm',
                description: '获取服务器HID激活码。\n@returns 激活码字符串\n@throws Error 当蓝牙未初始化时',
                params: [],
                returns: 'string',
            },
            {
                name: 'ver',
                description: '获取插件版本号。\n@returns 插件版本号',
                params: [],
                returns: 'number',
            },
            {
                name: 'home',
                description: '模拟按下Home键。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'recents',
                description: '模拟按下任务键。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'back',
                description: '模拟按下返回键。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'back1',
                description: '使用另一种方式模拟按下返回键。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'touchDown',
                description: '模拟手指按下事件。\n@param x X坐标\n@param y Y坐标\n@returns 是否成功',
                params: [
                    { name: 'x', type: 'number' },
                    { name: 'y', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'touchMove',
                description: '模拟手指移动事件。\n@param x X坐标\n@param y Y坐标\n@returns 是否成功',
                params: [
                    { name: 'x', type: 'number' },
                    { name: 'y', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'touchUp',
                description: '模拟手指抬起事件。\n@param x X坐标\n@param y Y坐标\n@returns 是否成功',
                params: [
                    { name: 'x', type: 'number', optional: true },
                    { name: 'y', type: 'number', optional: true },
                ],
                returns: 'boolean',
            },
            {
                name: 'touchUp2',
                description: '模拟手指多次抬起事件。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'tap',
                description: '模拟点击事件。\n@param x X坐标\n@param y Y坐标\n@returns 是否成功',
                params: [
                    { name: 'x', type: 'number' },
                    { name: 'y', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'initBluetooth',
                description: '初始化蓝牙模块。\n@param ctx 上下文对象\n@returns 是否成功',
                params: [
                    { name: 'ctx', type: 'any' },
                ],
                returns: 'boolean',
            },
            {
                name: 'getName',
                description: '获取已连接蓝牙设备名称。\n@returns 设备名称',
                params: [],
                returns: 'string',
            },
            {
                name: 'keyDown',
                description: '模拟按键按下事件。\n@param code 键码\n@returns 是否成功',
                params: [
                    { name: 'code', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'keyUp',
                description: '模拟按键抬起事件。\n@param code 键码\n@returns 是否成功',
                params: [
                    { name: 'code', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'keyPress',
                description: '模拟按键按下和抬起事件。\n@param code 键码\n@returns 是否成功',
                params: [
                    { name: 'code', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'keyPress_code',
                description: '模拟指定键码的按键事件。\n@param code 键码\n@returns 是否成功',
                params: [
                    { name: 'code', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'keyDown_code',
                description: '模拟指定键码的按键按下。\n@param code 键码\n@returns 是否成功',
                params: [
                    { name: 'code', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'keyUp_code',
                description: '模拟指定键码的按键抬起。\n@param code 键码\n@returns 是否成功',
                params: [
                    { name: 'code', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'keyUpAll',
                description: '模拟松开所有按键。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'key_select',
                description: '模拟全选操作。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'key_paste',
                description: '模拟粘贴操作。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'key_copy',
                description: '模拟复制操作。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'key_cat',
                description: '模拟剪切操作。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'key_del',
                description: '模拟退格操作。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'key_delete',
                description: '模拟删除操作。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'key_enter',
                description: '模拟回车操作。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'key_num',
                description: '模拟数字键输入。\n@param n 数字（0-9）\n@returns 是否成功',
                params: [
                    { name: 'n', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'key_abc',
                description: '模拟字母键输入。\n@param n 字母\n@returns 是否成功',
                params: [
                    { name: 'n', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'volUp',
                description: '模拟音量加操作。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'volDown',
                description: '模拟音量减操作。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'power',
                description: '模拟按下电源键。\n@param time 持续时间（可选）\n@returns 是否成功',
                params: [
                    { name: 'time', type: 'number', optional: true },
                ],
                returns: 'boolean',
            },
            {
                name: 'reboot',
                description: '模拟重启设备。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'setXY',
                description: '设置屏幕分辨率。\n@param x 宽度\n@param y 高度\n@returns 是否成功',
                params: [
                    { name: 'x', type: 'number' },
                    { name: 'y', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'reg',
                description: '注册设备。\n@param key 注册码\n@returns 是否成功',
                params: [
                    { name: 'key', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'setRnd',
                description: '设置点击延时随机数。\n@param x X随机数\n@param y Y随机数\n@returns 是否成功',
                params: [
                    { name: 'x', type: 'number' },
                    { name: 'y', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'setBattery',
                description: '设置设备电量。\n@param lv 电量百分比\n@returns 是否成功',
                params: [
                    { name: 'lv', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'connect',
                description: '连接蓝牙设备。\n@param autoconnect 是否自动连接\n@param index 设备索引\n@returns 是否成功',
                params: [
                    { name: 'autoconnect', type: 'boolean' },
                    { name: 'index', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'getConnectedDevices',
                description: '获取已连接的蓝牙设备。\n@returns 蓝牙设备对象或null',
                params: [],
                returns: 'any',
            },
            {
                name: 'getConnectState',
                description: '获取蓝牙连接状态。\n@returns 是否已连接',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'sendData',
                description: '发送数据到蓝牙设备。\n@param str 数据内容\n@returns 是否成功',
                params: [
                    { name: 'str', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'sendDataAwait',
                description: '发送数据并等待响应。\n@param str 数据内容\n@param time 等待时间（毫秒）\n@returns 是否成功',
                params: [
                    { name: 'str', type: 'string' },
                    { name: 'time', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'getData',
                description: '获取接收到的数据。\n@param time 等待时间（可选）\n@returns 返回数据',
                params: [
                    { name: 'time', type: 'number', optional: true },
                ],
                returns: 'string',
            },
            {
                name: 'waitFor',
                description: '等待数据响应。\n@param time 最大等待时间（毫秒，可选）\n@param sleep 检查间隔（毫秒，可选）\n@returns 返回数据或超时信息',
                params: [
                    { name: 'time', type: 'number', optional: true },
                    { name: 'sleep', type: 'number', optional: true },
                ],
                returns: 'string',
            },
            {
                name: 'disconnect',
                description: '断开蓝牙连接。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
    },
    'Http': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'post',
                description: 'post请求\n@param url 请求地址\n@param json 请求内容\n@param headers 请求头n的请求头，如：{"Content-Type":"application/json"}',
                params: [
                    { name: 'url', type: 'string' },
                    { name: 'json', type: 'object' },
                    { name: 'headers', type: 'object', optional: true },
                ],
                returns: 'string | null',
            },
            {
                name: 'get',
                description: 'get请求\n@param url 请求地址\n@param headers 请求头',
                params: [
                    { name: 'url', type: 'string' },
                    { name: 'headers', type: 'object' },
                ],
                returns: 'string | null',
            },
            {
                name: 'postFile',
                description: '@param url 请求地址\n@param files \n@param params \n@param httpCallback',
                params: [
                    { name: 'url', type: 'string' },
                    { name: 'files', type: 'string[]' },
                    { name: 'params', type: 'object' },
                    { name: 'httpCallback', type: '{\n        success: (response: any) => void' },
                    { name: 'fail', type: '(response: any) => void\n    }' },
                ],
                returns: 'void',
            },
            {
                name: 'download',
                description: '下载文件\n@param url 下载链接\n@param destPath 保存路径（含文件名称）\n@param headers 请求头',
                params: [
                    { name: 'url', type: 'string' },
                    { name: 'destPath', type: 'string' },
                    { name: 'headers', type: 'object', optional: true },
                ],
                returns: 'string | null',
            },
            {
                name: 'setConnectTimeout',
                description: '设置连接超时时间\n@param seconds 超时时间（秒），默认10秒',
                params: [
                    { name: 'seconds', type: 'number' },
                ],
                returns: 'void',
            },
            {
                name: 'setReadTimeout',
                description: '设置读取超时时间\n@param seconds 超时时间（秒），默认30秒',
                params: [
                    { name: 'seconds', type: 'number' },
                ],
                returns: 'void',
            },
            {
                name: 'setWriteTimeout',
                description: '设置写入超时时间\n@param seconds 超时时间（秒），默认30秒',
                params: [
                    { name: 'seconds', type: 'number' },
                ],
                returns: 'void',
            },
            {
                name: 'setTimeout',
                description: '设置所有超时时间\n@param connectSeconds 连接超时时间（秒）\n@param readSeconds 读取超时时间（秒）\n@param writeSeconds 写入超时时间（秒）',
                params: [
                    { name: 'connectSeconds', type: 'number' },
                    { name: 'readSeconds', type: 'number' },
                    { name: 'writeSeconds', type: 'number' },
                ],
                returns: 'void',
            },
            {
                name: 'setTimeout',
                description: '设置所有超时时间为相同的值\n@param seconds 超时时间（秒），将应用于连接、读取和写入',
                params: [
                    { name: 'seconds', type: 'number' },
                ],
                returns: 'void',
            },
            {
                name: 'postStream',
                description: '流式POST请求（支持Server-Sent Events等流式输出）\n@param url 请求URL\n@param json 请求体JSON对象\n@param headers 请求头（可选）\n@param onData 数据回调函数，每收到一行数据时调用，参数为数据字符串\n@param onError 错误回调函数，发生错误时调用，参数为错误信息',
                params: [
                    { name: 'url', type: 'string' },
                    { name: 'json', type: 'object' },
                    { name: 'headers', type: 'object' },
                    { name: 'onData', type: '(data: string) => void, onError: (error: string) => void' },
                ],
                returns: 'void',
            },
            {
                name: 'postStream',
                description: '流式POST请求（支持Server-Sent Events等流式输出）\n@param url 请求URL\n@param json 请求体JSON对象\n@param onData 数据回调函数，每收到一行数据时调用，参数为数据字符串\n@param onError 错误回调函数，发生错误时调用，参数为错误信息',
                params: [
                    { name: 'url', type: 'string' },
                    { name: 'json', type: 'object' },
                    { name: 'onData', type: '(data: string) => void, onError: (error: string) => void' },
                ],
                returns: 'void',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
    },
    'Images': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'getMat',
                description: '',
                params: [
                    { name: 'imageFile', type: 'string' },
                ],
                returns: 'Mat',
            },
            {
                name: 'findOne',
                description: '',
                params: [
                    { name: 'source', type: 'Mat' },
                    { name: 'template', type: 'Mat' },
                    { name: 'threshold', type: 'number' },
                ],
                returns: 'Point',
            },
            {
                name: 'find',
                description: '',
                params: [
                    { name: 'source', type: 'Mat' },
                    { name: 'template', type: 'Mat' },
                    { name: 'threshold', type: 'number' },
                ],
                returns: 'Point[]',
            },
            {
                name: 'capture',
                description: '',
                params: [],
                returns: 'string',
            },
            {
                name: 'getColor',
                description: '',
                params: [
                    { name: 'imageFile', type: 'string' },
                    { name: 'pixelX', type: 'number' },
                    { name: 'pixelY', type: 'number' },
                ],
                returns: 'string',
            },
            {
                name: 'findColor',
                description: '',
                params: [
                    { name: 'imageFile', type: 'string' },
                    { name: 'color', type: 'string' },
                ],
                returns: 'Point[]',
            },
            {
                name: 'findColor',
                description: '',
                params: [
                    { name: 'imageFile', type: 'string' },
                    { name: 'startColor', type: 'string' },
                    { name: 'endColor', type: 'string' },
                ],
                returns: 'Point[]',
            },
            {
                name: 'crop',
                description: '',
                params: [
                    { name: 'imageFile', type: 'string' },
                    { name: 'left', type: 'number' },
                    { name: 'top', type: 'number' },
                    { name: 'width', type: 'number' },
                    { name: 'height', type: 'number' },
                ],
                returns: 'string',
            },
            {
                name: 'scale',
                description: '@param imageFile 图片文件路径\n@param multiple 缩放倍数\n@throws Error 当参数非法时或者图片文件不存在时抛出异常',
                params: [
                    { name: 'imageFile', type: 'string' },
                    { name: 'multiple', type: 'number' },
                ],
                returns: 'string',
            },
            {
                name: 'getTextAndRegion',
                description: '返回图片的文本和区域\n@param imageFile 图片文件路径\n@throws Error 当图像识别失败或参数非法时',
                params: [
                    { name: 'imageFile', type: 'string' },
                ],
                returns: 'TextAndRegion[]',
            },
            {
                name: 'findTextPosition',
                description: '查找文本位置\n@param imageFile 图片文件路径\n@param keyword 查找的文本\n@throws Error 当图像识别失败或参数非法时',
                params: [
                    { name: 'imageFile', type: 'string' },
                    { name: 'keyword', type: 'string' },
                ],
                returns: 'Rect[]',
            },
            {
                name: 'findTextInRegion',
                description: '在指定区域内查找文本。\n@param imageFile 图片文件路径\n@param left 区域左边界\n@param top 区域上边界\n@param width 区域宽度\n@param height 区域高度\n@returns 识别出的文本数组\n@throws Error 当图像识别失败或参数非法时',
                params: [
                    { name: 'imageFile', type: 'string' },
                    { name: 'left', type: 'number' },
                    { name: 'top', type: 'number' },
                    { name: 'width', type: 'number' },
                    { name: 'height', type: 'number' },
                ],
                returns: 'string[]',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
    },
    'Intent': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'open',
                description: 'open',
                params: [],
                returns: 'void',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
    },
    'JavaImporter': {
        kind: 'function',
        description: '',
        methods: [],
        properties: [],
        constructorParams: [],
        funcParams: [
            { name: 'packages', type: 'any[]', rest: true },
        ],
        funcReturns: 'any',
    },
    'KeyBoards': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'isEnabled',
                description: 'DeekeScript输入法是否启用（未设置为默认，也返回true，但是此时不能输入和删除）',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'canInput',
                description: '判断DeekeScript输入法是否设置为默认，是的话，则可以使用输入和删除方法',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'input',
                description: '往文本框追加字符串',
                params: [
                    { name: 'str', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'delete',
                description: '删除文本框最后一个字符',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'hide',
                description: '隐藏键盘',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'pressKey',
                description: '发送按键事件，支持各种按键\n注意：输入法只能发送文本输入相关的按键，系统级按键（如HOME、BACK、POWER等）无法通过输入法发送\n@param key 按键代码，可以是字符串（如 "ENTER"）或数字（如 KeyBoards.KEYCODE.ENTER）',
                params: [
                    { name: 'key', type: 'string | number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'pressEnter',
                description: '发送Enter键（回车键）',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'pressTab',
                description: '发送Tab键（制表符）',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'pressSpace',
                description: '发送空格键',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'showInputMethodPicker',
                description: '智能方法：根据当前状态自动跳转到合适的页面\n- 如果已经是默认输入法，返回 true\n- 如果未启用，跳转到启用页面（用户需要先启用）\n- 如果已启用但未设为默认，弹出输入法选择界面（用户可以选择为默认）\n@returns 返回当前输入法是否已设为默认（true表示已是默认，false表示需要用户操作）',
                params: [],
                returns: 'boolean',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
    },
    'Log': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'setFile',
                description: '全局设置日志输出文件',
                params: [
                    { name: 'filename', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'log',
                description: '输出日志内容',
                params: [
                    { name: 'obj', type: 'object', rest: true },
                ],
                returns: 'void',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
    },
    'Mat': {
        kind: 'object',
        description: '',
        methods: [],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
        typeOnly: true,
    },
    'MediaStore': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'getImages',
                description: '获取相册中的所有图片\n@return JavaScript 数组，包含图片信息对象 {id, name, path, uri, size, date}',
                params: [],
                returns: 'any[]',
            },
            {
                name: 'saveImage',
                description: '保存图片到相册\n@param sourcePath 源图片路径\n@param displayName 显示名称（可选）\n@param relativePath 相对路径（可选，如 "Pictures/MyApp"）\n@return 保存后的 content:// Uri 字符串，失败返回 null',
                params: [
                    { name: 'sourcePath', type: 'string' },
                    { name: 'displayName', type: 'string', optional: true },
                    { name: 'relativePath', type: 'string', optional: true },
                ],
                returns: 'string | null',
            },
            {
                name: 'saveImage',
                description: '保存图片到相册（使用默认配置）\n@param sourcePath 源图片路径\n@return 保存后的 content:// Uri 字符串',
                params: [
                    { name: 'sourcePath', type: 'string' },
                ],
                returns: 'string | null',
            },
            {
                name: 'deleteImage',
                description: '删除图片\n@param uriString content:// Uri 字符串\n@return 删除成功返回 true',
                params: [
                    { name: 'uriString', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'getVideos',
                description: '获取相册中的所有视频\n@return JavaScript 数组，包含视频信息对象 {id, name, path, uri, size, duration, date}',
                params: [],
                returns: 'any[]',
            },
            {
                name: 'saveVideo',
                description: '保存视频到相册\n@param sourcePath 源视频路径\n@param displayName 显示名称（可选）\n@param relativePath 相对路径（可选）\n@return 保存后的 content:// Uri 字符串，失败返回 null',
                params: [
                    { name: 'sourcePath', type: 'string' },
                    { name: 'displayName', type: 'string', optional: true },
                    { name: 'relativePath', type: 'string', optional: true },
                ],
                returns: 'string | null',
            },
            {
                name: 'saveVideo',
                description: '保存视频到相册（使用默认配置）\n@param sourcePath 源视频路径\n@return 保存后的 content:// Uri 字符串',
                params: [
                    { name: 'sourcePath', type: 'string' },
                ],
                returns: 'string | null',
            },
            {
                name: 'deleteVideo',
                description: '删除视频\n@param uriString content:// Uri 字符串\n@return 删除成功返回 true',
                params: [
                    { name: 'uriString', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'getAudios',
                description: '获取所有音频文件\n@return JavaScript 数组，包含音频信息对象 {id, name, path, uri, size, duration, artist, album}',
                params: [],
                returns: 'any[]',
            },
            {
                name: 'saveAudio',
                description: '保存音频文件\n@param sourcePath 源文件路径\n@param displayName 显示名称（可选）\n@return 保存后的 content:// Uri 字符串，失败返回 null',
                params: [
                    { name: 'sourcePath', type: 'string' },
                    { name: 'displayName', type: 'string', optional: true },
                ],
                returns: 'string | null',
            },
            {
                name: 'saveToDownloads',
                description: '保存文件到下载目录\n@param sourcePath 源文件路径\n@param displayName 显示名称（可选）\n@return 保存后的 content:// Uri 字符串（Android 10+）或文件路径（Android 9-），失败返回 null',
                params: [
                    { name: 'sourcePath', type: 'string' },
                    { name: 'displayName', type: 'string', optional: true },
                ],
                returns: 'string | null',
            },
            {
                name: 'getDownloads',
                description: '获取下载目录的所有文件\nAPI 29+ 使用 MediaStore，API 26-28 使用文件系统\n@return JavaScript 数组，包含文件信息对象 {id, name, uri, size, date} 或 {name, path, uri, size, date}',
                params: [],
                returns: 'any[]',
            },
            {
                name: 'saveToDocuments',
                description: '保存文档文件到文档目录\n@param sourcePath 源文件路径\n@param displayName 显示名称（可选）\n@return 保存后的 content:// Uri 字符串（Android 10+）或文件路径（Android 9-），失败返回 null',
                params: [
                    { name: 'sourcePath', type: 'string' },
                    { name: 'displayName', type: 'string', optional: true },
                ],
                returns: 'string | null',
            },
            {
                name: 'saveToDocuments',
                description: '保存文档文件到文档目录（使用默认名称）\n@param sourcePath 源文件路径\n@return 保存后的 content:// Uri 字符串或文件路径',
                params: [
                    { name: 'sourcePath', type: 'string' },
                ],
                returns: 'string | null',
            },
            {
                name: 'getDocuments',
                description: '获取文档目录的所有文件\n@return JavaScript 数组，包含文件信息对象 {id, name, uri, size, date, mimeType} 或 {name, path, uri, size, date}',
                params: [],
                returns: 'any[]',
            },
            {
                name: 'readFromUri',
                description: '从 URI 读取文件内容\n@param uriString content:// Uri 字符串\n@return 文件内容字节数组，失败返回 null',
                params: [
                    { name: 'uriString', type: 'string' },
                ],
                returns: 'number[] | null',
            },
            {
                name: 'queryMediaInfo',
                description: '查询媒体文件信息\n@param uriString content:// Uri 字符串\n@return JavaScript 对象，包含文件信息 {name, size, mimeType}',
                params: [
                    { name: 'uriString', type: 'string' },
                ],
                returns: 'any',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
    },
    'NotificationBridge': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'startService',
                description: '开启读取通知服务',
                params: [],
                returns: 'void',
            },
            {
                name: 'startListening',
                description: '监听通知\n@param onNotification 通知发起后执行 @argument packageName 包名 @argument title 标题 @argument text 内容\n@param onNotificationRemoved 通知移除后执行 @argument packageName 包名 @argument title 标题 @argument text 内容',
                params: [
                    { name: 'onNotification', type: '(packageName: string, title: string, text: string) => void,\n        onNotificationRemoved: (packageName: string' },
                    { name: 'title', type: 'string' },
                    { name: 'text', type: 'string) => void' },
                ],
                returns: 'void',
            },
            {
                name: 'stopService',
                description: '关闭服务',
                params: [],
                returns: 'void',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
    },
    'Packages': {
        kind: 'object',
        description: '',
        methods: [],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: 'any',
    },
    'Point': {
        kind: 'object',
        description: '',
        methods: [],
        properties: [
            { name: 'x', type: 'number', description: '' },
            { name: 'y', type: 'number', description: '' },
        ],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
        typeOnly: true,
    },
    'Rect': {
        kind: 'class',
        description: '',
        methods: [
            {
                name: 'height',
                description: '',
                params: [],
                returns: 'number',
            },
            {
                name: 'width',
                description: '',
                params: [],
                returns: 'number',
            },
            {
                name: 'centerX',
                description: '',
                params: [],
                returns: 'number',
            },
            {
                name: 'centerY',
                description: '',
                params: [],
                returns: 'number',
            },
        ],
        properties: [
            { name: 'left', type: 'number', description: '' },
            { name: 'top', type: 'number', description: '' },
            { name: 'right', type: 'number', description: '' },
            { name: 'bottom', type: 'number', description: '' },
        ],
        constructorParams: [
            { name: 'left', type: 'number' },
            { name: 'top', type: 'number' },
            { name: 'right', type: 'number' },
            { name: 'bottom', type: 'number' },
        ],
        funcParams: [],
        funcReturns: '',
    },
    'SocketIoClient': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'getInstance',
                description: '获取socketIoClient实例\n@param serverUrl  socketIOServer地址\n@param reconnect  是否自动重连（默认为true）\n@param timeout  重连超时时间（毫秒）（默认为5000毫秒）',
                params: [
                    { name: 'serverUrl', type: 'string' },
                    { name: 'reconnect', type: 'boolean' },
                    { name: 'timeout', type: 'number' },
                ],
                returns: 'socketIoClient',
            },
            {
                name: 'connect',
                description: '连接socketIOServer',
                params: [],
                returns: 'void',
            },
            {
                name: 'disconnect',
                description: '断开socketIOServer',
                params: [],
                returns: 'void',
            },
            {
                name: 'isConnected',
                description: '是否已连接',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'emit',
                description: '向服务器发送事件和数据\n@param eventName  事件名称\n@param data  数据',
                params: [
                    { name: 'eventName', type: 'string' },
                    { name: 'data', type: 'string' },
                ],
                returns: 'void',
            },
            {
                name: 'emit',
                description: '向服务器发送事件和数据\n@param eventName 事件名称\n@param data 数据\n@param callback 服务器确认后的回调函数',
                params: [
                    { name: 'eventName', type: 'string' },
                    { name: 'data', type: 'string' },
                    { name: 'callback', type: 'function' },
                ],
                returns: 'void',
            },
            {
                name: 'on',
                description: '监听事件\n@param eventName \n@param callback',
                params: [
                    { name: 'eventName', type: 'string' },
                    { name: 'callback', type: '(data: string) => void' },
                ],
                returns: 'void',
            },
            {
                name: 'off',
                description: '移除事件监听器\n@param eventName \n@param callback',
                params: [
                    { name: 'eventName', type: 'string' },
                    { name: 'callback', type: '(data: string) => void' },
                ],
                returns: 'void',
            },
            {
                name: 'off',
                description: '移除事件监听器\n@param eventName',
                params: [
                    { name: 'eventName', type: 'string' },
                ],
                returns: 'void',
            },
            {
                name: 'off',
                description: '移除所有事件监听器',
                params: [],
                returns: 'void',
            },
            {
                name: 'setReconnect',
                description: '重置当前实例的是否重连\n@param bool 是否自动重连',
                params: [
                    { name: 'bool', type: 'boolean' },
                ],
                returns: 'void',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
    },
    'Storage': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'create',
                description: '创建存储实例  全局使用一个即可\n@param db 数据库名称\n@return 返回当前实例，如果已存在则直接返回',
                params: [
                    { name: 'db', type: 'string' },
                ],
                returns: 'storage',
            },
            {
                name: 'put',
                description: '设置字符串\n@param key 键\n@param value 值',
                params: [
                    { name: 'key', type: 'string' },
                    { name: 'value', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'putInteger',
                description: '设置整型值\n@param key 键\n@param value 值',
                params: [
                    { name: 'key', type: 'string' },
                    { name: 'value', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'putBoolean',
                description: '设置bool\n@param key 键\n@param value 值',
                params: [
                    { name: 'key', type: 'string' },
                    { name: 'value', type: 'boolean' },
                ],
                returns: 'boolean',
            },
            {
                name: 'putDouble',
                description: '设置双精度值\n@param key 键\n@param value 值',
                params: [
                    { name: 'key', type: 'string' },
                    { name: 'value', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'putObj',
                description: '设置对象\n@param key 键\n@param obj 值',
                params: [
                    { name: 'key', type: 'string' },
                    { name: 'obj', type: 'object' },
                ],
                returns: 'boolean',
            },
            {
                name: 'putArray',
                description: '设置集合（字符串）\n@param key 键\n@param set 值',
                params: [
                    { name: 'key', type: 'string' },
                    { name: 'arr', type: 'Array' },
                ],
                returns: 'boolean',
            },
            {
                name: 'getArray',
                description: '获取集合（字符串）\n@param key 键',
                params: [
                    { name: 'key', type: 'string' },
                ],
                returns: 'Array',
            },
            {
                name: 'get',
                description: '获取字符串\n@param key 键',
                params: [
                    { name: 'key', type: 'string' },
                ],
                returns: 'string',
            },
            {
                name: 'getString',
                description: '获取字符串\n@param key 键',
                params: [
                    { name: 'key', type: 'string' },
                ],
                returns: 'string',
            },
            {
                name: 'getBoolean',
                description: '获取bool类型的值\n@param key 键',
                params: [
                    { name: 'key', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'getDouble',
                description: '获取Double类型的值\n@param key 键',
                params: [
                    { name: 'key', type: 'string' },
                ],
                returns: 'number',
            },
            {
                name: 'getInteger',
                description: '获取整型类型的值\n@param key 键',
                params: [
                    { name: 'key', type: 'string' },
                ],
                returns: 'number',
            },
            {
                name: 'getObj',
                description: '获取对象类型的值\n@param key 键',
                params: [
                    { name: 'key', type: 'string' },
                ],
                returns: 'object',
            },
            {
                name: 'remove',
                description: '移除某个键\n@param key 键\n@return 返回Promise，实际使用时通过blockingSubscribe()或toCompletionStage()来获取结果',
                params: [
                    { name: 'key', type: 'string' },
                ],
                returns: 'any',
            },
            {
                name: 'clear',
                description: '清空所有值\n@return 返回Promise，实际使用时通过blockingSubscribe()或toCompletionStage()来获取结果',
                params: [],
                returns: 'any',
            },
            {
                name: 'contains',
                description: '判断是否包含键为key的数据\n@param key 键\n@return 返回boolean，表示是否存在该键',
                params: [
                    { name: 'key', type: 'string' },
                ],
                returns: 'boolean',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
    },
    'System': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'sleep',
                description: '休眠\n@param milliSecond 毫秒',
                params: [
                    { name: 'milliSecond', type: 'number' },
                ],
                returns: 'void',
            },
            {
                name: 'preciseSleep',
                description: '精确休眠\n@param milliSecond 毫秒\n\n与sleep()方法相比，preciseSleep()使用更精确的休眠机制，\n通过WakeLock保持CPU唤醒状态，并使用循环检查来确保休眠时间的准确性。\n\n注意：此方法会保持CPU唤醒状态，可能会增加电量消耗。\n如果不需要精确的休眠时间，建议使用sleep()方法。',
                params: [
                    { name: 'milliSecond', type: 'number' },
                ],
                returns: 'void',
            },
            {
                name: 'gc',
                description: '释放内存',
                params: [],
                returns: 'void',
            },
            {
                name: 'time',
                description: '获取当前时间  yyyy-MM-dd HH:mm:ss.SSS 格式',
                params: [],
                returns: 'string',
            },
            {
                name: 'currentActivity',
                description: '获取当前Activity',
                params: [],
                returns: 'string',
            },
            {
                name: 'currentPackage',
                description: '获取当前包名',
                params: [],
                returns: 'string',
            },
            {
                name: 'setClip',
                description: '将内容设置到剪切板中\n@param text 剪切板内容',
                params: [
                    { name: 'text', type: 'string' },
                ],
                returns: 'void',
            },
            {
                name: 'getClip',
                description: '获取剪切板内容',
                params: [],
                returns: 'string',
            },
            {
                name: 'toast',
                description: '吐司\n@param text 显示文本',
                params: [
                    { name: 'text', type: 'string' },
                ],
                returns: 'void',
            },
            {
                name: 'toastLong',
                description: '吐司（显示时间较长）\n@param text 显示文本',
                params: [
                    { name: 'text', type: 'string' },
                ],
                returns: 'void',
            },
            {
                name: 'waitForActivity',
                description: '@param activity 等待的Activity\n@param period 每次时间间隔\n@param timeout 等待的总时间',
                params: [
                    { name: 'activity', type: 'string' },
                    { name: 'period', type: 'number' },
                    { name: 'timeout', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'waitForPackage',
                description: '@param activity 等待的PackageName的App启动\n@param period 每次时间间隔\n@param timeout 等待的总时间',
                params: [
                    { name: 'packageName', type: 'string' },
                    { name: 'period', type: 'number' },
                    { name: 'timeout', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'exit',
                description: '停止所有脚本',
                params: [],
                returns: 'void',
            },
            {
                name: 'cleanUp',
                description: '缓存清理',
                params: [],
                returns: 'void',
            },
            {
                name: 'AiSpeechToken',
                description: '获取智能话术token\n@param key 智能话术key\n@param secret 智能话术secret',
                params: [
                    { name: 'key', type: 'string' },
                    { name: 'secret', type: 'string' },
                ],
                returns: 'string',
            },
            {
                name: 'generateWindowElements',
                description: '生成窗口元素，使用App的上传日志，可以拿到文件',
                params: [],
                returns: 'void',
            },
            {
                name: 'getDataFrom',
                description: '获取接口返回的内容\n@param key \n@param dataForm \n@param content',
                params: [
                    { name: 'key', type: 'string' },
                    { name: 'dataForm', type: 'string' },
                    { name: 'content', type: 'string' },
                ],
                returns: 'string | null',
            },
            {
                name: 'setTimeWindowShow',
                description: '是否显示时间悬浮窗窗口\n@param show 是否显示',
                params: [
                    { name: 'show', type: 'boolean' },
                ],
                returns: 'void',
            },
            {
                name: 'setAccessibilityMode',
                description: '切换无障碍模式，快速模式下，将自动过滤非重要控件。注意通过id或者text方式获取控件不受此模式影响；\n@param mode 快速模式mode为fast，非快速模式为!fast',
                params: [
                    { name: 'mode', type: 'string' },
                ],
                returns: 'void',
            },
            {
                name: 'setKeepScreenOn',
                description: '设置屏幕是否保持常亮\n@param keepOn 是否保持屏幕常亮',
                params: [
                    { name: 'keepOn', type: 'boolean' },
                ],
                returns: 'void',
            },
            {
                name: 'getLocaleInfo',
                description: '获取当前系统区域与语言信息（配置中的首个 Locale）\n@returns language 为语言码；country 为国家/地区码；tag 为 BCP 47 标签（如 zh-CN）',
                params: [],
                returns: '{\n        language: string;\n        country: string;\n        tag: string;\n    }',
            },
        ],
        properties: [
            { name: 'language', type: 'string', description: '' },
            { name: 'country', type: 'string', description: '' },
            { name: 'tag', type: 'string', description: '' },
        ],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
    },
    'TextAndRegion': {
        kind: 'object',
        description: '',
        methods: [],
        properties: [
            { name: 'text', type: 'string', description: '' },
            { name: 'rect', type: 'Rect', description: '' },
        ],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
        typeOnly: true,
    },
    'ThreadWrapper': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'start',
                description: '启动线程',
                params: [],
                returns: 'void',
            },
            {
                name: 'join',
                description: '等待线程任务完成\n@throws InterruptedException 如果等待过程中线程被中断',
                params: [],
                returns: 'void',
            },
            {
                name: 'join',
                description: '等待线程任务完成，最多等待指定的毫秒数\n@param millis 最多等待的毫秒数\n@throws InterruptedException 如果等待过程中线程被中断',
                params: [
                    { name: 'millis', type: 'number' },
                ],
                returns: 'void',
            },
            {
                name: 'interrupt',
                description: '中断线程',
                params: [],
                returns: 'void',
            },
            {
                name: 'isAlive',
                description: '检查线程是否存活\n@returns 如果线程正在运行返回true，否则返回false',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'isInterrupted',
                description: '检查线程是否被中断\n@returns 如果线程被中断返回true，否则返回false',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'setName',
                description: '设置线程名称\n@param name 线程名称',
                params: [
                    { name: 'name', type: 'string' },
                ],
                returns: 'void',
            },
            {
                name: 'getName',
                description: '获取线程名称\n@returns 线程名称',
                params: [],
                returns: 'string',
            },
            {
                name: 'setPriority',
                description: '设置线程优先级\n@param priority 线程优先级（1-10），数字越大优先级越高',
                params: [
                    { name: 'priority', type: 'number' },
                ],
                returns: 'void',
            },
            {
                name: 'getPriority',
                description: '获取线程优先级\n@returns 线程优先级（1-10）',
                params: [],
                returns: 'number',
            },
            {
                name: 'getThread',
                description: '获取底层的Java Thread对象（通常不需要使用）\n@returns Java Thread对象',
                params: [],
                returns: 'any',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
        typeOnly: true,
    },
    'Threads': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'create',
                description: '创建一个新线程并执行指定的任务\n@param runnable 要执行的任务，可以是函数或包含run方法的对象\n@returns 返回ThreadWrapper对象，用于管理创建的线程',
                params: [
                    { name: 'runnable', type: '(() => void) | { run: () => void }' },
                ],
                returns: 'ThreadWrapper',
            },
            {
                name: 'sleep',
                description: '休眠当前线程指定的毫秒数\n@param millis 休眠的毫秒数\n@throws InterruptedException 如果线程在休眠时被中断',
                params: [
                    { name: 'millis', type: 'number' },
                ],
                returns: 'void',
            },
            {
                name: 'yield',
                description: '让出当前线程的CPU时间片，允许其他线程执行',
                params: [],
                returns: 'void',
            },
            {
                name: 'currentThread',
                description: '获取当前线程的ThreadWrapper对象\n@returns 当前线程的ThreadWrapper对象',
                params: [],
                returns: 'ThreadWrapper',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
    },
    'UiObject': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'click',
                description: '点击控件',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'longClick',
                description: '长按控件',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'scrollForward',
                description: '向前滚动控件（手指向下或者向右移动）',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'scrollBackward',
                description: '向后滚动控件（手指往上或者往左移动）',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'setSelection',
                description: '选中文本\n@param start 起始位置 \n@param end  结束位置',
                params: [
                    { name: 'start', type: 'number' },
                    { name: 'end', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'copy',
                description: '复制控制内容，结合setSelection使用',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'cut',
                description: '剪切控件内容，结合setSelection使用',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'paste',
                description: '粘贴内容到文本框',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'focus',
                description: '让控件获取焦点',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'setText',
                description: '给文本框输入内容\n@param text 文本内容',
                params: [
                    { name: 'text', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'find',
                description: '在当前控件或者所有子控件中查找某些控件\n如果使用了children() 方法，则只搜索子控件\n@param obj 搜索条件',
                params: [
                    { name: 'obj', type: 'UiSelector' },
                ],
                returns: 'UiObject[]',
            },
            {
                name: 'findOne',
                description: '在当前控件或者所有子控件中查找某个控件\n如果使用了children() 方法，则只搜索子控件\n@param obj 搜索条件',
                params: [
                    { name: 'obj', type: 'UiSelector' },
                ],
                returns: 'UiObject',
            },
            {
                name: 'bounds',
                description: '获取控件的位置',
                params: [],
                returns: 'Rect',
            },
            {
                name: 'text',
                description: '获取控件的文本内容',
                params: [],
                returns: 'string',
            },
            {
                name: 'desc',
                description: '获取控件的描述内容',
                params: [],
                returns: 'string',
            },
            {
                name: 'id',
                description: '获取控件的id',
                params: [],
                returns: 'string',
            },
            {
                name: 'children',
                description: '获取当前控件的子控件',
                params: [],
                returns: 'this',
            },
            {
                name: 'length',
                description: '获取当前控件的子控件数量，必须在children() 方法之后调用',
                params: [],
                returns: 'number',
            },
            {
                name: 'getChildCount',
                description: '获取子控件数量',
                params: [],
                returns: 'number',
            },
            {
                name: 'getChildren',
                description: '获取子控件',
                params: [
                    { name: 'index', type: 'any' },
                ],
                returns: 'UiObject',
            },
            {
                name: 'parent',
                description: '获取父控件',
                params: [],
                returns: 'UiObject',
            },
            {
                name: 'getDrawingOrder',
                description: '获取控件的绘制顺序',
                params: [],
                returns: 'number',
            },
            {
                name: 'isSelected',
                description: '判断控件是否被选中',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'isClickable',
                description: '判断控件是否可以点击',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'isLongClickable',
                description: '判断控件是否可以长按',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'isCheckable',
                description: '判断控件是否可以选中',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'isChecked',
                description: '判断控件是否被选中',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'isEnabled',
                description: '判断控件是否可用',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'isFocusable',
                description: '判断控件是否获得焦点',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'isFocused',
                description: '获取控件是否获得焦点',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'isScrollable',
                description: '判断控件是否可以滚动',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'isVisibleToUser',
                description: '判断控件是否对用户可见',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'isEditable',
                description: '判断控件是否可以编辑',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'isPassword',
                description: '判断控件是否是密码控件',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'className',
                description: '获取控件的className',
                params: [],
                returns: 'string',
            },
            {
                name: 'getPackageName',
                description: '获取控件的包名',
                params: [],
                returns: 'string',
            },
            {
                name: 'getHintText',
                description: '获取控件的提示文本',
                params: [],
                returns: 'string',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
        typeOnly: true,
    },
    'UiSelector': {
        kind: 'class',
        description: '控件选择器',
        methods: [
            {
                name: 'setLevel',
                description: '',
                params: [
                    { name: 'level', type: 'number' },
                ],
                returns: 'UiSelector',
            },
            {
                name: 'getLevel',
                description: '',
                params: [],
                returns: 'number',
            },
            {
                name: 'UiSelector',
                description: '',
                params: [],
                returns: 'void',
            },
            {
                name: 'UiSelector',
                description: '',
                params: [],
                returns: 'void',
            },
            {
                name: 'UiSelector',
                description: '',
                params: [],
                returns: 'void',
            },
            {
                name: 'text',
                description: '@param text 控件文本',
                params: [
                    { name: 'text', type: 'string' },
                ],
                returns: 'UiSelector',
            },
            {
                name: 'textContains',
                description: '@param text 模糊匹配文本控件',
                params: [
                    { name: 'text', type: 'string' },
                ],
                returns: 'UiSelector',
            },
            {
                name: 'textMatches',
                description: '@param text 正则匹配文本控件',
                params: [
                    { name: 'text', type: 'string' },
                ],
                returns: 'UiSelector',
            },
            {
                name: 'textStartsWith',
                description: '',
                params: [
                    { name: 'text', type: 'string' },
                ],
                returns: 'UiSelector',
            },
            {
                name: 'textEndsWith',
                description: '',
                params: [
                    { name: 'text', type: 'string' },
                ],
                returns: 'UiSelector',
            },
            {
                name: 'desc',
                description: '@param desc 控件描述内容',
                params: [
                    { name: 'desc', type: 'string' },
                ],
                returns: 'UiSelector',
            },
            {
                name: 'descContains',
                description: '@param desc 模糊匹配描述控件',
                params: [
                    { name: 'desc', type: 'string' },
                ],
                returns: 'UiSelector',
            },
            {
                name: 'descMatches',
                description: '@param desc 正则表达式匹配描述控件',
                params: [
                    { name: 'desc', type: 'string' },
                ],
                returns: 'UiSelector',
            },
            {
                name: 'descStartsWith',
                description: '',
                params: [
                    { name: 'desc', type: 'string' },
                ],
                returns: 'UiSelector',
            },
            {
                name: 'descEndsWith',
                description: '',
                params: [
                    { name: 'desc', type: 'string' },
                ],
                returns: 'UiSelector',
            },
            {
                name: 'className',
                description: '@param className 控件类名',
                params: [
                    { name: 'className', type: 'string' },
                ],
                returns: 'UiSelector',
            },
            {
                name: 'classNameMatches',
                description: '',
                params: [
                    { name: 'className', type: 'string' },
                ],
                returns: 'UiSelector',
            },
            {
                name: 'packageName',
                description: '',
                params: [
                    { name: 'packageName', type: 'string' },
                ],
                returns: 'UiSelector',
            },
            {
                name: 'packageNameMatches',
                description: '',
                params: [
                    { name: 'packageName', type: 'string' },
                ],
                returns: 'UiSelector',
            },
            {
                name: 'id',
                description: '@param id 控件ID',
                params: [
                    { name: 'id', type: 'string' },
                ],
                returns: 'UiSelector',
            },
            {
                name: 'bounds',
                description: '@param left 左边距 整数\n@param top  上边距  整数\n@param right 右边距  整数\n@param bottom 下边距  整数',
                params: [
                    { name: 'left', type: 'number' },
                    { name: 'top', type: 'number' },
                    { name: 'right', type: 'number' },
                    { name: 'bottom', type: 'number' },
                ],
                returns: 'UiSelector',
            },
            {
                name: 'clickable',
                description: '@param bool 是否可以点击',
                params: [
                    { name: 'bool', type: 'boolean' },
                ],
                returns: 'UiSelector',
            },
            {
                name: 'checked',
                description: '@param bool 是否选中',
                params: [
                    { name: 'bool', type: 'boolean' },
                ],
                returns: 'UiSelector',
            },
            {
                name: 'selected',
                description: '@param bool 是否被选择',
                params: [
                    { name: 'bool', type: 'boolean' },
                ],
                returns: 'UiSelector',
            },
            {
                name: 'enabled',
                description: '@param bool 是否可用，为false时，用户无法通过点击、输入等方式与该控件交互',
                params: [
                    { name: 'bool', type: 'boolean' },
                ],
                returns: 'UiSelector',
            },
            {
                name: 'checked',
                description: '@param bool 是否已被勾选',
                params: [
                    { name: 'bool', type: 'boolean' },
                ],
                returns: 'UiSelector',
            },
            {
                name: 'scrollable',
                description: '@param bool 是否可以滚动',
                params: [
                    { name: 'bool', type: 'boolean' },
                ],
                returns: 'UiSelector',
            },
            {
                name: 'checkable',
                description: '@param bool 是否可以勾选',
                params: [
                    { name: 'bool', type: 'boolean' },
                ],
                returns: 'UiSelector',
            },
            {
                name: 'focusable',
                description: '@param bool 是否可以聚焦',
                params: [
                    { name: 'bool', type: 'boolean' },
                ],
                returns: 'UiSelector',
            },
            {
                name: 'focused',
                description: '@param bool 是否已聚焦',
                params: [
                    { name: 'bool', type: 'boolean' },
                ],
                returns: 'UiSelector',
            },
            {
                name: 'editable',
                description: '@param bool 是否可编辑',
                params: [
                    { name: 'bool', type: 'boolean' },
                ],
                returns: 'UiSelector',
            },
            {
                name: 'isVisibleToUser',
                description: '@param bool 是否可见',
                params: [
                    { name: 'bool', type: 'boolean' },
                ],
                returns: 'UiSelector',
            },
            {
                name: 'filter',
                description: '@param filter 过滤控件，回调函数，返回true表示符合条件，返回false表示不符合条件',
                params: [
                    { name: 'filter', type: '(v: UiObject) => boolean' },
                ],
                returns: 'UiSelector',
            },
            {
                name: 'exists',
                description: '判断节点是否存在，底层使用的findOne方法',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'waitFindOne',
                description: '等待节点出现，一直阻塞直到找到节点',
                params: [],
                returns: 'UiObject',
            },
            {
                name: 'find',
                description: '查找所有符合条件的控件',
                params: [],
                returns: 'UiObject[]',
            },
            {
                name: 'findBy',
                description: '在当前的所有控件对象中查找所有符合某个控件选择器的控件\n@param obj 控件选择器',
                params: [
                    { name: 'obj', type: 'UiSelector' },
                ],
                returns: 'UiObject[]',
            },
            {
                name: 'findBy',
                description: '查找某个控件选择器，在timeout时间内，如果找不到，则返回null；如果找到立马返回\n@param timeout 查找时间（毫秒数）',
                params: [
                    { name: 'timeout', type: 'number' },
                ],
                returns: 'UiObject[]',
            },
            {
                name: 'findOne',
                description: '返回一个符合当前选择器条件的控件',
                params: [],
                returns: 'UiObject',
            },
            {
                name: 'findOnce',
                description: '返回一个符合当前选择器条件的控件',
                params: [],
                returns: 'UiObject',
            },
            {
                name: 'findOneBy',
                description: '返回一个符合当前控件选择的控件\n@param obj 控件选择器',
                params: [
                    { name: 'obj', type: 'UiSelector' },
                ],
                returns: 'UiObject',
            },
            {
                name: 'findOneBy',
                description: '查找某个控件选择器，在timeout时间内，如果找不到，则返回null；如果找到立马返回\n@param timeout 查找时间（毫秒数）',
                params: [
                    { name: 'timeout', type: 'number' },
                ],
                returns: 'UiObject',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [
            { name: 'simpleMode', type: 'boolean', optional: true },
        ],
        funcReturns: 'UiSelector',
    },
    'WebSocket': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'closeAll',
                description: '',
                params: [],
                returns: 'void',
            },
        ],
        properties: [],
        constructorParams: [
            { name: 'url', type: 'string' },
        ],
        funcParams: [],
        funcReturns: '',
    },
    'access': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'isAccessibilityServiceEnabled',
                description: '是否开启了无障碍权限',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'isFloatWindowsEnabled',
                description: '是否开启了悬浮窗权限',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'isBackgroundAlertEnabled',
                description: '是否开启了后台弹窗权限',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'isMediaProjectionEnable',
                description: '是否开启了截图录屏权限',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'openAccessibilityServiceSetting',
                description: '开启了无障碍权限设置界面',
                params: [],
                returns: 'void',
            },
            {
                name: 'openFloatWindowsSetting',
                description: '开启了悬浮窗权限设置界面',
                params: [],
                returns: 'void',
            },
            {
                name: 'openBackgroundAlertSetting',
                description: '开启了后台弹窗权限设置界面',
                params: [],
                returns: 'void',
            },
            {
                name: 'openMediaProjectionSetting',
                description: '开启了截图录屏权限设置界面',
                params: [],
                returns: 'void',
            },
            {
                name: 'requestNotificationAccess',
                description: '进入通知权限设置界面（用户可以开启通知权限）',
                params: [],
                returns: 'void',
            },
            {
                name: 'hasNotificationAccess',
                description: '是否开启读取通知权限',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'hasMediaReadPermission',
                description: '检查是否有媒体库读取权限（图片、视频）\n@return true 如果有权限',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'requestMediaPermissions',
                description: '申请媒体库权限（统一接口，自动处理各Android版本差异）\n\n权限说明：\n- Android 13+: 请求 READ_MEDIA_IMAGES 和 READ_MEDIA_VIDEO\n- Android 10-12: 请求 READ_EXTERNAL_STORAGE\n- Android 9-: 请求 READ_EXTERNAL_STORAGE 和 WRITE_EXTERNAL_STORAGE\n\n注意：这是异步操作，不会阻塞',
                params: [],
                returns: 'void',
            },
            {
                name: 'openPermissionSettings',
                description: '打开应用权限设置页面',
                params: [],
                returns: 'void',
            },
            {
                name: 'isMediaPermissionPermanentlyDenied',
                description: '检查媒体权限是否被永久拒绝（用户选择了"不再询问"）\n\n如果返回true，说明用户之前拒绝过权限并选择了"不再询问"，\n系统不会再弹出权限对话框，需要引导用户去设置页面手动开启\n\n@return true 如果权限被永久拒绝',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'hasStoragePermission',
                description: '检查是否有文件存储权限（适配Android 8及以上版本）\n\n权限说明：\n- Android 11+: 检查 MANAGE_EXTERNAL_STORAGE 权限（需要用户手动在设置中开启）\n- Android 8-10: 检查 READ_EXTERNAL_STORAGE 和 WRITE_EXTERNAL_STORAGE 权限\n\n@return true 如果有权限',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'requestStoragePermission',
                description: '申请文件存储权限（适配Android 8及以上版本）\n\n权限说明：\n- Android 11+: 引导用户去设置页面手动开启 MANAGE_EXTERNAL_STORAGE 权限\n- Android 8-10: 请求 READ_EXTERNAL_STORAGE 和 WRITE_EXTERNAL_STORAGE 权限\n\n注意：这是异步操作，不会阻塞\n如果用户禁用了权限，需要调用 isStoragePermissionPermanentlyDenied() 检查是否被永久拒绝',
                params: [],
                returns: 'void',
            },
            {
                name: 'isStoragePermissionPermanentlyDenied',
                description: '检查文件存储权限是否被永久拒绝（用户选择了"不再询问"或禁用了权限）\n\n权限说明：\n- Android 11+: 检查 MANAGE_EXTERNAL_STORAGE 权限状态\n- Android 8-10: 检查 READ_EXTERNAL_STORAGE 和 WRITE_EXTERNAL_STORAGE 是否被永久拒绝\n\n如果返回true，说明用户之前拒绝过权限并选择了"不再询问"，\n或者用户禁用了权限，系统不会再弹出权限对话框，需要引导用户去设置页面手动开启\n\n@return true 如果权限被永久拒绝或禁用',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'hasLocationPermission',
                description: '检查是否有位置权限\n\n权限说明：\n- 检查 ACCESS_FINE_LOCATION（精确定位）或 ACCESS_COARSE_LOCATION（粗略定位）权限\n- 如果授予了 ACCESS_FINE_LOCATION，则自动拥有 ACCESS_COARSE_LOCATION 权限\n\n@return true 如果有权限',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'requestLocationPermissions',
                description: '申请位置权限\n\n权限说明：\n- 优先请求 ACCESS_FINE_LOCATION（精确定位）\n- 如果用户拒绝了精确定位，系统可能降级为 ACCESS_COARSE_LOCATION（粗略定位）\n\n注意：这是异步操作，不会阻塞\n如果用户禁用了权限，需要调用 isLocationPermissionPermanentlyDenied() 检查是否被永久拒绝',
                params: [],
                returns: 'void',
            },
            {
                name: 'isLocationPermissionPermanentlyDenied',
                description: '检查位置权限是否被永久拒绝（用户选择了"不再询问"）\n\n如果返回true，说明用户之前拒绝过权限并选择了"不再询问"，\n系统不会再弹出权限对话框，需要引导用户去设置页面手动开启\n\n@return true 如果权限被永久拒绝',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'hasBluetoothConnectionPermission',
                description: '检查是否有蓝牙连接权限（Android 12+ 需要 BLUETOOTH_CONNECT）\nAndroid 12 以下始终返回 true',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'requestBluetoothConnectionPermission',
                description: '申请蓝牙连接权限（BLUETOOTH_CONNECT + BLUETOOTH_SCAN）\nAndroid 12 以下无需申请\n注意：这是异步操作',
                params: [],
                returns: 'void',
            },
            {
                name: 'isBluetoothPermissionPermanentlyDenied',
                description: '检查蓝牙权限是否被永久拒绝（用户选择了"不再询问"）\n\n如果返回true，需要引导用户去设置页面手动开启',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'openBluetoothPermissionSettings',
                description: '打开蓝牙权限设置页面（跳转到应用详情设置页）',
                params: [],
                returns: 'void',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
        typeOnly: true,
    },
    'console': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'log',
                description: '记录普通日志信息\n@param message 要记录的消息',
                params: [
                    { name: 'message', type: 'any[]', rest: true },
                ],
                returns: 'void',
            },
            {
                name: 'warn',
                description: '记录警告信息\n@param message 要记录的警告消息',
                params: [
                    { name: 'message', type: 'any[]', rest: true },
                ],
                returns: 'void',
            },
            {
                name: 'error',
                description: '记录错误信息\n@param message 要记录的错误消息',
                params: [
                    { name: 'message', type: 'any[]', rest: true },
                ],
                returns: 'void',
            },
            {
                name: 'info',
                description: '记录信息，通常用于调试目的\n@param message 要记录的信息',
                params: [
                    { name: 'message', type: 'any[]', rest: true },
                ],
                returns: 'void',
            },
            {
                name: 'debug',
                description: '记录调试信息\n@param message 要记录的调试信息',
                params: [
                    { name: 'message', type: 'any[]', rest: true },
                ],
                returns: 'void',
            },
            {
                name: 'trace',
                description: '打印堆栈追踪\n@param message 堆栈追踪信息',
                params: [
                    { name: 'message', type: 'any[]', rest: true },
                ],
                returns: 'void',
            },
            {
                name: 'show',
                description: '显示日志窗口',
                params: [],
                returns: 'void',
            },
            {
                name: 'hide',
                description: '隐藏日志窗口',
                params: [],
                returns: 'void',
            },
            {
                name: 'setWindowSize',
                description: '设置日志窗口的大小\n@param width 窗口宽度（像素）\n@param height 窗口高度（像素）',
                params: [
                    { name: 'width', type: 'number' },
                    { name: 'height', type: 'number' },
                ],
                returns: 'void',
            },
            {
                name: 'setWindowPosition',
                description: '设置日志窗口的位置\n@param x 窗口左上角X坐标（像素）\n@param y 窗口左上角Y坐标（像素）',
                params: [
                    { name: 'x', type: 'number' },
                    { name: 'y', type: 'number' },
                ],
                returns: 'void',
            },
            {
                name: 'setBackgroundColor',
                description: '设置日志窗口的背景颜色\n@param color 颜色值（ARGB格式，如 0xFF000000 表示黑色）',
                params: [
                    { name: 'color', type: 'number' },
                ],
                returns: 'void',
            },
            {
                name: 'setTextColor',
                description: '设置日志文本的颜色\n@param color 颜色值（ARGB格式，如 0xFFFFFFFF 表示白色）',
                params: [
                    { name: 'color', type: 'number' },
                ],
                returns: 'void',
            },
            {
                name: 'setTextSize',
                description: '设置日志文本的字体大小\n@param size 字体大小（像素）',
                params: [
                    { name: 'size', type: 'number' },
                ],
                returns: 'void',
            },
            {
                name: 'setLineHeight',
                description: '设置日志文本的行高\n@param lineHeight 行高（像素）',
                params: [
                    { name: 'lineHeight', type: 'number' },
                ],
                returns: 'void',
            },
            {
                name: 'setButtonColors',
                description: '一次性设置两个按钮的颜色（关闭按钮、调整大小按钮）\n@param closeColor 关闭按钮颜色（ARGB格式）\n@param resizeColor 调整大小按钮颜色（ARGB格式）',
                params: [
                    { name: 'closeColor', type: 'number' },
                    { name: 'resizeColor', type: 'number' },
                ],
                returns: 'void',
            },
            {
                name: 'setTitleTextColor',
                description: '设置标题栏文字的颜色\n@param color 颜色值（ARGB格式，如 0xFFFFFFFF 表示白色）',
                params: [
                    { name: 'color', type: 'number' },
                ],
                returns: 'void',
            },
            {
                name: 'setTitleTextSize',
                description: '设置标题栏文字的字体大小\n@param size 字体大小（sp）',
                params: [
                    { name: 'size', type: 'number' },
                ],
                returns: 'void',
            },
            {
                name: 'setTitleText',
                description: '设置标题栏的文字内容\n@param text 标题文字内容。如果传入 null 或空字符串，将使用应用名称作为默认标题',
                params: [
                    { name: 'text', type: 'string | null' },
                ],
                returns: 'void',
            },
            {
                name: 'setTitleBarColor',
                description: '设置标题栏的背景颜色\n@param color 颜色值（ARGB格式，-1表示自动计算，比背景色深20%）',
                params: [
                    { name: 'color', type: 'number' },
                ],
                returns: 'void',
            },
            {
                name: 'setAllowMoveToTop',
                description: '设置是否允许窗口移动到顶部\n@param allow 是否允许移动到顶部',
                params: [
                    { name: 'allow', type: 'boolean' },
                ],
                returns: 'void',
            },
            {
                name: 'setAllowMoveToBottom',
                description: '设置是否允许窗口移动到底部\n@param allow 是否允许移动到底部',
                params: [
                    { name: 'allow', type: 'boolean' },
                ],
                returns: 'void',
            },
            {
                name: 'setClickable',
                description: '设置日志窗口是否可点击（穿透）\n@param clickable 是否可点击',
                params: [
                    { name: 'clickable', type: 'boolean' },
                ],
                returns: 'void',
            },
            {
                name: 'isClickable',
                description: '检查日志窗口是否可点击\n@returns 是否可点击',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'clearLogs',
                description: '清空日志窗口中的所有日志',
                params: [],
                returns: 'void',
            },
            {
                name: 'setMaxLogLines',
                description: '设置日志窗口显示的最大行数。超过此数量的旧日志会被自动删除。\n@param maxLines 最大行数',
                params: [
                    { name: 'maxLines', type: 'number' },
                ],
                returns: 'void',
            },
            {
                name: 'getMaxLogLines',
                description: '获取日志窗口显示的最大行数\n@returns 最大行数',
                params: [],
                returns: 'number',
            },
            {
                name: 'setAutoScroll',
                description: '设置是否自动滚动到底部（当有新日志时）\n@param autoScroll 是否自动滚动',
                params: [
                    { name: 'autoScroll', type: 'boolean' },
                ],
                returns: 'void',
            },
            {
                name: 'setWindowStyle',
                description: '一次性设置日志窗口的多个样式属性\n@param config 配置对象',
                params: [
                    { name: 'config', type: '{\n        width?: number;\n        height?: number;\n        x?: number;\n        y?: number;\n        backgroundColor?: number;\n        textColor?: number;\n        textSize?: number;\n        lineHeight?: number;\n        closeButtonColor?: number;\n        resizeButtonColor?: number;\n        titleTextColor?: number;\n        titleTextSize?: number;\n        titleText?: string | null;\n        titleBarColor?: number;\n        allowMoveToTop?: boolean;\n        allowMoveToBottom?: boolean;\n        clickable?: boolean;\n    }' },
                ],
                returns: 'void',
            },
            {
                name: 'getWindowStyle',
                description: '获取当前日志窗口的样式配置\n@returns 包含所有样式配置的对象',
                params: [],
                returns: '{\n        width: number;\n        height: number;\n        x: number;\n        y: number;\n        backgroundColor: number;\n        textColor: number;\n        textSize: number;\n        lineHeight: number;\n        closeButtonColor: number;\n        resizeButtonColor: number;\n        titleTextColor: number;\n        titleTextSize: number;\n        titleText: string;\n        titleBarColor: number;\n        allowMoveToTop: boolean;\n        allowMoveToBottom: boolean;\n        clickable: boolean;\n    }',
            },
        ],
        properties: [
            { name: 'width', type: 'number', description: '' },
            { name: 'height', type: 'number', description: '' },
            { name: 'x', type: 'number', description: '' },
            { name: 'y', type: 'number', description: '' },
            { name: 'backgroundColor', type: 'number', description: '' },
            { name: 'textColor', type: 'number', description: '' },
            { name: 'textSize', type: 'number', description: '' },
            { name: 'lineHeight', type: 'number', description: '' },
            { name: 'closeButtonColor', type: 'number', description: '' },
            { name: 'resizeButtonColor', type: 'number', description: '' },
            { name: 'titleTextColor', type: 'number', description: '' },
            { name: 'titleTextSize', type: 'number', description: '' },
            { name: 'titleText', type: 'string', description: '' },
            { name: 'titleBarColor', type: 'number', description: '' },
            { name: 'allowMoveToTop', type: 'boolean', description: '' },
            { name: 'allowMoveToBottom', type: 'boolean', description: '' },
            { name: 'clickable', type: 'boolean', description: '' },
        ],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
    },
    'files': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'read',
                description: '读取文件内容\n@param path 文件路径\n@return 文件内容，如果失败返回null',
                params: [
                    { name: 'path', type: 'string' },
                ],
                returns: 'string | null',
            },
            {
                name: 'write',
                description: '写入内容到文件\n@param path 文件路径\n@param content 要写入的内容\n@return 成功返回true，失败返回false',
                params: [
                    { name: 'path', type: 'string' },
                    { name: 'content', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'append',
                description: '追加内容到文件\n@param path 文件路径\n@param content 要追加的内容\n@return 成功返回true，失败返回false',
                params: [
                    { name: 'path', type: 'string' },
                    { name: 'content', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'delete',
                description: '删除文件或目录\n@param path 文件或目录路径\n@return 成功返回true，失败返回false',
                params: [
                    { name: 'path', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'exists',
                description: '检查文件或目录是否存在\n@param path 文件或目录路径\n@return 存在返回true，不存在返回false',
                params: [
                    { name: 'path', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'mkdirs',
                description: '创建目录（包括父目录）\n@param path 目录路径\n@return 成功返回true，失败返回false',
                params: [
                    { name: 'path', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'list',
                description: '列出目录中的文件\n@param path 目录路径\n@return 文件名数组',
                params: [
                    { name: 'path', type: 'string' },
                ],
                returns: 'string[]',
            },
            {
                name: 'listFiles',
                description: '列出目录中的文件（包含完整路径）\n@param path 目录路径\n@return 文件完整路径数组',
                params: [
                    { name: 'path', type: 'string' },
                ],
                returns: 'string[]',
            },
            {
                name: 'copy',
                description: '复制文件\n@param source 源文件路径\n@param destination 目标文件路径\n@return 成功返回true，失败返回false',
                params: [
                    { name: 'source', type: 'string' },
                    { name: 'destination', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'move',
                description: '移动文件\n@param source 源文件路径\n@param destination 目标文件路径\n@return 成功返回true，失败返回false',
                params: [
                    { name: 'source', type: 'string' },
                    { name: 'destination', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'size',
                description: '获取文件大小（字节）\n@param path 文件路径\n@return 文件大小（字节），如果文件不存在或为目录返回-1',
                params: [
                    { name: 'path', type: 'string' },
                ],
                returns: 'number',
            },
            {
                name: 'isDirectory',
                description: '检查路径是否为目录\n@param path 路径\n@return 是目录返回true，否则返回false',
                params: [
                    { name: 'path', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'isFile',
                description: '检查路径是否为文件\n@param path 路径\n@return 是文件返回true，否则返回false',
                params: [
                    { name: 'path', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'getName',
                description: '获取文件名\n@param path 文件路径\n@return 文件名',
                params: [
                    { name: 'path', type: 'string' },
                ],
                returns: 'string',
            },
            {
                name: 'getParent',
                description: '获取父目录路径\n@param path 文件路径\n@return 父目录路径',
                params: [
                    { name: 'path', type: 'string' },
                ],
                returns: 'string',
            },
            {
                name: 'getAbsolutePath',
                description: '获取绝对路径\n@param path 文件路径\n@return 绝对路径',
                params: [
                    { name: 'path', type: 'string' },
                ],
                returns: 'string',
            },
            {
                name: 'rename',
                description: '重命名文件或目录\n@param oldPath 旧路径\n@param newPath 新路径\n@return 成功返回true，失败返回false',
                params: [
                    { name: 'oldPath', type: 'string' },
                    { name: 'newPath', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'lastModified',
                description: '获取最后修改时间\n@param path 文件路径\n@return 最后修改时间（毫秒），如果文件不存在返回-1',
                params: [
                    { name: 'path', type: 'string' },
                ],
                returns: 'number',
            },
            {
                name: 'readUri',
                description: '从URI读取内容（支持content://和file://等URI）\n@param uriString URI字符串\n@return 内容，如果失败返回null',
                params: [
                    { name: 'uriString', type: 'string' },
                ],
                returns: 'string | null',
            },
            {
                name: 'readBytesFromUri',
                description: '从URI读取字节数组（支持content://和file://等URI，用于读取图片等二进制文件）\n@param uriString URI字符串\n@return 字节数组，如果失败返回null',
                params: [
                    { name: 'uriString', type: 'string' },
                ],
                returns: 'number[] | null',
            },
            {
                name: 'getPathFromUri',
                description: '从content URI获取真实文件路径\n@param uriString content URI字符串\n@return 真实文件路径，如果失败返回null',
                params: [
                    { name: 'uriString', type: 'string' },
                ],
                returns: 'string | null',
            },
            {
                name: 'readBytes',
                description: '从文件读取字节数组\n@param path 文件路径\n@return 字节数组，如果失败返回null',
                params: [
                    { name: 'path', type: 'string' },
                ],
                returns: 'number[] | null',
            },
            {
                name: 'writeBytes',
                description: '写入字节数组到文件\n@param path 文件路径\n@param bytes 要写入的字节数组\n@return 成功返回true，失败返回false',
                params: [
                    { name: 'path', type: 'string' },
                    { name: 'bytes', type: 'number[]' },
                ],
                returns: 'boolean',
            },
            {
                name: 'copyFromUri',
                description: '从URI复制文件到目标路径\n@param uriString 源URI字符串\n@param destination 目标文件路径\n@return 成功返回true，失败返回false',
                params: [
                    { name: 'uriString', type: 'string' },
                    { name: 'destination', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'getExternalStoragePath',
                description: '获取外部存储根目录路径\n@return 外部存储路径',
                params: [],
                returns: 'string',
            },
            {
                name: 'getFilesPath',
                description: '获取应用私有文件目录路径\n@return 文件目录路径',
                params: [],
                returns: 'string',
            },
            {
                name: 'getCachePath',
                description: '获取应用缓存目录路径\n@return 缓存目录路径',
                params: [],
                returns: 'string',
            },
            {
                name: 'getExternalFilesPath',
                description: '获取应用外部私有文件目录路径\n@param type 文件目录类型（如"Pictures"、"Documents"），null表示根目录\n@return 外部文件目录路径',
                params: [
                    { name: 'type', type: 'string | null' },
                ],
                returns: 'string',
            },
            {
                name: 'getExternalFilesPath',
                description: '获取应用外部私有文件根目录路径\n@return 外部文件目录路径',
                params: [],
                returns: 'string',
            },
            {
                name: 'getDownloadPath',
                description: '获取Download目录路径\n@return Download目录路径',
                params: [],
                returns: 'string',
            },
            {
                name: 'getPicturesPath',
                description: '获取Pictures目录路径\n@return Pictures目录路径',
                params: [],
                returns: 'string',
            },
            {
                name: 'getDCIMPath',
                description: '获取DCIM目录路径\n@return DCIM目录路径',
                params: [],
                returns: 'string',
            },
            {
                name: 'getMoviesPath',
                description: '获取Movies目录路径\n@return Movies目录路径',
                params: [],
                returns: 'string',
            },
            {
                name: 'getMusicPath',
                description: '获取Music目录路径\n@return Music目录路径',
                params: [],
                returns: 'string',
            },
            {
                name: 'getDocumentsPath',
                description: '获取Documents目录路径\n@return Documents目录路径',
                params: [],
                returns: 'string',
            },
            {
                name: 'readAsset',
                description: '从assets读取文件\n@param fileName assets目录中的文件名\n@return 文件内容，如果失败返回null',
                params: [
                    { name: 'fileName', type: 'string' },
                ],
                returns: 'string | null',
            },
            {
                name: 'isExternalStorageWritable',
                description: '检查外部存储是否可用且可写\n@return 可用且可写返回true，否则返回false',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'isExternalStorageReadable',
                description: '检查外部存储是否可读\n@return 可读返回true，否则返回false',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'getExtension',
                description: '获取文件扩展名\n@param path 文件路径\n@return 文件扩展名（不含点），如果没有扩展名返回空字符串',
                params: [
                    { name: 'path', type: 'string' },
                ],
                returns: 'string',
            },
            {
                name: 'getNameWithoutExtension',
                description: '获取不带扩展名的文件名\n@param path 文件路径\n@return 不带扩展名的文件名',
                params: [
                    { name: 'path', type: 'string' },
                ],
                returns: 'string',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
        typeOnly: true,
    },
    'foregroundServiceBridge': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'startService',
                description: '开启前台服务',
                params: [],
                returns: 'void',
            },
            {
                name: 'register',
                description: '注册执行的方法（启动服务前设置）\n@param register 注册监听',
                params: [
                    { name: 'func', type: 'Function' },
                ],
                returns: 'void',
            },
            {
                name: 'setContent',
                description: '前台服务标题和内容设置（启动服务前设置）\n@param title 前台服务标题\n@param content 前台服务内容',
                params: [
                    { name: 'title', type: 'string' },
                    { name: 'content', type: 'string' },
                ],
                returns: 'void',
            },
            {
                name: 'stopService',
                description: '关闭服务',
                params: [],
                returns: 'void',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
        typeOnly: true,
    },
    'hid': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'swipe',
                description: '模拟从一个点滑动到另一个点。\n@param x1 起始点X坐标\n@param y1 起始点Y坐标\n@param x2 终点X坐标\n@param y2 终点Y坐标\n@param step 每步移动距离（5-60，默认随机20-51）\n@param downTimeout 按下后等待时间（默认随机100-180ms）\n@param upTimeout 滑动结束后等待抬起时间（默认随机100-180ms）\n@param timeout 每步之间的延迟时间（默认随机8-15ms）\n@param upDownTimes 抬起次数（默认1）\n@returns 是否滑动成功',
                params: [
                    { name: 'x1', type: 'number' },
                    { name: 'y1', type: 'number' },
                    { name: 'x2', type: 'number' },
                    { name: 'y2', type: 'number' },
                    { name: 'step', type: 'number', optional: true },
                    { name: 'downTimeout', type: 'number', optional: true },
                    { name: 'upTimeout', type: 'number', optional: true },
                    { name: 'timeout', type: 'number', optional: true },
                    { name: 'upDownTimes', type: 'number', optional: true },
                ],
                returns: 'boolean',
            },
            {
                name: 'swipex',
                description: '使用仿真曲线滑动。\n@param x1 起始点X坐标\n@param y1 起始点Y坐标\n@param x2 终点X坐标\n@param y2 终点Y坐标\n@param radian 弧度大小（默认10-100）\n@param step 每步移动距离（5-60，默认随机20-51）\n@param downTimeout 按下后等待时间（默认随机100-180ms）\n@param upTimeout 滑动结束后等待抬起时间（默认随机100-180ms）\n@param timeout 每步之间的延迟时间（默认随机8-15ms）\n@param upDownTimes 抬起次数（默认1）\n@returns 是否滑动成功',
                params: [
                    { name: 'x1', type: 'number' },
                    { name: 'y1', type: 'number' },
                    { name: 'x2', type: 'number' },
                    { name: 'y2', type: 'number' },
                    { name: 'radian', type: 'number', optional: true },
                    { name: 'step', type: 'number', optional: true },
                    { name: 'downTimeout', type: 'number', optional: true },
                    { name: 'upTimeout', type: 'number', optional: true },
                    { name: 'timeout', type: 'number', optional: true },
                    { name: 'upDownTimes', type: 'number', optional: true },
                ],
                returns: 'boolean',
            },
            {
                name: 'getHidZcm',
                description: '获取服务器HID激活码。\n@returns 激活码字符串\n@throws Error 当蓝牙未初始化时',
                params: [],
                returns: 'string',
            },
            {
                name: 'ver',
                description: '获取插件版本号。\n@returns 插件版本号',
                params: [],
                returns: 'number',
            },
            {
                name: 'home',
                description: '模拟按下Home键。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'recents',
                description: '模拟按下任务键。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'back',
                description: '模拟按下返回键。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'back1',
                description: '使用另一种方式模拟按下返回键。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'touchDown',
                description: '模拟手指按下事件。\n@param x X坐标\n@param y Y坐标\n@returns 是否成功',
                params: [
                    { name: 'x', type: 'number' },
                    { name: 'y', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'touchMove',
                description: '模拟手指移动事件。\n@param x X坐标\n@param y Y坐标\n@returns 是否成功',
                params: [
                    { name: 'x', type: 'number' },
                    { name: 'y', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'touchUp',
                description: '模拟手指抬起事件。\n@param x X坐标\n@param y Y坐标\n@returns 是否成功',
                params: [
                    { name: 'x', type: 'number', optional: true },
                    { name: 'y', type: 'number', optional: true },
                ],
                returns: 'boolean',
            },
            {
                name: 'touchUp2',
                description: '模拟手指多次抬起事件。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'tap',
                description: '模拟点击事件。\n@param x X坐标\n@param y Y坐标\n@returns 是否成功',
                params: [
                    { name: 'x', type: 'number' },
                    { name: 'y', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'initBluetooth',
                description: '初始化蓝牙模块。\n@param ctx 上下文对象\n@returns 是否成功',
                params: [
                    { name: 'ctx', type: 'any' },
                ],
                returns: 'boolean',
            },
            {
                name: 'getName',
                description: '获取已连接蓝牙设备名称。\n@returns 设备名称',
                params: [],
                returns: 'string',
            },
            {
                name: 'keyDown',
                description: '模拟按键按下事件。\n@param code 键码\n@returns 是否成功',
                params: [
                    { name: 'code', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'keyUp',
                description: '模拟按键抬起事件。\n@param code 键码\n@returns 是否成功',
                params: [
                    { name: 'code', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'keyPress',
                description: '模拟按键按下和抬起事件。\n@param code 键码\n@returns 是否成功',
                params: [
                    { name: 'code', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'keyPress_code',
                description: '模拟指定键码的按键事件。\n@param code 键码\n@returns 是否成功',
                params: [
                    { name: 'code', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'keyDown_code',
                description: '模拟指定键码的按键按下。\n@param code 键码\n@returns 是否成功',
                params: [
                    { name: 'code', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'keyUp_code',
                description: '模拟指定键码的按键抬起。\n@param code 键码\n@returns 是否成功',
                params: [
                    { name: 'code', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'keyUpAll',
                description: '模拟松开所有按键。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'key_select',
                description: '模拟全选操作。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'key_paste',
                description: '模拟粘贴操作。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'key_copy',
                description: '模拟复制操作。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'key_cat',
                description: '模拟剪切操作。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'key_del',
                description: '模拟退格操作。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'key_delete',
                description: '模拟删除操作。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'key_enter',
                description: '模拟回车操作。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'key_num',
                description: '模拟数字键输入。\n@param n 数字（0-9）\n@returns 是否成功',
                params: [
                    { name: 'n', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'key_abc',
                description: '模拟字母键输入。\n@param n 字母\n@returns 是否成功',
                params: [
                    { name: 'n', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'volUp',
                description: '模拟音量加操作。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'volDown',
                description: '模拟音量减操作。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'power',
                description: '模拟按下电源键。\n@param time 持续时间（可选）\n@returns 是否成功',
                params: [
                    { name: 'time', type: 'number', optional: true },
                ],
                returns: 'boolean',
            },
            {
                name: 'reboot',
                description: '模拟重启设备。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'setXY',
                description: '设置屏幕分辨率。\n@param x 宽度\n@param y 高度\n@returns 是否成功',
                params: [
                    { name: 'x', type: 'number' },
                    { name: 'y', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'reg',
                description: '注册设备。\n@param key 注册码\n@returns 是否成功',
                params: [
                    { name: 'key', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'setRnd',
                description: '设置点击延时随机数。\n@param x X随机数\n@param y Y随机数\n@returns 是否成功',
                params: [
                    { name: 'x', type: 'number' },
                    { name: 'y', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'setBattery',
                description: '设置设备电量。\n@param lv 电量百分比\n@returns 是否成功',
                params: [
                    { name: 'lv', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'connect',
                description: '连接蓝牙设备。\n@param autoconnect 是否自动连接\n@param index 设备索引\n@returns 是否成功',
                params: [
                    { name: 'autoconnect', type: 'boolean' },
                    { name: 'index', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'getConnectedDevices',
                description: '获取已连接的蓝牙设备。\n@returns 蓝牙设备对象或null',
                params: [],
                returns: 'any',
            },
            {
                name: 'getConnectState',
                description: '获取蓝牙连接状态。\n@returns 是否已连接',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'sendData',
                description: '发送数据到蓝牙设备。\n@param str 数据内容\n@returns 是否成功',
                params: [
                    { name: 'str', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'sendDataAwait',
                description: '发送数据并等待响应。\n@param str 数据内容\n@param time 等待时间（毫秒）\n@returns 是否成功',
                params: [
                    { name: 'str', type: 'string' },
                    { name: 'time', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'getData',
                description: '获取接收到的数据。\n@param time 等待时间（可选）\n@returns 返回数据',
                params: [
                    { name: 'time', type: 'number', optional: true },
                ],
                returns: 'string',
            },
            {
                name: 'waitFor',
                description: '等待数据响应。\n@param time 最大等待时间（毫秒，可选）\n@param sleep 检查间隔（毫秒，可选）\n@returns 返回数据或超时信息',
                params: [
                    { name: 'time', type: 'number', optional: true },
                    { name: 'sleep', type: 'number', optional: true },
                ],
                returns: 'string',
            },
            {
                name: 'disconnect',
                description: '断开蓝牙连接。\n@returns 是否成功',
                params: [],
                returns: 'boolean',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
        typeOnly: true,
    },
    'java': {
        kind: 'object',
        description: '',
        methods: [],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: 'any',
    },
    'log': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'setFile',
                description: '全局设置日志输出文件',
                params: [
                    { name: 'filename', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'log',
                description: '输出日志内容',
                params: [
                    { name: 'obj', type: 'object', rest: true },
                ],
                returns: 'void',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
        typeOnly: true,
    },
    'notificationBridge': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'startService',
                description: '开启读取通知服务',
                params: [],
                returns: 'void',
            },
            {
                name: 'startListening',
                description: '监听通知\n@param onNotification 通知发起后执行 @argument packageName 包名 @argument title 标题 @argument text 内容\n@param onNotificationRemoved 通知移除后执行 @argument packageName 包名 @argument title 标题 @argument text 内容',
                params: [
                    { name: 'onNotification', type: '(packageName: string, title: string, text: string) => void,\n        onNotificationRemoved: (packageName: string' },
                    { name: 'title', type: 'string' },
                    { name: 'text', type: 'string) => void' },
                ],
                returns: 'void',
            },
            {
                name: 'stopService',
                description: '关闭服务',
                params: [],
                returns: 'void',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
        typeOnly: true,
    },
    'socketIoClient': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'getInstance',
                description: '获取socketIoClient实例\n@param serverUrl  socketIOServer地址\n@param reconnect  是否自动重连（默认为true）\n@param timeout  重连超时时间（毫秒）（默认为5000毫秒）',
                params: [
                    { name: 'serverUrl', type: 'string' },
                    { name: 'reconnect', type: 'boolean' },
                    { name: 'timeout', type: 'number' },
                ],
                returns: 'socketIoClient',
            },
            {
                name: 'connect',
                description: '连接socketIOServer',
                params: [],
                returns: 'void',
            },
            {
                name: 'disconnect',
                description: '断开socketIOServer',
                params: [],
                returns: 'void',
            },
            {
                name: 'isConnected',
                description: '是否已连接',
                params: [],
                returns: 'boolean',
            },
            {
                name: 'emit',
                description: '向服务器发送事件和数据\n@param eventName  事件名称\n@param data  数据',
                params: [
                    { name: 'eventName', type: 'string' },
                    { name: 'data', type: 'string' },
                ],
                returns: 'void',
            },
            {
                name: 'emit',
                description: '向服务器发送事件和数据\n@param eventName 事件名称\n@param data 数据\n@param callback 服务器确认后的回调函数',
                params: [
                    { name: 'eventName', type: 'string' },
                    { name: 'data', type: 'string' },
                    { name: 'callback', type: 'function' },
                ],
                returns: 'void',
            },
            {
                name: 'on',
                description: '监听事件\n@param eventName \n@param callback',
                params: [
                    { name: 'eventName', type: 'string' },
                    { name: 'callback', type: '(data: string) => void' },
                ],
                returns: 'void',
            },
            {
                name: 'off',
                description: '移除事件监听器\n@param eventName \n@param callback',
                params: [
                    { name: 'eventName', type: 'string' },
                    { name: 'callback', type: '(data: string) => void' },
                ],
                returns: 'void',
            },
            {
                name: 'off',
                description: '移除事件监听器\n@param eventName',
                params: [
                    { name: 'eventName', type: 'string' },
                ],
                returns: 'void',
            },
            {
                name: 'off',
                description: '移除所有事件监听器',
                params: [],
                returns: 'void',
            },
            {
                name: 'setReconnect',
                description: '重置当前实例的是否重连\n@param bool 是否自动重连',
                params: [
                    { name: 'bool', type: 'boolean' },
                ],
                returns: 'void',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
        typeOnly: true,
    },
    'storage': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'create',
                description: '创建存储实例  全局使用一个即可\n@param db 数据库名称\n@return 返回当前实例，如果已存在则直接返回',
                params: [
                    { name: 'db', type: 'string' },
                ],
                returns: 'storage',
            },
            {
                name: 'put',
                description: '设置字符串\n@param key 键\n@param value 值',
                params: [
                    { name: 'key', type: 'string' },
                    { name: 'value', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'putInteger',
                description: '设置整型值\n@param key 键\n@param value 值',
                params: [
                    { name: 'key', type: 'string' },
                    { name: 'value', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'putBoolean',
                description: '设置bool\n@param key 键\n@param value 值',
                params: [
                    { name: 'key', type: 'string' },
                    { name: 'value', type: 'boolean' },
                ],
                returns: 'boolean',
            },
            {
                name: 'putDouble',
                description: '设置双精度值\n@param key 键\n@param value 值',
                params: [
                    { name: 'key', type: 'string' },
                    { name: 'value', type: 'number' },
                ],
                returns: 'boolean',
            },
            {
                name: 'putObj',
                description: '设置对象\n@param key 键\n@param obj 值',
                params: [
                    { name: 'key', type: 'string' },
                    { name: 'obj', type: 'object' },
                ],
                returns: 'boolean',
            },
            {
                name: 'putArray',
                description: '设置集合（字符串）\n@param key 键\n@param set 值',
                params: [
                    { name: 'key', type: 'string' },
                    { name: 'arr', type: 'Array' },
                ],
                returns: 'boolean',
            },
            {
                name: 'getArray',
                description: '获取集合（字符串）\n@param key 键',
                params: [
                    { name: 'key', type: 'string' },
                ],
                returns: 'Array',
            },
            {
                name: 'get',
                description: '获取字符串\n@param key 键',
                params: [
                    { name: 'key', type: 'string' },
                ],
                returns: 'string',
            },
            {
                name: 'getString',
                description: '获取字符串\n@param key 键',
                params: [
                    { name: 'key', type: 'string' },
                ],
                returns: 'string',
            },
            {
                name: 'getBoolean',
                description: '获取bool类型的值\n@param key 键',
                params: [
                    { name: 'key', type: 'string' },
                ],
                returns: 'boolean',
            },
            {
                name: 'getDouble',
                description: '获取Double类型的值\n@param key 键',
                params: [
                    { name: 'key', type: 'string' },
                ],
                returns: 'number',
            },
            {
                name: 'getInteger',
                description: '获取整型类型的值\n@param key 键',
                params: [
                    { name: 'key', type: 'string' },
                ],
                returns: 'number',
            },
            {
                name: 'getObj',
                description: '获取对象类型的值\n@param key 键',
                params: [
                    { name: 'key', type: 'string' },
                ],
                returns: 'object',
            },
            {
                name: 'remove',
                description: '移除某个键\n@param key 键\n@return 返回Promise，实际使用时通过blockingSubscribe()或toCompletionStage()来获取结果',
                params: [
                    { name: 'key', type: 'string' },
                ],
                returns: 'any',
            },
            {
                name: 'clear',
                description: '清空所有值\n@return 返回Promise，实际使用时通过blockingSubscribe()或toCompletionStage()来获取结果',
                params: [],
                returns: 'any',
            },
            {
                name: 'contains',
                description: '判断是否包含键为key的数据\n@param key 键\n@return 返回boolean，表示是否存在该键',
                params: [
                    { name: 'key', type: 'string' },
                ],
                returns: 'boolean',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
        typeOnly: true,
    },
    'webSocket': {
        kind: 'object',
        description: '',
        methods: [
            {
                name: 'onOpen',
                description: '连接成功',
                params: [],
                returns: 'void',
            },
            {
                name: 'onMessage',
                description: '消息通知\n@param data',
                params: [
                    { name: 'data', type: 'string' },
                ],
                returns: 'void',
            },
            {
                name: 'onClose',
                description: '连接关闭\n@param code \n@param reason',
                params: [
                    { name: 'code', type: 'number' },
                    { name: 'reason', type: 'string' },
                ],
                returns: 'void',
            },
            {
                name: 'onError',
                description: '连接出错\n@param errorMsg',
                params: [
                    { name: 'errorMsg', type: 'string' },
                ],
                returns: 'void',
            },
            {
                name: 'send',
                description: '发送数据\n@param data',
                params: [
                    { name: 'data', type: 'string' },
                ],
                returns: 'void',
            },
            {
                name: 'close',
                description: '关闭当前连接',
                params: [],
                returns: 'void',
            },
        ],
        properties: [],
        constructorParams: [],
        funcParams: [],
        funcReturns: '',
        typeOnly: true,
    },
};


/***/ }),
/* 44 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.generateFloatWindowTypes = generateFloatWindowTypes;
exports.generateTimerGlobals = generateTimerGlobals;
exports.generateRequireGlobals = generateRequireGlobals;
exports.generateV2DtsContent = generateV2DtsContent;
/** Pro 版 V2 页面 / 组件 API 类型（Page、Component），追加到生成的 deekeScriptPro.d.ts */
const DOC = 'https://script.deeke.cn';
const DOC_LABEL = 'DeekeScript Pro 文档';
/** 悬浮球菜单相关类型（在 FloatWindow 全局之前生成） */
function generateFloatWindowTypes() {
    return [
        '// --- 悬浮球 ---',
        '',
        '/** 菜单点击回调 @see {@link ' + DOC + '/v2/floatWindow.html ' + DOC_LABEL + '} */',
        'type DeekeFloatWindowMenuHandler = (menuId?: string) => void;',
        '',
        '/** deekeScript.json → floatWindow.menus[] / FloatWindow.setMenus @see {@link ' + DOC + '/v2/config.html ' + DOC_LABEL + '} */',
        'interface DeekeFloatWindowMenuItem {',
        '    /** 菜单 id，给 FloatWindow.on / update 用 */',
        '    id?: string;',
        '    /** 内置 close / play / hide，或工程内图片路径 */',
        '    icon?: string;',
        '    /** 图标下方文案 */',
        '    label?: string;',
        '    /** 点击函数名，或内联 function（setMenus 时） */',
        '    onTap?: string | DeekeFloatWindowMenuHandler;',
        '    /** always（默认）/ running / idle */',
        '    show?: "always" | "running" | "idle" | string;',
        '    /** 圆形底色，如 #FFE8E6 */',
        '    background?: string;',
        '    /** 是否参与展示，默认 true */',
        '    visible?: boolean;',
        '}',
        '',
        '/** FloatWindow.update 的 patch 参数 @see {@link ' + DOC + '/v2/floatWindow.html#floatwindow-updateid-patch ' + DOC_LABEL + '} */',
        'interface DeekeFloatWindowMenuPatch {',
        '    icon?: string;',
        '    label?: string;',
        '    background?: string;',
        '    show?: string;',
        '    visible?: boolean;',
        '    onTap?: string | DeekeFloatWindowMenuHandler;',
        '}',
        '',
        '/** deekeScript.json → floatWindow @see {@link ' + DOC + '/v2/config.html ' + DOC_LABEL + '} */',
        'interface DeekeFloatWindowConfig {',
        '    /** 展开菜单项，最多 5 个；不写则连点两次停止任务 */',
        '    menus?: DeekeFloatWindowMenuItem[];',
        '}',
        '',
    ].join('\n');
}
/** 全局定时器（Rhino 注入，非 Http.setTimeout） */
function generateTimerGlobals() {
    const doc = DOC + '/base/timer/timer.html';
    return [
        '// --- 全局定时器 ---',
        '',
        '/**',
        ' * 延时执行一次',
        ' * @see {@link ' + doc + ' ' + DOC_LABEL + '}',
        ' */',
        'declare function setTimeout(callback: () => void, delay: number, ...args: unknown[]): number;',
        '',
        '/**',
        ' * 按间隔循环执行',
        ' * @see {@link ' + doc + ' ' + DOC_LABEL + '}',
        ' */',
        'declare function setInterval(callback: () => void, delay: number, ...args: unknown[]): number;',
        '',
        '/** @see {@link ' + doc + ' ' + DOC_LABEL + '} */',
        'declare function clearTimeout(id: number): void;',
        '',
        '/** @see {@link ' + doc + ' ' + DOC_LABEL + '} */',
        'declare function clearInterval(id: number): void;',
        '',
    ].join('\n');
}
/**
 * DeekeScript 的 require / module（Rhino CommonJS，非 Node）。
 * 配合 jsconfig baseUrl="."，使 require('app/a.js') 按项目根解析并有跳转/提示。
 */
function generateRequireGlobals() {
    const doc = DOC + '/v2/require.html';
    return [
        '// --- require / module（项目根相对路径）---',
        '',
        '/**',
        ' * 加载工程内 JS 模块（Rhino CommonJS）。',
        ' * - 以 ./ 或 ../ 开头：相对当前文件',
        ' * - 其它写法：相对项目根，如 require(\'common/permission.js\')、require(\'app/a.js\')',
        ' * 必须带 .js 后缀。导出方用 module.exports。',
        ' * @param id 模块路径',
        ' * @returns 被引入文件的 module.exports',
        ' * @see {@link ' + doc + ' ' + DOC_LABEL + '}',
        ' */',
        'declare function require(id: string): any;',
        '',
        '/** CommonJS 模块对象（当前文件） @see {@link ' + doc + ' ' + DOC_LABEL + '} */',
        'interface DeekeModule {',
        '    exports: any;',
        '}',
        '',
        '/** 当前模块；导出写 module.exports = { ... } */',
        'declare var module: DeekeModule;',
        '',
        '/** 等同于 module.exports 的初始引用 */',
        'declare var exports: any;',
        '',
    ].join('\n');
}
function generateV2DtsContent() {
    return [
        '// --- V2 页面与自定义组件（Page / Component）---',
        '',
        '/** 页面滚动事件 @see {@link ' + DOC + '/v2/events.html ' + DOC_LABEL + '} */',
        'interface DeekePageScrollEvent {',
        '    scrollY?: number;',
        '    deltaY?: number;',
        '}',
        '',
        '/** 组件 triggerEvent / 父页 onXxx 事件 @see {@link ' + DOC + '/v2/component-event.html ' + DOC_LABEL + '} */',
        'interface DeekeComponentEvent {',
        '    type?: string;',
        '    detail?: Record<string, unknown>;',
        '    value?: unknown;',
        '}',
        '',
        '/** 底栏单项 @see {@link ' + DOC + '/v2/tabBar.html ' + DOC_LABEL + '} */',
        'interface DeekeTabBarItem {',
        '    title?: string;',
        '    icon?: string;',
        '    page?: string;',
        '    badge?: number;',
        '    hidden?: boolean;',
        '}',
        '',
        '/** setTabBar / setTabBarStyle 参数 @see {@link ' + DOC + '/v2/tabBar.html ' + DOC_LABEL + '} */',
        'interface DeekeTabBarStyle {',
        '    color?: string;',
        '    selectedColor?: string;',
        '    iconColor?: string;',
        '    selectedIconColor?: string;',
        '    background?: string;',
        '    borderColor?: string;',
        '    items?: DeekeTabBarItem[];',
        '}',
        '',
        '/** selectComponent 返回值 @see {@link ' + DOC + '/v2/component-event.html ' + DOC_LABEL + '} */',
        'interface DeekeComponentRef {',
        '    /** 只读当前组件数据 */',
        '    data: Record<string, unknown>;',
        '    /** 写入组件数据并触发重绘 */',
        '    setData(patch: Record<string, unknown>): void;',
        '    /** 调用组件上的方法，例如 onOk */',
        '    call(name: string, arg?: unknown): void;',
        '}',
        '',
        '/**',
        ' * 页面实例（Page 方法内 this）',
        ' * @see {@link ' + DOC + '/v2/events.html#页面方法 ' + DOC_LABEL + '}',
        ' */',
        'interface DeekePageInstance {',
        '    /** 页面数据 */',
        '    data: Record<string, unknown>;',
        '    /** 按字段更新页面数据 @see {@link ' + DOC + '/v2/life.html#页面数据 ' + DOC_LABEL + '} */',
        '    setData(patch: Record<string, unknown>): void;',
        '    /** 向 data 中某数组字段末尾追加 @see {@link ' + DOC + '/v2/life.html#页面数据 ' + DOC_LABEL + '} */',
        '    appendData(key: string, items: unknown[]): void;',
        '    /** 打开另一页 @see {@link ' + DOC + '/v2/navigate.html ' + DOC_LABEL + '} */',
        '    navigate(page: string | { page: string; params?: Record<string, unknown> }): void;',
        '    /** 关掉当前二级页再打开 @see {@link ' + DOC + '/v2/navigate.html ' + DOC_LABEL + '} */',
        '    redirect(page: string | { page: string; params?: Record<string, unknown> }): void;',
        '    /** 切底栏 Tab @see {@link ' + DOC + '/v2/navigate.html ' + DOC_LABEL + '} */',
        '    switchTab(page: string | { page: string }): void;',
        '    /** 关闭当前二级页 @see {@link ' + DOC + '/v2/navigate.html ' + DOC_LABEL + '} */',
        '    back(): void;',
        '    /** 短提示 @see {@link ' + DOC + '/v2/events.html#页面方法 ' + DOC_LABEL + '} */',
        '    toast(text: string | { text: string; duration?: number | string }): void;',
        '    /** 系统浏览器打开链接 */',
        '    openUrl(url: string): void;',
        '    /** 改当前页标题栏 */',
        '    setTitle(text: string | { text: string; color?: string; background?: string }): void;',
        '    /** 滚动页面，y 与 onScroll.scrollY 同为 px */',
        '    scrollTo(y: number | { y?: number; animated?: boolean; top?: boolean }): void;',
        '    /** 按弹层 id 或 showIf 显示 */',
        '    showPopup(id: string): void;',
        '    /** 按弹层 id 或 showIf 隐藏 */',
        '    hidePopup(id: string): void;',
        '    /** 显示全屏加载圈 */',
        '    showLoading(text?: string): void;',
        '    /** 隐藏全屏加载圈 */',
        '    hideLoading(): void;',
        '    /** 结束下拉刷新转圈 @see {@link ' + DOC + '/v2/refresh.html ' + DOC_LABEL + '} */',
        '    stopPullDownRefresh(): void;',
        '    /** 创建或恢复底栏 @see {@link ' + DOC + '/v2/tabBar.html#settabbar ' + DOC_LABEL + '} */',
        '    setTabBar(options?: DeekeTabBarStyle): void;',
        '    /** 改底栏某一项 @see {@link ' + DOC + '/v2/tabBar.html#settabbaritem ' + DOC_LABEL + '} */',
        '    setTabBarItem(options: { page?: string; index?: number; title?: string; badge?: number; hidden?: boolean }): void;',
        '    /** 改底栏样式 @see {@link ' + DOC + '/v2/tabBar.html#settabbarstyle ' + DOC_LABEL + '} */',
        '    setTabBarStyle(options: DeekeTabBarStyle): void;',
        '    /** 按节点 id 查找子组件，找不到返回 null @see {@link ' + DOC + '/v2/component-event.html ' + DOC_LABEL + '} */',
        '    selectComponent(id: string): DeekeComponentRef | null;',
        '}',
        '',
        '/**',
        ' * 自定义组件实例（Component 方法内 this）',
        ' * @see {@link ' + DOC + '/v2/component.html ' + DOC_LABEL + '}',
        ' */',
        'interface DeekeComponentInstance extends DeekePageInstance {',
        '    /** 向父页抛事件，父节点写 onXxx 承接 @see {@link ' + DOC + '/v2/component-event.html ' + DOC_LABEL + '} */',
        '    triggerEvent(name: string, detail?: Record<string, unknown>): void;',
        '}',
        '',
        '/** Page({}) 可写字段 @see {@link ' + DOC + '/v2/life.html ' + DOC_LABEL + '} */',
        'interface DeekePageOptions {',
        '    /** 页面初始数据 */',
        '    data?: Record<string, unknown>;',
        '    /** 页面第一次打开 @see {@link ' + DOC + '/v2/life.html ' + DOC_LABEL + '} */',
        '    onLoad?(params?: Record<string, unknown>): void;',
        '    /** 页面显示 */',
        '    onShow?(): void;',
        '    /** 页面首次显示完成 */',
        '    onReady?(): void;',
        '    /** 页面被盖住或切走 */',
        '    onHide?(): void;',
        '    /** 页面关闭 */',
        '    onUnload?(): void;',
        '    /** 页面滚动 @see {@link ' + DOC + '/v2/events.html ' + DOC_LABEL + '} */',
        '    onScroll?(e?: DeekePageScrollEvent): void;',
        '    /** 整页滚到底 */',
        '    onReachBottom?(e?: unknown): void;',
        '    /** 整页滚到顶 */',
        '    onReachTop?(e?: unknown): void;',
        '    /** 整页下拉刷新 @see {@link ' + DOC + '/v2/refresh.html ' + DOC_LABEL + '} */',
        '    onPullDownRefresh?(): void;',
        '    /** 点页面空白 */',
        '    onTap?(): void;',
        '    /** 双击页面空白 */',
        '    onDoubleTap?(): void;',
        '    /** 长按页面空白 */',
        '    onLongPress?(): void;',
        '    /** 页面上滑 */',
        '    onSwipeUp?(): void;',
        '    /** 页面下滑 */',
        '    onSwipeDown?(): void;',
        '    /** 页面左滑 */',
        '    onSwipeLeft?(): void;',
        '    /** 页面右滑 */',
        '    onSwipeRight?(): void;',
        '    /** 页面滑动（统一） */',
        '    onSwipe?(e?: unknown): void;',
        '}',
        '',
        '/** Component({}) 可写字段 @see {@link ' + DOC + '/v2/component-life.html ' + DOC_LABEL + '} */',
        'interface DeekeComponentOptions {',
        '    /** 组件初始数据 */',
        '    data?: Record<string, unknown>;',
        '    /** 实例创建，接收父节点 params @see {@link ' + DOC + '/v2/component-life.html ' + DOC_LABEL + '} */',
        '    created?(props?: Record<string, unknown>): void;',
        '    /** 插入界面（showIf 为真） */',
        '    attached?(): void;',
        '    /** 从界面拿掉（showIf 为假或父页卸载） */',
        '    detached?(): void;',
        '}',
        '',
        '/** Page 方法内 this（含 Page({ data }) 推断出的 data 字段） @see {@link ' + DOC + '/v2/events.html#页面方法 ' + DOC_LABEL + '} */',
        'type DeekePageInstanceWithData<TData extends Record<string, unknown>> = Omit<DeekePageInstance, "data" | "setData"> & {',
        '    data: TData;',
        '    setData(patch: Partial<TData>): void;',
        '};',
        '',
        '/** Component 方法内 this（含 Component({ data }) 推断出的 data 字段） @see {@link ' + DOC + '/v2/component.html ' + DOC_LABEL + '} */',
        'type DeekeComponentInstanceWithData<TData extends Record<string, unknown>> = Omit<DeekeComponentInstance, "data" | "setData"> & {',
        '    data: TData;',
        '    setData(patch: Partial<TData>): void;',
        '};',
        '',
        '/**',
        ' * 注册页面逻辑（写在 page.js）',
        ' * @see {@link ' + DOC + '/v2/page.html ' + DOC_LABEL + '}',
        ' */',
        'declare function Page<TData extends Record<string, unknown> = Record<string, unknown>>(options: Omit<DeekePageOptions, "data"> & { data?: TData } & ThisType<DeekePageInstanceWithData<TData>> & Record<string, unknown>): void;',
        '',
        '/**',
        ' * 注册自定义组件逻辑（写在 component.js）',
        ' * @see {@link ' + DOC + '/v2/component.html ' + DOC_LABEL + '}',
        ' */',
        'declare function Component<TData extends Record<string, unknown> = Record<string, unknown>>(options: Omit<DeekeComponentOptions, "data"> & { data?: TData } & ThisType<DeekeComponentInstanceWithData<TData>> & Record<string, unknown>): void;',
        '',
    ].join('\n');
}


/***/ }),
/* 45 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.clearDeekeScriptProjectCache = clearDeekeScriptProjectCache;
exports.isDeekeScriptWorkspaceFolder = isDeekeScriptWorkspaceFolder;
exports.hasAnyDeekeScriptProject = hasAnyDeekeScriptProject;
exports.isDeekeScriptProject = isDeekeScriptProject;
const vscode = __importStar(__webpack_require__(1));
const projectCache = new Map();
function clearDeekeScriptProjectCache() {
    projectCache.clear();
}
async function isDeekeScriptWorkspaceFolder(folder) {
    const key = folder.uri.toString();
    if (!projectCache.has(key)) {
        try {
            await vscode.workspace.fs.stat(vscode.Uri.parse(folder.uri.toString() + '/deekeScript.json'));
            projectCache.set(key, true);
        }
        catch {
            projectCache.set(key, false);
        }
    }
    return projectCache.get(key);
}
async function hasAnyDeekeScriptProject() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0)
        return false;
    for (const folder of folders) {
        if (await isDeekeScriptWorkspaceFolder(folder)) {
            return true;
        }
    }
    return false;
}
async function isDeekeScriptProject(document) {
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!folder)
        return false;
    return isDeekeScriptWorkspaceFolder(folder);
}
vscode.workspace.onDidChangeWorkspaceFolders(() => clearDeekeScriptProjectCache());


/***/ }),
/* 46 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.registerRequirePathCompletion = registerRequirePathCompletion;
const path = __importStar(__webpack_require__(35));
const vscode = __importStar(__webpack_require__(1));
const utils_1 = __webpack_require__(45);
const SKIP_DIRS = new Set([
    'node_modules',
    '.git',
    '.vscode',
    '.idea',
    'dist',
    '_book',
    '.deeke',
]);
/** 匹配 require('...') / require("...") 内光标位置 */
function getRequirePathContext(document, position) {
    const line = document.lineAt(position.line).text;
    const before = line.slice(0, position.character);
    const match = before.match(/require\s*\(\s*(['"])([^'"]*)$/);
    if (!match) {
        return null;
    }
    return { quote: match[1], prefix: match[2] };
}
function resolveBaseDir(folder, document, prefix) {
    const normalized = prefix.replace(/\\/g, '/');
    const lastSlash = normalized.lastIndexOf('/');
    const dirPart = lastSlash >= 0 ? normalized.slice(0, lastSlash + 1) : '';
    const segments = dirPart.split('/').filter((s) => s.length > 0);
    if (normalized.startsWith('./') || normalized.startsWith('../') || normalized === '.' || normalized === '..') {
        const docDir = path.dirname(document.uri.fsPath);
        const baseFsPath = segments.length > 0 ? path.resolve(docDir, ...segments) : docDir;
        return { baseFsPath, insertPrefix: dirPart };
    }
    // 项目根相对：require('app/a.js')
    const baseFsPath = segments.length > 0
        ? path.join(folder.uri.fsPath, ...segments)
        : folder.uri.fsPath;
    return { baseFsPath, insertPrefix: dirPart };
}
function getFilter(prefix) {
    const normalized = prefix.replace(/\\/g, '/');
    const lastSlash = normalized.lastIndexOf('/');
    return lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
}
async function listEntries(baseFsPath, insertPrefix, filter) {
    let entries;
    try {
        entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(baseFsPath));
    }
    catch {
        return [];
    }
    const items = [];
    const lowerFilter = filter.toLowerCase();
    for (const [name, type] of entries) {
        if (name.startsWith('.')) {
            continue;
        }
        if (type === vscode.FileType.Directory && SKIP_DIRS.has(name)) {
            continue;
        }
        if (lowerFilter && !name.toLowerCase().startsWith(lowerFilter)) {
            continue;
        }
        if (type === vscode.FileType.Directory) {
            const item = new vscode.CompletionItem(name + '/', vscode.CompletionItemKind.Folder);
            item.insertText = insertPrefix + name + '/';
            item.filterText = insertPrefix + name;
            item.detail = '目录（项目根相对 require）';
            item.command = {
                command: 'editor.action.triggerSuggest',
                title: 'Retrigger',
            };
            items.push(item);
        }
        else if (type === vscode.FileType.File && name.endsWith('.js')) {
            const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.File);
            item.insertText = insertPrefix + name;
            item.filterText = insertPrefix + name;
            item.detail = '模块（相对项目根，如 require(\'app/a.js\')）';
            items.push(item);
        }
    }
    return items.sort((a, b) => String(a.label).localeCompare(String(b.label)));
}
/**
 * 在 require('...') 内提示工程 JS 路径：
 * - ./ ../ → 相对当前文件
 * - 其它 → 相对项目根（配合 jsconfig baseUrl）
 */
function registerRequirePathCompletion(context) {
    const provider = {
        async provideCompletionItems(document, position) {
            if (document.languageId !== 'javascript' && document.languageId !== 'javascriptreact') {
                return undefined;
            }
            if (!(await (0, utils_1.isDeekeScriptProject)(document))) {
                return undefined;
            }
            const ctx = getRequirePathContext(document, position);
            if (!ctx) {
                return undefined;
            }
            const folder = vscode.workspace.getWorkspaceFolder(document.uri);
            if (!folder) {
                return undefined;
            }
            const resolved = resolveBaseDir(folder, document, ctx.prefix);
            const filter = getFilter(ctx.prefix);
            const items = await listEntries(resolved.baseFsPath, resolved.insertPrefix, filter);
            const line = document.lineAt(position.line).text;
            const before = line.slice(0, position.character);
            if (!before.match(/require\s*\(\s*['"]/)) {
                return items;
            }
            const pathStart = before.lastIndexOf(ctx.quote) + 1;
            const range = new vscode.Range(new vscode.Position(position.line, pathStart), position);
            for (const item of items) {
                item.range = range;
            }
            return items;
        },
    };
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider([{ language: 'javascript', scheme: 'file' }, { language: 'javascriptreact', scheme: 'file' }], provider, "'", '"', '/', '.'));
}


/***/ }),
/* 47 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DeviceDiscoveryService = void 0;
const lanProbe_1 = __webpack_require__(48);
const log_1 = __importDefault(__webpack_require__(33));
class DeviceDiscoveryService {
    timer = null;
    scanning = false;
    paused = false;
    loggedTargets = false;
    options;
    constructor(options) {
        this.options = options;
    }
    start() {
        if (this.timer) {
            return;
        }
        this.timer = setInterval(() => {
            void this.tick();
        }, this.options.intervalMs);
        // 启动后立即扫一次
        void this.tick();
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.scanning = false;
        this.loggedTargets = false;
    }
    pause() {
        this.paused = true;
    }
    resume() {
        this.paused = false;
    }
    updatePort(port) {
        this.options.port = port;
    }
    async tick() {
        if (this.paused || this.scanning || !this.options.shouldScan()) {
            return;
        }
        this.scanning = true;
        try {
            if (!this.loggedTargets) {
                log_1.default.info(`192.168 网段扫描：${(0, lanProbe_1.describeScanTargets)()}（端口 ${this.options.port}）`);
                this.loggedTargets = true;
            }
            const ips = await (0, lanProbe_1.discoverDevices)(this.options.port, this.options.getLastKnownIp());
            if (ips.length === 0 || !this.options.shouldScan()) {
                return;
            }
            if (ips.length === 1) {
                log_1.default.showInfo(`局域网扫描发现手机 ${ips[0]}，正在连接...`);
            }
            else {
                log_1.default.showInfo(`局域网扫描发现 ${ips.length} 台手机：${ips.join(', ')}`);
            }
            await this.options.onDevicesFound(ips);
        }
        catch (error) {
            log_1.default.error(`局域网扫描失败：${error instanceof Error ? error.message : '未知错误'}`);
        }
        finally {
            this.scanning = false;
        }
    }
}
exports.DeviceDiscoveryService = DeviceDiscoveryService;


/***/ }),
/* 48 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getLocalLanNetworks = getLocalLanNetworks;
exports.getLocalLanAddresses = getLocalLanAddresses;
exports.probeHost = probeHost;
exports.discoverDevices = discoverDevices;
exports.describeScanTargets = describeScanTargets;
const net = __importStar(__webpack_require__(11));
const os = __importStar(__webpack_require__(49));
const PROBE_TIMEOUT_MS = 400;
const SCAN_BATCH_SIZE = 48;
/** 单网段最多扫描主机数，避免 /16 等大网段扫爆 */
const MAX_HOSTS_PER_SUBNET = 254;
function isIPv4(family) {
    return family === 'IPv4' || family === 4;
}
function ipToInt(ip) {
    const parts = ip.split('.').map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
        return 0;
    }
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}
function intToIp(value) {
    return [
        (value >>> 24) & 255,
        (value >>> 16) & 255,
        (value >>> 8) & 255,
        value & 255,
    ].join('.');
}
function is192168Address(ip) {
    return ip.startsWith('192.168.');
}
function shouldSkipAddress(ip) {
    if (ip.startsWith('127.')) {
        return true;
    }
    if (ip.startsWith('169.254.')) {
        return true;
    }
    return !is192168Address(ip);
}
function prefixLengthFromNetmask(netmask) {
    const mask = ipToInt(netmask);
    if (mask === 0) {
        return null;
    }
    let bits = 0;
    for (let shift = 31; shift >= 0; shift--) {
        if ((mask >>> shift) & 1) {
            bits++;
        }
        else {
            break;
        }
    }
    const expected = bits === 32 ? 0xffffffff : (~((1 << (32 - bits)) - 1)) >>> 0;
    if (mask !== expected) {
        return null;
    }
    return bits;
}
function prefixLengthFromCidr(cidr) {
    const slash = cidr.indexOf('/');
    if (slash < 0) {
        return null;
    }
    const prefix = Number(cidr.slice(slash + 1));
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
        return null;
    }
    return prefix;
}
function hostRangeFromPrefix(localAddress, prefixLength) {
    const ipInt = ipToInt(localAddress);
    const mask = prefixLength === 0 ? 0 : (~0 << (32 - prefixLength)) >>> 0;
    const network = ipInt & mask;
    const broadcast = network | (~mask >>> 0);
    let scanStart = network + 1;
    let scanEnd = broadcast - 1;
    const hostCount = scanEnd - scanStart + 1;
    if (hostCount > MAX_HOSTS_PER_SUBNET) {
        const classCBase = ipInt & 0xffffff00;
        scanStart = classCBase + 1;
        scanEnd = classCBase + 254;
    }
    return { scanStart, scanEnd };
}
/** 读取本机 192.168.x.x 网卡及对应扫描范围 */
function getLocalLanNetworks() {
    const networks = [];
    const seen = new Set();
    for (const ifaces of Object.values(os.networkInterfaces())) {
        if (!ifaces) {
            continue;
        }
        for (const iface of ifaces) {
            if (!isIPv4(iface.family) || iface.internal) {
                continue;
            }
            const localAddress = iface.address;
            if (shouldSkipAddress(localAddress)) {
                continue;
            }
            let prefixLength = null;
            if (typeof iface.cidr === 'string') {
                prefixLength = prefixLengthFromCidr(iface.cidr);
            }
            if (prefixLength === null && typeof iface.netmask === 'string') {
                prefixLength = prefixLengthFromNetmask(iface.netmask);
            }
            if (prefixLength === null) {
                prefixLength = 24;
            }
            const { scanStart, scanEnd } = hostRangeFromPrefix(localAddress, prefixLength);
            const key = `${localAddress}|${scanStart}|${scanEnd}`;
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            networks.push({ localAddress, scanStart, scanEnd });
        }
    }
    return networks;
}
/** 本机局域网 IPv4 列表（仅地址，便于日志展示） */
function getLocalLanAddresses() {
    return getLocalLanNetworks().map((item) => item.localAddress);
}
/** TCP 探测指定 IP 端口是否可达（WebSocket 服务端口） */
function probeHost(ip, port, timeoutMs = PROBE_TIMEOUT_MS) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let settled = false;
        const finish = (ok) => {
            if (settled) {
                return;
            }
            settled = true;
            socket.destroy();
            resolve(ok);
        };
        socket.setTimeout(timeoutMs);
        socket.once('connect', () => finish(true));
        socket.once('timeout', () => finish(false));
        socket.once('error', () => finish(false));
        socket.connect(port, ip);
    });
}
async function scanRange(scanStart, scanEnd, port, skipIp) {
    const found = [];
    const skipInt = skipIp ? ipToInt(skipIp) : 0;
    for (let start = scanStart; start <= scanEnd; start += SCAN_BATCH_SIZE) {
        const end = Math.min(start + SCAN_BATCH_SIZE - 1, scanEnd);
        const tasks = [];
        for (let host = start; host <= end; host++) {
            if (host === skipInt) {
                continue;
            }
            const ip = intToIp(host);
            if (!is192168Address(ip)) {
                continue;
            }
            tasks.push(probeHost(ip, port).then((ok) => (ok ? ip : null)));
        }
        const batch = await Promise.all(tasks);
        for (const ip of batch) {
            if (ip) {
                found.push(ip);
            }
        }
    }
    return found;
}
/** 扫描局域网内开放了指定端口的设备 */
async function discoverDevices(port, lastKnownIp) {
    if (lastKnownIp && !shouldSkipAddress(lastKnownIp) && (await probeHost(lastKnownIp, port))) {
        return [lastKnownIp];
    }
    const networks = getLocalLanNetworks();
    if (networks.length === 0) {
        return [];
    }
    const found = new Set();
    for (const network of networks) {
        const ips = await scanRange(network.scanStart, network.scanEnd, port, network.localAddress);
        for (const ip of ips) {
            found.add(ip);
        }
    }
    return [...found].filter(is192168Address);
}
/** 扫描范围描述，用于日志 */
function describeScanTargets() {
    const networks = getLocalLanNetworks();
    if (networks.length === 0) {
        return '未检测到 192.168.x.x 网卡';
    }
    return networks
        .map((network) => {
        const from = intToIp(network.scanStart);
        const to = intToIp(network.scanEnd);
        return `${network.localAddress} → ${from} ~ ${to}`;
    })
        .join('；');
}


/***/ }),
/* 49 */
/***/ ((module) => {

module.exports = require("os");

/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__(0);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
//# sourceMappingURL=extension.js.map