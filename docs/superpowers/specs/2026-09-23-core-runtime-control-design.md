# CORE-006 配置器 Core 运行控制设计

## 意图与成功标准

用户关闭或意外失去 Dext Core 后，配置器仍可留在屏幕上，并能从连接状态旁一键启动 Core；Core 正在运行时，同一位置能正常退出 Core。按钮明确写“启动 Core / 退出 Core”，不把壁纸暂停混入 Core 控制。

验收以真实 Dext 进程和桌面为准：从当前配置器所属 worktree 启动 Core，等待正确产品、运行身份、Pipe、进程路径和 WorkerW 初始化；退出后配置器仍运行；再次启动后沿用 Core 既有的壁纸布局恢复。连续两轮无重复实例。

## 当前链路

配置器 React 每两秒调用 Tauri `core_identity`，Rust 通过 Dext named pipe 读取 Core `GetCoreStats` 并验证产品、运行身份、Pipe、数据目录和开发态 worktree。顶栏只有状态，没有启动/退出入口。Core 的 `CommandsService/ShutDown` 已存在；托盘的“退出 Dext Core”调用同一正常退出流程。Core 启动时已调用 `RestoreWallpaper()`。

## 交互和状态

| Core 状态 | 顶栏文字 | 按钮 |
|---|---|---|
| Pipe 不存在 | Dext Core 未运行 | 启动 Core |
| 身份正确且桌面已初始化 | Dext Core 已连接 | 退出 Core |
| 身份正确但桌面未初始化 | Dext Core 桌面未就绪 | 退出 Core |
| 有 Pipe 但身份错误或连接异常 | Dext Core 连接异常 | 不提供可能影响其他实例的操作，显示错误 |
| 操作进行中 | 启动中／退出中 | 按钮禁用 |

按钮动作不需要二次确认。失败保留配置器和非 Core 功能，顶栏显示可读错误；轮询仍持续，Core 后续自行就绪时状态自动恢复。暂停壁纸继续由现有托盘提供；使用页“停止壁纸”仍只关闭壁纸。

## 后端边界

新 Tauri `start_core` 和 `exit_core` 命令不接受前端提供的文件路径或 PID。`start_core` 仅从配置器自身位置推导同一 worktree 的 Core 路径；发布包仅接受与配置器同目录的 Core。缺少二进制时明确报错，不在 UI 内构建。启动前检查 Dext Pipe；若 Pipe 存在但身份错误，拒绝另起进程。启动单飞；等待 Core 身份正确、路径匹配且 `is_core_initialized` 为真，超时报告状态。`exit_core` 先验证身份，再调用现有 `CommandsService/ShutDown`，以已验证 PID 的退出为完成条件；不强杀其他进程。

Rust 命令返回结构化成功或可读错误，React 随后立即刷新运行状态，同时保留两秒轮询作为外部变化兜底。Core 未就绪时依赖桌面的应用动作禁用。

## 验证

Rust 单元测试覆盖路径推导、错误路径拒绝和启动状态判定；前端测试覆盖每种状态的文案及按钮动作。运行 `cargo test --lib`、`cargo check`、`npm test`、`npm run build`。活体验收覆盖从正确 worktree 启动、退出、恢复与重复操作；跨 worktree 身份冲突由回归测试验证，不为此启动另一工作区 Core。只读检查进程路径、Pipe 和壁纸布局，不运行会改写 Room 的测试。
