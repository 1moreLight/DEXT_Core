# V3-CORE-002 版本化会话协议与受控入口验收

- 状态：开发中
- 分支：`feat/V3-CORE-002-session-protocol`
- 目标：Core 只接受版本匹配、来源授权且指向已校验安装 Room 的 v3 会话连接和命令。
- 范围外：真实 Player/配置器 RPC、Room v3 作品 Schema/安装签名、个人绑定与权限、v2 播放链改造。

## 自动检查

- [ ] 协议模拟客户端回归：版本不匹配、来源伪装、未知/撤销安装均拒绝且无快照泄露。
- [ ] 已授权的桌面与 Dock 客户端共享 Core 快照；角色权限、旧会话、错来源令牌被拒绝；断线重连取得完整最新快照。
- [ ] `scripts/build.ps1` 后执行 `scripts/start.ps1`，身份脚本确认本 worktree Core/Player/配置器和 v3 入口注册；旧 v2 Room 仍可使用。
- [ ] `git diff --check` 通过；每大步已独立提交。

## 人工验收

1. [ ] 运行 `dotnet run --project tests/Dext.RoomSession.ProtocolTests -- --demo`，核对错误版本、伪装来源和未安装 Room 均被拒绝。
2. [ ] 核对合法桌面和 Dock 连接得到同一 SessionId、修订号与 Desk；Dock 无法伪造动画完成，桌面完成后两者重连均看到相同最终 Desk。
3. [ ] 核对关闭连接、切换 Room 或撤销安装后旧连接无法写入；重新连接只取得经当前安装身份校验的完整快照。
4. [ ] 运行 `scripts/verify-runtime-identity.ps1`，核对 Core 来自本工作分支；当前 v2 Room 仍可运行且未被 v3 自动接管。

## 通过标准

- 自动检查与四项人工步骤通过。此包建立 Core 内部的受控协议边界；真实传输与作品安装验证须在后续工作包接入并重新验收。

## 验收记录

- 用户已授权继续开发并按大步提交，不等待本包人工验收后才推进下一步；运行与代码证据仍如实记录。
