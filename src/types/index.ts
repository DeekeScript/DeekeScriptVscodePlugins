// WebSocket消息类型定义
export interface WebSocketMessage {
  code: number;
  msg: string;
}

export interface ErrorInfo {
  sourceName: string;
  lineNumber: number;
  columnNumber: number;
  detail: string;
  message: string;
}

export interface FileSyncData {
  status: number;
  file: string;
  isDir: boolean;
  body: string;
}

export interface FileDeleteData {
  status: number;
  file: string;
  isDir: boolean;
  body: string;
}

export interface ProjectInitData {
  status: number;
  body: string;
}

export interface FileRunData {
  status: number;
  body: string;
  file: string;
}

export interface StopData {
  status: number;
}

export interface ProjectRunData {
  command: string;
}

// 客户端配置接口
export interface ClientConfig {
  port: number;
  wsMaxRetries: number;
  wsBaseDelay: number;
}

// 文件操作结果接口
export interface FileOperationResult {
  success: boolean;
  message: string;
  error?: Error;
}

// 连接状态枚举
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting'
}

// 项目同步状态
export interface ProjectSyncState {
  isSyncing: boolean;
  totalFiles: number;
  syncedFiles: number;
  errors: string[];
} 