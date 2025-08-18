import * as vscode from 'vscode';

export interface DeekeScriptConfig {
  server: {
    port: number;
    wsMaxRetries: number;
    wsBaseDelay: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enableColors: boolean;
    showNotifications: boolean;
  };
  sync: {
    debounceDelay: number;
    autoSync: boolean;
    excludePatterns: string[];
  };
}

export class ConfigManager {
  private static instance: ConfigManager;
  private config: DeekeScriptConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadConfig(): DeekeScriptConfig {
    const workspaceConfig = vscode.workspace.getConfiguration('deekeScript');
    
    return {
      server: {
        port: workspaceConfig.get('server.port', 8088),
        wsMaxRetries: workspaceConfig.get('server.wsMaxRetries', 59),
        wsBaseDelay: workspaceConfig.get('server.wsBaseDelay', 1000)
      },
      logging: {
        level: workspaceConfig.get('logging.level', 'info'),
        enableColors: workspaceConfig.get('logging.enableColors', true),
        showNotifications: workspaceConfig.get('logging.showNotifications', true)
      },
      sync: {
        debounceDelay: workspaceConfig.get('sync.debounceDelay', 500),
        autoSync: workspaceConfig.get('sync.autoSync', true),
        excludePatterns: workspaceConfig.get('sync.excludePatterns', ['node_modules', '.git', '.vscode'])
      }
    };
  }

  getConfig(): DeekeScriptConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<DeekeScriptConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
  }

  private async saveConfig(): Promise<void> {
    const workspaceConfig = vscode.workspace.getConfiguration('deekeScript');
    
    // 更新服务器配置
    await workspaceConfig.update('server.port', this.config.server.port, vscode.ConfigurationTarget.Workspace);
    await workspaceConfig.update('server.wsMaxRetries', this.config.server.wsMaxRetries, vscode.ConfigurationTarget.Workspace);
    await workspaceConfig.update('server.wsBaseDelay', this.config.server.wsBaseDelay, vscode.ConfigurationTarget.Workspace);
    
    // 更新日志配置
    await workspaceConfig.update('logging.level', this.config.logging.level, vscode.ConfigurationTarget.Workspace);
    await workspaceConfig.update('logging.enableColors', this.config.logging.enableColors, vscode.ConfigurationTarget.Workspace);
    await workspaceConfig.update('logging.showNotifications', this.config.logging.showNotifications, vscode.ConfigurationTarget.Workspace);
    
    // 更新同步配置
    await workspaceConfig.update('sync.debounceDelay', this.config.sync.debounceDelay, vscode.ConfigurationTarget.Workspace);
    await workspaceConfig.update('sync.autoSync', this.config.sync.autoSync, vscode.ConfigurationTarget.Workspace);
    await workspaceConfig.update('sync.excludePatterns', this.config.sync.excludePatterns, vscode.ConfigurationTarget.Workspace);
  }

  // 获取服务器配置
  getServerConfig() {
    return this.config.server;
  }

  // 获取日志配置
  getLoggingConfig() {
    return this.config.logging;
  }

  // 获取同步配置
  getSyncConfig() {
    return this.config.sync;
  }

  // 检查文件是否应该被排除
  shouldExcludeFile(filePath: string): boolean {
    return this.config.sync.excludePatterns.some(pattern => 
      filePath.includes(pattern)
    );
  }

  // 重新加载配置
  reloadConfig(): void {
    this.config = this.loadConfig();
  }
}

// 导出单例实例
export const configManager = ConfigManager.getInstance(); 