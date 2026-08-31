// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import Client from './Client';
import setting from './setting';
import log, { LogLevel } from './unit/log';
import { Workspace } from './Workspace';
import { activateLanguageFeatures } from './language';
import { DeviceDiscoveryService } from './services/DeviceDiscoveryService';
import { configManager } from './utils/config';

export function activate(context: vscode.ExtensionContext) {
	setting.init(context);//创建日志窗口， 设置extension变量

	// Generate .vscode/deekeScriptPro.d.ts + jsconfig.json for TypeScript-based IntelliSense
	activateLanguageFeatures(context);

	// 初始化日志配置，确保在Windows PowerShell等环境中禁用颜色
	log.setConfig({
		level: LogLevel.INFO,
		showNotifications: true,
		enableFileLogging: true,
		enableColors: false // 在VSCode扩展中禁用颜色以避免乱码
	});

	log.modelInfo("~_~ 欢迎使用" + context.extension.packageJSON.displayName + "~");
	let client: Client | undefined = undefined;
	let workspace: Workspace = new Workspace();
	workspace.init();//监听工作区文件变化
	// 全局状态（跨工作区持久化）
	const globalState = context.globalState;

	const serverConfig = configManager.getServerConfig();
	const discovery = new DeviceDiscoveryService({
		port: serverConfig.port,
		intervalMs: serverConfig.discoveryIntervalMs,
		shouldScan: () => {
			if (!setting.isProject()) {
				return false;
			}
			const cfg = configManager.getServerConfig();
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
			const pick = await vscode.window.showQuickPick(
				ips.map((ip) => ({ label: ip, description: 'DeekeScript Pro 手机端' })),
				{ title: '发现多台设备，请选择要连接的手机', placeHolder: ips[0] }
			);
			if (pick) {
				await connectToDevice(pick.label, { auto: true });
			}
		}
	});

	const ensureDiscoveryRunning = () => {
		if (configManager.getServerConfig().discoveryEnabled) {
			discovery.start();
		}
	};

	async function connectToDevice(
		ip: string,
		options: { auto?: boolean; silentFail?: boolean } = {}
	): Promise<boolean> {
		if (!/([\d]{1,3}\.){3}[\d]{1,3}/.test(ip)) {
			log.showError("手机连接地址有误~");
			return false;
		}

		if (client && client.state()) {
			const currentIp = client.getSocketIp();
			if (currentIp === ip) {
				if (!options.auto) {
					log.showError('已经连接成功，无需再次连接');
				}
				return true;
			}
		}

		discovery.pause();
		try {
			await globalState.update('deekeScriptPro.ip', ip);
			if (client) {
				client.close();
			}
			client = new Client(ip);
			await client.createSocket();
			workspace.setClient(client);
			workspace.setStop(false);
			if (options.auto) {
				log.showInfo(`局域网扫描连接成功：${ip}`);
				log.info(`局域网扫描连接成功：${ip}`);
			}
			return true;
		} catch (error) {
			const message = error instanceof Error ? error.message : '未知错误';
			if (options.silentFail) {
				log.info(`自动连接 ${ip} 失败（${message}），将继续扫描局域网`);
			} else {
				log.showError(`连接失败：${message}`);
			}
			return false;
		} finally {
			discovery.resume();
		}
	}

	const syncAutoConnectWithProject = async () => {
		if (!setting.isProject()) {
			discovery.stop();
			return;
		}
		if (!configManager.getServerConfig().discoveryEnabled) {
			return;
		}

		log.info('检测到 deekeScript.json，开始自动扫描并连接手机...');
		ensureDiscoveryRunning();

		const lastIp: string | undefined = globalState.get('deekeScriptPro.ip');
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
		configManager.reloadConfig();
		const next = configManager.getServerConfig();
		discovery.updatePort(next.port);
		if (next.discoveryEnabled) {
			ensureDiscoveryRunning();
		} else {
			discovery.stop();
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('deekeScriptPro.serverRun', async () => {
		const input = vscode.window.createInputBox();
		const ip: string | undefined = globalState.get('deekeScriptPro.ip');
		if (ip) {
			input.value = ip;
		}

		input.title = '请输入手机 IP（192.168.x.x；留空可等待自动扫描）';
		input.placeholder = '扩展会根据本机 192.168 网段自动扫描';
		discovery.pause();
		input.show();

		input.onDidAccept(async () => {
			const param: string = input.value.trim();
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
			return log.modelError(errorMsg);
		}
		if (vscode.window?.activeTextEditor?.document) {
			const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri);
			if (!workspaceFolder) {
				return log.modelError("当前文件不属于任何工作区");
			}
			client?.projectSync(workspaceFolder.uri.fsPath);
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('deekeScriptPro.fileSync', () => {
		if (!client?.state()) {
			return log.modelError(errorMsg);
		}
		if (vscode.window?.activeTextEditor?.document) {
			const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri);
			if (!workspaceFolder) {
				return log.modelError("当前文件不属于任何工作区");
			}

			client.fileSync(workspaceFolder.uri.fsPath, vscode.window?.activeTextEditor?.document?.fileName, false);
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('deekeScriptPro.run', () => {
		if (!client?.state()) {
			return log.modelError(errorMsg);
		}

		if (vscode.window?.activeTextEditor?.document) {
			const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri);
			if (!workspaceFolder) {
				return log.modelError("当前文件不属于任何工作区");
			}

			client.fileRunCommand({
				absolutePath: workspaceFolder.uri.fsPath,
				file: vscode.window?.activeTextEditor?.document?.fileName,
			});
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('deekeScriptPro.projectRun', () => {
		if (!client?.state()) {
			return log.modelError(errorMsg);
		}
		client.projectRunCommand();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('deekeScriptPro.stopAll', () => {
		if (!client?.state()) {
			return log.modelError(errorMsg);
		}
		client.stopCommand();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('deekeScriptPro.serverClose', () => {
		if (client?.state()) {
			client.close();
			workspace.setStop(true);//stop workspace listening
			log.showInfo("连接关闭成功");
			ensureDiscoveryRunning();
		} else {
			client?.close();
			log.showError("连接未开启");
			ensureDiscoveryRunning();
		}
	}));

	// 添加重置重连状态的命令
	context.subscriptions.push(vscode.commands.registerCommand('deekeScriptPro.resetRetry', () => {
		if (client) {
			client.resetRetryState();
			log.showInfo("重连状态已重置");
			ensureDiscoveryRunning();
		} else {
			log.showError("客户端未初始化");
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

			log.showInfo(`当前状态:\n${statusMessage}`);
		} else {
			log.showInfo('当前状态:\n连接状态: 未连接\n自动发现: 扫描中');
		}
	}));
}

// This method is called when your extension is deactivated
export function deactivate() { }
