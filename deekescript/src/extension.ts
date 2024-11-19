// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import Cilent from './Cilent';
import setting from './setting';
import log from './unit/log';
import { loadingModel } from './unit/loadingModel';
import { Workspace } from './Workspace';

export function activate(context: vscode.ExtensionContext) {
	setting.init(context);//创建日志窗口， 设置extension变量

	log.modelInfo("~_~ 欢迎使用" + context.extension.packageJSON.displayName + "~")
	let client: Cilent | undefined = undefined;
	let workspace: Workspace = new Workspace();
	workspace.init();//监听工作区文件变化

	context.subscriptions.push(vscode.commands.registerCommand('deekescript.serverRun', () => {
		//输入手机地址
		const input = vscode.window.createInputBox();
		input.title = '请输入手机连接地址（格式为：192.168.XXX.XXX:3353）';
		input.show();

		input.onDidAccept(() => {
			const params: any[] = input.value.split(':');
			if (params.length !== 2 || !/([\d]{1,3}\.){3}[\d]{1,3}/.test(params[0]) || params[1] * 1 <= 1024 || params[1] * 1 > 65535) {
				return log.model("手机连接地址有误~");
			}

			input.hide();
			client = new Cilent(params[0], params[1]);
			loadingModel(client.createSocket());
			return true;
		});
	}));

	let errorMsg = "未连接手机或连接中断（请执行“连接手机”命令）";
	context.subscriptions.push(vscode.commands.registerCommand('deekescript.projectSync', () => {
		if (!client?.state()) {
			return log.modelError(errorMsg);
		}
		client?.projectSync();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('deekescript.fileSync', () => {
		if (!client?.state()) {
			return log.modelError(errorMsg);
		}
		if (vscode.window?.activeTextEditor?.document) {
			client.fileSync(vscode.window?.activeTextEditor?.document?.fileName);
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('deekescript.run', () => {
		//file  run
		if (!client?.state()) {
			return log.modelError(errorMsg);
		}

		if (vscode.window?.activeTextEditor?.document) {
			client.fileRunCommand({
				file: vscode.window?.activeTextEditor?.document?.fileName,
			});
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('deekescript.projectRun', () => {
		//Project  run
		if (!client?.state()) {
			return log.modelError(errorMsg);
		}
		client.projectRunCommand();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('deekescript.stopAll', () => {
		//stop  all script
		if (!client?.state()) {
			return log.modelError(errorMsg);
		}
		client.stopCommand();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('deekescript.serverClose', () => {
		if (client?.state()) {
			client.close();
			workspace.setStop(true);//stop workspace listening
			log.modelInfo("连接关闭成功")
		} else {
			log.modelError("连接未开启")
		}
	}));
}

// This method is called when your extension is deactivated
export function deactivate() { }
