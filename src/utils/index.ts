import * as vscode from 'vscode';

// IP地址验证函数
export function isValidIPAddress(ip: string): boolean {
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipRegex.test(ip);
}

// 防抖函数
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  };
}

// 获取工作区文件夹
export function getWorkspaceFolder(uri: vscode.Uri): vscode.WorkspaceFolder | undefined {
  return vscode.workspace.getWorkspaceFolder(uri);
}

// 验证文件是否属于工作区
export function validateWorkspaceFile(document: vscode.TextDocument): vscode.WorkspaceFolder | null {
  const workspaceFolder = getWorkspaceFolder(document.uri);
  if (!workspaceFolder) {
    throw new Error("当前文件不属于任何工作区");
  }
  return workspaceFolder;
}

// 格式化文件路径
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

// 获取相对路径
export function getRelativePath(baseDir: string, filePath: string): string {
  return normalizePath(filePath.substring(baseDir.length));
}

// 检查是否为DeekeScript项目
export async function isDeekeScriptProject(context: vscode.ExtensionContext): Promise<boolean> {
  const projectPath = context.asAbsolutePath("");
  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(`${projectPath}/deekeScript.json`));
    return true;
  } catch {
    return false;
  }
}

// 延迟函数
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 重试函数
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  baseDelay: number
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      const delayMs = baseDelay * Math.pow(2, attempt - 1); // 指数退避
      await delay(delayMs);
    }
  }
  
  throw lastError!;
} 