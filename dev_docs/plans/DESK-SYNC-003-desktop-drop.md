# DESK-SYNC-003 Explorer原生文件拖入

基线：7334286；worktree desktop-file-drop；分支 feat/DESK-SYNC-003-desktop-drop。
目标：资源管理器拖动真实文件/文件夹到启用同步的Desk，按Windows复制/移动/快捷方式语义实际落到用户桌面并显示。
范围外：内部自由排序、Dock拖入、网页或聊天软件虚拟文件、文件管理右键菜单（004）。
执行：使用executing-plans顺序实施，不启用并行代理；用户已授权不增加审核环节，统一人工验收后再合并。

## 设计

优先使用WebView2自身OLE接收和官方顶层页面drop，通过AdditionalObjects将磁盘File/目录交给Player；Player复核来源及实际宿主状态；Core校验当前会话、同步Desk、无转场状态并提供本机目标。真实Shell操作在STA执行，成功项目再进入扫描/摆放。禁止新增覆盖桌面的透明输入层，不改原点击/触控采样链。WebView2与子HWND实际接收行为先由探针确认，不能只凭父窗口注册成功计作完成。

探针已验证WebView2浏览器drop经原生AdditionalObjects传递真实文件和目录路径，尚须验证实际WorkerW/Explorer。原生IDropTarget注册探针保留为接收结构证据，先不改造外部进程子窗口。可选全屏接收层会抢输入，明确不采用。探针确认前不锁定最终接收HWND。

拖动效果结合源允许效果、Ctrl/Shift/Alt和同卷/跨卷；链接明确生成快捷方式。文件操作使用Windows Shell冲突/取消语义，保留每项完成结果；异步排队不能直接报告MOVE让来源清理。最终OLE效果与实际搬移责任在第02/03步明确验证。目标只由系统Known Folder解析，处理同目录、同名、部分失败。

## 五步与文件

| 步骤 | 状态 | 独立文件 |
|---|---|---|
| 真实宿主接收验证 | 开做 | [01](DESK-SYNC-003/01-native-target.md) |
| OLE格式/效果与命中 | 待做 | [02](DESK-SYNC-003/02-ole-policy.md) |
| Shell复制/移动/链接 | 开做 | [03](DESK-SYNC-003/03-shell-transfer.md) |
| 会话/落点/自动显示 | 待做 | [04](DESK-SYNC-003/04-placement.md) |
| 实机与候选交接 | 待做 | [05](DESK-SYNC-003/05-handoff.md) |

实施0/5=0%，桌面交互路线实施工作包2/4=50%；001/002待统一验收。

## 来源与实现定位

- Player：lively-core-separation/src/Lively/Lively.Player.WebView2/Form1.cs（EnsureCoreWebView2Async及控制器初始化）、Form1.NativePause.cs（已有控制器访问）。拟新增独立NativeDrop文件，不继续扩大Form1。
- Core：RoomSessionRuntimeCoordinator.DesktopSync.cs、RoomDesktopSync.cs以及Services/DesktopSync；拟新增DesktopDrop独立服务处理范围及Shell结果。
- 检查：tests下独立原生接收探针和策略/临时文件传输检查；真实WorkerW验证复用现有运行身份与磁盘恢复流程。
- DeskBox只读参考：ContentWidgetWindow.NativeDragDrop.cs、NativeDropEffectPolicy.cs；不移植源码。其控件HWND方案不证明Dext的WebView子窗口可用。
- [Windows OLE拖放](https://learn.microsoft.com/en-us/windows/win32/com/drag-and-drop)
- [WebView2控制器AllowExternalDrop](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/winrt/microsoft_web_webview2_core/corewebview2controller)