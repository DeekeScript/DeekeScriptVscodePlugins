import { ConfigurationChangeEvent, FileCreateEvent, FileDeleteEvent, NotebookDocumentChangeEvent, TextDocumentChangeEvent, WorkspaceFoldersChangeEvent, workspace } from "vscode";
import log from "./unit/log";
import * as vscode from 'vscode';
import setting from "./setting";

export class Workspace {
    stop: boolean = false;
    setStop(stop: boolean) {
        this.stop = stop;
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
            log.info("配置变化了");
        });

        vscode.workspace.onDidChangeNotebookDocument((e: NotebookDocumentChangeEvent) => {
            if (!this.canEdit(e.notebook.uri.path) || !e.notebook.isDirty) {
                return false;
            }
            log.info("内容变更：" + e.notebook.uri.path);
        });

        vscode.workspace.onDidChangeTextDocument((e: TextDocumentChangeEvent) => {
            if (!this.canEdit(e.document.fileName) || !e.document.isDirty) {
                return false;
            }
            //log.info("文件变更：" + e.document.fileName);
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

        vscode.workspace.onDidCreateFiles((e: FileCreateEvent) => {
            if (!e.files) {
                return false;
            }

            log.info("文件新增：");
            for (let i in e.files) {
                if (!this.canEdit(e.files[i].path)) {
                    continue;
                }
                log.info(e.files[i].path);
            }
            return false;
        });

        vscode.workspace.onDidDeleteFiles((e: FileDeleteEvent) => {
            if (!e.files) {
                return false;
            }

            if (e.files && e.files.length > 0) {
                log.info("文件移除：");
                for (let i in e.files) {
                    log.info(e.files[i].path);
                }
            }
        });

        vscode.workspace.onDidRenameFiles((e: vscode.FileRenameEvent) => {
            if (!e.files) {
                return false;
            }

            for (let i in e.files) {
                if (!this.canEdit(e.files[i].newUri.path)) {
                    continue;
                }
                return log.info("文件重命名：" + e.files[i].newUri.path + "变更为" + e.files[i].newUri.path);
            }
        });
    }
}
