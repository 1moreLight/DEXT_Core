# V3-CORE-004 会话存储故障收敛验收

- 状态：自动检查通过，待用户复核；按用户指示继续后续开发
- 分支：`feat/V3-CORE-004-storage-faults`（基于待复核的 V3-CORE-003 `959af6e`）
- 目标：checkpoint 暂时不可读写或清除时，受控会话返回可识别结果并保留原权威状态与有效订阅，恢复后可重试。
- 范围外：checkpoint 格式迁移、备份/云同步、P3 作品安装、真实传输、v2 播放链。

## 自动检查

- [x] Start/Restore/Complete/SetOperable/Stop 的预期 IO 与权限错误返回 `StorageUnavailable`，无半途快照或新修订泄露；意外编程错误仍传播。
- [x] 失败期间旧会话与订阅保持有效；存储恢复后相同操作可重试，桌面与 Dock 最终收敛。真实文件读取区分缺失/损坏与不可读。
- [x] 协议 27/27、内核 10/10；完整构建与启动、运行身份脚本全项 OK：Core PID 109820、Player PID 70460、配置器 PID 86232 均来自本 worktree。日志显示 `protocol=1` 与 `gateway admission=closed`；v2 Player 继续运行既有 Room URL。
- [x] `git diff --check` 通过，计划、实现和运行证据按大步具名提交。

## 人工验收

1. [ ] 运行 `dotnet run --project tests/Dext.RoomSession.ProtocolTests -c Release -- --demo`，核对存储故障有 `StorageUnavailable`，修复后重试被接受。
2. [ ] 核对故障时 SessionId/当前 Desk/修订号不变，旧订阅继续可用；重试后桌面和 Dock 收到同一快照。
3. [ ] 运行 `scripts/verify-runtime-identity.ps1`，核对 Core、Player、配置器来自本工作分支，协议生产准入仍关闭，v2 Room 未被接管。

## 通过标准

自动检查及三项人工步骤通过。此包只收敛可预期的 checkpoint 存储故障；真实传输适配器仍独立接入。

## 验收记录

- 用户已授权持续推进、每大步提交，不等待逐包人工复核；每包仍记录独立运行与回归证据。
- 2026-09-29：执行 `dotnet run --project tests/Dext.RoomSession.ProtocolTests -c Release -- --demo`；模拟存储故障时 Start/Complete 均返回 `StorageUnavailable`，旧 SessionId 保留、Desk=`home`、修订号不假增；存储恢复后 Complete 重试 `Accepted`，Desk=`work`，两个观察者快照相同。用户可按上面三步复核。
