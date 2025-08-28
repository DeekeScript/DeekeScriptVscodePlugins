// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import Client from './Client';
import setting from './setting';
import log, { LogLevel } from './unit/log';
import { Workspace } from './Workspace';

export function activate(context: vscode.ExtensionContext) {
	setting.init(context);//创建日志窗口， 设置extension变量

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

	context.subscriptions.push(vscode.commands.registerCommand('deekeScript.serverRun', async () => {
		//输入手机地址
		const input = vscode.window.createInputBox();
		let ip: string | undefined = globalState.get('ip');
		if (ip) {
			input.value = ip;
		}

		input.title = '请输入手机Ip（格式为：192.168.xxx.xxx）';
		input.show();

		input.onDidAccept(async () => {
			const param: string = input.value;
			if (!/([\d]{1,3}\.){3}[\d]{1,3}/.test(param)) {
				log.showError("手机连接地址有误~");
				return;
			}

			try {
				globalState.update('ip', param);
				input.hide();
				// 检查是否已经有连接且IP地址相同
				if (client && client.state()) {
					const currentIp = client.getSocketIp();
					if (currentIp === param) {
						log.showError('已经连接成功，无需再次连接');
						return;
					}
				}

				// 如果IP地址不同或没有连接，先关闭旧连接
				if (client) {
					client.close();
				}

				client = new Client(param);
				await client.createSocket();
				workspace.setClient(client);
			} catch (error) {
				log.showError(`连接失败：${error instanceof Error ? error.message : '未知错误'}`);
			}
		});
	}));

	let errorMsg = "未连接手机或连接中断（请执行“连接手机”命令）";
	context.subscriptions.push(vscode.commands.registerCommand('deekeScript.projectSync', () => {
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

	context.subscriptions.push(vscode.commands.registerCommand('deekeScript.fileSync', () => {
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

	context.subscriptions.push(vscode.commands.registerCommand('deekeScript.run', () => {
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

	context.subscriptions.push(vscode.commands.registerCommand('deekeScript.projectRun', () => {
		if (!client?.state()) {
			return log.modelError(errorMsg);
		}
		client.projectRunCommand();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('deekeScript.stopAll', () => {
		if (!client?.state()) {
			return log.modelError(errorMsg);
		}
		client.stopCommand();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('deekeScript.serverClose', () => {
		if (client?.state()) {
			client.close();
			workspace.setStop(true);//stop workspace listening
			log.showInfo("连接关闭成功");
		} else {
			client?.close();
			log.showError("连接未开启");
		}
	}));

	// 添加重置重连状态的命令
	context.subscriptions.push(vscode.commands.registerCommand('deekeScript.resetRetry', () => {
		if (client) {
			client.resetRetryState();
			log.showInfo("重连状态已重置");
		} else {
			log.showError("客户端未初始化");
		}
	}));

	// 添加显示状态的命令
	context.subscriptions.push(vscode.commands.registerCommand('deekeScript.showStatus', () => {
		if (client) {
			const retryInfo = client.getRetryInfo();
			const syncState = client.getSyncState();

			const statusMessage = [
				`连接状态: ${client.state() ? '已连接' : '未连接'}`,
				`重连次数: ${retryInfo.currentRetryCount}/${retryInfo.maxRetries}`,
				`曾经连接: ${retryInfo.hasConnectedOnce ? '是' : '否'}`,
				`同步状态: ${syncState.isSyncing ? '同步中' : '空闲'}`,
				`已同步文件: ${syncState.syncedFiles}/${syncState.totalFiles}`,
				`同步错误: ${syncState.errors.length}个`
			].join('\n');

			log.showInfo(`当前状态:\n${statusMessage}`);
		} else {
			log.showError("客户端未初始化");
		}
	}));
}

// This method is called when your extension is deactivated
export function deactivate() { }
