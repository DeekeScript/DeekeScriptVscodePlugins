import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { FileSyncData, FileDeleteData, ProjectInitData, FileOperationResult, ProjectSyncState } from '../types';
import { WebSocketService } from './WebSocketService';
import { getRelativePath } from '../utils';
import { showFileSyncProgress } from '../utils/progress';
import log from '../unit/log';

export class FileSyncService {
  private wsService: WebSocketService;
  private syncState: ProjectSyncState = {
    isSyncing: false,
    totalFiles: 0,
    syncedFiles: 0,
    errors: []
  };

  constructor(wsService: WebSocketService) {
    this.wsService = wsService;
  }

  get state(): ProjectSyncState {
    return { ...this.syncState };
  }

  // 同步单个文件
  async syncFile(baseDir: string, filePath: string, isDir: boolean = false, document?: vscode.TextDocument): Promise<FileOperationResult> {
    try {
      if (!this.wsService.isConnected) {
        throw new Error('WebSocket未连接');
      }

      const relativePath = getRelativePath(baseDir, filePath);
      
      // 获取文件内容：优先使用文档对象中的实时内容，否则从磁盘读取
      let fileContent = '';
      if (!isDir) {
        if (document) {
          // 使用文档对象中的实时内容，转换为base64
          fileContent = Buffer.from(document.getText(), 'utf8').toString('base64');
        } else {
          // 从磁盘读取文件，直接转换为base64
          const fileBuffer = fs.readFileSync(filePath);
          fileContent = fileBuffer.toString('base64');
        }
      }

      const data: Omit<FileSyncData, 'key'> = {
        status: 1001,
        file: relativePath,
        isDir: isDir,
        body: fileContent
      };

      // 发送消息并等待服务端确认
      await this.wsService.sendWithResponse(data);
      
      // 收到服务端确认后再打印日志
      log.formatSuccess(`${isDir ? '同步文件夹：' : '同步文件：'}${relativePath}`);
      
      return {
        success: true,
        message: `成功同步${isDir ? '文件夹' : '文件'}：${relativePath}`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      log.formatError(`同步文件失败：${errorMessage}`);
      
      return {
        success: false,
        message: `同步失败：${errorMessage}`,
        error: error instanceof Error ? error : new Error(errorMessage)
      };
    }
  }

  // 删除文件
  async deleteFile(baseDir: string, filePath: string, isDir: boolean = false): Promise<FileOperationResult> {
    try {
      if (!this.wsService.isConnected) {
        throw new Error('WebSocket未连接');
      }

      const relativePath = getRelativePath(baseDir, filePath);
      const data: Omit<FileDeleteData, 'key'> = {
        status: 1003,
        file: relativePath,
        isDir: isDir,
        body: ''
      };

      // 发送消息并等待服务端确认
      await this.wsService.sendWithResponse(data);
      
      // 收到服务端确认后再打印日志
      log.formatSuccess(`${isDir ? '删除文件夹：' : '删除文件：'}${relativePath}`);
      
      return {
        success: true,
        message: `成功删除${isDir ? '文件夹' : '文件'}：${relativePath}`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      log.formatError(`删除文件失败：${errorMessage}`);
      
      return {
        success: false,
        message: `删除失败：${errorMessage}`,
        error: error instanceof Error ? error : new Error(errorMessage)
      };
    }
  }

  // 同步整个项目
  async syncProject(baseDir: string): Promise<FileOperationResult> {
    if (this.syncState.isSyncing) {
      return {
        success: false,
        message: '项目正在同步中，请稍后再试'
      };
    }

    this.syncState = {
      isSyncing: true,
      totalFiles: 0,
      syncedFiles: 0,
      errors: []
    };

    try {
      const files = await this.scanProjectFiles(baseDir);
      this.syncState.totalFiles = files.length;

      if (files.length === 0) {
        log.formatWarning('没有找到需要同步的文件');
        return {
          success: true,
          message: '没有找到需要同步的文件'
        };
      }

      // 使用进度条显示同步进度
      await showFileSyncProgress(files.length, async (progressCallback) => {
        let currentFile = 0;

        // 同步所有文件
        for (const file of files) {
          currentFile++;
          const relativePath = getRelativePath(baseDir, file.path);
          const fileType = file.isDir ? '文件夹' : '文件';
          
          progressCallback(currentFile, `同步${fileType}: ${relativePath}`);

          try {
            // 尝试获取文档对象以获取最新内容
            const document = vscode.workspace.textDocuments.find(doc => doc.fileName === file.path);
            const result = await this.syncFile(baseDir, file.path, file.isDir, document);
            if (result.success) {
              this.syncState.syncedFiles++;
            } else {
              this.syncState.errors.push(result.message);
            }
            
            // 添加小延迟，让用户能看到进度变化
            if (currentFile < files.length) {
              await new Promise(resolve => setTimeout(resolve, 2));
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            this.syncState.errors.push(errorMessage);
          }
        }

        // 初始化项目文件列表
        progressCallback(files.length, '初始化项目文件列表...');
        await this.initProjectFiles(files, baseDir);
      });

      const successMessage = `项目同步完成，共${this.syncState.syncedFiles}/${this.syncState.totalFiles}个文件`;
      if (this.syncState.errors.length > 0) {
        log.formatWarning(`${successMessage}，${this.syncState.errors.length}个文件同步失败`);
      } else {
        log.formatSuccess(successMessage);
      }

      return {
        success: this.syncState.errors.length === 0,
        message: successMessage
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      log.formatError(`项目同步失败：${errorMessage}`);
      
      return {
        success: false,
        message: `项目同步失败：${errorMessage}`,
        error: error instanceof Error ? error : new Error(errorMessage)
      };
    } finally {
      this.syncState.isSyncing = false;
    }
  }

  // 扫描项目文件
  private async scanProjectFiles(baseDir: string): Promise<Array<{ path: string; isDir: boolean }>> {
    const files: Array<{ path: string; isDir: boolean }> = [];
    
    const scanDirectory = (dir: string): void => {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        if (item.startsWith('.')) {
          continue; // 跳过隐藏文件
        }

        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          if (item === 'node_modules') {
            continue; // 跳过node_modules
          }
          
          files.push({ path: fullPath, isDir: true });
          scanDirectory(fullPath);
        } else {
          files.push({ path: fullPath, isDir: false });
        }
      }
    };

    scanDirectory(baseDir);
    return files;
  }

  // 初始化项目文件列表
  private async initProjectFiles(files: Array<{ path: string; isDir: boolean }>, baseDir: string): Promise<void> {
    try {
      const fileList = files.map(file => [
        file.isDir,
        getRelativePath(baseDir, file.path)
      ]);

      const data: Omit<ProjectInitData, 'key'> = {
        status: 1002,
        body: JSON.stringify(fileList)
      };

      // 发送消息并等待服务端确认
      await this.wsService.sendWithResponse(data);
      log.info('项目文件列表已发送到APP端');
    } catch (error) {
      log.error(`初始化项目文件列表失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  // 重置同步状态
  resetSyncState(): void {
    this.syncState = {
      isSyncing: false,
      totalFiles: 0,
      syncedFiles: 0,
      errors: []
    };
  }

} 