# Windows 桌面同步与原生文件交互

日期：2026-10-11。状态：方案做完；001/002实施做完待验收、003开做、004待做，实施工作包2/4=50%。
来源：用户希望一键识别原桌面已有应用，并让从窗口拖到桌面的文件直接显示，减少逐个配置。当前P8-013/014已转待统一验收，002独立分支已交接，下一项003，002证据见DESK-SYNC-002-desktop-watch.md。

## 推荐体验

配置器提供“一键接入 Windows 桌面”，首次把选中的 Desk 设为本机桌面同步页。应用快捷方式、普通文件、文件夹均显示真实名称和图标；原文件留在 Windows 桌面目录。之后保存到桌面、新增、改名、删除会同步，退出 Dext 后在 Explorer 中仍能看到实际文件。

默认方案（实施假设，可按后续使用反馈调整）：每个 Room 最多指定一个同步 Desk，其他 Desk 保留自定义入口。外部拖入同步页时，目标为系统解析出的当前用户桌面；公共桌面项可显示，写操作按实际权限反馈。向其他 Desk 拖入文件暂显示去同步页的引导，不悄悄改目标目录。

通过系统 Known Folder 解析桌面，包含用户桌面和公共桌面；不拼接 USERPROFILE/Desktop，以兼容路径重定向/OneDrive。回收站、此电脑等 Shell 虚拟项目单列后续，不把扫描普通目录称为完整 Explorer 桌面复刻。

## 方案取舍

- 一次性复制为 Dext 入口：实现少，但文件增删后会过期，不能满足持续同步。
- **真实目录驱动的官方图标层（采用）**：文件由 Windows 管理，Core 枚举和监听，Dext 保存本机布局并显示；适合现有多 Desk。
- 嵌入完整 Explorer 桌面视图：更接近原生，但与 WorkerW、作者内容、多 Desk 的输入和层级冲突更大，当前不采用。

## 数据与交互边界

- 本机文件身份、路径、所属同步页、坐标及隐藏项写私人数据；不写作者 room.json，不随主题分享。此次仅设计，正式 schema/IPC 在对应包开工时确定。
- 扫描只读；第一次不移动文件、不重写快捷方式、不删除已有 Dext 项。按文件/Shell 身份去重，不能只按显示名去重。同名公共/用户项目保留可区分身份。
- 文件系统是内容权威；读取失败保留最近确认列表并报告错误，不能视为空目录。监听用于触发增量刷新，溢出、重连、恢复和启动后完整核对。
- 拖入先走真实 OLE/Shell 接收及文件操作结果，再显示确认的目标；指针命中与普通点击分别验证。保留现有点击/触控链，禁止拿透明全屏拦截层快速覆盖。
- 复制/移动/快捷方式遵守源允许效果、修饰键及同盘/跨盘规则。异步复制尚未完成不能向源回报已移动并让它删除；取消、重名冲突和部分成功均按 Shell 实际结果反馈。
- 本轮新要求恢复的是“外部文件拖入桌面”这一范围；之前暂缓的内部自由拖动排序、已取消的 Dock 双向拖入不自动恢复。

## 分包及独立步骤文件

| 顺序 | 工作包 | 状态 | 独立步骤 |
|---|---|---|---|
| 1 | DESK-SYNC-001 一键识别并显示真实桌面 | 做完（待验收） | [01-import](DESK-SYNC/01-import.md) |
| 2 | DESK-SYNC-002 文件变化自动同步 | 开做 | [02-watch](DESK-SYNC/02-watch.md) |
| 3 | DESK-SYNC-003 从资源管理器拖入 | 待做 | [03-drop](DESK-SYNC/03-drop.md) |
| 4 | DESK-SYNC-004 原生文件常用操作 | 待做 | [04-shell-actions](DESK-SYNC/04-shell-actions.md) |

每包开工建立自己的 worktree/分支和 acceptance，步骤改“开做”；自测与交接完成后记录“做完”，用户验收/合并另记，不能用代码提交代替验收。拖入能力先覆盖资源管理器真实文件；浏览器/聊天软件虚拟文件另列扩展。

## DeskBox 借鉴证据

本地参考 D:/midDOW/DeskBox，HEAD 22d29480bdcac98f636b94b2990ceff2b8f2a0de，2026-10-11只读核查如下文件；没有安装或执行其代码，也未移植源码。

- DesktopOrganizationScanner.cs：用系统 DesktopDirectory / CommonDesktopDirectory 路径提供器。注意其组织扫描主体枚举用户目录；Dext 需自行落实合并公共目录，不直接照搬为“已经全覆盖”。
- FolderWatcherService.cs：FileSystemWatcher + 查询失效通知、批量防抖、代次、重连、溢出重载；值得借鉴增量更新与完整复核配合。
- ContentWidgetWindow.NativeDragDrop.cs / NativeDropTarget.cs：原生 HWND 拖放桥、OLE IDropTarget 与实际文件格式处理；Dext 的 WorkerW/WebView2 层级仍须单独验证。
- NativeDropEffectPolicy.cs：把拖动提示效果和完成效果分开，避免异步队列未落盘就授权源删除。
- ShellDesktopDropTarget.cs：核对指针下真实窗口/祖先与 Explorer 身份，不能“鼠标在屏幕范围”就判为桌面。

来源：[DeskBox仓库](https://github.com/Tianyu199509/DeskBox)；[监听源码](https://github.com/Tianyu199509/DeskBox/blob/22d29480bdcac98f636b94b2990ceff2b8f2a0de/src/DeskBox/Services/FolderWatcherService.cs)。项目为 GPL-3.0-only，直接复用时按项目现有上游归属规则保留来源/许可；此方案仅借鉴结构。

Windows依据：[Known Folders](https://learn.microsoft.com/en-us/windows/win32/shell/knownfolderid)、[IDropTarget](https://learn.microsoft.com/en-us/windows/win32/api/oleidl/nn-oleidl-idroptarget)、[IFileOperation](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nn-shobjidl_core-ifileoperation)。
