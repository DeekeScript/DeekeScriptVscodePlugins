import * as vscode from 'vscode';
import setting from '../setting';
const log = {
    type: 0,
    setType(type: number) {
        this.type = type;
    },
    info(str: string, params: any = []) {
        setting.getLogWindows().info(str, ...params);
    },
    model(str: string) {
        vscode.window.showInformationMessage(str);
    },
    modelInfo(str: string, params: any = []) {
        setting.getLogWindows().info(str, ...params);
        vscode.window.showInformationMessage(str);
    },
    modelError(str: string, params: any = []) {
        setting.getLogWindows().error(str, ...params);
        vscode.window.showErrorMessage(str);
    },
}

export default log;