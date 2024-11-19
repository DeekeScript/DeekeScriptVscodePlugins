declare class AppClass {
    /**
     * 获取当前包名
     */
    public currentPackageName(): string;

    /**
     * 获取当前版本号
     */
    public currentVersionCode(): number;

    /**
     * 获取当前版本名称
     */
    public currentVersionName(): string;
    
    /**
     * 获取包信息
     */
    public packageInfo(): any;//这里是返回的PackageInfo（Android对象）

    /**
     * 创建一个Intent对象
     * @param i Intent对象
     */
    public intent(i: Intent): Intent;

    /**
     * 调整到某个Activity
     * @param uri 跳转的uri
     */
    public gotoIntent(uri: string): void;

    /**
     * 启动Activity
     * @param intent Intent对象
     */
    public startActivity(intent: Intent): void;

    /**
     * 返回到App
     */
    public backApp(): void;

    /**
     * 启动服务
     * @param service Intent对象
     */
    public stratService(service: Intent): any;//这里的参数和返回都是ComponentName（Android对象）
    
    /**
     * 发送广播
     * @param intent Intent对象
     */
    public sendBroadcast(intent: Intent): void;

    /**
     * 通过包名，打开某个App
     * @param packageName 包名
     */
    public launch(packageName: string): void;

    /**
     * 通知
     * @param title 标题
     * @param content 内容
     */
    public notifySuccess(title: string, content: string): void;

    /**
     * 通过包名，获取某个App的版本名称
     * @param packageName 包名
     */
    public getAppVersionName(packageName: string): string;
    
    /**
     * 通过包名，获取某个App版本号
     * @param packageName 包名
     */
    public getAppVersionCode(packageName: string): number;

    /**
     * 通过包名，进入某个App设置界面
     * @param packageName 包名
     */
    public openAppSettings(packageName: string): void;
}
