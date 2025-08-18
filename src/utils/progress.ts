import * as vscode from 'vscode';
import log from '../unit/log';

// 简化的进度条工具
export async function showProgress<T>(
  title: string,
  task: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<T>
): Promise<T> {
  return vscode.window.withProgress(
    {
      title,
      cancellable: true,
      location: vscode.ProgressLocation.Notification
    },
    async (progress, token) => {
      token.onCancellationRequested(() => {
        log.formatWarning('操作已取消');
      });

      return await task(progress);
    }
  );
}

// 文件同步进度条
export async function showFileSyncProgress(
  totalFiles: number,
  syncTask: (progressCallback: (current: number, message: string) => void) => Promise<void>
): Promise<void> {
  await showProgress('文件同步中...', async (progress) => {
    let lastReportedFile = 0;
    let lastReportTime = 0;
    let startTime = Date.now();
    
    // 显示初始进度
    progress.report({
      message: `准备同步 ${totalFiles} 个文件... (0/${totalFiles}, 0%)`,
      increment: 0
    });
    
    await syncTask((current: number, message: string) => {
      const now = Date.now();
      const percentage = Math.round((current / totalFiles) * 100);
      const elapsed = Math.round((now - startTime) / 1000);
      
      // 确保进度条有最小显示时间，避免一闪而过
      const minDisplayTime = 150; // 最小显示时间150ms
      const timeSinceLastReport = now - lastReportTime;
      
      if (timeSinceLastReport >= minDisplayTime || current === totalFiles) {
        const increment = current > lastReportedFile ? ((current - lastReportedFile) / totalFiles) * 100 : 0;
        
        // 计算预估剩余时间
        let timeInfo = '';
        if (current > 0 && elapsed > 0) {
          const avgTimePerFile = elapsed / current;
          const remainingFiles = totalFiles - current;
          const estimatedRemaining = Math.round(avgTimePerFile * remainingFiles);
          timeInfo = `，已用时: ${elapsed}s，预计剩余: ${estimatedRemaining}s`;
        }
        
        progress.report({
          message: `${message} (${current}/${totalFiles}, ${percentage}%)${timeInfo}`,
          increment: increment
        });
        
        lastReportedFile = current;
        lastReportTime = now;
      }
    });
  });
}

// 连接进度条
export async function showConnectionProgress(
  connectionTask: () => Promise<void>
): Promise<void> {
  await showProgress('正在连接...', async (progress) => {
    progress.report({ message: '正在建立连接...' });
    await connectionTask();
    progress.report({ message: '连接成功！', increment: 100 });
  });
} 