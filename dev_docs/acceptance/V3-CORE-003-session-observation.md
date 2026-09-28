# V3-CORE-003 受控会话快照订阅验收

- 状态：自动检查通过，待用户复核；按用户指示继续后续开发
- 分支：`feat/V3-CORE-003-session-observation`（基于待复核的 V3-CORE-002 `f1764c5`）
- 目标：受信任桌面与 Dock 连接按修订收到 Core 完整会话快照，旧连接及失效安装不能继续读取或接收推送。
- 范围外：真实 Player/配置器 RPC、P3 安装内容校验、v2 播放链、启动/待机规则。

## 自动检查

- [x] 双视图初始快照相同；Desk 过渡与提交均推送修订 1,2,3；断线重连获取完整最新快照。
- [x] 错误来源不能订阅；关闭连接、撤销/更换安装、更换会话后旧订阅不再接收快照；观察者异常不影响其他视图。并发关闭与初始回调重入回归通过。
- [x] 协议 21/21、内核 8/8；完整构建、启动和运行身份核对通过：Core PID 88456、Player PID 107984、配置器 PID 110820 均来自本 worktree。日志显示 `protocol=1` 与 `gateway admission=closed`；旧 v2 Player 继续运行既有 Room URL。
- [x] `git diff --check` 通过；计划、订阅行为、运行证据按大步具名提交。

## 人工验收

1. [ ] 运行 `dotnet run --project tests/Dext.RoomSession.ProtocolTests -c Release -- --demo`，核对桌面与 Dock 收到相同 SessionId/修订号/Desk 序列。
2. [ ] 核对关闭连接、撤销安装和切换会话后旧订阅计数不再增加；重连拿到最新完整快照。
3. [ ] 运行 `scripts/verify-runtime-identity.ps1`，核对 Core 来自本工作分支、协议入口仍为关闭准入；当前 v2 Room 未被接管。

## 通过标准

自动检查及三项人工步骤通过。订阅只在 Core 内部供模拟客户端使用；真实传输和作品安装权威另包接入。

## 验收记录

- 用户已授权持续开发、每大步提交，不等待逐包人工复核后才继续；每包仍保留独立验收证据。
- 2026-09-29：执行 `dotnet run --project tests/Dext.RoomSession.ProtocolTests -c Release -- --demo`；桌面与 Dock 都收到修订 1,2,3，关闭旧桌面后其事件数保持 3、Dock 到 5，更换安装/会话后旧 Dock 仍保持 5。用户可按上面三步复核；生产入口仍关闭。
