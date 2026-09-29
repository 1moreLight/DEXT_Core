# V3-CORE-005 Core/Player 会话消息接线

- 状态：开发中
- 分支：`feat/V3-CORE-005-player-bridge`（基于 V3-P2A-001）
- 提交：待提交
- 目标：受信 Player 进程通过现有 Core 标准流通道接收 v3 会话快照、请求 Desk，并报告过渡完成。
- 范围外：P3 正式作品/安装格式、开放生产 v3 准入、原生 Dock/AppBar。

## 自动检查

- [x] 协议 29/29，含全量初始快照、错误 Desk、撤销准入、连接关闭和重连。
- [x] 隔离 Release Player 使用测试安装权威，经真实 Gateway 和 stdin/stdout 完成请求、快照切页、过渡回告；持续场景仍是同一文档，旧 v2 原生拖动 10/10 通过。
- [x] `scripts/build.ps1`、`node --check wallpapers/dext-room/main.js`、`git diff --check` 通过。
- [ ] `scripts/start.ps1` 与本分支运行身份核对；已尝试启动，脚本正确识别 P2a Core PID 115948 占用同一 Dext mutex/pipe 并拒绝误复用。P2a 配置器 PID 122760 按用户要求保持运行。

## 人工验收

1. 在本分支运行 `scripts/start.ps1`，再运行 `scripts/verify-runtime-identity.ps1`；确认 Core、Player 来自本 worktree，配置器可连接。
2. 运行 `dotnet build tests/Dext.Input.Tests -c Release`，再运行 `tests/Dext.Input.Tests/bin/Release/net9.0-windows/Dext.Input.Tests.exe lively-core-separation/src/Lively/Lively.Player.WebView2/bin/Release/Lively.Player.WebView2.exe`；确认输出 `PASS Gateway-to-Release Player v3 IPC`，它使用隔离临时 Room，不改变 WorkerW。
3. 运行 `dotnet run --project tests/Dext.RoomSession.ProtocolTests -c Release`；确认 29/29，特别是 Player 关闭/重连取得最新完整快照、撤销安装后拒绝请求。
4. 在正在使用的 v2 Room 验证图标、Dock 导航与布局保存行为照常。验证结束不需重铺壁纸。

## 通过标准

以上步骤有可复现证据；本包只完成受控传输，生产 v3 准入仍需 P3 安装身份验证与正式作品链。

## 验收记录

- 自动检查通过；真实 Core/配置器尚在 P2a worktree 运行，本分支启动核对待做。待用户确认。
