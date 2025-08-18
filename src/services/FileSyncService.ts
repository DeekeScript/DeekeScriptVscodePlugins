import * as fs from 'fs';
import * as path from 'path';
import { FileSyncData, FileDeleteData, ProjectInitData, FileOperationResult, ProjectSyncState } from '../types';
import { WebSocketService } from './WebSocketService';
import { normalizePath, getRelativePath } from '../utils';
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
  async syncFile(baseDir: string, filePath: string, isDir: boolean = false): Promise<FileOperationResult> {
    try {
      if (!this.wsService.isConnected) {
        throw new Error('WebSocket未连接');
      }

      const relativePath = getRelativePath(baseDir, filePath);
      const data: FileSyncData = {
        status: 1001,
        file: relativePath,
        isDir: isDir,
        body: isDir ? '' : fs.readFileSync(filePath).toString('base64')
      };

      await this.wsService.send(data);
      
      log.info(`${isDir ? '同步文件夹：' : '同步文件：'}${relativePath}`);
      
      return {
        success: true,
        message: `成功同步${isDir ? '文件夹' : '文件'}：${relativePath}`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      log.error(`同步文件失败：${errorMessage}`);
      
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
      const data: FileDeleteData = {
        status: 1003,
        file: relativePath,
        isDir: isDir,
        body: ''
      };

      await this.wsService.send(data);
      
      log.info(`${isDir ? '删除文件夹：' : '删除文件：'}${relativePath}`);
      
      return {
        success: true,
        message: `成功删除${isDir ? '文件夹' : '文件'}：${relativePath}`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      log.error(`删除文件失败：${errorMessage}`);
      
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

      // 同步所有文件
      for (const file of files) {
        try {
          const result = await this.syncFile(baseDir, file.path, file.isDir);
          if (result.success) {
            this.syncState.syncedFiles++;
          } else {
            this.syncState.errors.push(result.message);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '未知错误';
          this.syncState.errors.push(errorMessage);
        }
      }

      // 初始化项目文件列表
      await this.initProjectFiles(files);

      const successMessage = `项目同步完成，共${this.syncState.syncedFiles}/${this.syncState.totalFiles}个文件`;
      if (this.syncState.errors.length > 0) {
        log.warn(`${successMessage}，${this.syncState.errors.length}个文件同步失败`);
      } else {
        log.info(successMessage);
      }

      return {
        success: this.syncState.errors.length === 0,
        message: successMessage
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      log.error(`项目同步失败：${errorMessage}`);
      
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
  private async initProjectFiles(files: Array<{ path: string; isDir: boolean }>): Promise<void> {
    try {
      const fileList = files.map(file => [
        file.isDir,
        getRelativePath(files[0].path.split(path.sep).slice(0, -1).join(path.sep), file.path)
      ]);

      const data: ProjectInitData = {
        status: 1002,
        body: JSON.stringify(fileList)
      };

      await this.wsService.send(data);
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