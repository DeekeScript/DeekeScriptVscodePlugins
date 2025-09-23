import { WebSocket, MessageEvent } from 'ws';
import { ConnectionState, WebSocketMessage, ErrorInfo, ServerResponse } from '../types';
import log from '../unit/log';


export class WebSocketService {
  private socket: WebSocket | undefined = undefined;
  private socketIp: string;
  private socketPort: number;
  private wsMaxRetries: number;
  private isManualClose: boolean = false;
  private retryOpen: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private messageHandlers: Map<string, (data: any) => void> = new Map();

  // 消息key管理
  private pendingRequests: Map<string, { resolve: (value: any) => void; reject: (error: Error) => void; timeout: NodeJS.Timeout }> = new Map();
  private requestTimeout: number = 10000; // 10秒超时

  // 重连相关状态
  private currentRetryCount: number = 0;
  private hasConnectedOnce: boolean = false; // 标记是否曾经连接成功过

  constructor(socketIp: string, config: { port: number; wsMaxRetries: number; wsBaseDelay?: number }) {
    this.socketIp = socketIp;
    this.socketPort = config.port;
    this.wsMaxRetries = config.wsMaxRetries;
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
      log.formatWarning('WebSocket已经连接，无需再次连接');
      return;
    }

    this.connectionState = ConnectionState.CONNECTING;
    log.logConnectionStatus('connecting', `ws://${this.socketIp}:${this.socketPort}`);

    try {
      await this.createConnection();
      // 连接成功处理已在onopen事件中完成
    } catch (error) {
      this.connectionState = ConnectionState.DISCONNECTED;
      //log.formatError(`连接失败：${error instanceof Error ? error.message : '未知错误'}`);
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
          this.currentRetryCount = 0; // 连接成功后重置重连计数器
          log.logConnectionStatus('connected');
          resolve();
        };

        this.socket.onclose = () => {
          this.connectionState = ConnectionState.DISCONNECTED;
          if (this.retryOpen && !this.isManualClose) {
            this.scheduleReconnect();
          } else {
            log.logConnectionStatus('disconnected');
          }
          resolve();
        };

        this.socket.onerror = (error) => {
          if (!this.retryOpen) {
            log.showError(`连接失败：${error.message}`);
            //vscode.window.showErrorMessage('连接错误');
          }
          reject(error);
        };

        this.socket.onmessage = (event: MessageEvent) => {
          this.handleMessage(event);
        };

        this.socket.on('unexpected-response', (_req, res) => {
          if (res.statusCode == 101) {
            log.showError(`连接失败（请关闭电脑的vpn代理，重启vscode；连接成功后，再开启vpn即可！）`);
            return;
          }
          log.showError(`连接失败，状态码: ${res.statusCode}`);
          //vscode.window.showErrorMessage(`连接错误，状态码: ${res.statusCode}`);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data.toString());

      // 检查是否是服务端响应消息（新格式）
      if (data.key && this.pendingRequests.has(data.key)) {
        this.handleServerResponse(data as ServerResponse);
        return;
      }

      // 处理旧格式的消息
      const message: WebSocketMessage = data;
      if (message.code === 0) {
        this.handleSuccessMessage(message.msg);
        // 如果有待处理的请求，假设这个成功消息是对它们的响应
        this.resolveAllPendingRequests();
      } else {
        log.showError(message.msg);
        // 如果有待处理的请求，假设这个错误消息是对它们的响应
        this.rejectAllPendingRequests(new Error(message.msg));
      }
    } catch (error) {
      log.error(`消息解析失败：${error instanceof Error ? error.message : '未知错误'}`);
      // 解析失败时，拒绝所有待处理的请求
      this.rejectAllPendingRequests(new Error('消息解析失败'));
    }
  }

  // 解析所有待处理的请求（用于旧格式消息）
  private resolveAllPendingRequests(): void {
    for (const [, request] of this.pendingRequests.entries()) {
      clearTimeout(request.timeout);
      request.resolve({ success: true, code: 0, msg: '操作成功' });
    }
    this.pendingRequests.clear();
  }

  // 拒绝所有待处理的请求（用于旧格式消息）
  private rejectAllPendingRequests(error: Error): void {
    for (const [, request] of this.pendingRequests.entries()) {
      clearTimeout(request.timeout);
      request.reject(error);
    }
    this.pendingRequests.clear();
  }

  private handleServerResponse(response: ServerResponse): void {
    const pendingRequest = this.pendingRequests.get(response.key);
    if (!pendingRequest) {
      return;
    }

    // 清除超时定时器
    clearTimeout(pendingRequest.timeout);
    this.pendingRequests.delete(response.key);

    if (response.code == 0) {
      pendingRequest.resolve(response);
    } else {
      pendingRequest.reject(new Error(response.msg));
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
      this.connectionState = ConnectionState.DISCONNECTED;
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.currentRetryCount++;
    this.connectionState = ConnectionState.RECONNECTING;

    // 计算重连延迟时间 - 逐步增加1秒
    const delayTime = this.currentRetryCount * 1000; // 1s, 2s, 3s, 4s...
    log.logConnectionStatus('reconnecting', `第${this.currentRetryCount}次重连，${this.currentRetryCount}s后尝试...`);
    this.reconnectTimer = setTimeout(() => {
      this.createConnection().then(() => {
        // 重连成功，重置计数
        this.currentRetryCount = 0;
        this.connectionState = ConnectionState.CONNECTED;
        // 重连成功的日志已在onopen事件中处理
      }).catch(() => {

      });
    }, delayTime);
  }

  // 生成唯一消息key
  private generateMessageKey(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 发送消息并等待响应
  sendWithResponse(data: any): Promise<ServerResponse> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket未连接'));
        return;
      }

      // 生成唯一key
      const messageKey = this.generateMessageKey();
      const messageWithKey = { ...data, key: messageKey };

      // 设置超时定时器
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(messageKey);
        reject(new Error(`请求超时 (${this.requestTimeout}ms)`));
      }, this.requestTimeout);

      // 保存待处理的请求
      this.pendingRequests.set(messageKey, { resolve, reject, timeout });

      try {
        const message = JSON.stringify(messageWithKey);
        this.socket.send(message, { compress: true }, (error) => {
          if (error) {
            // 发送失败，清理待处理请求
            this.pendingRequests.delete(messageKey);
            clearTimeout(timeout);
            log.error(`发送消息失败：${error.message}`);
            reject(error);
          }
        });
      } catch (error) {
        // 序列化失败，清理待处理请求
        this.pendingRequests.delete(messageKey);
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  // 发送消息（不等待响应，兼容旧接口）
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
  updateConfig(config: Partial<{ port: number; wsMaxRetries: number; wsBaseDelay?: number }>): void {
    if (config.port !== undefined) this.socketPort = config.port;
    if (config.wsMaxRetries !== undefined) this.wsMaxRetries = config.wsMaxRetries;
    // wsBaseDelay 不再使用，忽略该配置
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