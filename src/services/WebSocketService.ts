import { WebSocket, MessageEvent } from 'ws';
import * as vscode from 'vscode';
import { ConnectionState, WebSocketMessage, ErrorInfo } from '../types';
import log from '../unit/log';


export class WebSocketService {
  private socket: WebSocket | undefined = undefined;
  private socketIp: string;
  private socketPort: number;
  private wsMaxRetries: number;
  private wsBaseDelay: number;
  private isManualClose: boolean = false;
  private retryOpen: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  
  // 重连相关状态
  private currentRetryCount: number = 0;
  private hasConnectedOnce: boolean = false; // 标记是否曾经连接成功过

  constructor(socketIp: string, config: { port: number; wsMaxRetries: number; wsBaseDelay: number }) {
    this.socketIp = socketIp;
    this.socketPort = config.port;
    this.wsMaxRetries = config.wsMaxRetries;
    this.wsBaseDelay = config.wsBaseDelay;
  }

  get state(): ConnectionState {
    return this.connectionState;
  }

  get isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  // 注册消息处理器
  onMessage(type: string, handler: (data: any) => void): void {
    this.messageHandlers.set(type, handler);
  }

  // 连接WebSocket
  async connect(): Promise<void> {
    if (this.isConnected) {
      log.formatWarning('WebSocket已经连接');
      return;
    }

    this.connectionState = ConnectionState.CONNECTING;
    log.logConnectionStatus('connecting', `ws://${this.socketIp}:${this.socketPort}`);

    try {
      await this.createConnection();
      // 连接成功，重置重连计数
      this.currentRetryCount = 0;
      this.hasConnectedOnce = true;
    } catch (error) {
      this.connectionState = ConnectionState.DISCONNECTED;
      log.formatError(`连接失败：${error instanceof Error ? error.message : '未知错误'}`);
      throw error;
    }
  }

  private createConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(`ws://${this.socketIp}:${this.socketPort}`);
        
        this.socket.onopen = () => {
          this.connectionState = ConnectionState.CONNECTED;
          this.retryOpen = true;
          this.hasConnectedOnce = true; // 标记曾经连接成功过
          log.logConnectionStatus('connected');
          resolve();
        };

        this.socket.onclose = () => {
          this.connectionState = ConnectionState.DISCONNECTED;
          if (this.retryOpen && !this.isManualClose) {
            log.logConnectionStatus('disconnected', '准备重连...');
            this.scheduleReconnect();
          } else {
            log.logConnectionStatus('disconnected');
          }
          resolve();
        };

        this.socket.onerror = (error) => {
          if (!this.retryOpen) {
            log.showError(`连接失败：${error.message}`);
            vscode.window.showErrorMessage('连接错误');
          }
          reject(error);
        };

        this.socket.onmessage = (event: MessageEvent) => {
          this.handleMessage(event);
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data.toString());
      
      if (message.code === 0) {
        this.handleSuccessMessage(message.msg);
      } else {
        log.showError(message.msg);
      }
    } catch (error) {
      log.error(`消息解析失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  private handleSuccessMessage(msg: string): void {
    try {
      const info = JSON.parse(msg);
      
      if (info.code === 0) {
        log.info(info.message);
        return;
      }

      // 处理错误信息
      const errorInfo: ErrorInfo = info.message;
      log.error(
        `${errorInfo.message}\n文件：${errorInfo.sourceName}\n行数：${errorInfo.lineNumber}\n列号：${errorInfo.columnNumber}`
      );
    } catch (error) {
      log.info(msg);
    }
  }

  private scheduleReconnect(): void {
    if (this.isManualClose || !this.retryOpen) {
      return;
    }

    // 检查重连次数限制
    if (this.currentRetryCount >= this.wsMaxRetries) {
      log.formatError(`超过最大重连次数 (${this.wsMaxRetries})，停止重连`);
      this.retryOpen = false;
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.currentRetryCount++;
    this.connectionState = ConnectionState.RECONNECTING;

    // 计算重连延迟时间
    let delayTime: number;
    
    if (this.hasConnectedOnce) {
      // 如果之前连接成功过，说明网络是通的，使用较短的重连间隔
      delayTime = this.wsBaseDelay;
    } else {
      // 如果从未连接成功过，使用指数退避策略
      delayTime = this.wsBaseDelay * Math.pow(2, this.currentRetryCount - 1);
    }

    log.logConnectionStatus('reconnecting', `第${this.currentRetryCount}次重连，${delayTime}ms后尝试...`);
    
    this.reconnectTimer = setTimeout(() => {
      this.createConnection().then(() => {
        // 重连成功，重置计数
        this.currentRetryCount = 0;
        this.connectionState = ConnectionState.CONNECTED;
        log.formatSuccess('重连成功');
      }).catch(() => {
        // 重连失败，继续重试
        this.scheduleReconnect();
      });
    }, delayTime);
  }

  // 发送消息
  send(data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket未连接'));
        return;
      }

      try {
        const message = JSON.stringify(data);
        this.socket.send(message, { compress: true }, (error) => {
          if (error) {
            log.error(`发送消息失败：${error.message}`);
            reject(error);
          } else {
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // 关闭连接
  close(): void {
    this.isManualClose = true;
    this.retryOpen = false;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = undefined;
    }

    this.connectionState = ConnectionState.DISCONNECTED;
    
    // 重置重连状态
    this.currentRetryCount = 0;
    this.hasConnectedOnce = false;
  }

  // 更新配置
  updateConfig(config: Partial<{ port: number; wsMaxRetries: number; wsBaseDelay: number }>): void {
    if (config.port !== undefined) this.socketPort = config.port;
    if (config.wsMaxRetries !== undefined) this.wsMaxRetries = config.wsMaxRetries;
    if (config.wsBaseDelay !== undefined) this.wsBaseDelay = config.wsBaseDelay;
  }

  // 重置重连状态
  resetRetryState(): void {
    this.currentRetryCount = 0;
    this.hasConnectedOnce = false;
    log.info('重连状态已重置');
  }

  // 获取重连状态信息
  getRetryInfo(): { currentRetryCount: number; hasConnectedOnce: boolean; maxRetries: number } {
    return {
      currentRetryCount: this.currentRetryCount,
      hasConnectedOnce: this.hasConnectedOnce,
      maxRetries: this.wsMaxRetries
    };
  }
} 