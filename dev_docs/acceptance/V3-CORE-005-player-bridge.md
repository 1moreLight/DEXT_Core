# V3-CORE-005 Core/Player 会话消息接线

- 状态：开发中
- 分支：`feat/V3-CORE-005-player-bridge`（基于 V3-P2A-001）
- 提交：待提交
- 目标：受信 Player 进程通过现有 Core 标准流通道接收 v3 会话快照、请求 Desk，并报告过渡完成。
- 范围外：P3 正式作品/安装格式、开放生产 v3 准入、原生 Dock/AppBar。

## 自动检查

- [ ] 协议/传输测试覆盖初始快照、修订、错误会话、撤销准入、连接关闭和重连。
- [ ] 官方页面测试覆盖快照驱动切页与旧 v2 自主切页。
- [ ] `scripts/build.ps1`、`scripts/start.ps1` 和运行身份核对通过。

## 人工验收

1. 在本分支运行 `scripts/start.ps1`，再运行 `scripts/verify-runtime-identity.ps1`；确认 Core、Player 来自本 worktree，配置器可连接。
2. 用本包附带的受控验证入口打开临时 v3 Room，点击上一页/下一页；页面按 Core 快照切换，日志中的会话 ID 与修订号连续，连续场景不重建。
3. 关闭并重新打开 Player；新 Player 先收当前完整快照，Desk 与 Core 一致；旧 Player 不能再发起切页。
4. 回到现有 v2 Room；图标、Dock 导航和布局保存行为照常。验证结束恢复原壁纸。

## 通过标准

以上步骤有可复现证据；未验证安装身份前不得把生产 v3 准入标为开放。

## 验收记录

- 待实现与用户确认。
