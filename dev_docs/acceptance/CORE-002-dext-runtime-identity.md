# CORE-002 Dext Core 运行身份隔离验收

- 状态：验收反馈修复中
- 分支：`feat/core-002-dext-runtime-identity`
- 实施提交：`039d468`
- 目标：Dext 使用仓库内自带的 Lively Core fork，并以独立的单实例、管道、数据/日志目录和可验证进程路径运行，不依赖或误连用户另装的原版 Lively。
- 范围外：不修改或停止 DXT-002、DOCK-004 和用户 rooms；不实现 idle、Room zip、Dock、素材导入或 Player/Core 架构重构；不重命名内部 namespace、proto 包、源码目录和 Core/Player 可执行文件；不迁移旧 `%LOCALAPPDATA%\Lively Wallpaper` 数据；安装器/MSIX/AppUserModelId/屏保注册另立 PACKAGING-001。

## 身份审计

| 链路/名称 | 分类 | CORE-002 结论 |
|---|---|---|
| `ApplicationType.Name` | 必须改 | 由共享身份源返回 `Dext`；未打包 Core 的 LocalAppData 也由共享目录名直接派生。 |
| `SingleInstance.UniqueAppName` / mutex | 必须改 | 从 `LIVELY:DESKTOPWALLPAPERSYSTEM` 改为 `DEXT:DESKTOPSHELL`；实测两个 mutex 可同时存在。 |
| `PipeServerName` / `GrpcPipeServerName` | 必须改 | 保留用户名后缀，统一为 `Grpc_DEXT:DESKTOPSHELL<用户名>`；Core 与全部 C# 客户端继续读同一 `Constants`。 |
| Rust gRPC 客户端 | 必须改 | 不再手写 Lively pipe；编译时读取共享 JSON，每个业务 RPC 前先取 Core identity 并验证产品、identity、PID、pipe、data，Debug 还验证当前 worktree 路径。 |
| `GetCoreStatsResponse` | 必须改 | 向后兼容追加 `product_name/runtime_identity/process_id/app_data_directory/grpc_pipe_name` 字段，未改 RPC 名和原字段编号。 |
| AppData / Settings / layout / tokens / screenshots | 必须改 | 全部进入 `%LOCALAPPDATA%\Dext`；新 Settings 的 Library 为 `%LOCALAPPDATA%\Dext\Library`，`IsFirstRun` 由 Core 初始化后收口。 |
| Library / SaveData / 壁纸运行数据 | 必须改 | 继续从 `Settings.WallpaperDir` 派生，但默认根已隔离到 Dext；不读取或迁移旧 Lively Library。 |
| WebView2 / CEF / Mpv / theme / temp | 必须改 | Core 常量进入 `%TEMP%\Dext`；独立 CEF Player 的遗留硬编码也改为 Dext。 |
| NLog | 必须改 | NLog 运行时变量指向 `%LOCALAPPDATA%\Dext\logs`；首行记录 Dext、identity、PID、BaseDirectory、AppData、pipe 和版本。 |
| Windows Run 启动项 | 必须改 | 注册表 value 使用共享 `Dext`，值为当前 Core 绝对路径，不覆盖原版 Lively entry。 |
| `scripts/start.ps1` | 必须改 | 从“任意 `Lively.exe`”改为规范化绝对路径识别；其他安装/worktree 只报告，Dext mutex/pipe 与目标路径不一致时拒绝继续。 |
| Core / Player / Watchdog / 配置器启动路径 | 必须改 | Core 从当前 worktree 固定构建路径启动；Player/Watchdog 由该 Core 的 BaseDirectory 派生；只读验证脚本逐进程报告真实路径和命令行。 |
| 首次启动旧 WinUI | 必须改 | Core 完成目录/默认包初始化后自行清除 `IsFirstRun`；`RunnerService` 对所有旧 UI/Gallery/自定义/更新页面请求只记拒绝日志，不再 spawn `Lively.UI.WinUI.exe`。 |
| 原版 GitHub updater / Gallery | 必须改 | Core 不再注册或启动 updater，也不绑定 UpdateService；托盘不提供更新/Gallery/旧 UI 入口。上游实现源码保留作 fork 归属与未来参考。 |
| 托盘、错误框、日志、窗口标题 | 建议改 | 托盘名为 Dext，仅保留暂停/继续、关闭壁纸、退出 Dext；活动 Core 错误标题、配置器标题和日志均显示 Dext。 |
| Core / Player / Watchdog / Tauri 产品元数据 | 建议改 | Product/FileDescription 改为 Dext；Tauri/Cargo 包与进程名改为 `dext-configurator`，窗口仍为“Dext 配置器”。 |
| Tauri identifier `com.jan.tauri-ui` | 保留 | 改动会无意义地切断既有配置器本地状态；它不参与 Core mutex、pipe 或数据目录隔离。 |
| `Lively.exe`、Player/Watchdog 文件名 | 保留 | Core/Player 内部启动链和大量工具依赖这些文件名；运行身份已由 mutex/pipe/path proof 隔离，重命名收益低、风险高。 |
| 428 个 namespace/using 文件、14 个含 Lively 名称的 C# 项目文件 | 保留 | 纯源码/程序集兼容面，不造成跨产品实例、通信或数据冲突；本包全量重命名会形成高风险无用户价值重构。 |
| 10 份 Lively proto package 文件、RPC 方法名、`LivelyInfo` 类型 | 保留 | 属于 fork 内部技术协议；字段扩展已能证明 Dext 身份，无需破坏协议兼容。 |
| Core 多语言 Lively 资源和旧 WinUI 文案 | 保留 | 旧 WinUI 已不可达；资源同时记录上游类型/来源，批量翻牌会扩大无意义重构。活动错误框标题已直接改为 Dext。 |
| LICENSE / 上游 README / copyright / source links | 保留 | 属于 GPL、版权、来源和第三方致谢，不得改成 Dext 独占归属。 |
| Inno installer / MSIX Identity / AppUserModelId / 快捷方式 / 卸载信息 / 屏保注册 | 后续 | 当前仍含上游 AppId、安装目录和屏保 mutex/Core 定位；登记 `PACKAGING-001` 单独处理，避免把包装体系重构混入运行时隔离。 |

### 审计问题结论

1. 旧脚本确实会把任意原版/其他 worktree `Lively.exe` 当成已启动；新脚本实测在 DXT-002 PID 70596 存在时仍启动当前 Dext PID 84120。
2. 旧 Rust 客户端可能连接原版 pipe；新客户端只连接 Dext pipe，且身份或 Debug 路径不匹配时业务 RPC 全部拒绝。
3. 旧 Core 会共用 `%LOCALAPPDATA%\Lively Wallpaper`；新 Core 的 Settings、Library、layout 和 logs 实测位于 `%LOCALAPPDATA%\Dext`。
4. 新日志首行包含 Dext Core、identity、PID、BaseDirectory、AppData、pipe 和版本，可明确归属。
5. 新 Core、Player、Watchdog 和配置器实测均来自当前 worktree；其他 worktree 进程只以 `OTHER` 报告。
6. namespace、程序集、proto 包、`LivelyInfo`、源码目录和可执行文件名只是 fork 内部技术兼容面，不再承担运行身份。
7. 配置器、托盘、错误标题、日志和活动二进制元数据属于用户可见面，已改为 Dext。
8. LICENSE、上游 README/链接、版权和来源说明必须保留；全量 namespace/程序集/目录改名风险高且没有本轮用户价值。

## 自动检查

- [x] 共享身份源由 C#、Rust、PowerShell 读取；Dext mutex 为 `DEXT:DESKTOPSHELL`，管道为 `Grpc_DEXT:DESKTOPSHELL<用户名>`。
- [x] 两份 proto 规范化文本一致且 Rust 副本无 BOM；Rust 测试覆盖管道拼接、身份解析和错误产品/身份/Debug 路径拒绝。
- [x] `scripts/build.ps1` 通过，并在其后运行 `scripts/start.ps1`。
- [x] `npm run build`、`cargo check`、13 项非运行态 Rust 测试与 `cargo test --lib applies_room_wallpaper` 通过。
- [x] `scripts/verify-runtime-identity.ps1` 报告 Core、Watchdog、Player、配置器真实路径及 Dext mutex/pipe/data/log 状态。
- [x] 在已有非目标 `Lively.exe` 时，`scripts/start.ps1` 仍启动当前 worktree Core；发现同名 Dext pipe/mutex 属于其他路径时拒绝连接。
- [x] 配置器身份卡返回 Dext、当前 Core PID、当前 worktree BaseDirectory、Dext 管道和 `%LOCALAPPDATA%\Dext`；只读窗口检查显示“Dext Core 已连接”。
- [x] 新日志、Settings、Library、缓存只由 Dext 写入 Dext 路径；Dext Player 命令行不引用旧 Lively 数据目录。
- [x] Core、Player、配置器活动进程路径均属于当前 CORE-002 worktree/build；日志首行可证明 Dext Core 身份和路径。
- [x] 全量复查剩余 `Lively` 字样并完成分类；`git diff --check` 与 `git status --short` 清单核对通过。

### 自动检查记录

- 初次自动检查进程：Core PID 84120、Player PID 83644、Watchdog PID 78036、配置器 PID 81116；当时 DXT-002 Core PID 70596 及其 Player/Watchdog 保持运行且只标记为 `OTHER`。
- 验收反馈修复后进程：Core PID 85812、Player PID 75288、Watchdog PID 81044、配置器 PID 79680。
- Core：`D:\use\Orca\DEXT_Core\core-002-dext-runtime-identity\lively-core-separation\src\Lively\Lively\bin\x64\Debug\net9.0-windows10.0.18362.0\Lively.exe`。
- Player：`D:\use\Orca\DEXT_Core\core-002-dext-runtime-identity\lively-core-separation\src\Lively\Lively\bin\x64\Debug\net9.0-windows10.0.18362.0\plugins\webview2\Lively.Player.WebView2.exe`。
- 配置器：`D:\use\Orca\DEXT_Core\core-002-dext-runtime-identity\tauri-ui\src-tauri\target\debug\dext-configurator.exe`。
- 最新日志：`C:\Users\JAN\AppData\Local\Dext\Logs\20260830_185846.txt`；首行记录 Dext Core、identity、PID、BaseDirectory、AppData、pipe 和版本。
- 活动 Dext Player 的 `--wallpaper-user-data` 为 `%TEMP%\Dext\CEF\...`；Settings 的 `WallpaperDir` 为 `%LOCALAPPDATA%\Dext\Library`，`IsFirstRun=False`。
- 修改后 `codegraph status` 报当前 worktree 索引未初始化，无法执行 sync；未擅自 init，也未使用 Understand，最终字样分类使用只读搜索兜底。

## 人工验收

1. [ ] 电脑保留原版 Lively 安装。
2. [ ] 启动 Dext，确认启动的是当前工作包构建出的 Dext Core 和 Player。
3. [ ] 打开 Dext 配置器，确认身份状态显示 Dext Core，并可读取应用、应用 Room 和启动应用。
4. [ ] 确认配置器展示的 PID、Core 路径和管道均不属于原版 Lively。
5. [ ] 确认 Dext 日志、设置和运行数据写入 `%LOCALAPPDATA%\Dext`。
6. [ ] 启动或保持原版 Lively 进程存在，确认 Dext 启动脚本不会误报“Dext 已启动”。
7. [ ] 关闭 Dext，确认不会通过共享 mutex 或管道关闭、唤醒或控制原版 Lively。
8. [ ] 检查配置器、托盘、错误提示、日志首行和活动二进制产品信息显示 Dext。
9. [ ] 检查 LICENSE、上游 README/来源说明仍保留 Lively 的合法归属。

## 通过标准

- 自动检查全部通过，九项人工验收均符合预期。
- Dext 与原版 Lively 的 mutex、named pipe 和数据目录不重名；脚本和配置器不能误认、误连其他路径的 Core。
- 当前只保证运行身份可共存，不承诺两者同时控制 Windows WorkerW 桌面。
- 用户明确回复“通过”前不合并 master。

## 验收记录

- 2026-08-30：自动检查通过，实施提交 `039d468`；停在独立分支待用户按九步清单验收，未合并 master。
- 2026-08-30：用户反馈托盘退出 Core 后配置器仍显示已连接，且现有 `v1testRoom` 因 DXT-002 `idle` 字段被阻断。已增加两秒实时身份刷新、断线禁用应用入口与明确提示；`idle` 仅校验/透传/写回保留，不实现其功能。实测退出态显示“Dext Core 未运行”，重启后恢复“已连接”，含 `idle` Room 显示“已应用 v1testRoom”；源 `room.json` 前后 SHA-256 均为 `0875C31EFC19004EE9FE66BB040478995264208DEF2AF723D750E561E551AD78`。
