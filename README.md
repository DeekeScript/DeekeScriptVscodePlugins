# DeekeScript Pro · VS Code 扩展

**DeekeScript Pro 在桌面端的官方开发插件**——通过 WebSocket 连接手机上的 Pro 运行时，完成脚本编辑、项目同步、单文件调试与 API 智能提示，支撑从界面配置到自动化脚本的完整交付流程。

| 适用产品 | DeekeScript Pro（Android 端） |
| --- | --- |
| 脚本语言 | JavaScript |
| 官方文档 | [script.deeke.cn](https://script.deeke.cn) |
| 示例工程 | [deekeScriptV2Demo](https://github.com/DeekeScript/deekeScriptV2Demo) |

---

## 产品定位

本扩展**不是**独立的自动化框架，而是 **DeekeScript Pro 开发工作流中的 IDE 侧组件**，与手机端 Pro App 配对使用：

- **Pro 运行时**：在 Android 设备上执行无障碍自动化、页面渲染与任务调度。
- **本扩展**：在 VS Code 中编写与调试脚本，将工程同步至手机，并触发执行与日志回传。

典型场景包括：RPA 任务脚本开发、JSON + `page.js` 工作台搭建、单文件任务联调，以及配合官方文档进行 API 开发。

---

## 核心能力

### 设备连接

通过局域网 WebSocket 连接手机端 Pro，支持连接状态展示、主动断开与重连状态重置。

### 工程同步

- **项目同步**：将完整 DeekeScript 工程推送到手机。
- **单文件同步**：同步当前编辑的脚本文件。
- **自动同步**：文件变更后按配置防抖上传（可关闭）。
- **排除规则**：默认跳过 `node_modules`、`.git`、`.vscode` 等目录。

### 脚本执行

- **仅当前文件执行**：调试独立任务脚本（`.js`），无需从手机界面入口启动。
- **项目执行**：按工程配置运行完整项目。
- **停止所有脚本**：终止手机端正在运行的脚本。

### 编辑器增强（DeekeScript 工程）

当工作区根目录存在 `deekeScript.json` 时，扩展会自动：

1. 生成 `.vscode/deekeScriptPro.d.ts`（全局 API 类型声明，含参数与返回值说明）。
2. 配置 `jsconfig.json`，启用 `checkJs` 与类型检查。
3. 通过 TypeScript 语言服务提供**补全、悬停文档、签名帮助与类型诊断**。

API 文档链接指向 [DeekeScript Pro 文档](https://script.deeke.cn)。非 DeekeScript 工程不会写入上述文件，也不会改动编辑器行为。

---

## 环境要求

| 端 | 要求 |
| --- | --- |
| 电脑 | VS Code ≥ 1.96，与本扩展 |
| 手机 | DeekeScript Pro App，已开启无障碍、悬浮窗、**开发模式** |
| 网络 | 手机与电脑同一局域网；调试时建议关闭电脑端 VPN |
| 工程 | 根目录包含 `deekeScript.json`（标识为 DeekeScript 项目） |

---

## 快速开始

### 1. 安装

在 VS Code 扩展市场搜索 **DeekeScript Pro** 并安装本扩展。

### 2. 准备工程

```bash
git clone https://github.com/DeekeScript/deekeScriptV2Demo.git
```

用 VS Code 打开克隆后的目录，确认根目录存在 `deekeScript.json`。

### 3. 连接与同步

1. 手机端 Pro 查看局域网 IP，确保开发模式已开启。
2. VS Code 执行 **DeekeScript Pro：连接手机**，输入手机 IP。
3. 执行 **DeekeScript Pro：项目同步**，将工程推送到手机。

### 4. 运行与调试

| 目标 | 操作 |
| --- | --- |
| 调试单个任务脚本 | 打开任务 `.js` → **DeekeScript Pro：仅当前文件执行** |
| 运行完整项目 | **DeekeScript Pro：项目执行** |
| 从手机界面跑任务 | 同步后，在 App 工作台点击对应功能 |

**注意**

- 不要对 `page.js` 使用「仅当前文件执行」；页面脚本由引擎在打开对应页面时加载。
- 页面按钮应通过 `Engines.executeScript` 调用任务脚本，不宜把长任务直接写在 JSON 的 `action` 中。

更完整的流程见官方文档：[快速开始](https://script.deeke.cn/quick/start.html)、[VS Code 开发](https://script.deeke.cn/config/vscode.html)。

---

## 命令一览

在命令面板（`Ctrl+Shift+P`）中搜索 **DeekeScript Pro**：

| 命令 | 说明 |
| --- | --- |
| DeekeScript Pro：连接手机 | 建立与 Pro 运行时的 WebSocket 连接 |
| DeekeScript Pro：关闭连接 | 断开连接 |
| DeekeScript Pro：重置重连状态 | 清除重连计数，用于连接异常后恢复 |
| DeekeScript Pro：文件同步 | 同步当前文件到手机 |
| DeekeScript Pro：项目同步 | 同步整个工程到手机 |
| DeekeScript Pro：仅当前文件执行 | 在手机上运行当前 `.js` 文件 |
| DeekeScript Pro：项目执行 | 运行整个 DeekeScript 工程 |
| DeekeScript Pro：停止所有脚本 | 停止手机端全部脚本 |
| DeekeScript Pro：显示状态 | 查看当前连接与运行状态 |

编辑 `deekeScript.json` 时，编辑器标题栏会显示连接、项目同步等快捷按钮。

---

## 配置项

在 VS Code 设置中搜索 `deekeScriptPro`：

| 配置键 | 说明 | 默认值 |
| --- | --- | --- |
| `deekeScriptPro.server.port` | WebSocket 端口 | `8088` |
| `deekeScriptPro.server.wsMaxRetries` | 最大重连次数 | `59` |
| `deekeScriptPro.server.wsBaseDelay` | 重连基础延迟（ms） | `1000` |
| `deekeScriptPro.sync.autoSync` | 是否自动同步文件变更 | `true` |
| `deekeScriptPro.sync.debounceDelay` | 自动同步防抖（ms） | `500` |
| `deekeScriptPro.sync.excludePatterns` | 同步排除路径 | `node_modules`, `.git`, `.vscode` |
| `deekeScriptPro.logging.level` | 日志级别 | `info` |
| `deekeScriptPro.logging.enableColors` | 彩色日志 | `true` |
| `deekeScriptPro.logging.showNotifications` | 操作结果通知 | `true` |

---

## 关于 DeekeScript Pro

DeekeScript Pro 是面向 Android 自动化的脚本与交付平台：支持无障碍节点操作、JSON 页面与 `page.js` 动态 UI、自定义组件、UI 热更新、一键打包等能力。本扩展负责 **IDE 侧连接与调试**；框架能力、API 细节与界面开发规范请以官方文档为准。

---

## 区分插件名称

VS Code 扩展市场同时有 **DeekeScript** 与 **DeekeScript Pro** 两款插件，名称相近。开发 Pro 项目请安装 **DeekeScript Pro**（扩展 ID：`DeekeScript.deekescript-pro`），勿与标准版 **DeekeScript** 插件搞混。

---

## 文档与支持

- **开发文档**：[https://script.deeke.cn](https://script.deeke.cn)
- **示例工程**：[deekeScriptV2Demo](https://github.com/DeekeScript/deekeScriptV2Demo)
- **问题反馈**：[GitHub Issues](https://github.com/DeekeScript/DeekeScriptVscodePlugins/issues)
- **技术支持**：miniphper@gmail.com
