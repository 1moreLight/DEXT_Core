# CORE-003 Dext 一键启动防旧构建验收

- 状态：已完成
- 已合并分支：`fix/core-003-dext-startup-stale-binary`（已删除）
- 实现提交：`7d1b10e`
- master 合并提交：`8c7c89a`
- 目标：启动入口必须拒绝或自动替换当前 worktree 内残留的上游 Lively 旧二进制，并只在 Dext 身份验证通过后启动配置器。
- 范围外：不重命名 `Lively.exe` 或内部程序集/namespace；不修改 UI、Room、Dock、idle、安装器或用户 rooms；不删除仍有独立用途的 scripts。

## 复现证据

- 当前 master 旧输出路径：`D:\use\Orca\DEXT\DEXT_Core\lively-core-separation\src\Lively\Lively\bin\x64\Debug\net9.0-windows10.0.18362.0\Lively.exe`
- 复现 PID：41732（复现后已精确停止）
- 文件元数据：ProductName=`Lively`，FileDescription=`Lively`
- 运行结果：Dext mutex `DEXT:DESKTOPSHELL` 和 pipe `Grpc_DEXT:DESKTOPSHELLJAN` 均未创建；旧 `start.ps1` 等待后报身份验证失败，但遗留了错误进程。

## 自动检查

- [x] PowerShell 语法检查：`scripts/start.ps1`、`build.ps1`、`verify-runtime-identity.ps1`。
- [x] 从非 Dext/缺失 Core 输出开始运行入口，自动执行 `scripts/build.ps1 -Rebuild` 并生成 ProductName=`Dext` 的 Core，不依赖增量构建时间戳。
- [x] `scripts/start.ps1` 启动后通过 PID、绝对路径、ProductName、mutex、pipe、数据和日志验证。
- [x] `scripts/verify-runtime-identity.ps1` 报告 Core、Watchdog、配置器以及运行后 Player 的当前 worktree 路径。
- [x] Core 已为有效 Dext 构建时再次启动，不重复执行全量构建。
- [x] 新 worktree 缺少 `node_modules` 时自动执行 `npm ci`；npm/Tauri 失败时启动入口返回非零。
- [x] 模拟启动验证失败时，只停止本次由脚本启动的目标 PID，不停止其他安装或 worktree 的 `Lively.exe`。
- [x] `scripts/start-dext.cmd` 只调用 `start.ps1`，从 `C:\Windows\Temp` 能定位仓库脚本，并透传退出码。
- [x] scripts 审计：删除无引用且硬编码改写旧 Room 的 `dock-demo-inject.mjs`；保留并核对 build/start/preview/identity/schema 五类有效工具。
- [x] `git diff --check` 与 `git status --short` 通过，只包含本工作包具名文件。

## 人工验收

1. [x] 双击 `scripts/start-dext.cmd`，确认窗口明确显示正在检查或构建 Dext，而不是无提示启动旧 Lively。
2. [x] 配置器打开后确认顶部显示“Dext Core 已连接”，并能正常浏览和应用 Room。
3. [x] 运行 `scripts/verify-runtime-identity.ps1`，确认 Core、Player、Watchdog 和配置器路径都属于本工作包 worktree，产品身份、mutex、pipe 和数据目录均为 Dext。
4. [x] 退出 Dext Core 后再次双击 `start-dext.cmd`，确认能够直接启动且不会再次进行不必要的全量构建。
5. [x] 保持原版 Lively 存在时再启动 Dext，确认脚本只报告并忽略原版进程，不停止、复用或连接它。

## 通过标准

- 五项人工验收全部通过。
- 无论输出目录中是否残留旧 Lively 二进制，入口都不能把它当作 Dext 成功启动。
- 用户已确认通过；工作包已合并 master 并清理分支/worktree。

## 验收记录

- 2026-08-30：从 master 的真实旧 `Lively.exe`（ProductName/FileDescription 均为 Lively）覆盖测试输出，双击入口识别后执行强制四步重建，重建结果为 ProductName=`Dext`、FileDescription=`Dext Core`。
- 2026-08-30：运行 `cargo test --lib applies_room_wallpaper` 通过；`verify-runtime-identity.ps1` 随后确认 Core PID 77896、Watchdog PID 84688、Player PID 75640、配置器 PID 76020 全部属于 `D:\use\Orca\DEXT_Core\core-003-dext-startup`，mutex/pipe/data/log 均为 Dext。
- 2026-08-30：二次启动只验证已有 Dext 二进制，未重复四步 C# 构建；临时错误运行身份测试中，脚本在等待失败后精确停止本次启动的 PID 81688，身份文件已恢复且无内容差异。
- 2026-08-30：实现提交 `7d1b10e`；工作分支停在待验收，用户明确回复“通过”前不合并 master。
- 2026-08-30：用户回复“通过”，五项人工验收通过并授权合并 master。
- 2026-08-30：合并到 master（merge `8c7c89a`）；运行包测试变化保存为 stash `core-003 runtime test artifacts 2026-08-30`，用户 rooms 未触碰。
