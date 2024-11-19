declare class DeviceClass {
    /**
     * 保持屏幕常亮（需要在当前App界面）
     * @param second 屏幕保持亮屏时间，单位秒
     */
    public keepScreenOn(second: number): void;

    /**
     * 关闭屏幕
     */
    public closeScreenLight(): void;

    /**
     * 获取屏幕宽度
     */
    public width(): number;

    /**
     * 获取屏幕高度
     */
    public height(): number;

    /**
     * 获取设备版本，如 26
     */
    public sdkInt(): number;

    /**
     * 获取设备
     */
    public device(): string;

    /**
     * 获取设备版本，如 "8.1.0"
     */
    public androidVersion(): string;

    /**
     * 生成设备唯一标识符， 卸载App前，可以通过getUuid获取，卸载后丢失
     */
    public createUuid(): string;

    /**
     * 获取设备唯一标识符
     */
    public getUuid(): string;

    /**
     * 判断屏幕是否亮着
     */
    public isScreenOn(): boolean;

    /**
     * 获取设备品牌， 如 "HUAWEI" 或 "Xiaomi"
     */
    public brand(): string;

    /**
     * 获取设备操作系统名称， 如 "Android"
     */
    public os(): string;

    /**
     * 获取设备型号名称， 如 "Honor V30" 或类似的字符串
     */
    public model(): string;

    /**
     * 获取设备代号， 例如 "REL" 表示正式发布的版本
     */
    public codename(): string;
}
