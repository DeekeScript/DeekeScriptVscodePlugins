declare class EnginesClass {
    /**
     * 执行脚本
     * @param file 文件路径，相对根目录的路径
     */
    public execScript(file: string): void;

    /**
     * 执行脚本
     * @param content 脚本内容
     */
    public executeScriptStr(content: string): void;

    /**
     * 关闭所有脚本
     */
    public closeAll(): void;
}
