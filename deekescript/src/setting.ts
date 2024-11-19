import * as vscode from 'vscode';

let extension!: vscode.Extension<any>;
let logg!: vscode.LogOutputChannel;
let context!: vscode.ExtensionContext;

const setting = {
    init(context: vscode.ExtensionContext) {
        this.setExtention(context.extension);
        this.setLogWindows(context.extension);
        this.setContext(context);
    },
    setExtention(iExtension: vscode.Extension<any>) {
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
    },
    getLogWindows() {
        return logg;
    },
    isProject() {
        let dir = setting.getContext().asAbsolutePath("");
        return vscode.FileSystemError.FileExists(dir + "/deekeScript.json");//is or not the project is deeke project
    }
}

export default setting;