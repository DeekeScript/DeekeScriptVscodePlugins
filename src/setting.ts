import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

let extension!: vscode.Extension<any>;
let logg!: vscode.LogOutputChannel;
let context!: vscode.ExtensionContext;

const setting = {
    init(context: vscode.ExtensionContext) {
        this.setExtension(context.extension);
        this.setLogWindows(context.extension);
        this.setContext(context);
    },
    setExtension(iExtension: vscode.Extension<any>) {
        extension = iExtension;
    },
    getExtension() {
        return extension;
    },
    setContext(iContext: vscode.ExtensionContext) {
        context = iContext;
    },
    getContext() {
        return context;
    },
    setLogWindows(extension: vscode.Extension<any>) {
        logg = vscode.window.createOutputChannel(extension.packageJSON.displayName, { log: true });
        logg.show(true);
    },
    getLogWindows() {
        return logg;
    },
    isProject(): boolean {
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

export default setting;