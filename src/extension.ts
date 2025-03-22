// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import Client from './Client';
import setting from './setting';
import { loadingModel } from './unit/loadingModel';
import log from './unit/log';
import { Workspace } from './Workspace';

export function activate(context: vscode.ExtensionContext) {
	setting.init(context);//创建日志窗口， 设置extension变量

	log.modelInfo("~_~ 欢迎使用" + context.extension.packageJSON.displayName + "~");
	let client: Client | undefined = undefined;
	let workspace: Workspace = new Workspace();
	workspace.init();//监听工作区文件变化
	// 全局状态（跨工作区持久化）
	const globalState = context.globalState;

	context.subscriptions.push(vscode.commands.registerCommand('deekeScript.serverRun', () => {
		//输入手机地址
		const input = vscode.window.createInputBox();
		let ip: string | undefined = globalState.get('ip');
		if (ip) {
			input.value = ip;
		}

		input.title = '请输入手机Ip（格式为：192.168.xxx.xxx）';
		input.show();

		input.onDidAccept(() => {
			const param: string = input.value;
			if (!/([\d]{1,3}\.){3}[\d]{1,3}/.test(param)) {
				return log.model("手机连接地址有误~");
			}

			globalState.update('ip', param);
			input.hide();
			client = new Client(param);
			loadingModel(client.createSocket());
			workspace.setClient(client);
			return true;
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
			log.modelInfo("连接关闭成功");
		} else {
			log.modelError("连接未开启");
		}
	}));
}

// This method is called when your extension is deactivated
export function deactivate() { }
