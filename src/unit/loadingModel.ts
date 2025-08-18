import * as vscode from 'vscode';

export function loadingModel(p: Promise<any>, title: string = '正在连接...') {
    vscode.window.withProgress({
        cancellable: true,
        location: vscode.ProgressLocation.Notification,
        title: title
    }, (_progress, token) => {
        token.onCancellationRequested(() => {
            vscode.window.showInformationMessage("取消成功!");
        });

        return p;
    });
}
