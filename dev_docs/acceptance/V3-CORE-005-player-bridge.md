# V3-CORE-005 Core/Player 会话消息接线

- 状态：开发侧验收通过，待用户决定合入
- 分支：`feat/V3-CORE-005-player-bridge`（基于 V3-P2A-001）
- 提交：`2e2c290`（真实接入与开发侧验收）
- 目标：配置器从本 worktree 连接真实 Core，并可应用一个经 Core 验证的最小 v3 Room；Core 的会话快照驱动真实 Player 切页和恢复。
- 范围外：完整 P3 创作者格式、原生 Dock/AppBar、游戏宿主。

## 自动检查

- [x] 协议 30/30，含安装样包与真实 Player PID 准入、全量快照、错误 Desk、撤销准入、连接关闭和重连。
- [x] 隔离 Release Player 使用测试安装权威，经真实 Gateway 和 stdin/stdout 完成请求、快照切页、过渡回告；持续场景仍是同一文档，旧 v2 原生拖动 10/10 通过。
- [x] `scripts/build.ps1`、`node --check wallpapers/dext-room/main.js`、`git diff --check` 通过。
- [x] `scripts/start.ps1` 从本分支启动；设置 `CARGO_TARGET_DIR=D:\use\Orca\DEXT\build-cache\v3-player-bridge` 后身份脚本显示 Core、Player、配置器、mutex 和 pipe 全项 OK，配置器正常窗口显示“Dext Core 已连接”。
- [x] 配置器应用 `v3-core-probe` 后，Core 日志记录实际 Player PID 31792、Room ID、会话 ID、修订 1；原生鼠标经官方 Dock 发送切页，Core RPC 报 `probe-a → probe-b`、修订 1→3，配置器同步显示 `v3 · probe-b`。
- [x] 重启三进程后，新 Player PID 110824 恢复 `probe-b`；切回原 `MSIroom` 后 v3 RPC 为 inactive，运行包 `session.v3.json` 已删除，旧 Room 原生拖动 10/10 与隔离 v3 IPC 回归通过。
- [x] Rust 50/50 单元测试（3 个需要改桌面的 live 测试未运行）、`npm run build`、`scripts/build.ps1`、JS 语法和 `git diff --check` 通过。

## 人工验收

1. 在本分支设置 `CARGO_TARGET_DIR=D:\use\Orca\DEXT\build-cache\v3-player-bridge`，运行 `scripts/build.ps1`、`scripts/start.ps1`、`scripts/verify-runtime-identity.ps1`；确认三进程全项 OK，配置器显示“Dext Core 已连接”。
2. 把 `rooms/v3-core-probe` 复制到配置器当前 Room 库，重开配置器，在“使用”页应用该样包；确认顶部出现 `v3 · probe-a`。运行 `dotnet run --project tests/Dext.Input.Tests -c Release -- --v3-live`，确认真实 Player 原生 Dock 点击使 Core 修订增长并显示 `probe-b`。
3. 重启 `scripts/start.ps1` 的三进程，再运行 `dotnet run --project tests/Dext.Input.Tests -c Release -- --v3-status probe-b`；确认恢复。切回原 v2 Room，运行同命令将参数改为 `inactive`，确认旧模式仍可用，然后删除 Room 库的测试副本。
4. 运行 `dotnet run --project tests/Dext.RoomSession.ProtocolTests -c Release`，确认 30/30；运行 `tests/Dext.Input.Tests/bin/Release/net9.0-windows/Dext.Input.Tests.exe lively-core-separation/src/Lively/Lively.Player.WebView2/bin/Release/Lively.Player.WebView2.exe`，确认隔离 Player 与旧 Room 原生输入回归。

## 通过标准

由开发侧执行并保留可复现证据；配置器、Core、Player 三进程使用本 worktree，v3 Room 由 Core 验证后接入内核并能切页、恢复；v2 仍可用。

## 验收记录

- 2026-09-30 用户明确要求由开发侧完成真实接入与验证，不依赖其人工验收。上述真实运行与恢复已由开发侧执行，测试副本已清理；当前工作分支尚未合入 master。
