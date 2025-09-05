import { ConfigurationChangeEvent, FileCreateEvent, FileDeleteEvent, NotebookDocumentChangeEvent, TextDocumentChangeEvent } from "vscode";
import log from "./unit/log";
import * as vscode from 'vscode';
import setting from "./setting";
import Client from "./Client";
import { debounce } from "./utils";

export class Workspace {
    private stop: boolean = false;
    private client: Client | undefined = undefined;
    private debouncedFileSync: (baseDir: string, filePath: string, isDir: boolean, document?: vscode.TextDocument) => void;

    constructor() {
        // 创建防抖的文件同步函数，延迟500ms
        this.debouncedFileSync = debounce((baseDir: string, filePath: string, isDir: boolean, document?: vscode.TextDocument) => {
            if (this.client) {
                // 在执行时重新获取最新的文档对象，确保获取到最新的内容
                const latestDocument = vscode.workspace.textDocuments.find(doc => doc.fileName === filePath);
                const documentToUse = latestDocument || document;
                
                this.client.fileSync(baseDir, filePath, isDir, documentToUse).catch((error: unknown) => {
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

    private canEdit(): boolean {
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

    // 递归同步文件夹内的所有文件
    private async syncDirectoryRecursively(baseDir: string, dirPath: string): Promise<void> {
        if (!this.client) return;

        try {
            // 首先同步文件夹本身
            await this.client.fileSync(baseDir, dirPath, true);
            //log.info(`同步文件夹：${dirPath}`);

            // 读取文件夹内容
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));
            
            for (const entry of entries) {
                const fullPath = dirPath + '/' + entry[0];
                const isDir = entry[1] === vscode.FileType.Directory;
                
                if (isDir) {
                    // 递归处理子文件夹
                    await this.syncDirectoryRecursively(baseDir, fullPath);
                } else {
                    // 同步文件 - 尝试获取文档对象
                    const document = vscode.workspace.textDocuments.find(doc => doc.fileName === fullPath);
                    await this.client.fileSync(baseDir, fullPath, false, document);
                    //log.info(`同步文件：${fullPath}`);
                }
            }
        } catch (error) {
            log.error(`递归同步文件夹失败：${dirPath} - ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    listening() {
        vscode.workspace.onDidChangeConfiguration((_e: ConfigurationChangeEvent) => {
            if (!this.canEdit()) {
                return;
            }
        });

        vscode.workspace.onDidChangeNotebookDocument((e: NotebookDocumentChangeEvent) => {
            if (!this.canEdit() || !e.notebook.isDirty) {
                return;
            }

            log.info("内容变更：" + e.notebook.uri.path);

            if (this.client) {
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(e.notebook.uri);
                if (!workspaceFolder) {
                    log.showError("当前文件不属于任何工作区");
                    return;
                }

                // 对于notebook，我们无法直接获取文本内容，所以不传递文档对象
                this.client.fileSync(workspaceFolder.uri.fsPath, e.notebook.uri.path, false);
            }
        });

        vscode.workspace.onDidChangeTextDocument((e: TextDocumentChangeEvent) => {
            if (!this.canEdit() || !e.document.isDirty) {
                return;
            }
            log.debug("文件变更：" + e.document.fileName);
            if (this.client) {
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(e.document.uri);
                if (!workspaceFolder) {
                    log.showError("当前文件不属于任何工作区");
                    return;
                }

                // 使用防抖的文件同步，传递文档对象以获取实时内容
                this.debouncedFileSync(workspaceFolder.uri.fsPath, e.document.fileName, false, e.document);
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
                return;
            }

            log.info("文件新增：");
            for (let i in e.files) {
                if (!this.canEdit()) {
                    continue;
                }
                log.info(e.files[i].fsPath);
                if (this.client) {
                    const workspaceFolder = vscode.workspace.getWorkspaceFolder(e.files[i]);
                    if (!workspaceFolder) {
                        log.showError("当前文件不属于任何工作区");
                        return;
                    }
                    const stats = await vscode.workspace.fs.stat(e.files[i]);
                    const isDir = stats.type == vscode.FileType.File ? false : true;
                    
                    if (isDir) {
                        // 如果是文件夹，递归同步文件夹内的所有文件
                        await this.syncDirectoryRecursively(workspaceFolder.uri.fsPath, e.files[i].fsPath);
                    } else {
                        // 如果是文件，直接同步 - 尝试获取文档对象
                        const document = vscode.workspace.textDocuments.find(doc => doc.fileName === e.files[i].fsPath);
                        this.client.fileSync(workspaceFolder.uri.fsPath, e.files[i].fsPath, isDir, document);
                    }
                }
            }
        });

        vscode.workspace.onDidDeleteFiles((e: FileDeleteEvent) => {
            if (!e.files) {
                return;
            }

            if (e.files && e.files.length > 0) {
                log.info("文件移除：");
                for (let i in e.files) {
                    log.info(e.files[i].fsPath);
                    if (this.client) {
                        const workspaceFolder = vscode.workspace.getWorkspaceFolder(e.files[i]);
                        if (!workspaceFolder) {
                            log.showError("当前文件不属于任何工作区");
                            return;
                        }

                        //文件其实不需要传类型，文件和文件夹不会重名，Android端直接能判断 【这里因为文件已经被删了，所以判断不了类型】
                        this.client.fileDelete(workspaceFolder.uri.fsPath, e.files[i].fsPath, false);
                    }
                }
            }
        });

        vscode.workspace.onDidRenameFiles(async (e: vscode.FileRenameEvent) => {
            if (!e.files) {
                return;
            }

            for (let i in e.files) {
                if (!this.canEdit()) {
                    continue;
                }
                log.info("文件重命名：" + e.files[i].oldUri.fsPath + "变更为" + e.files[i].newUri.fsPath);
                if (this.client) {
                    const stats = await vscode.workspace.fs.stat(e.files[i].newUri);
                    const isDir = stats.type == vscode.FileType.File ? false : true;
                    const workspaceFolder = vscode.workspace.getWorkspaceFolder(e.files[i].newUri);
                    if (!workspaceFolder) {
                        log.showError("当前文件不属于任何工作区");
                        return;
                    }

                    // 删除旧文件/文件夹
                    this.client.fileDelete(workspaceFolder.uri.fsPath, e.files[i].oldUri.fsPath, isDir);
                    
                    if (isDir) {
                        // 如果是文件夹，递归同步文件夹内的所有文件
                        await this.syncDirectoryRecursively(workspaceFolder.uri.fsPath, e.files[i].newUri.fsPath);
                    } else {
                        // 如果是文件，直接同步 - 尝试获取文档对象
                        const document = vscode.workspace.textDocuments.find(doc => doc.fileName === e.files[i].newUri.fsPath);
                        this.client.fileSync(workspaceFolder.uri.fsPath, e.files[i].newUri.fsPath, isDir, document);
                    }
                }
            }
        });
    }
}
