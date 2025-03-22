import { ConfigurationChangeEvent, FileCreateEvent, FileDeleteEvent, NotebookDocumentChangeEvent, TextDocumentChangeEvent, WorkspaceFoldersChangeEvent, workspace } from "vscode";
import log from "./unit/log";
import * as vscode from 'vscode';
import setting from "./setting";
import Client from "./Client";

export class Workspace {
    stop: boolean = false;
    client: Client | undefined = undefined;
    setStop(stop: boolean) {
        this.stop = stop;
    }

    setClient(client: Client) {
        this.client = client;
    }

    init() {
        this.listening();
        log.info("正在监听工作区文件变化");
    }

    canEdit(file: string | undefined) {
        if (this.stop) {
            return false;
        }

        //log.info(JSON.stringify(vscode.workspace.workspaceFolders));
        if (!setting.isProject()) {
            log.info("失败了~");
            return false;
        }

        if (file && !vscode.FileSystemError.FileExists(file)) {
            return false;
        }
        return true;
    }

    listening() {
        vscode.workspace.onDidChangeConfiguration((e: ConfigurationChangeEvent) => {
            if (!this.canEdit(undefined)) {
                return false;
            }
        });

        vscode.workspace.onDidChangeNotebookDocument((e: NotebookDocumentChangeEvent) => {
            if (!this.canEdit(e.notebook.uri.path) || !e.notebook.isDirty) {
                return false;
            }

            log.info("内容变更：" + e.notebook.uri.path);

            if (this.client) {
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(e.notebook.uri);
                if (!workspaceFolder) {
                    return log.modelError("当前文件不属于任何工作区");
                }

                this.client.fileSync(workspaceFolder.uri.fsPath, e.notebook.uri.path, false);
            }
        });

        vscode.workspace.onDidChangeTextDocument((e: TextDocumentChangeEvent) => {
            if (!this.canEdit(e.document.fileName) || !e.document.isDirty) {
                return false;
            }
            log.info("文件变更：" + e.document.fileName);
            if (this.client) {
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(e.document.uri);
                if (!workspaceFolder) {
                    return log.modelError("当前文件不属于任何工作区");
                }

                this.client.fileSync(workspaceFolder.uri.fsPath, e.document.fileName, false);
            }
        });

        // vscode.workspace.onDidChangeWorkspaceFolders((e: WorkspaceFoldersChangeEvent) => {
        //     if (!e.added) {
        //         return false;
        //     }

        //     for (let i in e.added) {
        //         if (this.canEdit(e.added[i].uri.path)) {
        //             continue;
        //         }
        //         return log.info("目录变更：" + e.added[i].uri.path);
        //     }
        // });

        vscode.workspace.onDidCreateFiles(async (e: FileCreateEvent) => {
            if (!e.files) {
                return false;
            }

            log.info("文件新增：");
            for (let i in e.files) {
                if (!this.canEdit(e.files[i].path)) {
                    continue;
                }
                log.info(e.files[i].path);
                if (this.client) {
                    const workspaceFolder = vscode.workspace.getWorkspaceFolder(e.files[i]);
                    if (!workspaceFolder) {
                        return log.modelError("当前文件不属于任何工作区");
                    }
                    const stats = await vscode.workspace.fs.stat(e.files[i]);
                    const isDir = stats.type == vscode.FileType.File ? false : true;
                    this.client.fileSync(workspaceFolder.uri.fsPath, e.files[i].path, isDir);
                }
            }
            return false;
        });

        vscode.workspace.onDidDeleteFiles(async (e: FileDeleteEvent) => {
            if (!e.files) {
                return false;
            }

            if (e.files && e.files.length > 0) {
                log.info("文件移除：");
                for (let i in e.files) {
                    log.info(e.files[i].path);
                    if (this.client) {
                        const workspaceFolder = vscode.workspace.getWorkspaceFolder(e.files[i]);
                        const stats = await vscode.workspace.fs.stat(e.files[i]);
                        const isDir = stats.type == vscode.FileType.File ? false : true;
                        if (!workspaceFolder) {
                            return log.modelError("当前文件不属于任何工作区");
                        }

                        this.client.fileDelete(workspaceFolder.uri.fsPath, e.files[i].path, isDir);
                    }
                }
            }
        });

        vscode.workspace.onDidRenameFiles(async (e: vscode.FileRenameEvent) => {
            if (!e.files) {
                return false;
            }

            for (let i in e.files) {
                if (!this.canEdit(e.files[i].newUri.path)) {
                    continue;
                }
                log.info("文件重命名：" + e.files[i].newUri.path + "变更为" + e.files[i].newUri.path);
                if (this.client) {
                    const stats = await vscode.workspace.fs.stat(e.files[i].newUri);
                    const isDir = stats.type == vscode.FileType.File ? false : true;
                    const workspaceFolder = vscode.workspace.getWorkspaceFolder(e.files[i].newUri);
                    if (!workspaceFolder) {
                        return log.modelError("当前文件不属于任何工作区");
                    }

                    this.client.fileDelete(workspaceFolder.uri.fsPath, e.files[i].oldUri.path, isDir);
                    this.client.fileSync(workspaceFolder.uri.fsPath, e.files[i].newUri.path, isDir);
                }
            }
        });
    }
}
