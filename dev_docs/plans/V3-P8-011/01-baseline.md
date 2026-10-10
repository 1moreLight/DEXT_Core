# 01 现有代码与约束核对
状态：做完（2026-10-10）；基线 c3e168c。
CodeGraph在当前依赖worktree报告Not initialized，使用精确文件阅读兜底；未建立新索引。

以下均为相对仓库根路径，符号已在源文件核对：

| 文件/符号 | 事实与可复用点 | 缺口 |
|---|---|---|
| lively-core-separation/src/Lively/Lively/Services/ApplicationDock/DockModel.cs / Group、Action | 按目标分组；固定项顺序；0窗口启动、1窗口激活/最小化、多窗口选择；PinScope保护菜单上下文 | Key是规范化私人路径，DockTask含句柄/PID/目标，不能直接发到网页 |
| 同目录 ApplicationDockService.cs / Refresh、GroupForCurrentDesk、Render、Click | 500ms枚举；有效Desk固定项、枚举/动作已经可用；Render直接创建WPF窗口 | 模型与WPF呈现耦合，HTML尚无官方任务投影 |
| lively-core-separation/src/Lively/Lively/Core/Dext/DockHostOwnership.cs | None/Theme/Application，只有显式释放后可交接 | 应用requested当前强制选Application宿主，融合模式需要独立“选择呈现”与“启用应用模型” |
| 同目录 RoomSessionRuntimeCoordinator.Dock.cs / ReadDockDemand、DockReply | 已验证安装、独立Player、实际窗口/占位状态、退出后交接 | ApplicationRequested会让主题暂停；不能只同时打开两个开关 |
| wallpapers/dext-room-v3/dom-host.js / recordPlacement、visiblePolygons | Dock作者组件映射整个1920×1080逻辑画布；遮挡会裁减作者命中区域 | 新官方任务区必须同时成为可见层和几何遮挡区，否则一击两动作 |
| wallpapers/dext-room-v3/main.js / ensureDockKeyboard、announceDockReady | 固定官方顶层文档已有受管按钮、私有消息及就绪机制 | 无应用任务区，不能把renderer ready等同新区域可点击 |
| lively-core-separation/src/Lively/Lively.Player.WebView2/Form1.cs / WebMessageReceived | 检查顶层来源；Dock消息核验generation/session/revision | 需要专用官方任务消息，不能直接透传旧配置器Status/Edit |
| 同目录 Form1.NativeDock.cs、DextDockWindowHost.cs | 现有顶层窗口/输入与可见策略 | 应复用，不能另造主窗口或改WorkerW输入 |
| lively-core-separation/src/Lively/Lively/Core/Dext/RoomV3Installation.cs / PublicConfig | API1 config可装公共JSON，拒绝私人字段/路径 | 可定义带版本的公开布局约定，不增清单字段，不改六套冻结API1原件 |

约束：保持当前WPF按钮按下期间不刷新替换的行为；已有按Desk固定项只在提交Desk后切换；主题转场不得把目标Desk固定项提前当作当前项。无主题仍支持WPF应用Dock。桌面作者按钮保留原通道。
