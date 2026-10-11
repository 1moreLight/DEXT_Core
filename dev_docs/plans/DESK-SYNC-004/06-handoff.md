# DESK-SYNC-004 构建与统一验收交接

状态：待做

所有入口只对同步Desk生效；串行文件操作与退场取消，不因单个文件失败清空整个桌面。修改C#/proto后运行scripts/build.ps1再scripts/start.ps1；非验收时仅复用旧版CoreOnly，不多开配置器。完整候选在D盘新目录用build-v3-release.ps1生成、verify-v3-release-candidate.ps1核对。按独立验收卡验证真实关联打开/改名/剪贴板/回收恢复/右键/原输入；自动检查与用户验收分开。003尚缺门槛继续保留，未获通过不合master。

- [ ] 失败用例与实现
- [ ] 实际接线及必要检查
- [ ] 记录证据并提交
