# DESK-SYNC-004 构建与统一验收交接

状态：开做

所有入口只对同步Desk生效；串行文件操作与退场取消，不因单个文件失败清空整个桌面。修改C#/proto后运行scripts/build.ps1再scripts/start.ps1；非验收时仅复用旧版CoreOnly，不多开配置器。完整候选在D盘新目录用build-v3-release.ps1生成、verify-v3-release-candidate.ps1核对。按独立验收卡验证真实关联打开/改名/剪贴板/回收恢复/右键/原输入；自动检查与用户验收分开。003尚缺门槛继续保留，未获通过不合master。

- [ ] 失败用例与实现
- [ ] 实际接线及必要检查
- [ ] 记录证据并提交

2026-10-11开工：第05步代码完成。先检查D盘依赖/构建缓存和17项宿主白名单，在全新desktop-shell-actions-clean-20261011候选目录执行build-v3-release.ps1，核对inventory与当前源；候选完整后再核对启动身份。现有Core26668保留，未部署的新输入与全部人工门槛明确交接；不在后台重复打开配置器。
