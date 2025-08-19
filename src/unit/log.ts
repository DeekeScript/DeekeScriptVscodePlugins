import * as vscode from 'vscode';
import setting from '../setting';

// 日志级别枚举
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

// 日志配置接口
export interface LogConfig {
  level: LogLevel;
  showNotifications: boolean;
  enableFileLogging: boolean;
  enableColors: boolean;
}

// 颜色代码
const Colors = {
  RESET: '\x1b[0m',
  BRIGHT: '\x1b[1m',
  DIM: '\x1b[2m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  WHITE: '\x1b[37m',
  BG_RED: '\x1b[41m',
  BG_GREEN: '\x1b[42m',
  BG_YELLOW: '\x1b[43m',
  BG_BLUE: '\x1b[44m'
};

// 检测终端是否支持ANSI颜色
function supportsColors(): boolean {
  // 检查是否在Windows PowerShell环境中
  if (process.platform === 'win32') {
    const term = process.env.TERM || '';
    const shell = process.env.SHELL || '';
    
    // Windows PowerShell通常不支持ANSI颜色
    if (shell.includes('powershell') || shell.includes('cmd') || term === '') {
      return false;
    }
  }
  
  // 检查是否在VSCode的输出面板中
  if (process.env.VSCODE_EXTENSION_DEVELOPMENT === 'true') {
    return false;
  }
  
  // 检查TERM环境变量
  const term = process.env.TERM;
  if (term && (term.includes('xterm') || term.includes('linux') || term.includes('screen'))) {
    return true;
  }
  
  // 默认情况下禁用颜色以避免乱码
  return false;
}

class Logger {
  private config: LogConfig = {
    level: LogLevel.INFO,
    showNotifications: true,
    enableFileLogging: true,
    enableColors: supportsColors() // 根据终端环境自动设置
  };

  setConfig(config: Partial<LogConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // 手动启用或禁用颜色
  setColorsEnabled(enabled: boolean): void {
    this.config.enableColors = enabled;
  }

  // 获取当前颜色状态
  isColorsEnabled(): boolean {
    return this.config.enableColors;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  private getColorForLevel(level: string): string {
    if (!this.config.enableColors) return '';
    
    switch (level) {
      case 'DEBUG': return Colors.DIM + Colors.CYAN;
      case 'INFO': return Colors.BRIGHT + Colors.GREEN;
      case 'WARN': return Colors.BRIGHT + Colors.YELLOW;
      case 'ERROR': return Colors.BRIGHT + Colors.RED;
      default: return Colors.WHITE;
    }
  }

  private formatMessage(level: string, message: string, ...params: any[]): string {
    const formattedParams = params.length > 0 ? ` ${JSON.stringify(params)}` : '';
    const color = this.getColorForLevel(level);
    const resetColor = this.config.enableColors ? Colors.RESET : '';
    
    return `${color}${message}${formattedParams}${resetColor}`;
  }

  debug(message: string, ...params: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const formattedMessage = this.formatMessage('DEBUG', message, ...params);
      setting.getLogWindows().debug(formattedMessage);
    }
  }

  info(message: string, ...params: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const formattedMessage = this.formatMessage('INFO', message, ...params);
      setting.getLogWindows().info(formattedMessage);
    }
  }

  warn(message: string, ...params: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const formattedMessage = this.formatMessage('WARN', message, ...params);
      setting.getLogWindows().warn(formattedMessage);
    }
  }

  error(message: string, ...params: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const formattedMessage = this.formatMessage('ERROR', message, ...params);
      setting.getLogWindows().error(formattedMessage);
    }
  }

  // 显示通知消息
  showInfo(message: string): void {
    if (this.config.showNotifications) {
      vscode.window.showInformationMessage(message);
    }
    this.info(message);
  }

  showWarning(message: string): void {
    if (this.config.showNotifications) {
      vscode.window.showWarningMessage(message);
    }
    this.warn(message);
  }

  showError(message: string): void {
    if (this.config.showNotifications) {
      vscode.window.showErrorMessage(message);
    }
    this.error(message);
  }

  // 格式化日志方法
  formatSuccess(message: string, ...params: any[]): void {
    const formattedMessage = this.config.enableColors 
      ? `${Colors.BRIGHT}${Colors.GREEN}✓ ${message}${Colors.RESET}`
      : `✓ ${message}`;
    this.info(formattedMessage, ...params);
  }

  formatWarning(message: string, ...params: any[]): void {
    const formattedMessage = this.config.enableColors 
      ? `${Colors.BRIGHT}${Colors.YELLOW}⚠ ${message}${Colors.RESET}`
      : `⚠ ${message}`;
    this.warn(formattedMessage, ...params);
  }

  formatError(message: string, ...params: any[]): void {
    const formattedMessage = this.config.enableColors 
      ? `${Colors.BRIGHT}${Colors.RED}✗ ${message}${Colors.RESET}`
      : `✗ ${message}`;
    this.error(formattedMessage, ...params);
  }

  formatProgress(message: string, ...params: any[]): void {
    const formattedMessage = this.config.enableColors 
      ? `${Colors.BRIGHT}${Colors.BLUE}⟳ ${message}${Colors.RESET}`
      : `⟳ ${message}`;
    this.info(formattedMessage, ...params);
  }

  // 连接状态日志
  logConnectionStatus(status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting', details?: string): void {
    const statusMessages = {
      connecting: '正在连接...',
      connected: '连接成功',
      disconnected: '连接断开',
      reconnecting: '正在重连...'
    };

    const statusColors = {
      connecting: Colors.YELLOW,
      connected: Colors.GREEN,
      disconnected: Colors.RED,
      reconnecting: Colors.BLUE
    };

    const message = statusMessages[status];
    const color = statusColors[status];
    
    if (this.config.enableColors) {
      this.info(`${color}${message}${Colors.RESET}${details ? ` - ${details}` : ''}`);
    } else {
      this.info(`${message}${details ? ` - ${details}` : ''}`);
    }
  }

  // 兼容旧接口
  model(message: string): void {
    this.showInfo(message);
  }

  modelInfo(message: string): void {
    // 仅显示通知并记录一次日志（showInfo 内部已调用 info）
    this.showInfo(message);
  }

  modelError(message: string): void {
    // 仅显示通知并记录一次日志（showError 内部已调用 error）
    this.showError(message);
  }
}

const log = new Logger();
export default log;