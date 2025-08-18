import { ConfigurationChangeEvent, FileCreateEvent, FileDeleteEvent, NotebookDocumentChangeEvent, TextDocumentChangeEvent, WorkspaceFoldersChangeEvent, workspace } from "vscode";
import log from "./unit/log";
import * as vscode from 'vscode';
import setting from "./setting";
import Client from "./Client";
import { debounce } from "./utils";

export class Workspace {
    private stop: boolean = false;
    private client: Client | undefined = undefined;
    private debouncedFileSync: (baseDir: string, filePath: string, isDir: boolean) => void;

    constructor() {
        // 创建防抖的文件同步函数，延迟500ms
        this.debouncedFileSync = debounce((baseDir: string, filePath: string, isDir: boolean) => {
            if (this.client) {
                this.client.fileSync(baseDir, filePath, isDir).catch((error: unknown) => {
                    log.error(`防抖同步文件失败：${error instanceof Error ? error.message : '未知错误'}`);
                });
            }
        }, 500);
    }

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

    private canEdit(file: string | undefined): boolean {
        if (this.stop) {
            return false;
        }

        if (!setting.isProject()) {
            log.debug("非DeekeScript项目，跳过文件监听");
            return false;
        }

        // 简化文件存在检查，避免异步操作
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
            log.debug("文件变更：" + e.document.fileName);
            if (this.client) {
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(e.document.uri);
                if (!workspaceFolder) {
                    log.showError("当前文件不属于任何工作区");
                    return;
                }

                // 使用防抖的文件同步
                this.debouncedFileSync(workspaceFolder.uri.fsPath, e.document.fileName, false);
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

        vscode.workspace.onDidDeleteFiles((e: FileDeleteEvent) => {
            if (!e.files) {
                return false;
            }

            if (e.files && e.files.length > 0) {
                log.info("文件移除：");
                for (let i in e.files) {
                    log.info(e.files[i].path);
                    if (this.client) {
                        const workspaceFolder = vscode.workspace.getWorkspaceFolder(e.files[i]);
                        if (!workspaceFolder) {
                            return log.modelError("当前文件不属于任何工作区");
                        }

                        //文件其实不需要传类型，文件和文件夹不会重名，Android端直接能判断 【这里因为文件已经被删了，所以判断不了类型】
                        this.client.fileDelete(workspaceFolder.uri.fsPath, e.files[i].path, false);
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
