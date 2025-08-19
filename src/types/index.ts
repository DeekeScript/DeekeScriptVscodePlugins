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

// 基础消息接口
export interface BaseMessage {
  key: string;
  status: number;
}

export interface FileSyncData extends BaseMessage {
  file: string;
  isDir: boolean;
  body: string;
}

export interface FileDeleteData extends BaseMessage {
  file: string;
  isDir: boolean;
  body: string;
}

export interface ProjectInitData extends BaseMessage {
  body: string;
}

export interface FileRunData extends BaseMessage {
  body: string;
  file: string;
}

export interface StopData extends BaseMessage {
}

export interface ProjectRunData extends BaseMessage {
  command: string;
}

// 服务端响应消息
export interface ServerResponse {
  key: string;
  code: number;
  msg: string;
  success: boolean;
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