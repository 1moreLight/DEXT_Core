# V3-CORE-001 Room/Desk 会话内核验收

- 状态：待验收
- 分支：`feat/V3-CORE-001-room-session-kernel`
- 提交：实现 `5398679`；待验收复核的时钟回拨修复在本分支后续提交
- 目标：让 Dext Core 拥有 v3 Room/Desk 权威状态、版本化快照、切页仲裁和安全恢复。
- 范围外：v2 壁纸运行链改造、Player/配置器正式 RPC、Room v3 Schema、个人绑定/权限、顶层 Dock 和游戏宿主。

## 自动检查

- [x] 内核回归 8/8：双视图、最后输入、超时/失焦、时钟回拨后自动重试、旧结果、checkpoint 恢复与停止清理；配置器 Vitest 62/62。
- [x] 修复后 `scripts/build.ps1` 成功；随后 `scripts/start.ps1` 启动本 worktree Core PID 58172、Player PID 104568、配置器 PID 110124；日志出现 `Dext Room session kernel ready | protocol=1`。
- [x] `git diff --check` 通过；具名文件提交信息见下方状态。

## 人工验收

1. [ ] 在本工作分支运行 `dotnet run --project tests/Dext.RoomSession.KernelTests -- --demo`；两份模拟视图读取同一会话与修订号，切页完成后都显示同一最终 Desk。
2. [ ] 在演示输出中核对：切换动画期间连续提出两个目标，只保留最后一个；失焦或超时会立即提交目标，恢复操作前不开始新切页。
3. [ ] 在演示输出中核对：切换到另一 Room 后，旧 Room 的完成消息被拒绝；重启读取 checkpoint 后，只有提供匹配的 Room/Desk 列表才能恢复已提交 Desk，停止后 checkpoint 清空。
4. [ ] 按验收卡记录的 Core 启动方式与 `scripts/verify-runtime-identity.ps1` 核对当前进程来自本 worktree；旧 v2 Room 仍可按原方式运行，未被新会话自动接管。

## 通过标准

- 四项人工步骤及自动检查均通过。此包是新 Core 会话基础；真实 Player/配置器接线必须另包验收，不能把演示输出当作完整 v3 运行链。

## 当前边界

- Core 已实例化新会话内核，但尚未有正式 v3 Room 安装入口或 Player/配置器协议接线；当前桌面仍由 v2 Player 恢复。身份脚本显示 Player 二进制来自本 worktree，壁纸 URL 仍指向用户先前的 `DEXT_Core-desk-reorder-002` Room。后续工作包须先校验安装内容，再向内核提供 Room/Desk 身份。

## 验收记录

- 待用户确认。
