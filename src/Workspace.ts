import { ConfigurationChangeEvent, FileCreateEvent, FileDeleteEvent, NotebookDocumentChangeEvent, TextDocumentChangeEvent } from "vscode";
import log from "./unit/log";
import * as vscode from 'vscode';
import setting from "./setting";
import Client from "./Client";
import { debounce, getRelativePath } from "./utils";
import { configManager } from "./utils/config";

type DebouncedSync = (baseDir: string, filePath: string, document?: vscode.TextDocument) => void;

export class Workspace {
    private stop: boolean = false;
    private client: Client | undefined = undefined;
    /** 按文件路径独立防抖，避免多文件编辑时互相覆盖 */
    private readonly debouncers = new Map<string, DebouncedSync>();
    private fileWatcher: vscode.FileSystemWatcher | undefined;

    setStop(stop: boolean) {
        this.stop = stop;
    }

    setClient(client: Client | undefined) {
        this.client = client;
    }

    init(context: vscode.ExtensionContext) {
        this.listening(context);
        log.info("正在监听工作区文件变化（连接成功后自动同步到手机）");
    }

    /** 已连接且允许自动同步 */
    private canSync(): boolean {
        if (this.stop) {
            return false;
        }
        if (!setting.isProject()) {
            return false;
        }
        if (!configManager.getSyncConfig().autoSync) {
            return false;
        }
        if (!this.client?.state()) {
            return false;
        }
        return true;
    }

    private shouldSyncPath(filePath: string): boolean {
        const normalized = filePath.replace(/\\/g, '/');
        return !configManager.getSyncConfig().excludePatterns.some((pattern) => normalized.includes(pattern));
    }

    private getWorkspaceFolder(uri: vscode.Uri): vscode.WorkspaceFolder | undefined {
        return vscode.workspace.getWorkspaceFolder(uri);
    }

    private getDebouncedSync(filePath: string): DebouncedSync {
        let fn = this.debouncers.get(filePath);
        if (!fn) {
            fn = debounce((baseDir: string, path: string, document?: vscode.TextDocument) => {
                void this.syncFileToPhone(baseDir, path, false, document);
            }, configManager.getSyncConfig().debounceDelay);
            this.debouncers.set(filePath, fn);
        }
        return fn;
    }

    private scheduleFileSync(baseDir: string, filePath: string, document?: vscode.TextDocument): void {
        if (!this.canSync() || !this.shouldSyncPath(filePath)) {
            return;
        }
        this.getDebouncedSync(filePath)(baseDir, filePath, document);
    }

    private isDocumentOpen(uri: vscode.Uri): boolean {
        const target = uri.toString();
        return vscode.workspace.textDocuments.some((doc) => doc.uri.toString() === target);
    }

    private async syncFileToPhone(
        baseDir: string,
        filePath: string,
        isDir: boolean = false,
        document?: vscode.TextDocument
    ): Promise<void> {
        if (!this.canSync() || !this.client) {
            return;
        }
        if (!isDir && !this.shouldSyncPath(filePath)) {
            return;
        }

        try {
            const latestDocument = vscode.workspace.textDocuments.find((doc) => doc.fileName === filePath);
            await this.client.fileSync(baseDir, filePath, isDir, latestDocument || document);
        } catch (error) {
            log.error(`自动同步失败：${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    // 递归同步文件夹内的所有文件
    private async syncDirectoryRecursively(baseDir: string, dirPath: string): Promise<void> {
        if (!this.canSync() || !this.client) {
            return;
        }
        if (!this.shouldSyncPath(dirPath)) {
            return;
        }

        try {
            await this.client.fileSync(baseDir, dirPath, true);

            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));

            for (const entry of entries) {
                const fullPath = dirPath + '/' + entry[0];
                if (!this.shouldSyncPath(fullPath)) {
                    continue;
                }

                const isDir = entry[1] === vscode.FileType.Directory;
                if (isDir) {
                    await this.syncDirectoryRecursively(baseDir, fullPath);
                } else {
                    await this.syncFileToPhone(baseDir, fullPath, false);
                }
            }
        } catch (error) {
            log.error(`递归同步文件夹失败：${dirPath} - ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    private async handleFileUri(uri: vscode.Uri, isDir: boolean): Promise<void> {
        if (uri.scheme !== 'file' || !this.canSync()) {
            return;
        }

        const workspaceFolder = this.getWorkspaceFolder(uri);
        if (!workspaceFolder) {
            return;
        }

        const filePath = uri.fsPath;
        if (isDir) {
            await this.syncDirectoryRecursively(workspaceFolder.uri.fsPath, filePath);
            return;
        }

        const document = vscode.workspace.textDocuments.find((doc) => doc.fileName === filePath);
        await this.syncFileToPhone(workspaceFolder.uri.fsPath, filePath, false, document);
    }

    listening(context: vscode.ExtensionContext) {
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration((_e: ConfigurationChangeEvent) => {
                configManager.reloadConfig();
            })
        );

        context.subscriptions.push(
            vscode.workspace.onDidChangeNotebookDocument((e: NotebookDocumentChangeEvent) => {
                if (!this.canSync() || !e.notebook.isDirty) {
                    return;
                }

                const workspaceFolder = this.getWorkspaceFolder(e.notebook.uri);
                if (!workspaceFolder) {
                    return;
                }

                void this.syncFileToPhone(workspaceFolder.uri.fsPath, e.notebook.uri.fsPath, false);
            })
        );

        // 编辑过程中防抖同步
        context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument((e: TextDocumentChangeEvent) => {
                if (!this.canSync()) {
                    return;
                }

                const workspaceFolder = this.getWorkspaceFolder(e.document.uri);
                if (!workspaceFolder) {
                    return;
                }

                this.scheduleFileSync(workspaceFolder.uri.fsPath, e.document.fileName, e.document);
            })
        );

        // 保存时立即同步最新内容
        context.subscriptions.push(
            vscode.workspace.onDidSaveTextDocument((document) => {
                if (!this.canSync()) {
                    return;
                }

                const workspaceFolder = this.getWorkspaceFolder(document.uri);
                if (!workspaceFolder) {
                    return;
                }

                void this.syncFileToPhone(workspaceFolder.uri.fsPath, document.fileName, false, document);
            })
        );

        context.subscriptions.push(
            vscode.workspace.onDidCreateFiles(async (e: FileCreateEvent) => {
                if (!e.files?.length) {
                    return;
                }

                for (const file of e.files) {
                    if (!this.canSync()) {
                        continue;
                    }

                    const workspaceFolder = this.getWorkspaceFolder(file);
                    if (!workspaceFolder) {
                        continue;
                    }

                    log.info(`文件新增：${getRelativePath(workspaceFolder.uri.fsPath, file.fsPath)}`);
                    const stats = await vscode.workspace.fs.stat(file);
                    const isDir = stats.type !== vscode.FileType.File;
                    await this.handleFileUri(file, isDir);
                }
            })
        );

        context.subscriptions.push(
            vscode.workspace.onDidDeleteFiles((e: FileDeleteEvent) => {
                if (!e.files?.length || !this.canSync() || !this.client) {
                    return;
                }

                for (const file of e.files) {
                    if (!this.shouldSyncPath(file.fsPath)) {
                        continue;
                    }

                    const workspaceFolder = this.getWorkspaceFolder(file);
                    if (!workspaceFolder) {
                        continue;
                    }

                    log.info(`文件移除：${getRelativePath(workspaceFolder.uri.fsPath, file.fsPath)}`);
                    void this.client.fileDelete(workspaceFolder.uri.fsPath, file.fsPath, false);
                }
            })
        );

        context.subscriptions.push(
            vscode.workspace.onDidRenameFiles(async (e: vscode.FileRenameEvent) => {
                if (!e.files?.length || !this.canSync() || !this.client) {
                    return;
                }

                for (const file of e.files) {
                    const workspaceFolder = this.getWorkspaceFolder(file.newUri);
                    if (!workspaceFolder) {
                        continue;
                    }

                    log.info(`文件重命名：${file.oldUri.fsPath} → ${file.newUri.fsPath}`);
                    const stats = await vscode.workspace.fs.stat(file.newUri);
                    const isDir = stats.type !== vscode.FileType.File;

                    await this.client.fileDelete(workspaceFolder.uri.fsPath, file.oldUri.fsPath, isDir);
                    await this.handleFileUri(file.newUri, isDir);
                }
            })
        );

        // 磁盘修改（Git 切换、外部工具写入）；已在编辑器中打开的文件由 onDidChangeTextDocument 处理
        this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');
        this.fileWatcher.onDidChange((uri) => {
            if (!this.canSync() || this.isDocumentOpen(uri)) {
                return;
            }
            const workspaceFolder = this.getWorkspaceFolder(uri);
            if (!workspaceFolder) {
                return;
            }
            this.scheduleFileSync(workspaceFolder.uri.fsPath, uri.fsPath);
        });
        context.subscriptions.push(this.fileWatcher);
    }
}
