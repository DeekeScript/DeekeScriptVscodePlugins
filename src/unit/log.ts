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
}

class Logger {
  private config: LogConfig = {
    level: LogLevel.INFO,
    showNotifications: true,
    enableFileLogging: true
  };

  setConfig(config: Partial<LogConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  private formatMessage(level: string, message: string, ...params: any[]): string {
    const timestamp = new Date().toISOString();
    const formattedParams = params.length > 0 ? ` ${JSON.stringify(params)}` : '';
    return `[${timestamp}] [${level}] ${message}${formattedParams}`;
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

  // 兼容旧接口
  model(message: string): void {
    this.showInfo(message);
  }

  modelInfo(message: string, ...params: any[]): void {
    this.showInfo(message);
    this.info(message, ...params);
  }

  modelError(message: string, ...params: any[]): void {
    this.showError(message);
    this.error(message, ...params);
  }
}

const log = new Logger();
export default log;